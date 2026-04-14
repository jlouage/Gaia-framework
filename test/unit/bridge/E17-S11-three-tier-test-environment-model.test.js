/**
 * E17-S11: Three-Tier Test Environment Model
 *
 * Unit tests for the tier selection helper and the Layer 3 evidence
 * tier field. The three tiers are formally defined as:
 *
 *   Tier 1 — unit        (fast, no external dependencies)
 *   Tier 2 — integration (services mocked)
 *   Tier 3 — e2e         (real external dependencies)
 *
 * Covers:
 *   AC1 — Three tiers are formally defined (tier constants + names)
 *   AC2 — test-environment.yaml `tiers` block maps each tier to a runner command
 *   AC3 — selectTier honours the declared tier or defaults to "run all"
 *   AC4 — Layer 3 evidence file records which tier was executed
 *   AC5 — Unconfigured tiers are skipped gracefully with a log message
 *
 * Traces: FR-195, ADR-028
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SELECT_TIER_MOD = "../../../_gaia/core/bridge/layer-2-tier-selection.js";
const LAYER3_MOD = "../../../_gaia/core/bridge/layer-3-result-parsing.js";

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "e17-s11-"));
});

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ─── AC1: Three tiers formally defined ─────────────────────────────────────

describe("AC1: Three-tier model — formal definitions", () => {
  it("exports TIERS with unit/integration/e2e entries and semantic metadata", async () => {
    const { TIERS } = await import(SELECT_TIER_MOD);
    expect(TIERS).toBeDefined();
    expect(TIERS.unit).toMatchObject({
      id: 1,
      name: "unit",
      description: expect.stringMatching(/no external dependencies/i),
    });
    expect(TIERS.integration).toMatchObject({
      id: 2,
      name: "integration",
      description: expect.stringMatching(/mocked/i),
    });
    expect(TIERS.e2e).toMatchObject({
      id: 3,
      name: "e2e",
      description: expect.stringMatching(/real external dependencies/i),
    });
  });

  it("normaliseTierName accepts names, numeric ids, and strings", async () => {
    const { normaliseTierName } = await import(SELECT_TIER_MOD);
    expect(normaliseTierName("unit")).toBe("unit");
    expect(normaliseTierName("UNIT")).toBe("unit");
    expect(normaliseTierName("integration")).toBe("integration");
    expect(normaliseTierName("e2e")).toBe("e2e");
    expect(normaliseTierName(1)).toBe("unit");
    expect(normaliseTierName(2)).toBe("integration");
    expect(normaliseTierName(3)).toBe("e2e");
    expect(normaliseTierName("1")).toBe("unit");
    expect(normaliseTierName(null)).toBe(null);
    expect(normaliseTierName(undefined)).toBe(null);
    expect(normaliseTierName("bogus")).toBe(null);
  });
});

// ─── AC2: test-environment.yaml tier→command map ──────────────────────────

describe("AC2: tier→command map read from test-environment.yaml", () => {
  it("selectTier returns the declared tier command when a named tier block is present", async () => {
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: {
        tiers: {
          unit: { command: "npx vitest run --testPathPattern=unit" },
          integration: { command: "npm run test:integration" },
          e2e: { command: "npx playwright test" },
        },
      },
      requestedTier: "unit",
    });
    expect(result.tier).toBe("unit");
    expect(result.command).toBe("npx vitest run --testPathPattern=unit");
    expect(result.skipped).toBe(false);
  });

  it("accepts numeric tier ids in the tiers block (1/2/3)", async () => {
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: {
        tiers: {
          1: { command: "npm run test:unit" },
          2: { command: "npm run test:integration" },
          3: { command: "npm run test:e2e" },
        },
      },
      requestedTier: 2,
    });
    expect(result.tier).toBe("integration");
    expect(result.command).toBe("npm run test:integration");
    expect(result.skipped).toBe(false);
  });
});

// ─── AC3: tier selection / run-all default ────────────────────────────────

describe("AC3: selectTier honours declared tier or defaults to run-all", () => {
  it("returns run-all when test-environment has no tiers block", async () => {
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: { runners: [{ name: "unit", command: "npm test", tier: 1 }] },
      requestedTier: null,
      fallbackCommand: "npm test",
    });
    expect(result.tier).toBe(null);
    expect(result.runAll).toBe(true);
    expect(result.command).toBe("npm test");
    expect(result.skipped).toBe(false);
  });

  it("returns run-all when tiers block is empty", async () => {
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: { tiers: {} },
      requestedTier: null,
      fallbackCommand: "npm test",
    });
    expect(result.runAll).toBe(true);
    expect(result.command).toBe("npm test");
  });

  it("returns run-all when requestedTier is null and tiers are declared but no default selected", async () => {
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: {
        tiers: { unit: { command: "vitest run --tier=unit" } },
      },
      requestedTier: null,
      fallbackCommand: "npm test",
    });
    expect(result.runAll).toBe(true);
    expect(result.command).toBe("npm test");
  });
});

// ─── AC5: Unconfigured tier handling ──────────────────────────────────────

describe("AC5: unconfigured tier is skipped gracefully", () => {
  it("marks skipped=true with a reason when the requested tier has no command", async () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: {
        tiers: { unit: { command: "npm run test:unit" } },
      },
      requestedTier: "e2e",
      logger,
    });
    expect(result.skipped).toBe(true);
    expect(result.tier).toBe("e2e");
    expect(result.command).toBe(null);
    expect(result.reason).toMatch(/not configured/i);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/tier "e2e".*skipped/i));
  });

  it("does not throw when tiers block entirely omits the requested tier", async () => {
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: { tiers: {} },
      requestedTier: "integration",
      fallbackCommand: "npm test",
    });
    // Empty tiers block is treated as "no tiers declared" → run-all.
    expect(result.runAll).toBe(true);
  });

  it("rejects an unknown tier name with a clear error result", async () => {
    const { selectTier } = await import(SELECT_TIER_MOD);
    const result = selectTier({
      testEnvironment: {
        tiers: { unit: { command: "npm run test:unit" } },
      },
      requestedTier: "nonexistent",
    });
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/unknown tier/i);
  });
});

// ─── AC4: Layer 3 evidence records tier ───────────────────────────────────

describe("AC4: Layer 3 evidence records the executed tier", () => {
  it("writeEvidence includes a tier field when tier is supplied", async () => {
    const { writeEvidence } = await import(LAYER3_MOD);
    const parsed = {
      summary: { total: 2, passed: 2, failed: 0, skipped: 0 },
      tests: [
        { name: "a", status: "passed", duration_ms: 1 },
        { name: "b", status: "passed", duration_ms: 2 },
      ],
    };
    const filePath = writeEvidence({
      parsed,
      storyKey: "E17-S11",
      runner: "vitest",
      mode: "local",
      durationSeconds: 3,
      outputDir: tempDir,
      tier: "unit",
    });
    expect(existsSync(filePath)).toBe(true);
    const doc = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(doc.tier).toBe("unit");
  });

  it("writeEvidence defaults tier to null when not supplied (backward compat)", async () => {
    const { writeEvidence } = await import(LAYER3_MOD);
    const parsed = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
      tests: [{ name: "a", status: "passed", duration_ms: 1 }],
    };
    const filePath = writeEvidence({
      parsed,
      storyKey: "E17-S11",
      runner: "vitest",
      mode: "local",
      durationSeconds: 1,
      outputDir: tempDir,
    });
    const doc = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(doc).toHaveProperty("tier", null);
  });

  it("writeEvidence accepts numeric tier ids and records the canonical name", async () => {
    const { writeEvidence } = await import(LAYER3_MOD);
    const parsed = {
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
      tests: [{ name: "a", status: "passed", duration_ms: 1 }],
    };
    const filePath = writeEvidence({
      parsed,
      storyKey: "E17-S11",
      runner: "vitest",
      mode: "local",
      durationSeconds: 1,
      outputDir: tempDir,
      tier: 3,
    });
    const doc = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(doc.tier).toBe("e2e");
  });
});
