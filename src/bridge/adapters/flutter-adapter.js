/**
 * E25-S4: Flutter and Dart Stack Adapter
 *
 * Plugs into the E25-S5 adapter registry and satisfies the StackAdapter
 * contract (architecture §10.20.11.1). A single adapter handles both Flutter
 * and pure Dart projects because Flutter's `flutter test --machine` wraps
 * `package:test` and emits the same line-delimited JSON event schema as
 * `dart test --reporter json`. The `discoverRunners` layer branches between
 * the two commands based on whether `pubspec.yaml` declares a top-level
 * `flutter:` section.
 *
 * Responsibilities:
 *   - Layer 0: readinessCheck — detect flutter or dart on PATH + pubspec.yaml
 *   - Layer 1: discoverRunners — parse pubspec.yaml, branch flutter vs dart,
 *              emit Tier 1 (test/) and Tier 3 (integration_test/) when present,
 *              else a single all-tier fallback
 *   - Layer 3: parseOutput — streaming JSON event parser correlating testStart
 *              and testDone by integer testID; tolerant of truncated streams
 *
 * Detection semantics: AND over `pubspec.yaml` (single-file detection).
 * No new runtime dependencies — js-yaml is already in devDependencies.
 *
 * Traces to: FR-311, NFR-047, ADR-028, ADR-038, architecture §10.20.11
 */

import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { execFileSync as realExecFileSync } from "child_process";
import yaml from "js-yaml";

// ─── Constants ──────────────────────────────────────────────────────────────

const DETECTION_PATTERNS = ["pubspec.yaml"];

const FLUTTER_COMMAND = "flutter test --machine";
const DART_COMMAND = "dart test --reporter json";

const STDERR_SNIPPET_MAX = 2048;
const RAW_OUTPUT_SNIPPET_MAX = 2048;

const REMEDIATION = {
  missingPubspec: "pubspec.yaml not found at project root",
  missingFlutter: "flutter CLI not found on PATH — install Flutter SDK from https://flutter.dev",
  missingDart: "dart CLI not found on PATH — install Dart SDK from https://dart.dev/get-dart",
};

// ─── Layer 0 helpers ────────────────────────────────────────────────────────

