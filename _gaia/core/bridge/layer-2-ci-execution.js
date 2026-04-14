/**
 * E17-S9: Bridge Layer 2 — CI Execution Mode
 *
 * CI-mode peer of Layer 2 local execution (E17-S6). Instead of spawning a
 * subprocess locally, Layer 2 CI triggers a remote CI workflow run via the
 * GitHub Actions `gh` CLI, polls the run until completion, and retrieves
 * the run log for Layer 3 parsing.
 *
 * When `gh` is not on PATH or the CLI is not authenticated, the module
 * delegates to the injected `executeLocal` fallback (AC4) so the bridge
 * never stalls on missing CI infrastructure.
 *
 * Polling is capped at the NFR-033 5-minute (300 second) budget. Any
 * config `timeout_seconds` larger than 300 is clamped to the hard cap.
 *
 * Inputs:
 *   runnerManifest: { runner_name, command, tier }
 *   config:         { bridge_enabled, mode, ci_workflow, timeout_seconds?, poll_interval_seconds? }
 *   deps:           { ghCheck, runCli, sleep, now, executeLocal } — injected
 *                   for testability. Defaults use real gh + child_process.
 *                   runCli contract: (argv: string[]) => Promise<{exit_code, stdout, stderr}>
 *                   All commands use argv-array spawn (shell: false) per E17-S19.
 *
 * Output (executed):
 *   {
 *     mode: "ci",
 *     run_id,             // numeric run ID from gh run list
 *     conclusion,         // "success" | "failure" | "cancelled" | ...
 *     exit_code,          // 0 on success, 1 otherwise
 *     stdout,             // CI run log (passed to Layer 3)
 *     stderr,             // captured stderr from gh calls
 *     timed_out,          // true when polling exceeded the cap
 *     timeout_seconds,    // the cap that was applied
 *     evidence?           // only present on timeout
 *   }
 *
 * Output (fallback — gh unavailable/unauthenticated):
 *   ExecutionResult + { fallback: "local", fallback_reason }
 *
 * Output (bypassed — bridge_enabled: false):
 *   { bypassed: true }
 *
 * Traces to: FR-197, NFR-033, ADR-028
 * Test cases: TEB-37 to TEB-39
 */

import { spawn } from "child_process";
import { assertInScope, assertCiWorkflowAllowed } from "./bridge-scope-guard.js";

// ─── Hard caps ─────────────────────────────────────────────────────────────

// NFR-033: CI polling budget is a hard 5-minute cap. Any config value larger
// than this is clamped silently — the bridge never waits longer than 300s.
const HARD_CAP_TIMEOUT_SECONDS = 300;

// Default polling cadence — aligns with the story guidance (15s per poll).
// Callers can override via config.poll_interval_seconds.
const DEFAULT_POLL_INTERVAL_SECONDS = 15;

// ─── Real CLI runner (used when deps.runCli is not injected) ──────────────

function defaultRunCli(argv) {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", (err) => {
      stderr += `\n[layer-2-ci] subprocess error: ${err.message}`;
    });
    child.on("close", (code) => {
      resolve({ exit_code: code ?? 1, stdout, stderr });
    });
  });
}

