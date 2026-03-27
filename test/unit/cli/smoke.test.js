const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

describe("Smoke test — CJS require() under forks pool", () => {
  const cliPath = path.resolve(__dirname, "../../../bin/gaia-framework.js");

  it("should syntax-check bin/gaia-framework.js as valid CJS under forks pool", () => {
    expect(fs.existsSync(cliPath)).toBe(true);
    // AC1 + AC9 — Node can parse this CJS file without syntax errors
    // We use --check flag to verify syntax without executing (main() calls process.exit)
    expect(() => {
      execFileSync(process.execPath, ["--check", cliPath]);
    }).not.toThrow();
  });

  it("should use CJS require() pattern for dependencies", () => {
    const source = fs.readFileSync(cliPath, "utf8");
    // Verify CJS require() is used — this is a CJS entry point that loads built-in modules
    expect(source).toMatch(/require\(/);
    expect(source).toContain('require("child_process")');
    expect(source).toContain('require("fs")');
  });

  it("should require Tier 1 parsing libraries via CJS require()", () => {
    // AC6 — js-yaml, fast-xml-parser, csv-parse importable via require()
    expect(() => require("js-yaml")).not.toThrow();
    expect(() => require("fast-xml-parser")).not.toThrow();
    expect(() => require("csv-parse/sync")).not.toThrow();
  });
});

describe("Vitest config requirements", () => {
  const configPath = path.resolve(__dirname, "../../../vitest.config.js");
  const configSource = fs.readFileSync(configPath, "utf8");

  it("should have pool set to forks (AC1)", () => {
    expect(configSource).toMatch(/pool:\s*['"]forks['"]/);
  });

  it("should include test/shell glob pattern (AC2)", () => {
    expect(configSource).toContain("test/shell/");
  });

  it("should have 50% line coverage threshold enforced (E3-S6)", () => {
    expect(configSource).toMatch(/lines:\s*50/);
    expect(configSource).toMatch(/functions:\s*0/);
    expect(configSource).toMatch(/branches:\s*0/);
    expect(configSource).toMatch(/statements:\s*0/);
  });

  it("should have E3-S6 comment documenting threshold rationale", () => {
    expect(configSource).toMatch(/E3-S6/i);
  });
});

describe("Test directory scaffold (AC5)", () => {
  const root = path.resolve(__dirname, "../../..");

  const requiredDirs = [
    "test/unit/cli",
    "test/integration",
    "test/validation/tier1",
    "test/shell",
    "test/fixtures",
    "test/validators",
  ];

  it.each(requiredDirs)("should have %s directory", (dir) => {
    expect(fs.existsSync(path.join(root, dir))).toBe(true);
  });
});