function cliAvailable(execFile, bin) {
  try {
    execFile(bin, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasPubspec(projectPath) {
  return existsSync(join(projectPath, "pubspec.yaml"));
}

function readPubspec(projectPath) {
  try {
    const raw = readFileSync(join(projectPath, "pubspec.yaml"), "utf8");
    return yaml.load(raw) || {};
  } catch {
    return null;
  }
}

/**
 * Is this project a Flutter project (top-level `flutter:` section in pubspec.yaml)?
 * Returns false for pure Dart libraries that only declare `dependencies.flutter` etc.
 */
function isFlutterProject(pubspec) {
  if (!pubspec || typeof pubspec !== "object") return false;
  return Object.prototype.hasOwnProperty.call(pubspec, "flutter");
}

function hasDir(projectPath, name) {
  try {
    return statSync(join(projectPath, name)).isDirectory();
  } catch {
    return false;
  }
}

// ─── Layer 0: readinessCheck ────────────────────────────────────────────────

/**
 * Readiness check for Flutter/Dart projects (AC2).
 *
 * @param {string} projectPath
 * @param {object} [options]
 * @param {function} [options._execFile] - execFileSync override (tests only)
 * @returns {object}
 */
function readinessCheck(projectPath, options = {}) {
  const started = Date.now();
  const execFile = options._execFile || realExecFileSync;

  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("readinessCheck: projectPath is required");
  }

  // NFR-035 bridge_enabled guard — parity with other adapters.
  if (options?.test_execution_bridge?.bridge_enabled === false) {
    return {
      passed: true,
      remediation: null,
      ready: true,
      skipped: true,
      checks: [],
      remediations: [],
      report: "",
      elapsedMs: Date.now() - started,
    };
  }

  const checks = [];

  const pubspecOk = hasPubspec(projectPath);
  checks.push({
    name: "pubspec",
    passed: pubspecOk,
    remediation: pubspecOk ? null : REMEDIATION.missingPubspec,
  });

  // If pubspec exists, determine whether this is a Flutter or pure Dart project.
  // Then check for the appropriate toolchain binary.
  let pubspec = null;
  let flutterProject = false;
  if (pubspecOk) {
    pubspec = readPubspec(projectPath);
    flutterProject = isFlutterProject(pubspec);
  }

  const flutterOk = flutterProject ? cliAvailable(execFile, "flutter") : null;
  const dartOk = !flutterProject ? cliAvailable(execFile, "dart") : null;

  if (flutterProject) {
    checks.push({
      name: "flutter-toolchain",
      passed: flutterOk === true,
      detected: flutterOk ? "flutter" : null,
      remediation: flutterOk ? null : REMEDIATION.missingFlutter,
    });
  } else if (pubspecOk) {
    checks.push({
      name: "dart-toolchain",
      passed: dartOk === true,
      detected: dartOk ? "dart" : null,
      remediation: dartOk ? null : REMEDIATION.missingDart,
    });
  }

  // Priority: missing pubspec is most actionable, then toolchain.
  let remediation = null;
  if (!pubspecOk) {
    remediation = REMEDIATION.missingPubspec;
  } else if (flutterProject && !flutterOk) {
    remediation = REMEDIATION.missingFlutter;
  } else if (!flutterProject && !dartOk) {
    remediation = REMEDIATION.missingDart;
  }

  const passed = checks.every((c) => c.passed);
  const elapsedMs = Date.now() - started;
  const remediations = checks.filter((c) => !c.passed && c.remediation).map((c) => c.remediation);

  return {
    passed,
    remediation,
    ready: passed,
    skipped: false,
    checks,
    remediations,
    report: buildReport(checks, passed, elapsedMs),
    elapsedMs,
  };
}

function buildReport(checks, ready, elapsedMs) {
  const rows = checks.map((c) => {
    const status = c.passed ? "PASS" : "FAIL";
    const detail = c.detected || "";
    return `  ${status.padEnd(4)}  ${c.name.padEnd(24)}  ${detail}`;
  });
  return (
    "Bridge Layer 0 — Flutter/Dart Readiness\n" +
    "──────────────────────────────────────\n" +
    rows.join("\n") +
    `\n──────────────────────────────────────\n  Overall: ${
      ready ? "READY" : "NOT READY"
    }  (${elapsedMs}ms)`
  );
}

// ─── Layer 1: discoverRunners ───────────────────────────────────────────────

/**
 * Discover Flutter/Dart runners (AC3, AC6, AC7).
 *
 * Flutter projects use `flutter test --machine`; pure Dart libraries use
 * `dart test --reporter json`. Tier emission depends on project layout:
 *
 *   - Flutter project with `integration_test/` alongside `test/`:
 *       Tier 1 (unit, `flutter test test/`) + Tier 3 (e2e, `flutter test integration_test/`).
 *       Flutter does not emit a Tier 2 entry — the testing model lacks a
 *       standard unit-vs-integration distinction (AC6).
 *   - Otherwise: single `all` tier runner with a fallback log message (AC7).
 *
 * @param {string} projectPath
 * @param {object} [manifest]
 * @returns {Promise<object>}
 */
async function discoverRunners(projectPath /*, manifest */) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("discoverRunners: projectPath is required");
  }

  if (!hasPubspec(projectPath)) {
    return {
      status: "error",
      message: "No pubspec.yaml found at the project root.",
    };
  }

  const pubspec = readPubspec(projectPath);
  if (pubspec === null) {
    return {
      status: "error",
      message: "Failed to parse pubspec.yaml.",
    };
  }

  const flutterProject = isFlutterProject(pubspec);
  const hasTestDir = hasDir(projectPath, "test");
  const hasIntegrationDir = hasDir(projectPath, "integration_test");

  // Flutter with integration_test/ — emit Tier 1 + Tier 3.
  if (flutterProject && hasTestDir && hasIntegrationDir) {
    const tier1 = {
      runner_name: "flutter-test",
      command: `${FLUTTER_COMMAND} test/`,
      source: "pubspec.yaml",
      tier_mapping: { tier: "unit", gates: [] },
      tier: "unit",
    };
    const tier3 = {
      runner_name: "flutter-test-integration",
      command: `${FLUTTER_COMMAND.replace(" --machine", "")} integration_test/`,
      source: "pubspec.yaml",
      tier_mapping: { tier: "e2e", gates: [] },
      tier: "e2e",
    };
    return {
      status: "ok",
      primary: tier1,
      manifest: {
        mode: "flutter-tiered",
        primary_runner: tier1,
        runners: [tier1, tier3],
        tiers: {
          unit: { description: "Flutter widget/unit tests (test/)" },
          e2e: { description: "Flutter integration tests (integration_test/)" },
        },
      },
    };
  }

  // Pure Dart library OR Flutter without integration_test/ — single all-tier runner.
  const command = flutterProject ? FLUTTER_COMMAND : DART_COMMAND;
  const runnerName = flutterProject ? "flutter-test" : "dart-test";
  const logMessage =
    "no standard unit/integration/e2e convention for Flutter/Dart — using all-tier fallback";

  const primary = {
    runner_name: runnerName,
    command,
    source: "pubspec.yaml",
    tier_mapping: { tier: "all", gates: [] },
    tier: "all",
  };
  return {
    status: "ok",
    primary,
    manifest: {
      mode: flutterProject ? "flutter-all" : "dart-all",
      primary_runner: primary,
      runners: [primary],
      tiers: {
        all: {
          description: flutterProject
            ? "Flutter widget/unit tests (all)"
            : "Dart package tests (all)",
        },
      },
      log: logMessage,
    },
  };
}

// ─── Layer 3: streaming JSON parser ─────────────────────────────────────────

/**
 * Split a package:test JSON stdout buffer into parsed event objects.
 * Silently skips non-JSON lines and the final partial line after a truncation.
 *
 * @param {string} stdout
 * @returns {Array<object>}
 */
