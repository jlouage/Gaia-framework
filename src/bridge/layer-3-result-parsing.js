/**
 * E17-S10 / E25-S5: Bridge Layer 3 — Result Parsing and Evidence Generation
 *
 * Fourth layer of the Test Execution Bridge (ADR-028, architecture §10.20).
 * Layer 3 receives the { stdout, stderr, exit_code } output from Layer 2
 * (local mode, E17-S6) or Layer 2 CI (E17-S9), parses the runner output
 * into a structured result set, and writes a machine-readable evidence
 * file at `test-results/{story_key}-execution.json` per the FR-194 /
 * FR-197 evidence schema.
 *
 * E25-S5 refactor: all stack-specific parsing logic (TAP, Jest JSON, Mocha,
 * BATS) has been moved to per-stack adapters (src/bridge/adapters/).
 * Layer 3 now delegates to adapter.parseOutput() for format-specific parsing
 * while retaining the evidence file generation and verdict derivation logic
 * which are stack-agnostic.
 *
 * Traces to: FR-194, FR-197, FR-198, FR-307, NFR-034, ADR-028, ADR-038
 * Test cases: TEB-40
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { normaliseTierName } from "./layer-2-tier-selection.js";

// ─── Constants ─────────────────────────────────────────────────────────────

export const EVIDENCE_SCHEMA_VERSION = "1.0";

// NFR-034: evidence file size cap (500KB).
export const MAX_EVIDENCE_BYTES = 500 * 1024;

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
 * Parse Layer 2 execution output by delegating to the adapter.
 *
 * @param {Layer2ExecutionOutput} execution
 * @param {object} [adapter] — the stack adapter resolved by Layer 0. When
 *   provided, delegates to adapter.parseOutput(). When absent, falls back
 *   to a generic parse_error result for backward compatibility.
 * @returns {ParsedResult}
 */
export function parseResults(execution, adapter) {
  const stdout = typeof execution?.stdout === "string" ? execution.stdout : "";
  const stderr = typeof execution?.stderr === "string" ? execution.stderr : "";
  const exitCode = typeof execution?.exit_code === "number" ? execution.exit_code : 1;

  if (adapter && typeof adapter.parseOutput === "function") {
    return adapter.parseOutput(stdout, stderr, exitCode);
  }

  // No adapter available — return parse_error fallback
  const combined = `${stdout}\n${stderr}`;
  const raw_output_snippet = combined.slice(0, 2048);
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
 * @property {string} [executedAt]   — optional ISO 8601 timestamp
 * @property {"unit" | "integration" | "e2e" | 1 | 2 | 3 | null} [tier]
 */

/**
 * Serialize a parsed result to the FR-194 / FR-197 evidence schema and
 * write it to `{outputDir}/test-results/{storyKey}-execution.json`.
 *
 * @param {WriteEvidenceOptions} opts
 * @returns {string} absolute path to the written evidence file
 */
export function writeEvidence(opts) {
  const { parsed, storyKey, runner, mode, durationSeconds, outputDir, executedAt, tier } = opts;

  if (!storyKey || typeof storyKey !== "string") {
    throw new TypeError("writeEvidence: storyKey is required (string)");
  }
  if (!outputDir || typeof outputDir !== "string") {
    throw new TypeError("writeEvidence: outputDir is required (string)");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new TypeError("writeEvidence: parsed result is required (object)");
  }

  const normalisedTier = tier === undefined || tier === null ? null : normaliseTierName(tier);

  /** @type {Record<string, any>} */
  const base = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    story_key: storyKey,
    runner: runner || "unknown",
    mode: mode || "local",
    tier: normalisedTier,
    executed_at: executedAt || new Date().toISOString(),
    duration_seconds: typeof durationSeconds === "number" ? durationSeconds : 0,
    summary: parsed.summary || { total: 0, passed: 0, failed: 0, skipped: 0 },
    tests: Array.isArray(parsed.tests) ? parsed.tests : [],
    truncated: false,
  };

  if (parsed.parse_error) {
    base.parse_error = true;
    base.raw_output_snippet = parsed.raw_output_snippet || "";
  }

  let json = JSON.stringify(base, null, 2);
  if (Buffer.byteLength(json, "utf-8") > MAX_EVIDENCE_BYTES) {
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
 * Derive the review-gate verdict from a parsed result.
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
