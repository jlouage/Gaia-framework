/**
 * E17-S10: Bridge Layer 3 — Result Parsing and Evidence Generation
 *
 * Unit tests for the Layer 3 parser and evidence writer. These tests drive
 * the functional behavior of parsing runner output (Vitest TAP, Jest JSON,
 * BATS TAP, unknown) and serializing the evidence file per the FR-194
 * schema with the NFR-034 500KB cap and AC5 parse-failure fallback.
 *
 * Traces: FR-197, FR-198, NFR-034, ADR-028
 * Test cases: TEB-40
 * Risk: high | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LAYER3_REL = "../../../src/bridge/layer-3-result-parsing.js";
const LAYER3_PATH = join(__dirname, LAYER3_REL);

// E25-S5: Layer 3 now delegates parsing to the adapter. Import jsAdapter for tests.
import jsAdapter from "../../../src/bridge/adapters/js-adapter.js";

// Wrapper: Layer 3 parseResults now requires an adapter as second argument.
// Wrap calls so existing tests pass the JS adapter by default.
async function parseResultsWithAdapter(execution) {
  const { parseResults } = await import(LAYER3_REL);
  return parseResults(execution, jsAdapter);
}

// ─── Sample fixtures ───────────────────────────────────────────────────────

const VITEST_TAP_OUTPUT = `TAP version 13
1..4
ok 1 - auth > login returns token
ok 2 - auth > login validates password
not ok 3 - auth > refresh token rotates
  ---
  error: 'expected "abc" to equal "xyz"'
  ...
ok 4 - auth > logout clears session # SKIP
# tests 4
# pass 2
# fail 1
# skip 1
`;

const JEST_JSON_OUTPUT = JSON.stringify({
  numTotalTests: 3,
  numPassedTests: 2,
  numFailedTests: 1,
  numPendingTests: 0,
  testResults: [
    {
      testResults: [
        { fullName: "parser handles empty input", status: "passed", duration: 12 },
        { fullName: "parser handles vitest tap", status: "passed", duration: 45 },
        {
          fullName: "parser handles jest json",
          status: "failed",
          duration: 88,
          failureMessages: ["Expected 3 but got 2"],
        },
      ],
    },
  ],
});

const BATS_TAP_OUTPUT = `1..3
ok 1 installer exits 0 on help
not ok 2 installer rejects missing target
# (in test file test.bats, line 14)
#   \`run ./gaia-install.sh\` failed
ok 3 installer writes version file
`;

const UNKNOWN_OUTPUT = "random garbage output\nwith no TAP or JSON structure\njust text\n";

// ─── Helpers ───────────────────────────────────────────────────────────────

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "e17-s10-"));
});

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ─── Module existence ──────────────────────────────────────────────────────

describe("Layer 3 module exists", () => {
  it("module file exists at src/bridge/layer-3-result-parsing.js", () => {
    expect(existsSync(LAYER3_PATH)).toBe(true);
  });

  it("exports parseResults and writeEvidence functions", async () => {
    const mod = await import(LAYER3_REL);
    expect(typeof mod.parseResults).toBe("function");
    expect(typeof mod.writeEvidence).toBe("function");
  });
});

// ─── AC1: Parse Vitest TAP ─────────────────────────────────────────────────

describe("AC1: parseResults — Vitest TAP output", () => {
  it("extracts total/passed/failed/skipped counts from Vitest TAP", async () => {
    const parsed = await parseResultsWithAdapter({
      stdout: VITEST_TAP_OUTPUT,
      stderr: "",
      exit_code: 1,
      runner: "vitest",
    });
    expect(parsed.summary.total).toBe(4);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.skipped).toBe(1);
  });

  it("extracts test names and failure messages", async () => {
    const parsed = await parseResultsWithAdapter({
      stdout: VITEST_TAP_OUTPUT,
      stderr: "",
      exit_code: 1,
      runner: "vitest",
    });
    const failed = parsed.tests.find((t) => t.status === "failed");
    expect(failed).toBeDefined();
    expect(failed.name).toMatch(/refresh token rotates/);
    expect(failed.failure_message).toMatch(/expected/i);
    expect(parsed.tests.map((t) => t.name)).toContain("auth > login returns token");
  });
});

// ─── AC1/AC3: Parse Jest JSON ──────────────────────────────────────────────

describe("AC1/AC3: parseResults — Jest JSON output", () => {
  it("extracts counts from Jest JSON reporter", async () => {
    const parsed = await parseResultsWithAdapter({
      stdout: JEST_JSON_OUTPUT,
      stderr: "",
      exit_code: 1,
      runner: "jest",
    });
    expect(parsed.summary.total).toBe(3);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.skipped).toBe(0);
  });

  it("extracts failure_message and duration_ms from Jest JSON", async () => {
    const parsed = await parseResultsWithAdapter({
      stdout: JEST_JSON_OUTPUT,
      stderr: "",
      exit_code: 1,
      runner: "jest",
    });
    const failed = parsed.tests.find((t) => t.status === "failed");
    expect(failed.failure_message).toMatch(/Expected 3 but got 2/);
    expect(failed.duration_ms).toBe(88);
  });
});

// ─── AC1: Parse BATS TAP ───────────────────────────────────────────────────

describe("AC1: parseResults — BATS TAP output", () => {
  it("extracts counts from BATS TAP", async () => {
    const parsed = await parseResultsWithAdapter({
      stdout: BATS_TAP_OUTPUT,
      stderr: "",
      exit_code: 1,
      runner: "bats",
    });
    expect(parsed.summary.total).toBe(3);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(1);
  });
});

// ─── AC5: Parse failure fallback ───────────────────────────────────────────

describe("AC5: parseResults — unknown format fallback", () => {
  it("sets parse_error and raw_output_snippet for unknown output", async () => {
    const parsed = await parseResultsWithAdapter({
      stdout: UNKNOWN_OUTPUT,
      stderr: "",
      exit_code: 1,
      runner: "mystery",
    });
    expect(parsed.parse_error).toBe(true);
    expect(parsed.raw_output_snippet).toBeDefined();
    expect(parsed.raw_output_snippet.length).toBeLessThanOrEqual(2048);
    expect(parsed.raw_output_snippet).toContain("random garbage output");
  });

  it("truncates raw_output_snippet at 2KB", async () => {
    const huge = "x".repeat(10000);
    const parsed = await parseResultsWithAdapter({
      stdout: huge,
      stderr: "",
      exit_code: 1,
      runner: "mystery",
    });
    expect(parsed.parse_error).toBe(true);
    expect(parsed.raw_output_snippet.length).toBe(2048);
  });
});

// ─── AC2/AC3: writeEvidence writes file ─────────────────────────────────────

describe("AC2/AC3: writeEvidence — file writer", () => {
  it("writes evidence file to test-results/{story_key}-execution.json", async () => {
    const { writeEvidence } = await import(LAYER3_REL);
    const parsed = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
      tests: [{ name: "t", status: "passed", duration_ms: 5 }],
    };
    const path = writeEvidence({
      parsed,
      storyKey: "E17-S10",
      runner: "vitest",
      mode: "local",
      durationSeconds: 1.23,
      outputDir: tempDir,
    });
    expect(path).toMatch(/test-results[/\\]E17-S10-execution\.json$/);
    expect(existsSync(path)).toBe(true);
  });

  it("evidence file contains all FR-194 schema fields", async () => {
    const { writeEvidence } = await import(LAYER3_REL);
    const parsed = {
      summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
      tests: [
        { name: "a", status: "passed", duration_ms: 10 },
        { name: "b", status: "failed", duration_ms: 20, failure_message: "boom" },
      ],
    };
    const path = writeEvidence({
      parsed,
      storyKey: "E17-S10",
      runner: "vitest",
      mode: "local",
      durationSeconds: 2.5,
      outputDir: tempDir,
    });
    const doc = JSON.parse(readFileSync(path, "utf-8"));
    expect(doc.schema_version).toBeDefined();
    expect(doc.story_key).toBe("E17-S10");
    expect(doc.runner).toBe("vitest");
    expect(doc.mode).toBe("local");
    expect(doc.executed_at).toBeDefined();
    expect(doc.duration_seconds).toBe(2.5);
    expect(doc.summary).toEqual({ total: 2, passed: 1, failed: 1, skipped: 0 });
    expect(doc.tests).toHaveLength(2);
    expect(doc.tests[1].failure_message).toBe("boom");
    expect(doc.truncated).toBe(false);
  });

  it("creates test-results/ directory if it does not exist", async () => {
    const { writeEvidence } = await import(LAYER3_REL);
    const parsed = {
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      tests: [],
    };
    const nested = join(tempDir, "nested", "deep");
    const path = writeEvidence({
      parsed,
      storyKey: "E1-S1",
      runner: "none",
      mode: "local",
      durationSeconds: 0,
      outputDir: nested,
    });
    expect(existsSync(path)).toBe(true);
  });
});

// ─── AC4: 500KB cap ─────────────────────────────────────────────────────────

describe("AC4/NFR-034: writeEvidence — 500KB cap with truncated flag", () => {
  it("truncates tests array when evidence exceeds 500KB, sets truncated: true", async () => {
    const { writeEvidence } = await import(LAYER3_REL);
    // Build a huge tests array — 5000 entries with large failure messages
    const bigTests = Array.from({ length: 5000 }, (_, i) => ({
      name: `test ${i}`,
      status: "failed",
      duration_ms: 10,
      failure_message: "x".repeat(500),
    }));
    const parsed = {
      summary: { total: 5000, passed: 0, failed: 5000, skipped: 0 },
      tests: bigTests,
    };
    const path = writeEvidence({
      parsed,
      storyKey: "E17-S10",
      runner: "vitest",
      mode: "local",
      durationSeconds: 60,
      outputDir: tempDir,
    });
    const doc = JSON.parse(readFileSync(path, "utf-8"));
    expect(doc.truncated).toBe(true);
    // Summary block is preserved intact
    expect(doc.summary.total).toBe(5000);
    expect(doc.summary.failed).toBe(5000);
    // File size ≤ 500KB
    const size = statSync(path).size;
    expect(size).toBeLessThanOrEqual(500 * 1024);
    // Tests array was truncated
    expect(doc.tests.length).toBeLessThan(5000);
  });

  it("does not set truncated for small evidence files", async () => {
    const { writeEvidence } = await import(LAYER3_REL);
    const parsed = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
      tests: [{ name: "t", status: "passed", duration_ms: 1 }],
    };
    const path = writeEvidence({
      parsed,
      storyKey: "E17-S10",
      runner: "vitest",
      mode: "local",
      durationSeconds: 0.1,
      outputDir: tempDir,
    });
    const doc = JSON.parse(readFileSync(path, "utf-8"));
    expect(doc.truncated).toBe(false);
  });
});

// ─── AC5: parse_error evidence file ─────────────────────────────────────────

describe("AC5: writeEvidence — parse_error minimal evidence", () => {
  it("writes parse_error: true and raw_output_snippet for unknown runner output", async () => {
    const { writeEvidence } = await import(LAYER3_REL);
    const parsed = await parseResultsWithAdapter({
      stdout: "totally unknown\n",
      stderr: "",
      exit_code: 1,
      runner: "mystery",
    });
    const path = writeEvidence({
      parsed,
      storyKey: "E17-S10",
      runner: "mystery",
      mode: "local",
      durationSeconds: 0.5,
      outputDir: tempDir,
    });
    const doc = JSON.parse(readFileSync(path, "utf-8"));
    expect(doc.parse_error).toBe(true);
    expect(doc.raw_output_snippet).toContain("totally unknown");
    expect(doc.summary).toEqual({ total: 0, passed: 0, failed: 0, skipped: 0 });
    expect(doc.tests).toEqual([]);
  });
});
