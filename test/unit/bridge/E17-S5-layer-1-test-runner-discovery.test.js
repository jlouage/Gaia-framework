/**
 * E17-S5: Bridge Layer 1 — Test Runner Discovery (ATDD)
 *
 * Story: Layer 1 automatically discovers which test runners are configured
 * in the project so the correct runner is invoked without manual configuration.
 *
 * Traces: FR-196, FR-201 | Test cases: TEB-21 to TEB-25
 * Risk: medium | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

import { discoverRunners } from "../../../src/bridge/layer-1-test-runner-discovery.js";

let tmpRoot;

function writePkg(dir, pkg) {
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
}

function writeTestEnv(dir, content) {
  writeFileSync(join(dir, "test-environment.yaml"), content);
}

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "gaia-e17-s5-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ─── AC1 / TEB-21 — Vitest via devDependency ────────────────────────────────

describe("E17-S5 Layer 1 — Runner Detection (AC1)", () => {
  it("TEB-21: detects Vitest from package.json devDependencies", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      devDependencies: { vitest: "^1.0.0" },
    });

    const result = await discoverRunners({ projectPath: tmpRoot });

    expect(result.status).toBe("ok");
    expect(result.primary.runner_name).toBe("vitest");
    // Manifest has the expected shape (AC5)
    expect(result.primary).toMatchObject({
      runner_name: expect.any(String),
      command: expect.any(String),
      source: expect.any(String),
    });
    // tier_mapping may be null when no test-environment.yaml tiers block exists
    expect(result.primary).toHaveProperty("tier_mapping");
  });

  it("detects Jest and Mocha from devDependencies", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      devDependencies: { jest: "^29.0.0" },
    });
    let result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("ok");
    expect(result.primary.runner_name).toBe("jest");

    writePkg(tmpRoot, {
      name: "fixture",
      devDependencies: { mocha: "^10.0.0" },
    });
    result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("ok");
    expect(result.primary.runner_name).toBe("mocha");
  });

  it("detects runner declared in test-environment.yaml", async () => {
    writePkg(tmpRoot, { name: "fixture" });
    writeTestEnv(
      tmpRoot,
      `version: 2
runners:
  - name: unit
    command: "npm test"
    tier: 1
primary_runner: unit
`
    );

    const result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("ok");
    expect(result.primary.source).toBe("test-environment.yaml");
    expect(result.primary.runner_name).toBe("unit");
    expect(result.primary.command).toBe("npm test");
  });
});

// ─── AC2 / TEB-22 — Priority ranking ────────────────────────────────────────

describe("E17-S5 Layer 1 — Priority Ranking (AC2)", () => {
  it("TEB-22: test-environment.yaml primary outranks package.json detection", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      scripts: { test: "jest" },
      devDependencies: { jest: "^29.0.0", vitest: "^1.0.0" },
    });
    writeTestEnv(
      tmpRoot,
      `version: 2
runners:
  - name: unit
    command: "npm run test:custom"
    tier: 1
primary_runner: unit
`
    );

    const result = await discoverRunners({ projectPath: tmpRoot });

    expect(result.status).toBe("ok");
    expect(result.primary.source).toBe("test-environment.yaml");
    expect(result.primary.runner_name).toBe("unit");
  });

  it("package.json test script outranks devDependency-only detection", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      scripts: { test: "vitest run" },
      devDependencies: { jest: "^29.0.0", vitest: "^1.0.0" },
    });

    const result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("ok");
    expect(result.primary.runner_name).toBe("vitest");
    expect(result.primary.source).toBe("package.json:scripts.test");
  });
});

// ─── AC3 / TEB-23 — Disambiguation ──────────────────────────────────────────

describe("E17-S5 Layer 1 — Disambiguation (AC3)", () => {
  it("TEB-23: multiple runners with no primary_runner returns disambiguation", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      devDependencies: { jest: "^29.0.0", vitest: "^1.0.0" },
    });

    const result = await discoverRunners({ projectPath: tmpRoot });

    expect(result.status).toBe("disambiguation");
    expect(result.candidates).toBeInstanceOf(Array);
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    const names = result.candidates.map((c) => c.runner_name).sort();
    expect(names).toEqual(["jest", "vitest"]);
  });

  it("skips menu when test-environment.yaml specifies a primary runner", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      devDependencies: { jest: "^29.0.0", vitest: "^1.0.0" },
    });
    writeTestEnv(
      tmpRoot,
      `version: 2
runners:
  - name: vitest
    command: "vitest run"
    tier: 1
primary_runner: vitest
`
    );

    const result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("ok");
    expect(result.primary.runner_name).toBe("vitest");
  });
});

// ─── AC4 / TEB-24 — No runner halt ──────────────────────────────────────────

describe("E17-S5 Layer 1 — No Runner Detected (AC4)", () => {
  it("TEB-24: halts with error when no runner is detected", async () => {
    writePkg(tmpRoot, { name: "fixture" }); // no deps, no scripts

    const result = await discoverRunners({ projectPath: tmpRoot });

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/no test runner/i);
    expect(result.message).toMatch(/test-environment\.yaml/);
  });

  it("halts when package.json is absent and no test-environment.yaml", async () => {
    const result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/no test runner/i);
  });
});

// ─── AC5 / TEB-25 — Structured runner manifest ──────────────────────────────

describe("E17-S5 Layer 1 — Runner Manifest Shape (AC5)", () => {
  it("TEB-25: emits a structured manifest for Layer 2", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      devDependencies: { vitest: "^1.0.0" },
    });
    writeTestEnv(
      tmpRoot,
      `version: 2
runners:
  - name: unit
    command: "npm test"
    tier: 1
    promotion_chain_env_id: "dev"
primary_runner: unit
tiers:
  1:
    gates: [qa-tests, test-automate]
`
    );

    const result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("ok");
    expect(result.manifest).toBeDefined();
    expect(result.manifest.primary_runner).toBeDefined();
    expect(result.manifest.runners).toBeInstanceOf(Array);
    // Each manifest entry has the canonical Layer 2 handoff shape
    for (const r of result.manifest.runners) {
      expect(r).toMatchObject({
        runner_name: expect.any(String),
        command: expect.any(String),
        source: expect.any(String),
      });
      expect(r).toHaveProperty("tier_mapping");
    }
  });
});

// ─── Layer scope (Dev Note) — Layer 1 is read-only ──────────────────────────

describe("E17-S5 Layer 1 — Read-only (no execution)", () => {
  it("does not execute anything — pure discovery", async () => {
    writePkg(tmpRoot, {
      name: "fixture",
      devDependencies: { vitest: "^1.0.0" },
      scripts: {
        test: "echo 'LAYER_1_MUST_NOT_RUN_THIS' && exit 1",
      },
    });

    // If Layer 1 executed the test script this would throw or the process
    // would exit non-zero — the discovery call must return normally.
    const result = await discoverRunners({ projectPath: tmpRoot });
    expect(result.status).toBe("ok");
  });
});
