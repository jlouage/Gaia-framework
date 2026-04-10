/**
 * E17-S10: Bridge Layer 3 — Result Parsing and Evidence Generation
 *
 * Fourth layer of the Test Execution Bridge (ADR-028, architecture §10.20).
 * Layer 3 receives the { stdout, stderr, exit_code } output from Layer 2
 * (local mode, E17-S6) or Layer 2 CI (E17-S9), parses the runner output
 * into a structured result set, and writes a machine-readable evidence
 * file at `test-results/{story_key}-execution.json` per the FR-194 /
 * FR-197 evidence schema. The Review Gate protocol (§10.20.6) reads this
 * evidence file and reports PASSED / FAILED / UNVERIFIED.
 *
 * Supported runner formats (Task 1):
 *   - Vitest TAP       (ok / not ok lines, `# tests/pass/fail/skip` summary)
 *   - Jest JSON        (--json reporter output)
 *   - BATS TAP         (ok / not ok lines, same TAP protocol)
 *   - Unknown fallback (parse_error: true, raw_output_snippet captured)
 *
 * Evidence schema fields (FR-194 / FR-197, schema_version "1.0"):
 *   {
 *     schema_version,      // "1.0"
 *     story_key,           // e.g. "E17-S10"
 *     runner,              // e.g. "vitest"
 *     mode,                // "local" or "ci"
 *     executed_at,         // ISO 8601 UTC timestamp
 *     duration_seconds,    // wall-clock seconds
 *     summary: {
 *       total, passed, failed, skipped
 *     },
 *     tests: [
 *       { name, status, duration_ms, failure_message? }
 *     ],
 *     truncated,           // true when the tests array was trimmed to fit
 *     parse_error?,        // true on unknown-runner fallback (AC5)
 *     raw_output_snippet?  // first 2KB of stdout+stderr on parse failure
 *   }
 *
 * NFR-034 size cap: the serialized evidence file must not exceed 500KB.
 * When the tests array would blow that budget, Layer 3 truncates the
 * array and sets `truncated: true` while leaving `summary` intact.
 *
 * Evidence path reporting (AC6): writeEvidence returns the absolute path
 * of the written file so the caller can display it to the user and
 * add a linked reference to the story's Review Gate section.
 *
 * Traces to: FR-194, FR-197, FR-198, NFR-034, ADR-028
 * Test cases: TEB-40
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

// ─── Constants ─────────────────────────────────────────────────────────────

export const EVIDENCE_SCHEMA_VERSION = "1.0";

// NFR-034: evidence file size cap (500KB). When the serialized JSON
// exceeds this limit, the tests array is truncated and `truncated: true`
// is set on the evidence record so reviewers know data was dropped.
export const MAX_EVIDENCE_BYTES = 500 * 1024; // 500KB (500,000-ish, exact: 512000)

// AC5: first 2KB of stdout+stderr are captured verbatim in
// raw_output_snippet when the parser falls through to the unknown-runner
// path so post-mortem debugging is possible without re-running the test.
const RAW_OUTPUT_SNIPPET_MAX = 2048;

// ─── TAP parser (Vitest + BATS) ────────────────────────────────────────────

/**
 * Parse a TAP stream into { summary, tests }. Recognises the common
 * subset of TAP 13 used by Vitest and BATS: numbered `ok` / `not ok`
 * lines with optional `# SKIP` directives and free-form failure message
 * blocks following a `not ok` line.
 *
 * @param {string} output — raw stdout captured by Layer 2
 * @returns {{ summary: object, tests: Array }|null}
 *   — returns null when no TAP lines were found (so the caller can
 *     fall through to another format).
 */
