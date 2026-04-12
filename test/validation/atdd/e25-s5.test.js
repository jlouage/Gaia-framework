/**
 * ATDD: E25-S5 — Stack Adapter Registry Refactor
 *
 * Acceptance tests for the pluggable adapter registry that isolates per-stack
 * logic from the four-layer protocol core. Tests are written in RED phase —
 * they must fail until the implementation ships.
 *
 * AC coverage: AC1 (directory/file structure), AC2 (registry API + static imports),
 *              AC3 (js-adapter extraction), AC4 (layer delegation), AC5 (regression),
 *              AC6 (init performance), AC7 (contract enforcement)
 *
 * Traces to: FR-307, NFR-047, ADR-028, ADR-038, T37
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readdirSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

// ─── Path constants ───────────────────────────────────────────────────────────

const BRIDGE_DIR = join(PROJECT_ROOT, "src", "bridge");
const ADAPTERS_DIR = join(BRIDGE_DIR, "adapters");
const REGISTRY_PATH = join(ADAPTERS_DIR, "index.js");
const JS_ADAPTER_PATH = join(ADAPTERS_DIR, "js-adapter.js");
const LAYER_0_PATH = join(BRIDGE_DIR, "layer-0-environment-check.js");
const LAYER_1_PATH = join(BRIDGE_DIR, "layer-1-test-runner-discovery.js");
const LAYER_3_PATH = join(BRIDGE_DIR, "layer-3-result-parsing.js");

// ─── AC1: Directory and file structure ───────────────────────────────────────

describe("AC1: adapters/ directory structure", () => {
  it("src/bridge/adapters/ directory exists", () => {
    expect(existsSync(ADAPTERS_DIR)).toBe(true);
  });

  it("adapters/index.js exists", () => {
    expect(existsSync(REGISTRY_PATH)).toBe(true);
  });

  it("adapters/js-adapter.js exists", () => {
    expect(existsSync(JS_ADAPTER_PATH)).toBe(true);
  });

  it("adapters/ contains at minimum index.js and js-adapter.js (E25-S1+ may add more)", () => {
    const jsFiles = readdirSync(ADAPTERS_DIR).filter((f) => f.endsWith(".js"));
    expect(jsFiles).toEqual(expect.arrayContaining(["index.js", "js-adapter.js"]));
  });

  it("java-adapter.js, go-adapter.js, flutter-adapter.js do NOT exist yet (E25-S2..E25-S4 pending)", () => {
    // E25-S1 has landed — python-adapter.js is expected to exist. The remaining
    // stack adapters below are still forbidden until their respective stories land.
    const forbiddenAdapters = ["java-adapter.js", "go-adapter.js", "flutter-adapter.js"];
    for (const file of forbiddenAdapters) {
      expect(existsSync(join(ADAPTERS_DIR, file))).toBe(false);
    }
  });
});

// ─── AC2: Registry API and static imports ────────────────────────────────────

describe("AC2: registry API — listAdapters() and getAdapter()", () => {
  let registryModule;

  beforeAll(async () => {
    registryModule = await import(REGISTRY_PATH + "?bust=" + Date.now());
  });

  it("registry exports listAdapters function", () => {
    expect(typeof registryModule.listAdapters).toBe("function");
  });

  it("registry exports getAdapter function", () => {
    expect(typeof registryModule.getAdapter).toBe("function");
  });

  it("listAdapters() returns a non-empty array of StackAdapter objects", () => {
    const adapters = registryModule.listAdapters();
    expect(Array.isArray(adapters)).toBe(true);
    expect(adapters.length).toBeGreaterThan(0);
  });

  it("listAdapters() returns adapters in deterministic order with javascript first", () => {
    const adapters = registryModule.listAdapters();
    expect(adapters[0].name).toBe("javascript");
  });

  it("getAdapter() returns jsAdapter for a project with package.json", async () => {
    // PROJECT_ROOT has a package.json — should match js adapter
    const adapter = registryModule.getAdapter(PROJECT_ROOT);
    expect(adapter).not.toBeNull();
    expect(adapter.name).toBe("javascript");
  });

  it("getAdapter() returns null for a directory with no known stack files", async () => {
    // Create a truly empty temp dir — no package.json, no detection patterns
    const tmpPath = mkdtempSync(join(tmpdir(), "gaia-atdd-"));
    const adapter = registryModule.getAdapter(tmpPath);
    expect(adapter).toBeNull();
  });

  it("registry index.js contains no require(userPath) or dynamic import(userPath) calls", () => {
    const source = readFileSync(REGISTRY_PATH, "utf8");
    expect(source).not.toMatch(/require\s*\(\s*[^'"]/);
    expect(source).not.toMatch(/import\s*\(\s*[^'"]/);
  });

  it("registry index.js uses only static ES module imports", () => {
    const source = readFileSync(REGISTRY_PATH, "utf8");
    // All import statements should be static (import X from '...')
    // No dynamic import() with variable expressions
    expect(source).not.toMatch(/import\s*\(\s*(?!['"])/);
  });
});

// ─── AC3: js-adapter.js contains all JS-specific logic ───────────────────────

describe("AC3: js-adapter.js extraction of JS-specific logic", () => {
  it("js-adapter.js exports a readinessCheck function", async () => {
    const mod = await import(JS_ADAPTER_PATH + "?bust=" + Date.now());
    const adapter = mod.default ?? mod;
    expect(typeof adapter.readinessCheck).toBe("function");
  });

  it("js-adapter.js exports a discoverRunners function", async () => {
    const mod = await import(JS_ADAPTER_PATH + "?bust=" + Date.now());
    const adapter = mod.default ?? mod;
    expect(typeof adapter.discoverRunners).toBe("function");
  });

  it("js-adapter.js exports a parseOutput function", async () => {
    const mod = await import(JS_ADAPTER_PATH + "?bust=" + Date.now());
    const adapter = mod.default ?? mod;
    expect(typeof adapter.parseOutput).toBe("function");
  });

  it("js-adapter.js source references package.json readiness logic (moved from layer-0)", () => {
    const source = readFileSync(JS_ADAPTER_PATH, "utf8");
    // Should contain Node version check or package.json existence logic
    expect(source).toMatch(/package\.json|engines\.node|Node.*version/i);
  });

  it("js-adapter.js source contains SUPPORTED_RUNNERS (renamed from KNOWN_JS_RUNNERS)", () => {
    const source = readFileSync(JS_ADAPTER_PATH, "utf8");
    expect(source).toMatch(/SUPPORTED_RUNNERS/);
  });

  it("js-adapter.js source does NOT use the old KNOWN_JS_RUNNERS name", () => {
    const source = readFileSync(JS_ADAPTER_PATH, "utf8");
    expect(source).not.toMatch(/KNOWN_JS_RUNNERS/);
  });

  it("js-adapter.js source contains output parser logic (TAP/Vitest/Jest/Mocha/BATS)", () => {
    const source = readFileSync(JS_ADAPTER_PATH, "utf8");
    expect(source).toMatch(/vitest|jest|mocha|tap|bats/i);
  });

  it("js-adapter default export has name: 'javascript'", async () => {
    const mod = await import(JS_ADAPTER_PATH + "?bust=" + Date.now());
    const adapter = mod.default ?? mod;
    expect(adapter.name).toBe("javascript");
  });

  it("js-adapter default export has detectionPatterns: ['package.json']", async () => {
    const mod = await import(JS_ADAPTER_PATH + "?bust=" + Date.now());
    const adapter = mod.default ?? mod;
    expect(adapter.detectionPatterns).toEqual(["package.json"]);
  });
});

// ─── AC4: Layer files delegate to adapter — no stack-specific conditionals ───

describe("AC4: layer core files contain no JS-specific logic", () => {
  it("layer-0-environment-check.js does not contain KNOWN_JS_RUNNERS", () => {
    const source = readFileSync(LAYER_0_PATH, "utf8");
    expect(source).not.toMatch(/KNOWN_JS_RUNNERS/);
  });

  it("layer-0-environment-check.js does not contain stack-specific conditionals", () => {
    const source = readFileSync(LAYER_0_PATH, "utf8");
    expect(source).not.toMatch(/if\s*\(\s*(stack|runner)\s*===?\s*['"]javascript['"]/);
  });

  it("layer-1-test-runner-discovery.js does not contain KNOWN_JS_RUNNERS", () => {
    const source = readFileSync(LAYER_1_PATH, "utf8");
    expect(source).not.toMatch(/KNOWN_JS_RUNNERS/);
  });

  it("layer-1-test-runner-discovery.js does not contain vitest|jest|mocha|bats runner literals as hardcoded logic", () => {
    const source = readFileSync(LAYER_1_PATH, "utf8");
    // The source should not define KNOWN_JS_RUNNERS or SUPPORTED_RUNNERS — that lives in js-adapter.js now
    expect(source).not.toMatch(/const\s+(?:KNOWN_JS_RUNNERS|SUPPORTED_RUNNERS)\s*=/);
  });

  it("layer-3-result-parsing.js does not contain JS-specific parser logic", () => {
    const source = readFileSync(LAYER_3_PATH, "utf8");
    // TAP/Vitest/Jest/Mocha/BATS parsers should not be defined inline here
    expect(source).not.toMatch(/function\s+parse(?:Vitest|Jest|Mocha|Tap|Bats)/i);
  });

  it("layer-0-environment-check.js calls adapter.readinessCheck via registry", () => {
    const source = readFileSync(LAYER_0_PATH, "utf8");
    expect(source).toMatch(/getAdapter|adapter\.readinessCheck/);
  });

  it("layer-1-test-runner-discovery.js calls adapter.discoverRunners", () => {
    const source = readFileSync(LAYER_1_PATH, "utf8");
    expect(source).toMatch(/adapter\.discoverRunners/);
  });

  it("layer-3-result-parsing.js calls adapter.parseOutput", () => {
    const source = readFileSync(LAYER_3_PATH, "utf8");
    expect(source).toMatch(/adapter\.parseOutput/);
  });
});

// ─── AC5: Regression — byte-identical output ─────────────────────────────────

describe("AC5: E17 regression — byte-identical output after refactor", () => {
  const BASELINE_DIR = join(PROJECT_ROOT, "test", "fixtures", "bridge", "baseline");
  const VITEST_BASELINE = join(BASELINE_DIR, "vitest-evidence.json");
  const BATS_BASELINE = join(BASELINE_DIR, "bats-evidence.json");

  it("baseline/vitest-evidence.json exists (captured before refactor)", () => {
    expect(existsSync(VITEST_BASELINE)).toBe(true);
  });

  it("baseline/bats-evidence.json exists (captured before refactor)", () => {
    expect(existsSync(BATS_BASELINE)).toBe(true);
  });

  it("post-refactor Vitest evidence matches baseline (non-timing fields byte-identical)", async () => {
    // Import bridge orchestrator and feed pre-captured TAP output through the
    // refactored parsing path to verify byte-identical non-timing output.
    const { runBridge } = await import(
      join(PROJECT_ROOT, "src", "bridge", "bridge-orchestrator.js") + "?bust=" + Date.now()
    );
    const VITEST_FIXTURE = join(PROJECT_ROOT, "test", "fixtures", "bridge", "vitest-project");
    const capturedOutput = readFileSync(join(VITEST_FIXTURE, "captured-output.txt"), "utf8");
    const result = await runBridge({
      projectPath: VITEST_FIXTURE,
      storyKey: "E25-S5-regression",
      executionOutput: { stdout: capturedOutput, stderr: "", exit_code: 1, runner: "vitest" },
    });
    const baseline = JSON.parse(readFileSync(VITEST_BASELINE, "utf8"));
    const actual = result.evidence;

    // Compare non-timing fields byte-for-byte
    const timingFields = new Set(["duration", "timestamp", "elapsed_ms", "started_at", "ended_at"]);
    for (const key of Object.keys(baseline)) {
      if (!timingFields.has(key)) {
        expect(actual[key]).toEqual(baseline[key]);
      }
    }
  });

  it("post-refactor BATS evidence matches baseline (non-timing fields byte-identical)", async () => {
    const { runBridge } = await import(
      join(PROJECT_ROOT, "src", "bridge", "bridge-orchestrator.js") + "?bust=" + Date.now()
    );
    const BATS_FIXTURE = join(PROJECT_ROOT, "test", "fixtures", "bridge", "bats-project");
    const capturedOutput = readFileSync(join(BATS_FIXTURE, "captured-output.txt"), "utf8");
    const result = await runBridge({
      projectPath: BATS_FIXTURE,
      storyKey: "E25-S5-bats-regression",
      executionOutput: { stdout: capturedOutput, stderr: "", exit_code: 1, runner: "bats" },
    });
    const baseline = JSON.parse(readFileSync(BATS_BASELINE, "utf8"));
    const actual = result.evidence;

    const timingFields = new Set(["duration", "timestamp", "elapsed_ms", "started_at", "ended_at"]);
    for (const key of Object.keys(baseline)) {
      if (!timingFields.has(key)) {
        expect(actual[key]).toEqual(baseline[key]);
      }
    }
  });
});

// ─── AC6: Registry initialization performance ─────────────────────────────────

describe("AC6: registry init performance — p95 < 10ms over 100 warm runs", () => {
  it("registry initializes in under 10ms (p95 over 100 warm runs)", async () => {
    const timings = [];

    // Warm up: force the module to load first
    const { listAdapters } = await import(REGISTRY_PATH + "?bust=warmup");
    listAdapters();

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      listAdapters(); // warm run — module already loaded
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95)];

    expect(p95).toBeLessThan(10);
  });
});

// ─── AC7: Contract enforcement — loud failure on missing required fields ──────

describe("AC7: contract enforcement — registry fails loudly on missing adapter fields", () => {
  /**
   * Helper: create a stub adapter module source missing a specific field,
   * write it to a temp path, and attempt to import it via the registry.
   * Because we cannot dynamically inject into the registry, we test the
   * validateAdapter() helper directly.
   */
  let validateAdapter;

  beforeAll(async () => {
    // The registry should export validateAdapter for direct testing, OR
    // we import it from a dedicated contract validator module.
    const reg = await import(REGISTRY_PATH + "?bust=contract-" + Date.now());
    validateAdapter = reg.validateAdapter;
  });

  it("validateAdapter is exported from the registry", () => {
    expect(typeof validateAdapter).toBe("function");
  });

  it("throws with 'missing field: name' when adapter.name is absent", () => {
    const stub = {
      detectionPatterns: ["package.json"],
      readinessCheck: () => {},
      discoverRunners: () => {},
      parseOutput: () => {},
    };
    expect(() => validateAdapter(stub, "stub-adapter.js")).toThrow(/missing field: name/i);
  });

  it("throws with 'missing field: detectionPatterns' when detectionPatterns is absent", () => {
    const stub = {
      name: "stub",
      readinessCheck: () => {},
      discoverRunners: () => {},
      parseOutput: () => {},
    };
    expect(() => validateAdapter(stub, "stub-adapter.js")).toThrow(
      /missing field: detectionPatterns/i
    );
  });

  it("throws with 'missing field: readinessCheck' when readinessCheck is absent", () => {
    const stub = {
      name: "stub",
      detectionPatterns: ["stub.lock"],
      discoverRunners: () => {},
      parseOutput: () => {},
    };
    expect(() => validateAdapter(stub, "stub-adapter.js")).toThrow(
      /missing field: readinessCheck/i
    );
  });

  it("throws with 'missing field: discoverRunners' when discoverRunners is absent", () => {
    const stub = {
      name: "stub",
      detectionPatterns: ["stub.lock"],
      readinessCheck: () => {},
      parseOutput: () => {},
    };
    expect(() => validateAdapter(stub, "stub-adapter.js")).toThrow(
      /missing field: discoverRunners/i
    );
  });

  it("throws with 'missing field: parseOutput' when parseOutput is absent", () => {
    const stub = {
      name: "stub",
      detectionPatterns: ["stub.lock"],
      readinessCheck: () => {},
      discoverRunners: () => {},
    };
    expect(() => validateAdapter(stub, "stub-adapter.js")).toThrow(/missing field: parseOutput/i);
  });

  it("throws with 'missing field: parseOutput' when parseOutput is explicitly undefined", () => {
    const stub = {
      name: "stub",
      detectionPatterns: ["stub.lock"],
      readinessCheck: () => {},
      discoverRunners: () => {},
      parseOutput: undefined,
    };
    expect(() => validateAdapter(stub, "stub-adapter.js")).toThrow(/missing field: parseOutput/i);
  });

  it("error message includes the offending module path", () => {
    const stub = {
      name: "stub",
      detectionPatterns: ["stub.lock"],
      readinessCheck: () => {},
      discoverRunners: () => {},
    };
    expect(() => validateAdapter(stub, "/some/path/stub-adapter.js")).toThrow(
      /\/some\/path\/stub-adapter\.js/
    );
  });

  it("an adapter with all five required fields loads successfully (no throw)", () => {
    const validAdapter = {
      name: "stub-valid",
      detectionPatterns: ["stub.lock"],
      readinessCheck: () => {},
      discoverRunners: () => {},
      parseOutput: () => {},
    };
    expect(() => validateAdapter(validAdapter, "stub-valid-adapter.js")).not.toThrow();
  });
});

