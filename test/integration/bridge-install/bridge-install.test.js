/**
 * Integration Test: Bridge Install Regression Tests (BIRT)
 *
 * E17-S28 — Asserts that all critical bridge modules are present and functional
 * at their new _gaia/core/bridge/ location after E17-S27 relocation.
 *
 * Covers: BIRT-01 through BIRT-07 (AC2–AC8)
 * Traces to: FR-320, FR-321, ADR-040
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const BRIDGE_ROOT = join(PROJECT_ROOT, "_gaia", "core", "bridge");
const ADAPTERS_ROOT = join(BRIDGE_ROOT, "adapters");

describe("Bridge Install Regression Tests (BIRT)", () => {
  it("BIRT-01: bridge-toggle.js is present and importable", async () => {
    const modPath = join(BRIDGE_ROOT, "bridge-toggle.js");
    expect(existsSync(modPath)).toBe(true);
    const mod = await import(modPath);
    expect(mod).toBeTruthy();
    expect(typeof mod.readBridgeState).toBe("function");
    expect(typeof mod.toggleBridge).toBe("function");
    expect(typeof mod.buildSummary).toBe("function");
  });

  it("BIRT-02: layer-3-result-parsing.js exports correct API", async () => {
    const modPath = join(BRIDGE_ROOT, "layer-3-result-parsing.js");
    expect(existsSync(modPath)).toBe(true);
    const mod = await import(modPath);
    expect(typeof mod.parseResults).toBe("function");
    expect(typeof mod.writeEvidence).toBe("function");
    expect(typeof mod.deriveVerdict).toBe("function");
  });

  it("BIRT-03: bridge-post-flip-checks.js exports runPostFlipChecks", async () => {
    const modPath = join(BRIDGE_ROOT, "bridge-post-flip-checks.js");
    expect(existsSync(modPath)).toBe(true);
    const mod = await import(modPath);
    expect(typeof mod.runPostFlipChecks).toBe("function");
  });

  it("BIRT-04: adapters/index.js exports correct registry", async () => {
    const modPath = join(ADAPTERS_ROOT, "index.js");
    expect(existsSync(modPath)).toBe(true);
    const mod = await import(modPath);
    expect(typeof mod.getAdapter).toBe("function");
    expect(typeof mod.listAdapters).toBe("function");

    const adapters = mod.listAdapters();
    expect(Array.isArray(adapters)).toBe(true);
    expect(adapters.length).toBeGreaterThanOrEqual(5);

    const names = adapters.map((a) => a.name);
    for (const stack of ["javascript", "python", "java", "go", "flutter"]) {
      expect(names).toContain(stack);
    }
  });

  it("BIRT-05: bridge-toggle/instructions.xml contains no src/bridge references", () => {
    const xmlPath = join(
      PROJECT_ROOT,
      "_gaia",
      "core",
      "workflows",
      "bridge-toggle",
      "instructions.xml"
    );
    const content = readFileSync(xmlPath, "utf8");
    expect(content).not.toMatch(/src\/bridge/);
  });

  it("BIRT-06: dev-story/instructions.xml contains no src/bridge references", () => {
    const xmlPath = join(
      PROJECT_ROOT,
      "_gaia",
      "lifecycle",
      "workflows",
      "4-implementation",
      "dev-story",
      "instructions.xml"
    );
    const content = readFileSync(xmlPath, "utf8");
    expect(content).not.toMatch(/src\/bridge/);
  });

  it(
    "BIRT-07: npm pack --dry-run includes bridge-toggle.js",
    () => {
      const output = execSync("npm pack --dry-run 2>&1", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
        timeout: 30000,
      });
      expect(output).toContain("_gaia/core/bridge/bridge-toggle.js");
    },
    { timeout: 30000 }
  );
});