function parseTap(output) {
  const lines = output.split(/\r?\n/);
  const tests = [];
  let sawAny = false;
  let currentFailure = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = /^(ok|not ok)\s+(\d+)\s*-?\s*(.*?)(?:\s*#\s*(SKIP|TODO)\b.*)?$/.exec(line);
    if (m) {
      sawAny = true;
      const [, status, , rawName, directive] = m;
      const name = rawName.trim();
      let entry;
      if (directive === "SKIP") {
        entry = { name, status: "skipped", duration_ms: 0 };
      } else if (status === "ok") {
        entry = { name, status: "passed", duration_ms: 0 };
      } else {
        entry = { name, status: "failed", duration_ms: 0 };
        currentFailure = entry;
      }
      tests.push(entry);
      continue;
    }

    // Failure message capture: YAML-ish block between `---` and `...`
    // that TAP uses to attach diagnostics to a `not ok` line.
    if (currentFailure && /^\s*---\s*$/.test(line)) {
      const msgLines = [];
      i += 1;
      while (i < lines.length && !/^\s*\.\.\.\s*$/.test(lines[i])) {
        msgLines.push(lines[i].replace(/^\s*/, ""));
        i += 1;
      }
      currentFailure.failure_message = msgLines.join("\n").trim();
      currentFailure = null;
      continue;
    }

    // BATS-style diagnostic comments directly under a `not ok` line
    // (no YAML block) — capture the first `#` comment line as the
    // failure message.
    if (currentFailure && /^#\s+/.test(line) && !currentFailure.failure_message) {
      currentFailure.failure_message = line.replace(/^#\s*/, "").trim();
      continue;
    }
  }

  if (!sawAny) return null;

  const summary = summarise(tests);
  return { summary, tests };
}

// ─── Jest JSON parser ──────────────────────────────────────────────────────

/**
 * Parse the Jest `--json` reporter format into { summary, tests }.
 * Returns null when the input is not valid JSON or does not look like a
 * Jest test report.
 */
function parseJestJson(output) {
  let doc;
  try {
    doc = JSON.parse(output);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.testResults)) {
    return null;
  }

  const tests = [];
  for (const suite of doc.testResults) {
    if (!suite || !Array.isArray(suite.testResults)) continue;
    for (const t of suite.testResults) {
      /** @type {{ name: string, status: string, duration_ms: number, failure_message?: string }} */
      const entry = {
        name: t.fullName || t.title || "unnamed",
        status: normaliseJestStatus(t.status),
        duration_ms: typeof t.duration === "number" ? t.duration : 0,
      };
      if (Array.isArray(t.failureMessages) && t.failureMessages.length > 0) {
        entry.failure_message = t.failureMessages.join("\n").trim();
      }
      tests.push(entry);
    }
  }

  // Prefer Jest's own aggregate counters when present — they are the
  // authoritative summary — otherwise derive from the flattened tests
  // list. Either way the `tests` array carries the per-test records
  // required by FR-198 (AC→test mapping).
  const summary = {
    total: typeof doc.numTotalTests === "number" ? doc.numTotalTests : tests.length,
    passed:
      typeof doc.numPassedTests === "number"
        ? doc.numPassedTests
        : tests.filter((t) => t.status === "passed").length,
    failed:
      typeof doc.numFailedTests === "number"
        ? doc.numFailedTests
        : tests.filter((t) => t.status === "failed").length,
    skipped:
      typeof doc.numPendingTests === "number"
        ? doc.numPendingTests
        : tests.filter((t) => t.status === "skipped").length,
  };

  return { summary, tests };
}

function normaliseJestStatus(status) {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "pending" || status === "skipped" || status === "todo") return "skipped";
  return "failed";
}

// ─── Summarisation helper ──────────────────────────────────────────────────

function summarise(tests) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const t of tests) {
    if (t.status === "passed") passed += 1;
    else if (t.status === "failed") failed += 1;
    else if (t.status === "skipped") skipped += 1;
  }
  return { total: tests.length, passed, failed, skipped };
}

// ─── Public API: parseResults ──────────────────────────────────────────────

/**
 * @typedef {Object} Layer2ExecutionOutput
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} exit_code
 * @property {string} [runner] — optional hint from the runner manifest
 */

/**
 * @typedef {Object} ParsedResult
 * @property {{ total: number, passed: number, failed: number, skipped: number }} summary
 * @property {Array<{ name: string, status: string, duration_ms: number, failure_message?: string }>} tests
 * @property {boolean} [parse_error]
 * @property {string}  [raw_output_snippet]
 */

/**
 * Parse Layer 2 execution output into a structured result object.
 *
 * Parsing strategy (Task 1):
 *   1. If `runner` hints jest (or output starts with `{`), try Jest JSON.
 *   2. Try TAP (Vitest / BATS) — same protocol, same parser.
 *   3. Fallback: emit parse_error with raw_output_snippet (first 2KB).
 *
 * @param {Layer2ExecutionOutput} execution
 * @returns {ParsedResult}
 */