// Default gh availability/auth probe — returns { available, authenticated }.
async function defaultGhCheck(runCli) {
  const which = await runCli(["gh", "--version"]);
  if (which.exit_code !== 0) {
    return { available: false, authenticated: false };
  }
  const auth = await runCli(["gh", "auth", "status"]);
  return { available: true, authenticated: auth.exit_code === 0 };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function resolveTimeout(configTimeout) {
  const requested =
    typeof configTimeout === "number" && configTimeout > 0
      ? configTimeout
      : HARD_CAP_TIMEOUT_SECONDS;
  return Math.min(requested, HARD_CAP_TIMEOUT_SECONDS);
}

function resolvePollInterval(configInterval) {
  return typeof configInterval === "number" && configInterval > 0
    ? configInterval
    : DEFAULT_POLL_INTERVAL_SECONDS;
}

// Trigger the CI workflow run and discover its run ID.
async function triggerRun(ciWorkflow, runCli) {
  const triggerResult = await runCli(["gh", "workflow", "run", ciWorkflow]);
  if (triggerResult.exit_code !== 0) {
    return { ok: false, stderr: triggerResult.stderr || "gh workflow run failed" };
  }
  // Discover the run ID from the most recent run of this workflow.
  const listResult = await runCli(["gh", "run", "list", "--workflow", ciWorkflow, "--limit", "1", "--json", "databaseId,status"]);
  if (listResult.exit_code !== 0) {
    return { ok: false, stderr: listResult.stderr || "gh run list failed" };
  }
  const parsed = parseJsonSafe(listResult.stdout);
  if (!Array.isArray(parsed) || parsed.length === 0 || typeof parsed[0].databaseId !== "number") {
    return { ok: false, stderr: "Could not parse run ID from gh run list output" };
  }
  return { ok: true, run_id: parsed[0].databaseId };
}

// Poll the run until it reaches a terminal state or the timeout elapses.
async function pollUntilComplete(runId, { timeoutMs, intervalMs, runCli, sleep, now }) {
  const start = now();
  let lastStatus = null;
  let lastConclusion = null;
  // Loop bound — prevents runaway in tests with broken `now` clocks.
  const maxIterations = 10000;
  for (let i = 0; i < maxIterations; i += 1) {
    const elapsed = now() - start;
    if (elapsed >= timeoutMs) {
      return {
        timed_out: true,
        elapsed_ms: elapsed,
        last_status: lastStatus,
        last_conclusion: lastConclusion,
      };
    }
    const viewResult = await runCli(["gh", "run", "view", String(runId), "--json", "status,conclusion"]);
    if (viewResult.exit_code === 0) {
      const parsed = parseJsonSafe(viewResult.stdout);
      if (parsed) {
        lastStatus = parsed.status;
        lastConclusion = parsed.conclusion;
        if (parsed.status === "completed") {
          return {
            timed_out: false,
            elapsed_ms: now() - start,
            last_status: parsed.status,
            last_conclusion: parsed.conclusion,
          };
        }
      }
    }
    await sleep(intervalMs);
  }
  return {
    timed_out: true,
    elapsed_ms: now() - start,
    last_status: lastStatus,
    last_conclusion: lastConclusion,
  };
}

async function fetchRunLog(runId, runCli) {
  const result = await runCli(["gh", "run", "view", String(runId), "--log"]);
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exit_code: result.exit_code,
  };
}

