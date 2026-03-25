const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js
// Tests for E3-S1 coverage gaps — complements smoke.test.js

const ROOT = path.resolve(__dirname, "../../..");

describe("Vitest config — additional coverage (AC2)", () => {
  const configPath = path.resolve(ROOT, "vitest.config.js");
  const configSource = fs.readFileSync(configPath, "utf8");

  it("should include validation/atdd glob pattern", () => {
    expect(configSource).toContain("test/validation/atdd/");
  });

  it("should include unit test glob pattern", () => {
    expect(configSource).toContain("test/unit/");
  });

  it("should include integration test glob pattern", () => {
    expect(configSource).toContain("test/integration/");
  });

  it("should use v8 coverage provider", () => {
    expect(configSource).toMatch(/provider:\s*['"]v8['"]/);
  });

  it("should configure coverage reporters (text, lcov, json-summary)", () => {
    expect(configSource).toContain("text");
    expect(configSource).toContain("lcov");
    expect(configSource).toContain("json-summary");
  });

  it("should exclude test/ and node_modules/ from coverage", () => {
    expect(configSource).toMatch(/exclude:.*test/s);
    expect(configSource).toContain("node_modules/**");
  });

  it("should set globals: true for Vitest globals API", () => {
    expect(configSource).toMatch(/globals:\s*true/);
  });
});

describe("package.json scripts (AC3, AC4)", () => {
  const pkgPath = path.resolve(ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  it("should have 'test' script that runs vitest with coverage (E3-S6)", () => {
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.test).toBe("vitest run --coverage");
    // E3-S6: coverage always runs with npm test to enforce thresholds
    expect(pkg.scripts.test).toContain("--coverage");
  });

  it("should have 'test:coverage' script with coverage flag (AC3)", () => {
    expect(pkg.scripts["test:coverage"]).toBeDefined();
    expect(pkg.scripts["test:coverage"]).toContain("--coverage");
  });

  it("should have vitest as a devDependency (AC1)", () => {
    expect(pkg.devDependencies.vitest).toBeDefined();
  });

  it("should have @vitest/coverage-v8 as a devDependency (AC3)", () => {
    expect(pkg.devDependencies["@vitest/coverage-v8"]).toBeDefined();
  });

  it("should have Tier 1 parsing libraries as devDependencies (AC6)", () => {
    expect(pkg.devDependencies["js-yaml"]).toBeDefined();
    expect(pkg.devDependencies["fast-xml-parser"]).toBeDefined();
    expect(pkg.devDependencies["csv-parse"]).toBeDefined();
  });

  it("should have zero runtime dependencies (ADR-005)", () => {
    // package.json should not have a 'dependencies' field, or it should be empty
    const deps = pkg.dependencies || {};
    expect(Object.keys(deps).length).toBe(0);
  });

  it("should require Node.js >= 20", () => {
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines.node).toBe(">=20");
  });
});

describe("package-lock.json (AC8)", () => {
  it("should exist in the project root", () => {
    const lockPath = path.resolve(ROOT, "package-lock.json");
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("should be tracked by git", () => {
    // Verify package-lock.json is not gitignored
    const result = execFileSync("git", ["ls-files", "package-lock.json"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    expect(result).toBe("package-lock.json");
  });
});

describe("Transitive dependency budget (AC7)", () => {
  it("should have fewer than 450 transitive dependencies (hard fail)", () => {
    const result = execFileSync(
      "npm",
      ["ls", "--all", "--parseable"],
      { cwd: ROOT, encoding: "utf8" },
    );
    const depCount = result.trim().split("\n").length;
    expect(depCount).toBeLessThan(450);
  });

  it("should warn if transitive dependencies exceed 350 (soft gate)", () => {
    const result = execFileSync(
      "npm",
      ["ls", "--all", "--parseable"],
      { cwd: ROOT, encoding: "utf8" },
    );
    const depCount = result.trim().split("\n").length;
    // This is a soft gate — test passes but logs a warning
    if (depCount > 350) {
      console.warn(
        `WARNING: Transitive dependency count (${depCount}) exceeds soft threshold of 350`,
      );
    }
    // Hard assertion: must be under 450
    expect(depCount).toBeLessThan(450);
  });
});

describe("test/validation/atdd/ directory (AC2, AC5)", () => {
  it("should have the validation/atdd directory for ATDD tests", () => {
    const atddDir = path.resolve(ROOT, "test/validation/atdd");
    expect(fs.existsSync(atddDir)).toBe(true);
  });
});