export function parseResults(execution) {
  const stdout = typeof execution?.stdout === "string" ? execution.stdout : "";
  const stderr = typeof execution?.stderr === "string" ? execution.stderr : "";
  const runnerHint = (execution?.runner || "").toLowerCase();

  // Jest JSON — try first when the runner hint says jest OR when the
  // stdout looks like a JSON document.
  if (runnerHint === "jest" || /^\s*\{/.test(stdout)) {
    const jest = parseJestJson(stdout);
    if (jest) return jest;
  }

  // TAP — covers Vitest and BATS with the same protocol.
  const tap = parseTap(stdout);
  if (tap) return tap;

  // AC5: parse-failure fallback. Capture the first 2KB of combined
  // stdout+stderr so reviewers can inspect what the runner actually
  // emitted. parse_error is surfaced on the evidence record verbatim.
  const combined = `${stdout}\n${stderr}`;
  const raw_output_snippet = combined.slice(0, RAW_OUTPUT_SNIPPET_MAX);
  return {
    parse_error: true,
    raw_output_snippet,
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    tests: [],
  };
}

// ─── Public API: writeEvidence ─────────────────────────────────────────────

/**
 * @typedef {Object} WriteEvidenceOptions
 * @property {ParsedResult} parsed
 * @property {string} storyKey       — e.g. "E17-S10"
 * @property {string} runner         — e.g. "vitest"
 * @property {string} mode           — "local" or "ci"
 * @property {number} durationSeconds — wall-clock execution time
 * @property {string} outputDir      — base directory for test-results/
 *                                     (typically docs/test-artifacts)
 * @property {string} [executedAt]   — optional ISO 8601 timestamp; defaults to now
 */

/**
 * Serialize a parsed result to the FR-194 / FR-197 evidence schema and
 * write it to `{outputDir}/test-results/{storyKey}-execution.json`.
 *
 * Size cap behaviour (NFR-034 / AC4):
 *   - If the first serialization ≤ MAX_EVIDENCE_BYTES (500KB): write as-is
 *     with `truncated: false`.
 *   - Otherwise: binary-search the largest `tests` prefix that fits under
 *     the cap, set `truncated: true`, and rewrite. The `summary` block is
 *     left intact so totals remain correct even when per-test detail is
 *     dropped. This guarantees the evidence file is machine-readable and
 *     under 500KB for downstream review gate consumption.
 *
 * Returns the absolute path of the written file. AC6: callers use this
 * path to report the evidence file location to the user and to write a
 * linked reference into the story's Review Gate section.
 *
 * @param {WriteEvidenceOptions} opts
 * @returns {string} absolute path to the written evidence file
 */
export function writeEvidence(opts) {
  const { parsed, storyKey, runner, mode, durationSeconds, outputDir, executedAt } = opts;

  if (!storyKey || typeof storyKey !== "string") {
    throw new TypeError("writeEvidence: storyKey is required (string)");
  }
  if (!outputDir || typeof outputDir !== "string") {
    throw new TypeError("writeEvidence: outputDir is required (string)");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new TypeError("writeEvidence: parsed result is required (object)");
  }

  /** @type {Record<string, any>} */
  const base = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    story_key: storyKey,
    runner: runner || "unknown",
    mode: mode || "local",
    executed_at: executedAt || new Date().toISOString(),
    duration_seconds: typeof durationSeconds === "number" ? durationSeconds : 0,
    summary: parsed.summary || { total: 0, passed: 0, failed: 0, skipped: 0 },
    tests: Array.isArray(parsed.tests) ? parsed.tests : [],
    truncated: false,
  };

  // AC5: propagate parse_error + raw_output_snippet when the parser fell
  // through to the unknown-runner path. These fields are intentionally
  // additive — consumers that do not understand them can ignore them.
  if (parsed.parse_error) {
    base.parse_error = true;
    base.raw_output_snippet = parsed.raw_output_snippet || "";
  }

  // First attempt: serialize the full record. If it fits under the cap
  // we write it verbatim (the common case — most test suites produce
  // far less than 500KB of output).
  let json = JSON.stringify(base, null, 2);
  if (Buffer.byteLength(json, "utf-8") > MAX_EVIDENCE_BYTES) {
    // AC4: binary-search the largest prefix of the tests array that
    // keeps the serialized document under 500KB. The summary block is
    // always preserved so the totals are trustworthy even when the
    // per-test detail has been dropped.
    base.truncated = true;
    const allTests = base.tests;
    let lo = 0;
    let hi = allTests.length;
    let best = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      base.tests = allTests.slice(0, mid);
      const candidate = JSON.stringify(base, null, 2);
      if (Buffer.byteLength(candidate, "utf-8") <= MAX_EVIDENCE_BYTES) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    base.tests = allTests.slice(0, best);
    json = JSON.stringify(base, null, 2);
  }

  const resultsDir = join(outputDir, "test-results");
  mkdirSync(resultsDir, { recursive: true });
  const filePath = join(resultsDir, `${storyKey}-execution.json`);
  writeFileSync(filePath, json, "utf-8");
  return filePath;
}

// ─── Public API: deriveVerdict ─────────────────────────────────────────────

/**
 * Derive the review-gate verdict from a parsed result. The review gate
 * protocol (§10.20.6) reads this verdict to decide PASSED / FAILED /
 * UNVERIFIED for the story's test-execution gate row.
 *
 * Rules (§10.20.5 field notes):
 *   - parse_error → UNVERIFIED
 *   - failed > 0  → FAILED
 *   - passed > 0 AND failed == 0 → PASSED
 *   - otherwise (no tests at all) → UNVERIFIED
 *
 * @param {ParsedResult} parsed
 * @returns {"PASSED" | "FAILED" | "UNVERIFIED"}
 */
export function deriveVerdict(parsed) {
  if (!parsed || parsed.parse_error) return "UNVERIFIED";
  const s = parsed.summary || { total: 0, passed: 0, failed: 0, skipped: 0 };
  if ((s.failed || 0) > 0) return "FAILED";
  if ((s.passed || 0) > 0) return "PASSED";
  return "UNVERIFIED";
}
