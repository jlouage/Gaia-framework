import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

/**
 * E28-S30: Dual ground-truth.md refresh in val-refresh-ground-truth
 *
 * Acceptance:
 *   AC1 — val-refresh-ground-truth refreshes both runtime and committed
 *         sidecar locations by default.
 *   AC2 — Committed seed preserves entry_count: 0 and estimated_tokens: 0
 *         (empty-seed invariant from E28-S31).
 *   AC3 — ground-truth-management skill documents the dual-refresh behavior.
 *
 * This test is a static-artifact test: it asserts the workflow instructions,
 * workflow.yaml, skill documentation, and committed Tier 1 seeds carry the
 * dual-refresh contract. Runtime behavior is exercised by E28-S31's test
 * (which already guards entry_count: 0) plus manual end-to-end runs.
 */

const WORKFLOW_DIR = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "val-refresh-ground-truth"
);
const INSTRUCTIONS = join(WORKFLOW_DIR, "instructions.xml");
const WORKFLOW_YAML = join(WORKFLOW_DIR, "workflow.yaml");
const SKILL = join(PROJECT_ROOT, "_gaia", "lifecycle", "skills", "ground-truth-management.md");

const TIER_1_SEEDS = ["validator-sidecar", "architect-sidecar", "pm-sidecar", "sm-sidecar"];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error("No YAML frontmatter found");
  return yaml.load(match[1]);
}

describe("E28-S30: dual ground-truth.md refresh", () => {
  describe("AC1: workflow refreshes both runtime and committed locations", () => {
    it("instructions.xml contains a dual-write step for the committed seed", () => {
      const xml = readFileSync(INSTRUCTIONS, "utf-8");
      expect(xml).toMatch(/Dual-Write Committed Tier 1 Seed/);
      expect(xml).toMatch(/\{project-path\}\/_memory\//);
      expect(xml).toMatch(/validator-sidecar/);
      expect(xml).toMatch(/architect-sidecar/);
      expect(xml).toMatch(/pm-sidecar/);
      expect(xml).toMatch(/sm-sidecar/);
    });

    it("instructions.xml fails loud when committed seed is missing", () => {
      const xml = readFileSync(INSTRUCTIONS, "utf-8");
      expect(xml).toMatch(/committed seed file missing/i);
      expect(xml).toMatch(/HALT/);
    });

    it("instructions.xml critical mandate enumerates dual-refresh", () => {
      const xml = readFileSync(INSTRUCTIONS, "utf-8");
      expect(xml).toMatch(/Dual-refresh/);
      expect(xml).toMatch(/BOTH the runtime sidecar.*AND the committed seed/s);
    });

    it("workflow.yaml declares a committed_seed output path", () => {
      const wf = yaml.load(readFileSync(WORKFLOW_YAML, "utf-8"));
      expect(wf.output).toBeDefined();
      expect(wf.output.primary).toMatch(/validator-sidecar\/ground-truth\.md$/);
      expect(wf.output.committed_seed).toContain(
        "{project-path}/_memory/validator-sidecar/ground-truth.md"
      );
    });

    it("workflow.yaml requires the dual-refresh skill section", () => {
      const wf = yaml.load(readFileSync(WORKFLOW_YAML, "utf-8"));
      expect(wf.required_skill_sections).toContain("ground-truth-management:dual-refresh");
      expect(wf.required_skill_sections).toContain("memory-management:empty-seed-invariant");
    });
  });

  describe("AC2: committed seed preserves empty-seed invariant", () => {
    it("instructions.xml enforces entry_count/estimated_tokens = 0 post-write", () => {
      const xml = readFileSync(INSTRUCTIONS, "utf-8");
      expect(xml).toMatch(/entry_count == 0 AND estimated_tokens == 0/);
      expect(xml).toMatch(/Empty-seed invariant violated/);
    });

    it("instructions.xml cross-references E28-S31", () => {
      const xml = readFileSync(INSTRUCTIONS, "utf-8");
      expect(xml).toMatch(/E28-S31/);
    });

    // Redundant with e28-s31.test.js but locks the coupling: E28-S30's
    // contract relies on these seeds existing and being empty.
    for (const sidecar of TIER_1_SEEDS) {
      it(`${sidecar} committed seed is still empty after E28-S30 lands`, () => {
        const seedPath = join(PROJECT_ROOT, "_memory", sidecar, "ground-truth.md");
        expect(existsSync(seedPath)).toBe(true);
        const fm = parseFrontmatter(readFileSync(seedPath, "utf-8"));
        expect(fm.entry_count).toBe(0);
        expect(fm.estimated_tokens).toBe(0);
        expect(fm.tier).toBe(1);
      });
    }
  });

  describe("AC3: ground-truth-management skill documents dual-refresh", () => {
    it("skill frontmatter lists dual-refresh in sections", () => {
      const content = readFileSync(SKILL, "utf-8");
      const fm = parseFrontmatter(content);
      expect(fm.sections).toContain("dual-refresh");
    });

    it("skill body contains a dual-refresh section", () => {
      const content = readFileSync(SKILL, "utf-8");
      expect(content).toMatch(/<!-- SECTION: dual-refresh -->/);
      expect(content).toMatch(/<!-- END SECTION -->/);
      expect(content).toMatch(/## Dual Refresh/);
    });

    it("skill dual-refresh section explains runtime vs committed roles", () => {
      const content = readFileSync(SKILL, "utf-8");
      const match = content.match(/<!-- SECTION: dual-refresh -->([\s\S]*?)<!-- END SECTION -->/);
      expect(match).toBeTruthy();
      const section = match[1];
      expect(section).toMatch(/Runtime sidecar/);
      expect(section).toMatch(/Committed seed/);
      expect(section).toMatch(/entry_count: 0/);
      expect(section).toMatch(/estimated_tokens: 0/);
      expect(section).toMatch(/E28-S31/);
      expect(section).toMatch(/Fail-loud/i);
    });

    it("skill dual-refresh section covers all four Tier 1 agents", () => {
      const content = readFileSync(SKILL, "utf-8");
      const match = content.match(/<!-- SECTION: dual-refresh -->([\s\S]*?)<!-- END SECTION -->/);
      const section = match[1];
      expect(section).toMatch(/validator-sidecar/);
      expect(section).toMatch(/architect-sidecar/);
      expect(section).toMatch(/pm-sidecar/);
      expect(section).toMatch(/sm-sidecar/);
    });
  });
});
