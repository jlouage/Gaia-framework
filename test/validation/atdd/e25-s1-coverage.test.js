/**
 * E25-S1 Test Automation Coverage Expansion
 *
 * Companion tests that fill coverage gaps in `python-adapter.js` not
 * exercised by the AC-level ATDD suite in `e25-s1.test.js`. These tests
 * target branch and error-path coverage per /gaia-test-automate:
 *
 *   - parseJUnitXml: nested <testsuites> wrapper, malformed XML, empty doc
 *   - parseOutput:   unreadable XML file, missing _projectPath default
 *   - normalizeTestCases: <error> node, string failure body, skipped
 *   - extractMarkers: TOML array form, empty/no markers, malformed lines
 *   - readinessCheck: bridge_enabled=false early return, missing projectPath
 *   - discoverRunners: missing projectPath, no config at all
 *
 * Traces to: FR-307, FR-308, ADR-028, ADR-038
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const PYTHON_ADAPTER_PATH = join(PROJECT_ROOT, "src", "bridge", "adapters", "python-adapter.js");

let adapter;
beforeAll(async () => {
  const mod = await import(PYTHON_ADAPTER_PATH + "?cov=" + Date.now());
  adapter = mod.default ?? mod;
});

// ─── parseOutput: JUnit XML shape variants ─────────────────────────────────

describe("python-adapter coverage: parseOutput XML variants", () => {
  it("parses the <testsuites><testsuite> wrapper form", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    mkdirSync(join(tmp, "test-results"), { recursive: true });
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
  <testsuite name="pytest" tests="2" failures="1" errors="0" skipped="0">
    <testcase classname="tests.test_a" name="test_ok" time="0.012" />
    <testcase classname="tests.test_a" name="test_boom" time="0.034">
      <failure message="AssertionError: boom">traceback...</failure>
    </testcase>
  </testsuite>
</testsuites>`;
    writeFileSync(join(tmp, "test-results", "pytest.xml"), xml);
    const result = adapter.parseOutput("", "", 1, { _projectPath: tmp });
    expect(result.summary).toEqual({ total: 2, passed: 1, failed: 1, skipped: 0 });
    const failed = result.tests.find((t) => t.status === "failed");
    expect(failed.name).toBe("tests.test_a.test_boom");
    expect(failed.failure_message).toMatch(/AssertionError: boom/);
    expect(failed.duration_ms).toBe(34);
  });

  it("treats <testcase><error> nodes as failed with a message", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    mkdirSync(join(tmp, "test-results"), { recursive: true });
    const xml = `<?xml version="1.0"?>
<testsuite name="pytest" tests="1" errors="1">
  <testcase classname="tests.test_err" name="test_crash" time="0.001">
    <error message="collection error: ImportError">full traceback</error>
  </testcase>
</testsuite>`;
    writeFileSync(join(tmp, "test-results", "pytest.xml"), xml);
    const result = adapter.parseOutput("", "", 2, { _projectPath: tmp });
    expect(result.summary.failed).toBe(1);
    expect(result.tests[0].status).toBe("failed");
    expect(result.tests[0].failure_message).toMatch(/collection error/);
  });

  it("recognizes <skipped> as skipped status", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    mkdirSync(join(tmp, "test-results"), { recursive: true });
    const xml = `<?xml version="1.0"?>
<testsuite name="pytest" tests="1" skipped="1">
  <testcase classname="tests.test_s" name="test_skipme" time="0">
    <skipped message="platform win32" />
  </testcase>
</testsuite>`;
    writeFileSync(join(tmp, "test-results", "pytest.xml"), xml);
    const result = adapter.parseOutput("", "", 0, { _projectPath: tmp });
    expect(result.summary.skipped).toBe(1);
    expect(result.tests[0].status).toBe("skipped");
  });

  it("testcase without classname uses bare name", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    mkdirSync(join(tmp, "test-results"), { recursive: true });
    const xml = `<testsuite>
  <testcase name="test_bare" time="0.01"></testcase>
</testsuite>`;
    writeFileSync(join(tmp, "test-results", "pytest.xml"), xml);
    const result = adapter.parseOutput("", "", 0, { _projectPath: tmp });
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe("test_bare");
    expect(result.tests[0].status).toBe("passed");
    expect(result.tests[0].duration_ms).toBe(10);
  });

  it("malformed XML falls back to parse_error", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    mkdirSync(join(tmp, "test-results"), { recursive: true });
    writeFileSync(join(tmp, "test-results", "pytest.xml"), "not-xml");
    const result = adapter.parseOutput("", "boom", 3, { _projectPath: tmp });
    expect(result.parse_error).toBe(true);
    expect(result.stderr_snippet).toContain("boom");
    expect(result.exit_code).toBe(3);
  });

  it("truncates stderr snippet to 2048 chars on parse_error", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    const stderr = "x".repeat(10_000);
    const result = adapter.parseOutput("", stderr, 2, { _projectPath: tmp });
    expect(result.parse_error).toBe(true);
    expect(result.stderr_snippet.length).toBe(2048);
  });

  it("non-string stderr is coerced to empty snippet", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    const result = adapter.parseOutput("", undefined, 5, { _projectPath: tmp });
    expect(result.parse_error).toBe(true);
    expect(result.stderr_snippet).toBe("");
  });
});

// ─── readinessCheck: branches not covered by AC suite ───────────────────────

describe("python-adapter coverage: readinessCheck branches", () => {
  const fakeOk = () => Buffer.from("", "utf8");

  it("bridge_enabled=false short-circuits to ready+skipped", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    const result = adapter.readinessCheck(tmp, {
      _execFile: fakeOk,
      test_execution_bridge: { bridge_enabled: false },
    });
    expect(result.passed).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.checks).toEqual([]);
    expect(typeof result.elapsedMs).toBe("number");
  });

  it("throws TypeError when projectPath is missing or non-string", () => {
    expect(() => adapter.readinessCheck(undefined)).toThrow(TypeError);
    expect(() => adapter.readinessCheck(123)).toThrow(TypeError);
    expect(() => adapter.readinessCheck("")).toThrow(TypeError);
  });

  it("fills checks[] with one entry per probe", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    writeFileSync(join(tmp, "pytest.ini"), "[pytest]\n");
    const result = adapter.readinessCheck(tmp, { _execFile: fakeOk });
    const names = result.checks.map((c) => c.name).sort();
    expect(names).toEqual(["pytest-config", "pytest-importable", "python-interpreter"].sort());
    expect(result.report).toMatch(/Bridge Layer 0 — Python Readiness/);
    expect(result.report).toMatch(/Overall: READY/);
  });

  it("report shows NOT READY when a probe fails", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    const failExec = () => {
      const err = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    };
    const result = adapter.readinessCheck(tmp, { _execFile: failExec });
    expect(result.passed).toBe(false);
    expect(result.report).toMatch(/Overall: NOT READY/);
    expect(result.remediations.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── discoverRunners: branches not covered by AC suite ──────────────────────

describe("python-adapter coverage: discoverRunners branches", () => {
  it("throws TypeError when projectPath is missing or non-string", async () => {
    await expect(adapter.discoverRunners(undefined)).rejects.toThrow(TypeError);
    await expect(adapter.discoverRunners(42)).rejects.toThrow(TypeError);
  });

  it("emits default command and single 'all' tier when no config exists", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    const result = await adapter.discoverRunners(tmp, {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("pytest --junitxml=test-results/pytest.xml");
    expect(result.primary.source).toBe("default");
    expect(result.manifest.tiers).toHaveProperty("all");
    expect(result.primary.tier).toBe("all");
  });

  it("parses TOML-array form of markers", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    const toml = `[tool.pytest.ini_options]
markers = ["unit: fast unit tests", "integration: slow ones", "e2e: browser"]
`;
    writeFileSync(join(tmp, "pyproject.toml"), toml);
    const result = await adapter.discoverRunners(tmp, {});
    expect(Object.keys(result.manifest.tiers)).toEqual(
      expect.arrayContaining(["unit", "integration", "e2e"])
    );
    expect(result.manifest.markers.unit).toMatch(/fast unit tests/);
    expect(result.primary.source).toBe("pyproject.toml:pytest-config");
  });

  it("marker lines without a colon become empty-description tiers", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    const ini = `[pytest]
markers =
    smoke
    regression: full regression sweep
`;
    writeFileSync(join(tmp, "pytest.ini"), ini);
    const result = await adapter.discoverRunners(tmp, {});
    expect(result.manifest.markers).toHaveProperty("smoke", "");
    expect(result.manifest.markers.regression).toMatch(/full regression/);
  });

  it("empty pytest.ini section yields single 'all' tier", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    writeFileSync(join(tmp, "pytest.ini"), "[pytest]\n");
    const result = await adapter.discoverRunners(tmp, {});
    expect(result.manifest.tiers).toEqual({ all: expect.anything() });
  });

  it("setup.cfg with no [tool:pytest] section falls back to default", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-cov-"));
    writeFileSync(join(tmp, "setup.cfg"), "[metadata]\nname = demo\n");
    const result = await adapter.discoverRunners(tmp, {});
    expect(result.primary.command).toBe("pytest --junitxml=test-results/pytest.xml");
    expect(result.manifest.tiers).toEqual({ all: expect.anything() });
  });
});
