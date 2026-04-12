/**
 * ATDD: E25-S1 — Python/pytest Stack Adapter
 *
 * Acceptance tests for the Python/pytest stack adapter plugging into the
 * E25-S5 registry. Covers TEB-MS-P01..P06.
 *
 * AC coverage: AC1 (contract + patterns), AC2 (readiness + remediation),
 *              AC3 (discoverRunners + markers), AC4 (parseOutput JUnit XML),
 *              AC5 (parse_error fallback), AC6 (tier mapping),
 *              AC7 (registry init budget).
 *
 * Traces to: FR-307, FR-308, NFR-047, ADR-028, ADR-038
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const BRIDGE_DIR = join(PROJECT_ROOT, "src", "bridge");
const ADAPTERS_DIR = join(BRIDGE_DIR, "adapters");
const REGISTRY_PATH = join(ADAPTERS_DIR, "index.js");
const PYTHON_ADAPTER_PATH = join(ADAPTERS_DIR, "python-adapter.js");

const FIXTURES = join(PROJECT_ROOT, "test", "fixtures", "bridge", "python");

// ─── AC1: Contract compliance (TEB-MS-P01) ──────────────────────────────────

describe("E25-S1 AC1: adapter contract and detection patterns", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(PYTHON_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("python-adapter.js exists", () => {
    expect(existsSync(PYTHON_ADAPTER_PATH)).toBe(true);
  });

  it("exports default object with name 'python'", () => {
    expect(adapter.name).toBe("python");
  });

  it("detectionPatterns contains the four pytest config files", () => {
    expect(adapter.detectionPatterns).toEqual([
      "pyproject.toml",
      "pytest.ini",
      "setup.cfg",
      "setup.py",
    ]);
  });

  it("exports all five StackAdapter contract functions/fields", () => {
    expect(typeof adapter.readinessCheck).toBe("function");
    expect(typeof adapter.discoverRunners).toBe("function");
    expect(typeof adapter.parseOutput).toBe("function");
  });

  it("is registered by the registry after the javascript adapter", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const names = reg.listAdapters().map((a) => a.name);
    expect(names).toContain("python");
    expect(names.indexOf("python")).toBe(names.indexOf("javascript") + 1);
  });

  it("getAdapter() matches a project containing only pytest.ini (OR semantics)", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const proj = join(FIXTURES, "pytest-ini");
    const picked = reg.getAdapter(proj);
    expect(picked).not.toBeNull();
    expect(picked.name).toBe("python");
  });
});

// ─── AC2: readinessCheck (TEB-MS-P02, P03) ──────────────────────────────────

describe("E25-S1 AC2: readinessCheck success and failure modes", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(PYTHON_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  /**
   * Build a fake execFile that returns success or failure for python / pytest
   * import checks. Returns the function and a log of invocations.
   */
  function makeFakeExec({ pythonExists = true, pytestImportable = true } = {}) {
    const calls = [];
    function fake(cmd, args /*, opts */) {
      calls.push({ cmd, args });
      if (cmd === "python3" || cmd === "python") {
        if (!pythonExists) {
          const err = new Error("ENOENT");
          err.code = "ENOENT";
          throw err;
        }
        if (args && args.includes("-c") && args.some((a) => a.includes("import pytest"))) {
          if (!pytestImportable) {
            const err = new Error("ModuleNotFoundError: pytest");
            err.status = 1;
            throw err;
          }
          return Buffer.from("", "utf8");
        }
        return Buffer.from("Python 3.11.0\n", "utf8");
      }
      const err = new Error("unknown command " + cmd);
      err.code = "ENOENT";
      throw err;
    }
    return { fake, calls };
  }

  it("returns passed=true when interpreter + config + pytest are present", () => {
    const { fake } = makeFakeExec({ pythonExists: true, pytestImportable: true });
    const result = adapter.readinessCheck(join(FIXTURES, "pyproject"), { _execFile: fake });
    expect(result.passed).toBe(true);
    expect(result.remediation).toBeNull();
  });

  it("returns passed=false with interpreter-specific remediation when python is missing", () => {
    const { fake } = makeFakeExec({ pythonExists: false });
    const result = adapter.readinessCheck(join(FIXTURES, "pyproject"), { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/python/i);
    expect(result.remediation).toMatch(/interpreter|install|PATH/i);
  });

  it("returns passed=false with pytest-specific remediation when pytest is not importable", () => {
    const { fake } = makeFakeExec({ pythonExists: true, pytestImportable: false });
    const result = adapter.readinessCheck(join(FIXTURES, "pyproject"), { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/pytest/i);
    expect(result.remediation).toMatch(/pip install pytest/i);
  });

  it("returns passed=false with config-specific remediation when no detection file exists", () => {
    const { fake } = makeFakeExec({ pythonExists: true, pytestImportable: true });
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-"));
    const result = adapter.readinessCheck(tmp, { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/pyproject\.toml/);
    expect(result.remediation).toMatch(/pytest\.ini/);
    expect(result.remediation).toMatch(/setup\.cfg/);
    expect(result.remediation).toMatch(/setup\.py/);
  });

  it("distinct remediation strings for each failure mode", () => {
    const { fake: noPy } = makeFakeExec({ pythonExists: false });
    const { fake: noPytest } = makeFakeExec({ pythonExists: true, pytestImportable: false });
    const { fake: ok } = makeFakeExec({});
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-"));

    const missingPy = adapter.readinessCheck(join(FIXTURES, "pyproject"), {
      _execFile: noPy,
    }).remediation;
    const missingPytest = adapter.readinessCheck(join(FIXTURES, "pyproject"), {
      _execFile: noPytest,
    }).remediation;
    const missingCfg = adapter.readinessCheck(tmp, { _execFile: ok }).remediation;

    expect(missingPy).not.toEqual(missingPytest);
    expect(missingPytest).not.toEqual(missingCfg);
    expect(missingPy).not.toEqual(missingCfg);
  });
});

// ─── AC3 + AC6: discoverRunners + marker-based tier mapping (TEB-MS-P04) ─────

describe("E25-S1 AC3/AC6: discoverRunners and tier mapping", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(PYTHON_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("returns primary command `pytest --junitxml=test-results/pytest.xml`", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "pyproject"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("pytest --junitxml=test-results/pytest.xml");
    expect(result.primary.runner_name).toBe("pytest");
  });

  it("parses markers from pyproject.toml [tool.pytest.ini_options]", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "pyproject"), {});
    expect(result.manifest.tiers).toBeDefined();
    // Defined markers flow through to tier labels
    expect(Object.keys(result.manifest.tiers)).toEqual(
      expect.arrayContaining(["unit", "integration"])
    );
  });

  it("parses markers from pytest.ini", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "pytest-ini"), {});
    expect(Object.keys(result.manifest.tiers)).toEqual(
      expect.arrayContaining(["unit", "integration", "e2e"])
    );
  });

  it("parses markers from setup.cfg [tool:pytest]", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "setup-cfg"), {});
    expect(Object.keys(result.manifest.tiers)).toEqual(
      expect.arrayContaining(["unit", "integration"])
    );
  });

  it("falls back to a single 'all' tier when no markers are declared", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "single-file"), {});
    expect(result.manifest.tiers).toEqual({ all: expect.anything() });
  });

  it("pyproject.toml without [tool.pytest.ini_options] still emits default command", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-pyproj-"));
    writeFileSync(join(tmp, "pyproject.toml"), "[build-system]\nrequires = []\n");
    const result = await adapter.discoverRunners(tmp, {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("pytest --junitxml=test-results/pytest.xml");
  });
});

