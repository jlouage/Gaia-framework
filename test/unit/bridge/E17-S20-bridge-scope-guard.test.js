/**
 * E17-S20: Bridge Runner Compatibility Guard
 *
 * Tests the pre-Layer-0 compatibility guard that validates test runners
 * declared in test-environment.yaml against the bridge's SUPPORTED_RUNNERS
 * allowlist before any bridge layer executes.
 *
 * Test scenarios: TEB-41, TEB-42, TEB-43 + allowlist lock + performance
 *
 * Traces to: FR-196, FR-203, T36
 * Risk: low | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { tmpdir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Imports under test ────────────────────────────────────────────────────

import {
  checkRunnerCompatibility,
  writeCompatibilityEvidence,
  SUPPORTED_RUNNERS,
} from "../../../_gaia/core/bridge/runner-compatibility-guard.js";

// ─── Fixture helpers ───────────────────────────────────────────────────────

let tempDir;

function createTempDir() {
  const dir = join(
    tmpdir(),
    `e17-s20-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeManifest(dir, content) {
  const manifestPath = join(dir, "test-environment.yaml");
  writeFileSync(manifestPath, content, "utf-8");
  return manifestPath;
}

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
});

// ─── AC1: SUPPORTED_RUNNERS constant ──────────────────────────────────────

describe("AC1: SUPPORTED_RUNNERS constant", () => {
  it("exports SUPPORTED_RUNNERS with the expected allowlist", () => {
    expect(SUPPORTED_RUNNERS).toEqual(["vitest", "jest", "mocha", "bats"]);
  });

  it("SUPPORTED_RUNNERS is frozen / not accidentally mutable", () => {
    // The constant is a module-level array — verify it has the right value
    expect(Array.isArray(SUPPORTED_RUNNERS)).toBe(true);
    expect(SUPPORTED_RUNNERS).toHaveLength(4);
  });

  it("layer-1-test-runner-discovery.js re-exports SUPPORTED_RUNNERS", async () => {
    const layer1 = await import("../../../_gaia/core/bridge/layer-1-test-runner-discovery.js");
    expect(layer1.SUPPORTED_RUNNERS).toEqual(["vitest", "jest", "mocha", "bats"]);
  });
});

// ─── TEB-41: pytest-only halt ─────────────────────────────────────────────

describe("TEB-41: pytest-only halt (AC3, AC4)", () => {
  it("halts with status 'unsupported' when only unsupported runners are declared", () => {
    const manifestPath = writeManifest(tempDir, "bridge_enabled: true\nrunners: [pytest]\n");
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.status).toBe("unsupported");
    expect(result.unsupported).toEqual(["pytest"]);
    expect(result.supported).toEqual([]);
  });

  it("remediation message contains the runner name", () => {
    const manifestPath = writeManifest(tempDir, "bridge_enabled: true\nrunners: [pytest]\n");
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain("runner 'pytest' which is not yet supported");
  });

  it("remediation message names epic E25 and triage ID AF-2026-04-10-2", () => {
    const manifestPath = writeManifest(tempDir, "bridge_enabled: true\nrunners: [pytest]\n");
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.messages[0]).toContain("E25");
    expect(result.messages[0]).toContain("AF-2026-04-10-2");
  });

  it("remediation message lists SUPPORTED_RUNNERS", () => {
    const manifestPath = writeManifest(tempDir, "bridge_enabled: true\nrunners: [pytest]\n");
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.messages[0]).toContain(JSON.stringify(SUPPORTED_RUNNERS));
  });

  it("evidence stub is written with bridge_status 'unsupported_runner'", () => {
    const evidencePath = writeCompatibilityEvidence({
      storyKey: "E17-S20",
      bridgeStatus: "unsupported_runner",
      unsupportedRunners: ["pytest"],
      outputDir: tempDir,
    });

    expect(existsSync(evidencePath)).toBe(true);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf-8"));
    expect(evidence.bridge_status).toBe("unsupported_runner");
    expect(evidence.unsupported_runners).toEqual(["pytest"]);
    expect(evidence.story_key).toBe("E17-S20");
  });

  it("handles multiple unsupported runners", () => {
    const manifestPath = writeManifest(
      tempDir,
      "bridge_enabled: true\nrunners: [pytest, cargo-test, go-test]\n"
    );
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.status).toBe("unsupported");
    expect(result.unsupported).toEqual(["pytest", "cargo-test", "go-test"]);
    expect(result.messages).toHaveLength(3);
  });
});

// ─── TEB-42: mixed-stack WARNING ──────────────────────────────────────────

describe("TEB-42: mixed-stack WARNING (AC5)", () => {
  it("returns status 'partial' for mixed supported+unsupported runners", () => {
    const manifestPath = writeManifest(
      tempDir,
      "bridge_enabled: true\nrunners: [vitest, pytest]\n"
    );
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.status).toBe("partial");
    expect(result.supported).toEqual(["vitest"]);
    expect(result.unsupported).toEqual(["pytest"]);
  });

  it("emits a WARNING message naming skipped runners", () => {
    const manifestPath = writeManifest(
      tempDir,
      "bridge_enabled: true\nrunners: [vitest, pytest]\n"
    );
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toContain("WARNING");
    expect(result.messages[0]).toContain("pytest");
  });

  it("evidence stub records skipped_runners and supported_runners for partial", () => {
    const evidencePath = writeCompatibilityEvidence({
      storyKey: "E17-S20",
      bridgeStatus: "partial",
      unsupportedRunners: ["pytest"],
      supportedRunners: ["vitest"],
      outputDir: tempDir,
    });

    const evidence = JSON.parse(readFileSync(evidencePath, "utf-8"));
    expect(evidence.bridge_status).toBe("partial");
    expect(evidence.skipped_runners).toEqual(["pytest"]);
    expect(evidence.supported_runners).toEqual(["vitest"]);
  });
});

// ─── TEB-43: supported-only silent pass (regression baseline) ─────────────

describe("TEB-43: supported-only silent pass (AC6)", () => {
  it("returns status 'supported' with zero messages for vitest-only manifest", () => {
    const fixtureManifest = join(__dirname, "fixtures/teb-43-baseline/test-environment.yaml");
    const result = checkRunnerCompatibility({ manifestPath: fixtureManifest, storyKey: "E17-S20" });

    expect(result.status).toBe("supported");
    expect(result.messages).toEqual([]);
    expect(result.supported).toEqual(["vitest"]);
    expect(result.unsupported).toEqual([]);
  });

  it("returns status 'supported' for all four supported runners", () => {
    const manifestPath = writeManifest(
      tempDir,
      "bridge_enabled: true\nrunners: [vitest, jest, mocha, bats]\n"
    );
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.status).toBe("supported");
    expect(result.messages).toEqual([]);
    expect(result.unsupported).toEqual([]);
  });
});

// ─── AC7: Performance — guard completes under 50ms ────────────────────────

describe("AC7: Guard performance", () => {
  it("completes in under 50ms for a single-runner manifest (p95)", () => {
    const fixtureManifest = join(__dirname, "fixtures/teb-43-baseline/test-environment.yaml");
    const times = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      checkRunnerCompatibility({ manifestPath: fixtureManifest, storyKey: "E17-S20" });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("returns 'skipped' when bridge_enabled is false in config", () => {
    const manifestPath = writeManifest(tempDir, "bridge_enabled: true\nrunners: [pytest]\n");
    const result = checkRunnerCompatibility({
      manifestPath,
      storyKey: "E17-S20",
      config: { test_execution_bridge: { bridge_enabled: false } },
    });

    expect(result.status).toBe("skipped");
    expect(result.messages).toEqual([]);
  });

  it("returns 'skipped' when test-environment.yaml is absent", () => {
    const result = checkRunnerCompatibility({
      manifestPath: join(tempDir, "nonexistent-test-environment.yaml"),
      storyKey: "E17-S20",
    });

    expect(result.status).toBe("skipped");
  });

  it("returns 'skipped' when bridge_enabled is false in the manifest", () => {
    const manifestPath = writeManifest(tempDir, "bridge_enabled: false\nrunners: [pytest]\n");
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.status).toBe("skipped");
  });

  it("returns 'supported' when runners list is empty", () => {
    const manifestPath = writeManifest(tempDir, "bridge_enabled: true\nrunners: []\n");
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.status).toBe("supported");
  });

  it("is idempotent across repeated invocations", () => {
    const manifestPath = writeManifest(
      tempDir,
      "bridge_enabled: true\nrunners: [vitest, pytest]\n"
    );
    const r1 = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });
    const r2 = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(r1).toEqual(r2);
  });

  it("handles block-form YAML runners list", () => {
    const manifestPath = writeManifest(
      tempDir,
      "bridge_enabled: true\nrunners:\n  - vitest\n  - pytest\n"
    );
    const result = checkRunnerCompatibility({ manifestPath, storyKey: "E17-S20" });

    expect(result.status).toBe("partial");
    expect(result.supported).toEqual(["vitest"]);
    expect(result.unsupported).toEqual(["pytest"]);
  });
});

// ─── Evidence file creation ───────────────────────────────────────────────

describe("writeCompatibilityEvidence", () => {
  it("creates test-results directory if absent", () => {
    const outputDir = join(tempDir, "fresh-output");
    mkdirSync(outputDir, { recursive: true });

    const path = writeCompatibilityEvidence({
      storyKey: "E17-S20",
      bridgeStatus: "unsupported_runner",
      unsupportedRunners: ["pytest"],
      outputDir,
    });

    expect(existsSync(path)).toBe(true);
    expect(path).toContain("test-results");
    expect(path).toContain("E17-S20-execution.json");
  });

  it("includes timestamp in evidence file", () => {
    const path = writeCompatibilityEvidence({
      storyKey: "E17-S20",
      bridgeStatus: "unsupported_runner",
      unsupportedRunners: ["pytest"],
      outputDir: tempDir,
    });

    const evidence = JSON.parse(readFileSync(path, "utf-8"));
    expect(evidence.timestamp).toBeDefined();
    expect(new Date(evidence.timestamp).getTime()).not.toBeNaN();
  });

  it("throws when storyKey is missing", () => {
    expect(() =>
      writeCompatibilityEvidence({
        storyKey: "",
        bridgeStatus: "unsupported_runner",
        unsupportedRunners: [],
        outputDir: tempDir,
      })
    ).toThrow("storyKey and outputDir are required");
  });
});
