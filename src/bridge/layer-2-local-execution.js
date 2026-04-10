/**
 * E17-S6: Bridge Layer 2 — Local Execution Mode
 *
 * Third layer of the Test Execution Bridge (ADR-028, architecture §10.20).
 * Layer 2 receives the runner manifest from Layer 1 and executes the
 * declared test command as a local subprocess. It enforces a hard
 * timeout (NFR-033, default 300s), captures stdout/stderr/exit code
 * for Layer 3, and respects the bridge_enabled opt-in (NFR-035).
 *
 * Scope constraint (FR-203): Layer 2 only invokes the exact command
 * supplied in the runner manifest. Shell chaining operators and command
 * substitution are rejected BEFORE spawn to mitigate threats T22
 * (execution timeout) and T23 (subprocess runaway).
 *
 * Inputs:
 *   runnerManifest: { runner_name, command, tier }
 *   config:         { bridge_enabled, mode, timeout_seconds, cwd? }
 *
 * Output (executed):
 *   {
 *     command,          // the command that was invoked
 *     exit_code,        // process exit code
 *     stdout,           // captured stdout (string)
 *     stderr,           // captured stderr (string)
 *     timed_out,        // boolean — true if timeout was hit
 *     timeout_seconds,  // the timeout that was applied
 *     evidence?         // only present on timeout
 *   }
 *
 * Output (bypassed — bridge_enabled: false):
 *   { bypassed: true }
 *
 * Traces to: FR-197, FR-203, NFR-033, NFR-035, ADR-028
 * Test cases: TEB-26 to TEB-30
 */

import { spawn } from "child_process";
import { assertInScope, assertCommandAllowed } from "./bridge-scope-guard.js";

// ─── Defaults ──────────────────────────────────────────────────────────────

// NFR-033: local execution must cap at < 5 minutes (300 seconds).
const DEFAULT_TIMEOUT_SECONDS = 300;

// Grace period between SIGTERM and SIGKILL when the subprocess ignores the
// initial termination signal. Kept small so orphan processes cannot linger.
const SIGKILL_GRACE_MS = 2000;

// ─── Scope guard (FR-203) — shared module ─────────────────────────────────
//
// FR-203 scope enforcement lives in src/bridge/bridge-scope-guard.js so
// Layer 2 local and Layer 2 CI both route through the same policy. This
// module imports the guards and applies them before any subprocess is
// spawned — a compromised command string can never reach `spawn`.

// ─── Exit code interpretation ──────────────────────────────────────────────

/**
 * Interpret a subprocess exit code as a pass/fail signal for Layer 3.
 *
 * @param {number} code
 * @returns {"pass" | "fail"}
 */
export function interpretExitCode(code) {
  return code === 0 ? "pass" : "fail";
}

// ─── Subprocess runner ─────────────────────────────────────────────────────

/**
 * Spawn the command inside a shell so the full command string (including
 * arguments) is honoured, while still enforcing our scope guard above.
 *
 * The returned promise resolves with { exit_code, stdout, stderr,
 * timed_out, termination_signal } and never rejects — subprocess errors
 * are recorded on stderr and surfaced via a non-zero exit code.
 */