function parseJsonEventStream(stdout) {
  if (!stdout || typeof stdout !== "string") return [];
  const events = [];
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) !== "{") continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === "object") events.push(obj);
    } catch {
      // Skip malformed event — common with truncated / SIGTERM'd output.
    }
  }
  return events;
}

/**
 * Correlate testStart and testDone events into per-test records keyed by
 * integer testID. error events are folded into the matching record's
 * failure_message field. print events are ignored for summary but do not
 * break correlation.
 *
 * @param {Array<object>} events
 * @returns {{ tests: Array<object>, sawDone: boolean }}
 */
function correlateEvents(events) {
  const byId = new Map(); // testID → record
  let sawDone = false;

  for (const ev of events) {
    const type = ev.type || "";

    if (type === "done") {
      sawDone = true;
      continue;
    }

    if (type === "testStart" && ev.test && typeof ev.test.id === "number") {
      const t = ev.test;
      byId.set(t.id, {
        id: t.id,
        name: t.name || `test#${t.id}`,
        status: "incomplete",
        duration_ms: 0,
        startMs: typeof ev.time === "number" ? ev.time : 0,
        failure_message: null,
      });
      continue;
    }

    if (type === "testDone" && typeof ev.testID === "number") {
      const rec = byId.get(ev.testID);
      if (!rec) continue;
      // package:test result values: "success" | "failure" | "error".
      const result = ev.result || "";
      if (ev.skipped === true) {
        rec.status = "skipped";
      } else if (result === "success") {
        rec.status = "passed";
      } else if (result === "failure" || result === "error") {
        rec.status = "failed";
      }
      if (typeof ev.time === "number" && typeof rec.startMs === "number") {
        rec.duration_ms = Math.max(0, ev.time - rec.startMs);
      }
      continue;
    }

    if (type === "error" && typeof ev.testID === "number") {
      const rec = byId.get(ev.testID);
      if (!rec) continue;
      const err = ev.error || "";
      const stack = ev.stackTrace || "";
      const msg = (err + (stack ? "\n" + stack : "")).trim();
      if (msg) {
        rec.failure_message =
          msg.length > RAW_OUTPUT_SNIPPET_MAX ? msg.slice(0, RAW_OUTPUT_SNIPPET_MAX) : msg;
      }
      // Ensure status is failed if an error event arrives.
      if (rec.status !== "failed" && rec.status !== "skipped") {
        rec.status = "failed";
      }
      continue;
    }

    // print, suite, group, allSuites, start — ignored for correlation.
  }

  const tests = [];
  for (const rec of byId.values()) {
    const entry = {
      id: rec.id,
      name: rec.name,
      status: rec.status,
      duration_ms: rec.duration_ms,
    };
    if (rec.failure_message) entry.failure_message = rec.failure_message;
    tests.push(entry);
  }
  return { tests, sawDone };
}

/**
 * Parse `flutter test --machine` / `dart test --reporter json` output
 * (AC4, AC5).
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {number} exitCode
 * @param {object} [options] - { event?: "timeout" } to signal Layer-2 SIGTERM
 * @returns {object}
 */
function parseOutput(stdout, stderr, exitCode, options = {}) {
  const stdoutStr = typeof stdout === "string" ? stdout : "";
  const stderrStr = typeof stderr === "string" ? stderr : "";

  const events = parseJsonEventStream(stdoutStr);

  // No parseable events at all — fall back to parse_error record.
  if (events.length === 0) {
    return {
      parse_error: true,
      stderr_snippet: stderrStr.slice(0, STDERR_SNIPPET_MAX),
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, incomplete: 0 },
      tests: [],
      exit_code: exitCode,
    };
  }

  const { tests, sawDone } = correlateEvents(events);

  const summary = {
    total: tests.length,
    passed: tests.filter((t) => t.status === "passed").length,
    failed: tests.filter((t) => t.status === "failed").length,
    skipped: tests.filter((t) => t.status === "skipped").length,
    incomplete: tests.filter((t) => t.status === "incomplete").length,
  };

  // Layer 2 can explicitly tag the run as a timeout via options.event.
  // Otherwise, infer timeout from: no `done` event received + at least one
  // incomplete test + non-zero exit code.
  const inferredTimeout = !sawDone && summary.incomplete > 0 && exitCode !== 0;
  const isTimeout = options.event === "timeout" || inferredTimeout;

  const result = {
    parse_error: false,
    summary,
    tests,
    exit_code: exitCode,
  };
  if (isTimeout) {
    result.event = "timeout";
    result.raw_output_snippet = stderrStr.slice(0, RAW_OUTPUT_SNIPPET_MAX);
  }
  return result;
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * @type {import('./index.js').StackAdapter}
 */
const flutterAdapter = {
  name: "flutter",
  detectionPatterns: DETECTION_PATTERNS,
  readinessCheck,
  discoverRunners,
  parseOutput,
};

export default flutterAdapter;