// ─── AC4 + AC5: parseOutput (TEB-MS-P05) ─────────────────────────────────────

describe("E25-S1 AC4/AC5: parseOutput JUnit XML and parse_error fallback", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(PYTHON_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("parses JUnit XML from test-results/pytest.xml into summary + tests", () => {
    const result = adapter.parseOutput("", "", 1, {
      _projectPath: join(FIXTURES, "pyproject"),
    });
    expect(result.summary).toEqual({ total: 3, passed: 1, failed: 1, skipped: 1 });
    expect(result.tests).toHaveLength(3);
    const names = result.tests.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "tests.test_math.test_add",
        "tests.test_math.test_subtract",
        "tests.test_math.test_skip",
      ])
    );
    const failed = result.tests.find((t) => t.status === "failed");
    expect(failed.failure_message).toMatch(/assert 1 == 2/);
  });

  it("returns parse_error=true when exitCode is non-zero and XML is missing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s1-parse-"));
    const stderr = "FATAL: pytest crashed\n" + "x".repeat(5000);
    const result = adapter.parseOutput("", stderr, 2, { _projectPath: tmp });
    expect(result.parse_error).toBe(true);
    expect(typeof result.stderr_snippet).toBe("string");
    expect(result.stderr_snippet.length).toBeLessThanOrEqual(2048);
    expect(result.stderr_snippet).toContain("FATAL: pytest crashed");
  });
});

// ─── AC7: Registry init performance budget ───────────────────────────────────

describe("E25-S1 AC7: registry init stays within NFR-047 50ms budget", () => {
  it("registry listAdapters() p95 under 50ms over 100 warm runs with python adapter registered", async () => {
    const { listAdapters } = await import(REGISTRY_PATH + "?bust=warmup-" + Date.now());
    listAdapters();

    const timings = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      listAdapters();
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});