// ─── Layer-file purity (Test Scenario #8) ────────────────────────────────────

describe("Layer-file purity: zero JS-specific literals in core layer files", () => {
  it("layer-0 source has no 'vitest' literal (moved to js-adapter)", () => {
    const source = readFileSync(LAYER_0_PATH, "utf8");
    expect(source).not.toMatch(/\bvitest\b/);
  });

  it("layer-0 source has no 'jest' literal (moved to js-adapter)", () => {
    const source = readFileSync(LAYER_0_PATH, "utf8");
    expect(source).not.toMatch(/\bjest\b/);
  });

  it("layer-1 source has no 'KNOWN_JS_RUNNERS' constant definition", () => {
    const source = readFileSync(LAYER_1_PATH, "utf8");
    expect(source).not.toMatch(/KNOWN_JS_RUNNERS/);
  });

  it("layer-3 source has no 'TAP' parser inline definition (moved to js-adapter)", () => {
    const source = readFileSync(LAYER_3_PATH, "utf8");
    expect(source).not.toMatch(/parseTap|TAP_REGEX|tap.*result/i);
  });
});

// ─── KNOWN_JS_RUNNERS rename propagation (Test Scenario #10) ─────────────────

describe("KNOWN_JS_RUNNERS rename: zero occurrences outside changelog/migration", () => {
  const SOURCE_DIRS = [
    join(PROJECT_ROOT, "src"),
    join(PROJECT_ROOT, "bin"),
    join(PROJECT_ROOT, "test"),
  ];

  it("no source or test file references the old KNOWN_JS_RUNNERS name", () => {
    // Build the old constant name dynamically to avoid this test file matching itself
    const OLD_CONSTANT = ["KNOWN", "JS", "RUNNERS"].join("_");
    // This ATDD test file is excluded from the scan — it references the old name
    // only in test assertions and comments, not as a code-level constant definition.
    const THIS_FILE = join(PROJECT_ROOT, "test", "validation", "atdd", "e25-s5.test.js");

    function scanDir(dir) {
      if (!existsSync(dir)) return [];
      const entries = readdirSync(dir, { withFileTypes: true });
      const hits = [];
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules") {
          hits.push(...scanDir(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".js") && fullPath !== THIS_FILE) {
          const content = readFileSync(fullPath, "utf8");
          if (content.includes(OLD_CONSTANT)) {
            hits.push(fullPath);
          }
        }
      }
      return hits;
    }

    const allHits = SOURCE_DIRS.flatMap(scanDir);
    expect(allHits).toEqual([]);
  });
});
