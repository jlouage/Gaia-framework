/**
 * E20-S11 — Backward Compatibility: No ci_cd Block
 *
 * Verifies the promotion-chain guard handles every "absent" variant uniformly,
 * and that the dev-story Step 13 guard wording explicitly enumerates them.
 *
 * Acceptance Criteria covered:
 *   AC1 — All affected workflows treat absent ci_cd identically to pre-E20.
 *   AC2 — Dev-story Steps 13-16 silently skipped when chain absent.
 *   AC4 — Config resolution does not fail / inject defaults / warn on missing ci_cd.
 *   AC6 — MPC-40 + regression suite covers every variant.
 *   AC7 — All "absent" variants (null, {}, [], partial) treated uniformly.
 *   AC8 — Partial ci_cd block (no promotion_chain) is treated as absent.
 *
 * AC3 (ci-edit) and AC5 (E17 test bridge) are deferred to E20-S4 and the
 * E17 bridge story respectively — those workflows do not yet exist.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import { chainPresent } from "../../../scripts/lib/promotion-chain-guard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const FIXTURES = join(REPO_ROOT, "test", "fixtures", "e20-s11");

const loadFixture = (name) => yaml.load(readFileSync(join(FIXTURES, name), "utf8"));

const ABSENT_VARIANTS = [
  ["no ci_cd section", "global-no-ci-cd.yaml"],
  ["ci_cd: null", "global-ci-cd-null.yaml"],
  ["ci_cd: {} (empty mapping)", "global-ci-cd-empty.yaml"],
  ["ci_cd with no promotion_chain key", "global-ci-cd-no-chain.yaml"],
  ["promotion_chain: null", "global-promotion-chain-null.yaml"],
  ["promotion_chain: [] (empty array)", "global-promotion-chain-empty.yaml"],
];

describe("E20-S11 — promotion chain guard helper (chainPresent)", () => {
  describe('returns false for every "absent" variant (AC1, AC4, AC7, AC8)', () => {
    for (const [label, fixture] of ABSENT_VARIANTS) {
      it(`treats ${label} as absent`, () => {
        const cfg = loadFixture(fixture);
        expect(chainPresent(cfg)).toBe(false);
      });
    }
  });

  it("returns true for a valid populated promotion_chain (positive control)", () => {
    const cfg = loadFixture("global-with-promotion-chain.yaml");
    expect(chainPresent(cfg)).toBe(true);
  });

  it("is a pure boolean predicate (no side effects, no mutation)", () => {
    const cfg = loadFixture("global-ci-cd-no-chain.yaml");
    const snapshot = JSON.stringify(cfg);
    chainPresent(cfg);
    expect(JSON.stringify(cfg)).toBe(snapshot);
  });

  it("handles null / undefined input defensively (config resolution edge)", () => {
    expect(chainPresent(null)).toBe(false);
    expect(chainPresent(undefined)).toBe(false);
    expect(chainPresent({})).toBe(false);
  });
});

describe("E20-S11 — dev-story instructions.xml Step 13 guard wording (AC2)", () => {
  const instructionsPath = join(
    REPO_ROOT,
    "_gaia",
    "lifecycle",
    "workflows",
    "4-implementation",
    "dev-story",
    "instructions.xml"
  );
  const xml = readFileSync(instructionsPath, "utf8");

  it("Step 13 cites NFR-045 (backward compatibility requirement)", () => {
    expect(xml).toMatch(/NFR-045/);
  });

  it("Step 13 guard explicitly handles ci_cd absent variants", () => {
    // The hardened wording must enumerate all "absent" variants so future
    // maintainers cannot accidentally regress backward compatibility.
    const guardSection = xml.match(/PROMOTION CHAIN GUARD[\s\S]*?Proceed directly to Step 17/);
    expect(guardSection, "Step 13 must contain a PROMOTION CHAIN GUARD block").not.toBeNull();
    const text = guardSection[0];

    // Variant enumeration — every "absent" form must be named.
    expect(text).toMatch(/ci_cd block is absent/);
    expect(text).toMatch(/null/);
    expect(text).toMatch(/empty mapping|empty object|\{\}/);
    expect(text).toMatch(/empty array|\[\]/);
    expect(text).toMatch(/no promotion_chain|missing promotion_chain|without.*promotion_chain/);
  });

  it("Step 13 guard pledges silent skip (no error, no warning, no output)", () => {
    expect(xml).toMatch(/skip Steps 13, 14, 15, and 16 silently/);
    expect(xml).toMatch(/no error, no warning/);
  });
});

describe("E20-S11 — workflow engine config resolution tolerance (AC4)", () => {
  const enginePath = join(REPO_ROOT, "_gaia", "core", "engine", "workflow.xml");
  const xml = readFileSync(enginePath, "utf8");

  it("engine documents that missing ci_cd is a no-op (no defaults, no warning)", () => {
    expect(xml).toMatch(/ci_cd/);
    expect(xml).toMatch(/no-op|no defaults|no warning|backward compat/i);
  });
});