function runSubprocess(command, timeoutSeconds, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd: cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let terminationSignal = null;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const termTimer = setTimeout(() => {
      timedOut = true;
      terminationSignal = "SIGTERM";
      try {
        child.kill("SIGTERM");
      } catch {
        /* subprocess may have exited between check and kill */
      }

      // Escalate to SIGKILL if the child ignores SIGTERM within the grace
      // window — mitigates T23 (subprocess runaway).
      setTimeout(() => {
        if (!child.killed && child.exitCode === null) {
          terminationSignal = "SIGKILL";
          try {
            child.kill("SIGKILL");
          } catch {
            /* already gone */
          }
        }
      }, SIGKILL_GRACE_MS);
    }, timeoutSeconds * 1000);

    child.on("error", (err) => {
      // spawn-level failure (e.g., command not found) — record on stderr.
      stderr += `\n[layer-2] subprocess error: ${err.message}`;
    });

    child.on("close", (code, signal) => {
      clearTimeout(termTimer);
      // When timed_out was not flagged but the child terminated via a
      // signal anyway (e.g., external kill), surface the signal name.
      if (!timedOut && signal) {
        terminationSignal = signal;
      }
      resolve({
        exit_code: code ?? (signal ? 1 : 0),
        stdout,
        stderr,
        timed_out: timedOut,
        termination_signal: terminationSignal,
      });
    });
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RunnerManifestEntry
 * @property {string} runner_name — e.g., "vitest", "jest", "node"
 * @property {string} command     — CLI command to invoke
 * @property {number} [tier]      — optional tier classification
 */

/**
 * @typedef {Object} BridgeConfig
 * @property {boolean} bridge_enabled — NFR-035 opt-in toggle
 * @property {"local" | "ci"} [mode]  — execution mode (Layer 2 = local only)
 * @property {number} [timeout_seconds] — NFR-033 timeout, default 300
 * @property {string} [cwd]           — working directory (default process.cwd())
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {string}  command
 * @property {number}  exit_code
 * @property {string}  stdout
 * @property {string}  stderr
 * @property {boolean} timed_out
 * @property {number}  timeout_seconds
 * @property {object=} evidence — only present on timeout
 *
 * @typedef {{ bypassed: true }} BypassResult
 */

/**
 * Execute the runner manifest command locally and capture results.
 *
 * @param {RunnerManifestEntry} runnerManifest
 * @param {BridgeConfig} config
 * @returns {Promise<ExecutionResult | BypassResult>}
 */
export async function executeLocal(runnerManifest, config = {}) {
  // AC7 / NFR-035: bridge_enabled: false → short-circuit before any other
  // guard, before any spawn. Mode guard is intentionally bypassed here so
  // callers that have not yet populated `mode` still get a clean bypass.
  if (config.bridge_enabled === false) {
    return { bypassed: true };
  }

  if (!runnerManifest || typeof runnerManifest !== "object") {
    throw new TypeError(
      "Layer 2: runnerManifest is required (expected object with runner_name and command)."
    );
  }

  const { runner_name, command } = runnerManifest;

  // AC6: mode guard — Layer 2 handles the local path only. CI mode is
  // served by a separate Layer 2 module (E17-S9) and must not fall through.
  const mode = config.mode ?? "local";
  if (mode !== "local") {
    throw new Error(
      `Layer 2: invalid mode "${mode}" — local execution requires mode: "local". CI mode is handled by Layer 2 CI (E17-S9).`
    );
  }

  // FR-203 scope guard — rejects chaining/substitution/redirection before
  // any subprocess is spawned.
  assertInScope(command);

  // E17-S13 / AC2: if the caller supplies an explicit runner allowlist
  // (sourced from test-environment.yaml or package.json), enforce it.
  // When allowedCommands is absent the guard is skipped to preserve
  // backward compatibility with projects that opted into the bridge
  // before the whitelist was introduced.
  if (config.allowedCommands !== undefined) {
    assertCommandAllowed(command, config.allowedCommands);
  }

  const timeoutSeconds =
    typeof config.timeout_seconds === "number" && config.timeout_seconds > 0
      ? config.timeout_seconds
      : DEFAULT_TIMEOUT_SECONDS;

  const { exit_code, stdout, stderr, timed_out, termination_signal } = await runSubprocess(
    command,
    timeoutSeconds,
    config.cwd
  );

  /** @type {ExecutionResult} */
  const result = {
    command,
    exit_code,
    stdout,
    stderr,
    timed_out,
    timeout_seconds: timeoutSeconds,
  };

  if (timed_out) {
    result.evidence = {
      event: "timeout",
      timeout_seconds: timeoutSeconds,
      runner: runner_name,
      terminated_at: new Date().toISOString(),
      termination_signal: termination_signal || "graceful",
    };
  }

  return result;
}
