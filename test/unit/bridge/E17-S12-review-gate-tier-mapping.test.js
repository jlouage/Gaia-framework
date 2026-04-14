/**
 * E17-S12: Review Gate-to-Tier Mapping Table
 *
 * Tests the canonical mapping between the six review gates and the three
 * test tiers from E17-S11. Covers:
 *   - AC1: DEFAULT_GATE_TIER_MAPPING contains the canonical six-gate mapping
 *   - AC2: resolveGateTierMapping merges a custom mapping over the default
 *          (and falls back to the default when no custom mapping is present)
 *   - AC3: formatNudgeSuggestion produces the tier suggestion string used by
 *          the Nudge Block when a gate is UNVERIFIED
 *
 * Traces: FR-195, ADR-028, architecture §10.20.4
 */

import { describe, it, expect } from "vitest";

import {
  DEFAULT_GATE_TIER_MAPPING,
  REVIEW_GATES,
  resolveGateTierMapping,
  getTiersForGate,
  formatNudgeSuggestion,
} from "../../../_gaia/core/bridge/review-gate-tier-mapping.js";

describe("E17-S12 — Review Gate-to-Tier Mapping Table", () => {
  describe("DEFAULT_GATE_TIER_MAPPING (AC1)", () => {
    it("declares all six review gates", () => {
      const gates = Object.keys(DEFAULT_GATE_TIER_MAPPING).sort();
      expect(gates).toEqual(
        [
          "code-review",
          "qa-tests",
          "review-perf",
          "security-review",
          "test-automate",
          "test-review",
        ].sort()
      );
    });

    it("maps qa-tests to Tier 1 + Tier 2 (unit + integration)", () => {
      expect(DEFAULT_GATE_TIER_MAPPING["qa-tests"]).toEqual(["unit", "integration"]);
    });

    it("maps test-automate to Tier 1 (unit) only", () => {
      expect(DEFAULT_GATE_TIER_MAPPING["test-automate"]).toEqual(["unit"]);
    });

    it("maps test-review to Tier 2 (integration) only", () => {
      expect(DEFAULT_GATE_TIER_MAPPING["test-review"]).toEqual(["integration"]);
    });

    it("maps review-perf to Tier 3 (e2e) only", () => {
      expect(DEFAULT_GATE_TIER_MAPPING["review-perf"]).toEqual(["e2e"]);
    });

    it("maps security-review to Tier 2 + Tier 3 (integration + e2e)", () => {
      expect(DEFAULT_GATE_TIER_MAPPING["security-review"]).toEqual(["integration", "e2e"]);
    });

    it("maps code-review to no tier (static analysis only)", () => {
      expect(DEFAULT_GATE_TIER_MAPPING["code-review"]).toEqual([]);
    });

    it("REVIEW_GATES enumerates the six canonical gate names", () => {
      expect(REVIEW_GATES).toHaveLength(6);
      expect(REVIEW_GATES).toContain("code-review");
      expect(REVIEW_GATES).toContain("qa-tests");
      expect(REVIEW_GATES).toContain("security-review");
      expect(REVIEW_GATES).toContain("test-automate");
      expect(REVIEW_GATES).toContain("test-review");
      expect(REVIEW_GATES).toContain("review-perf");
    });

    it("DEFAULT_GATE_TIER_MAPPING is frozen (immutable)", () => {
      expect(Object.isFrozen(DEFAULT_GATE_TIER_MAPPING)).toBe(true);
    });
  });

  describe("resolveGateTierMapping (AC2)", () => {
    it("returns the default mapping when test-environment.yaml is absent", () => {
      const mapping = resolveGateTierMapping(null);
      expect(mapping).toEqual(DEFAULT_GATE_TIER_MAPPING);
    });

    it("returns the default mapping when test-environment.yaml has no tiers block", () => {
      const mapping = resolveGateTierMapping({});
      expect(mapping).toEqual(DEFAULT_GATE_TIER_MAPPING);
    });

    it("returns the default mapping when tiers.gate_mapping is absent", () => {
      const mapping = resolveGateTierMapping({ tiers: {} });
      expect(mapping).toEqual(DEFAULT_GATE_TIER_MAPPING);
    });

    it("returns the default mapping when tiers.gate_mapping is empty", () => {
      const mapping = resolveGateTierMapping({ tiers: { gate_mapping: {} } });
      expect(mapping).toEqual(DEFAULT_GATE_TIER_MAPPING);
    });

    it("merges a custom mapping over the default (AC2)", () => {
      const custom = {
        tiers: {
          gate_mapping: {
            "qa-tests": ["unit"], // override from [unit, integration] to [unit] only
          },
        },
      };
      const mapping = resolveGateTierMapping(custom);
      expect(mapping["qa-tests"]).toEqual(["unit"]);
      // other gates retain defaults
      expect(mapping["test-automate"]).toEqual(["unit"]);
      expect(mapping["security-review"]).toEqual(["integration", "e2e"]);
      expect(mapping["code-review"]).toEqual([]);
    });

    it("allows a custom mapping to add a tier to code-review", () => {
      const custom = { tiers: { gate_mapping: { "code-review": ["unit"] } } };
      const mapping = resolveGateTierMapping(custom);
      expect(mapping["code-review"]).toEqual(["unit"]);
    });

    it("normalises numeric-id tier values in custom mappings", () => {
      const custom = { tiers: { gate_mapping: { "qa-tests": [1, 2] } } };
      const mapping = resolveGateTierMapping(custom);
      expect(mapping["qa-tests"]).toEqual(["unit", "integration"]);
    });

    it("ignores unknown tier names in custom mappings (does not crash)", () => {
      const custom = { tiers: { gate_mapping: { "qa-tests": ["unit", "bogus"] } } };
      const mapping = resolveGateTierMapping(custom);
      expect(mapping["qa-tests"]).toEqual(["unit"]);
    });

    it("ignores unknown gate names in custom mappings", () => {
      const custom = { tiers: { gate_mapping: { "not-a-gate": ["unit"] } } };
      const mapping = resolveGateTierMapping(custom);
      expect(Object.keys(mapping).sort()).toEqual(Object.keys(DEFAULT_GATE_TIER_MAPPING).sort());
      expect(mapping["not-a-gate"]).toBeUndefined();
    });

    it("returned mapping is independent of the default (no shared refs)", () => {
      const mapping = resolveGateTierMapping(null);
      // The returned mapping must be deep-cloned so mutations by callers
      // cannot silently corrupt the frozen default.
      expect(mapping).not.toBe(DEFAULT_GATE_TIER_MAPPING);
      expect(mapping["qa-tests"]).not.toBe(DEFAULT_GATE_TIER_MAPPING["qa-tests"]);
    });
  });

  describe("getTiersForGate", () => {
    it("returns the tier list for a known gate", () => {
      expect(getTiersForGate("qa-tests")).toEqual(["unit", "integration"]);
    });

    it("returns [] for code-review (no tier)", () => {
      expect(getTiersForGate("code-review")).toEqual([]);
    });

    it("returns null for an unknown gate", () => {
      expect(getTiersForGate("not-a-gate")).toBeNull();
    });

    it("honours a caller-provided mapping override", () => {
      const custom = resolveGateTierMapping({
        tiers: { gate_mapping: { "qa-tests": ["unit"] } },
      });
      expect(getTiersForGate("qa-tests", custom)).toEqual(["unit"]);
    });
  });

  describe("formatNudgeSuggestion (AC3)", () => {
    it("formats qa-tests as 'run Tier 1 + Tier 2 tests'", () => {
      expect(formatNudgeSuggestion("qa-tests")).toBe("run Tier 1 + Tier 2 tests");
    });

    it("formats test-automate as 'run Tier 1 tests'", () => {
      expect(formatNudgeSuggestion("test-automate")).toBe("run Tier 1 tests");
    });

    it("formats test-review as 'run Tier 2 tests'", () => {
      expect(formatNudgeSuggestion("test-review")).toBe("run Tier 2 tests");
    });

    it("formats review-perf as 'run Tier 3 tests'", () => {
      expect(formatNudgeSuggestion("review-perf")).toBe("run Tier 3 tests");
    });

    it("formats security-review as 'run Tier 2 + Tier 3 tests'", () => {
      expect(formatNudgeSuggestion("security-review")).toBe("run Tier 2 + Tier 3 tests");
    });

    it("formats code-review with no-tier message (AC3 + Scenario 4)", () => {
      expect(formatNudgeSuggestion("code-review")).toBe("no tier required (static analysis only)");
    });

    it("returns null for an unknown gate", () => {
      expect(formatNudgeSuggestion("not-a-gate")).toBeNull();
    });

    it("honours a caller-provided mapping override", () => {
      const custom = resolveGateTierMapping({
        tiers: { gate_mapping: { "qa-tests": ["e2e"] } },
      });
      expect(formatNudgeSuggestion("qa-tests", custom)).toBe("run Tier 3 tests");
    });
  });
});
