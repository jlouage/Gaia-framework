/**
 * E17-S4: Bridge Layer 0 — Environment Readiness Check (ATDD)
 *
 * Story: Layer 0 verifies the local environment can run tests before any
 * runner is invoked so bridge failures are caught early with clear remediation.
 *
 * Traces: FR-192, NFR-033, NFR-035 | Test cases: TEB-16 to TEB-20
 * Risk: medium | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

import { checkEnvironmentReadiness } from "../../../src/bridge/layer-0-environment-check.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

let tmpRoot;

function writePkg(dir, pkg) {
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
}

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "gaia-e17-s4-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── AC1 — Layer 0 checks ────────────────────────────────────────────────────

describe("E17-S4 Layer 0 — Environment Readiness Check (AC1)", () => {
  it("TEB-16: passes when Node, npm, package.json, and test scripts all present", () => {
    writePkg(tmpRoot, {
      name: "fixture",
      engines: { node: ">=18" },
      scripts: { test: "vitest run" },
    });
    writeFileSync(join(tmpRoot, "package-lock.json"), "{}");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });

    expect(result.ready).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "node-version", passed: true }),
        expect.objectContaining({ name: "package-manager", passed: true }),
        expect.objectContaining({ name: "package-json-exists", passed: true }),
        expect.objectContaining({ name: "test-script-defined", passed: true }),
      ])
    );
    expect(result.remediations).toEqual([]);
  });

  it("detects yarn via yarn.lock", () => {
    writePkg(tmpRoot, { name: "fixture", scripts: { test: "jest" } });
    writeFileSync(join(tmpRoot, "yarn.lock"), "");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });
    const pmCheck = result.checks.find((c) => c.name === "package-manager");
    expect(pmCheck.passed).toBe(true);
    expect(pmCheck.detected).toBe("yarn");
  });

  it("detects pnpm via pnpm-lock.yaml", () => {
    writePkg(tmpRoot, { name: "fixture", scripts: { test: "mocha" } });
    writeFileSync(join(tmpRoot, "pnpm-lock.yaml"), "");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });
    const pmCheck = result.checks.find((c) => c.name === "package-manager");
    expect(pmCheck.passed).toBe(true);
    expect(pmCheck.detected).toBe("pnpm");
  });
});

// ─── AC2 — All-pass readiness report ────────────────────────────────────────

describe("E17-S4 Layer 0 — Readiness report (AC2)", () => {
  it("TEB-17: emits readiness report with tabular summary when all checks pass", () => {
    writePkg(tmpRoot, {
      name: "fixture",
      engines: { node: ">=18" },
      scripts: { test: "vitest run" },
    });
    writeFileSync(join(tmpRoot, "package-lock.json"), "{}");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });

    expect(result.ready).toBe(true);
    expect(result.report).toBeDefined();
    expect(typeof result.report).toBe("string");
    // Tabular: every check name should appear in the report
    expect(result.report).toContain("node-version");
    expect(result.report).toContain("package-manager");
    expect(result.report).toContain("package-json-exists");
    expect(result.report).toContain("test-script-defined");
  });
});

// ─── AC3 — Halt with remediation on failure ─────────────────────────────────

describe("E17-S4 Layer 0 — Remediation messages (AC3)", () => {
  it("TEB-18: returns remediation when package.json is missing", () => {
    // empty dir — no package.json → no adapter matches → not ready
    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });

    expect(result.ready).toBe(false);
    // Post E25-S5 refactor: when no adapter matches (no package.json → js adapter
    // doesn't match), layer-0 returns a "no adapter found" remediation instead of
    // running stack-specific checks.
    expect(result.adapter).toBeNull();
    expect(result.remediations.length).toBeGreaterThan(0);
    expect(result.remediations.join(" ")).toMatch(/package\.json/i);
  });

  it("returns remediation when test script is not defined", () => {
    writePkg(tmpRoot, { name: "fixture", scripts: { build: "tsc" } });
    writeFileSync(join(tmpRoot, "package-lock.json"), "{}");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });

    expect(result.ready).toBe(false);
    const testCheck = result.checks.find((c) => c.name === "test-script-defined");
    expect(testCheck.passed).toBe(false);
    expect(result.remediations.join(" ")).toMatch(/test script/i);
  });

  it("returns remediation when no package manager lockfile is present", () => {
    writePkg(tmpRoot, { name: "fixture", scripts: { test: "vitest" } });
    // no lockfile

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });

    expect(result.ready).toBe(false);
    const pmCheck = result.checks.find((c) => c.name === "package-manager");
    expect(pmCheck.passed).toBe(false);
    expect(result.remediations.join(" ")).toMatch(/package manager|lockfile|npm|yarn|pnpm/i);
  });

  it("returns remediation when Node.js is below required minimum", () => {
    writePkg(tmpRoot, {
      name: "fixture",
      engines: { node: ">=999" },
      scripts: { test: "vitest" },
    });
    writeFileSync(join(tmpRoot, "package-lock.json"), "{}");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });

    expect(result.ready).toBe(false);
    const nodeCheck = result.checks.find((c) => c.name === "node-version");
    expect(nodeCheck.passed).toBe(false);
    expect(result.remediations.join(" ")).toMatch(/node/i);
  });
});

// ─── AC4 — Performance (NFR-033) ─────────────────────────────────────────────

describe("E17-S4 Layer 0 — Performance (AC4, NFR-033)", () => {
  it("TEB-19: completes within 5 seconds on a clean fixture", () => {
    writePkg(tmpRoot, {
      name: "fixture",
      engines: { node: ">=18" },
      scripts: { test: "vitest run" },
    });
    writeFileSync(join(tmpRoot, "package-lock.json"), "{}");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot });

    expect(result.elapsedMs).toBeDefined();
    expect(result.elapsedMs).toBeLessThan(5000);
  });
});

// ─── AC5 — bridge_enabled guard (NFR-035) ────────────────────────────────────

describe("E17-S4 Layer 0 — bridge_enabled guard (AC5, NFR-035)", () => {
  it("TEB-20: skipped entirely when bridge_enabled is false", () => {
    // Even with a broken environment (empty tmpRoot), skipping should short-circuit
    const result = checkEnvironmentReadiness({
      projectPath: tmpRoot,
      config: { test_execution_bridge: { bridge_enabled: false } },
    });

    expect(result.skipped).toBe(true);
    expect(result.ready).toBe(true); // non-blocking: skipped means "pass through"
    expect(result.checks).toEqual([]);
    expect(result.remediations).toEqual([]);
  });

  it("runs checks when bridge_enabled is true", () => {
    writePkg(tmpRoot, {
      name: "fixture",
      scripts: { test: "vitest" },
    });
    writeFileSync(join(tmpRoot, "package-lock.json"), "{}");

    const result = checkEnvironmentReadiness({
      projectPath: tmpRoot,
      config: { test_execution_bridge: { bridge_enabled: true } },
    });

    expect(result.skipped).toBe(false);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it("runs checks when bridge_enabled is absent (default: enabled)", () => {
    writePkg(tmpRoot, { name: "fixture", scripts: { test: "vitest" } });
    writeFileSync(join(tmpRoot, "package-lock.json"), "{}");

    const result = checkEnvironmentReadiness({ projectPath: tmpRoot, config: {} });
    expect(result.skipped).toBe(false);
  });
});