function conclusionToExitCode(conclusion) {
  // Success-like conclusions → 0. Everything else → 1.
  if (conclusion === "success" || conclusion === "skipped" || conclusion === "neutral") {
    return 0;
  }
  return 1;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Execute the runner manifest command via a CI workflow run.
 *
 * @param {{runner_name: string, command: string, tier?: number}} runnerManifest
 * @param {{
 *   bridge_enabled: boolean,
 *   mode?: "local"|"ci",
 *   ci_workflow?: string,
 *   timeout_seconds?: number,
 *   poll_interval_seconds?: number,
 * }} config
 * @param {{
 *   ghCheck?: Function,
 *   runCli?: Function,
 *   sleep?: Function,
 *   now?: Function,
 *   executeLocal?: Function,
 * }} [deps]
 */
export async function executeCi(runnerManifest, config = {}, deps = {}) {
  // NFR-035: bridge_enabled: false short-circuits before any other guard.
  if (config.bridge_enabled === false) {
    return { bypassed: true };
  }

  if (!runnerManifest || typeof runnerManifest !== "object") {
    throw new TypeError(
      "Layer 2 CI: runnerManifest is required (expected object with runner_name and command)."
    );
  }

  const mode = config.mode ?? "ci";
  if (mode !== "ci") {
    throw new Error(
      `Layer 2 CI: invalid mode "${mode}" — CI execution requires mode: "ci". Local mode is handled by Layer 2 local (E17-S6).`
    );
  }

  if (!config.ci_workflow || typeof config.ci_workflow !== "string") {
    throw new Error(
      "Layer 2 CI: config.ci_workflow is required (expected the workflow filename, e.g., 'ci.yml')."
    );
  }

  // E17-S13 / FR-203 — Defence in depth: even before the gh CLI is
  // invoked, reject runner commands that contain shell operators. The
  // command is later interpreted in CI logs and occasionally fed back to
  // local fallbacks (AC4), so it must pass the same scope guard as
  // Layer 2 local.
  if (runnerManifest.command !== undefined) {
    assertInScope(runnerManifest.command);
  }

  // E17-S13 / AC3 — CI workflow allowlist. When `allowedWorkflows` is
  // supplied, the ci_workflow value MUST match an entry on the list and
  // MUST NOT contain shell metacharacters. Missing allowlist preserves
  // backward compatibility for projects that opted into the bridge
  // before the whitelist was introduced.
  if (config.allowedWorkflows !== undefined) {
    assertCiWorkflowAllowed(config.ci_workflow, config.allowedWorkflows);
  }

  const runCli = deps.runCli || defaultRunCli;
  const ghCheck = deps.ghCheck || (() => defaultGhCheck(runCli));
  const sleep = deps.sleep || defaultSleep;
  const now = deps.now || (() => Date.now());

  // ─── AC4: gh availability / auth fallback ──────────────────────────────
  const ghStatus = await ghCheck();
  if (!ghStatus.available || !ghStatus.authenticated) {
    const reason = !ghStatus.available
      ? "gh CLI not available on PATH"
      : "gh CLI not authenticated (run `gh auth login`)";
    const fallback = deps.executeLocal;
    if (typeof fallback === "function") {
      const localResult = await fallback(runnerManifest, {
        ...config,
        mode: "local",
      });
      return {
        ...localResult,
        fallback: "local",
        fallback_reason: reason,
      };
    }
    // No fallback supplied — still return a structured result so callers
    // can react without the CI call hanging.
    return {
      mode: "ci",
      fallback: "local",
      fallback_reason: reason,
      exit_code: 1,
      stdout: "",
      stderr: `[layer-2-ci] ${reason} — no local fallback supplied`,
      timed_out: false,
      timeout_seconds: resolveTimeout(config.timeout_seconds),
    };
  }

  // ─── AC5: resolve timeout cap (clamped to NFR-033) ─────────────────────
  const timeoutSeconds = resolveTimeout(config.timeout_seconds);
  const intervalSeconds = resolvePollInterval(config.poll_interval_seconds);

  // ─── AC1: trigger CI run ───────────────────────────────────────────────
  const trigger = await triggerRun(config.ci_workflow, runCli);
  if (!trigger.ok) {
    return {
      mode: "ci",
      exit_code: 1,
      stdout: "",
      stderr: trigger.stderr,
      timed_out: false,
      timeout_seconds: timeoutSeconds,
    };
  }

  // ─── AC2: poll until terminal or timeout ───────────────────────────────
  const pollResult = await pollUntilComplete(trigger.run_id, {
    timeoutMs: timeoutSeconds * 1000,
    intervalMs: intervalSeconds * 1000,
    runCli,
    sleep,
    now,
  });

  // ─── AC5: timeout path with evidence ───────────────────────────────────
  if (pollResult.timed_out) {
    return {
      mode: "ci",
      run_id: trigger.run_id,
      conclusion: pollResult.last_conclusion,
      exit_code: 1,
      stdout: "",
      stderr: `[layer-2-ci] polling timed out after ${timeoutSeconds}s`,
      timed_out: true,
      timeout_seconds: timeoutSeconds,
      evidence: {
        event: "timeout",
        timeout_seconds: timeoutSeconds,
        run_id: trigger.run_id,
        runner: runnerManifest.runner_name,
        terminated_at: new Date().toISOString(),
        last_status: pollResult.last_status,
      },
    };
  }

  // ─── AC3: fetch run log and return to Layer 3 ──────────────────────────
  const logResult = await fetchRunLog(trigger.run_id, runCli);

  return {
    mode: "ci",
    run_id: trigger.run_id,
    conclusion: pollResult.last_conclusion,
    exit_code: conclusionToExitCode(pollResult.last_conclusion),
    stdout: logResult.stdout,
    stderr: logResult.stderr,
    timed_out: false,
    timeout_seconds: timeoutSeconds,
  };
}
