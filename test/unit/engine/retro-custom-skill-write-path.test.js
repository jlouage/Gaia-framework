import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const RETRO_DIR =
  "_gaia/lifecycle/workflows/4-implementation/retrospective";

/** Load and cache the retro workflow.yaml as a parsed object. */
function loadRetroWorkflow() {
  const workflowPath = resolve(PROJECT_ROOT, RETRO_DIR, "workflow.yaml");
  return yaml.load(readFileSync(workflowPath, "utf8"));
}

/** Extract the content of step 6 from the retro instructions.xml. */
function extractStep6Content() {
  const instructionsPath = resolve(
    PROJECT_ROOT,
    RETRO_DIR,
    "instructions.xml"
  );
  const instructions = readFileSync(instructionsPath, "utf8");
  const step6Match = instructions.match(/<step\s+n="6"[\s\S]*?<\/step>/);
  if (!step6Match) {
    throw new Error("Step 6 not found in retrospective instructions.xml");
  }
  return step6Match[0];
}

describe("E10-S12: Retro Workflow Custom Skill Write Path", () => {
  let workflow;
  let step6;

  beforeAll(() => {
    workflow = loadRetroWorkflow();
    step6 = extractStep6Content();
  });

  // ── AC1: workflow.yaml skill_updates path points to custom/skills/ ──
  describe("AC1: workflow.yaml output path update", () => {
    it("should have skill_updates pointing to custom/skills/*.md", () => {
      expect(workflow.output.skill_updates).toBeDefined();
      const skillUpdatesPath = Array.isArray(workflow.output.skill_updates)
        ? workflow.output.skill_updates[0]
        : workflow.output.skill_updates;

      expect(skillUpdatesPath).toContain("custom/skills/");
      expect(skillUpdatesPath).not.toContain("_gaia/dev/skills/");
    });
  });

  // ── AC2: instructions.xml step 6 writes to custom/skills/ ──
  describe("AC2: instructions.xml write target", () => {
    it("should reference custom/skills/ as the write target in step 6", () => {
      expect(step6).toContain("custom/skills/");
    });

    it("should use custom/skills/ for the write/append action", () => {
      expect(step6).toMatch(
        /(?:write|append|save)[\s\S]*?custom\/skills\//i
      );
    });
  });

  // ── AC3: Base skill copy logic ──
  describe("AC3: Base skill copy before applying improvement", () => {
    it("should contain base-skill copy logic referencing _gaia/dev/skills/", () => {
      expect(step6).toContain("_gaia/dev/skills/");
      expect(step6).toMatch(/copy|clone|duplicate|base.?skill/i);
    });

    it("should preserve SECTION markers when copying base skill", () => {
      expect(step6).toMatch(
        /preserv[\s\S]*?SECTION|SECTION[\s\S]*?marker[\s\S]*?preserv/i
      );
    });
  });

  // ── AC4: .customize.yaml auto-registration ──
  describe("AC4: .customize.yaml auto-registration", () => {
    it("should reference all-dev.customize.yaml in step 6", () => {
      expect(step6).toContain("all-dev.customize.yaml");
    });

    it("should contain skill_overrides registration logic", () => {
      expect(step6).toContain("skill_overrides");
    });
  });

  // ── AC5: Existing entries preserved ──
  describe("AC5: Existing .customize.yaml entries preserved", () => {
    it("should contain logic to preserve existing entries", () => {
      expect(step6).toMatch(
        /(?:already|existing|preserve|duplicate|exists)/i
      );
    });
  });

  // ── AC6: Directory creation guard ──
  describe("AC6: custom/skills/ directory creation", () => {
    it("should contain mkdir guard for custom/skills/ in step 6", () => {
      expect(step6).toMatch(/mkdir|create.*director|ensure.*director/i);
    });
  });

  // ── AC7: Missing base skill handled gracefully ──
  describe("AC7: Missing base skill warning", () => {
    it("should contain fallback logic when base skill does not exist", () => {
      expect(step6).toMatch(/warn|not found|from scratch|missing/i);
    });
  });

  // ── AC8: .customize.yaml creation when not exists ──
  describe("AC8: .customize.yaml file creation", () => {
    it("should create all-dev.customize.yaml if it does not exist", () => {
      expect(step6).toMatch(
        /(?:create|initialize|does not exist)[\s\S]*?all-dev\.customize\.yaml|all-dev\.customize\.yaml[\s\S]*?(?:create|initialize|does not exist)/i
      );
    });
  });
});
