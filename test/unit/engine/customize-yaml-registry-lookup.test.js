import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

describe("E10-S18: Customize.yaml Registry Lookup Path", () => {
  const workflowXml = readFileSync(resolve(PROJECT_ROOT, "_gaia/core/engine/workflow.xml"), "utf8");
  const baseDevMd = readFileSync(resolve(PROJECT_ROOT, "_gaia/dev/agents/_base-dev.md"), "utf8");
  const devConfig = yaml.load(readFileSync(resolve(PROJECT_ROOT, "_gaia/dev/config.yaml"), "utf8"));
  const retroInstructions = readFileSync(
    resolve(
      PROJECT_ROOT,
      "_gaia/lifecycle/workflows/4-implementation/retrospective/instructions.xml"
    ),
    "utf8"
  );

  /** Extract Step 3 from workflow.xml */
  function extractStep3() {
    const match = workflowXml.match(/<step\s+n="3"[\s\S]*?<\/step>/);
    if (!match) throw new Error("Step 3 not found in workflow.xml");
    return match[0];
  }

  /** Extract Step 6 from retro instructions.xml */
  function extractRetroStep6() {
    const match = retroInstructions.match(/<step\s+n="6"[\s\S]*?<\/step>/);
    if (!match) throw new Error("Step 6 not found in retrospective instructions.xml");
    return match[0];
  }

  // ── AC1: workflow.xml Step 3 checks custom/skills/ first for .customize.yaml ──
  describe("AC1: Engine checks custom/skills/ first for .customize.yaml", () => {
    it("Step 3 references custom/skills/ for .customize.yaml lookup", () => {
      const step3 = extractStep3();
      expect(step3).toContain("custom/skills/");
    });

    it("Step 3 checks custom/skills/{agent-id}.customize.yaml", () => {
      const step3 = extractStep3();
      expect(step3).toMatch(/custom\/skills\/.*customize\.yaml/i);
    });

    it("Step 3 mentions custom/skills/ before _gaia/_config/agents/ in lookup order", () => {
      const step3 = extractStep3();
      const customIdx = step3.indexOf("custom/skills/");
      const fallbackIdx = step3.indexOf("_gaia/_config/agents/", customIdx);
      expect(customIdx).toBeGreaterThan(-1);
      expect(fallbackIdx).toBeGreaterThan(customIdx);
    });
  });

  // ── AC2: File-level replacement semantics (no merge) ──
  describe("AC2: File-level replacement semantics", () => {
    it("Step 3 specifies file-level replacement (no merge with fallback)", () => {
      const step3 = extractStep3();
      expect(step3).toMatch(
        /file.level replacement|no merge|takes precedence|skip.*fallback|ignore.*entirely/i
      );
    });
  });

  // ── AC3: _base-dev.md references custom/skills/ as primary .customize.yaml location ──
  describe("AC3: _base-dev.md references custom/skills/ for customization", () => {
    it("_base-dev.md mentions custom/skills/ in the customization/skill access section", () => {
      expect(baseDevMd).toContain("custom/skills/");
    });

    it("_base-dev.md lists custom/skills/ before _gaia/_config/agents/ in override resolution", () => {
      const customIdx = baseDevMd.indexOf("custom/skills/");
      const fallbackIdx = baseDevMd.indexOf("_gaia/_config/agents/", customIdx);
      expect(customIdx).toBeGreaterThan(-1);
      expect(fallbackIdx).toBeGreaterThan(customIdx);
    });
  });

  // ── AC4: dev/config.yaml has custom_skills_path ──
  describe("AC4: dev/config.yaml has custom_skills_path key", () => {
    it("custom_skills_path key exists in dev/config.yaml", () => {
      expect(devConfig.custom_skills_path).toBeDefined();
    });

    it("custom_skills_path value contains custom/skills", () => {
      expect(devConfig.custom_skills_path).toContain("custom/skills");
    });
  });

  // ── AC5: Retrospective writes .customize.yaml to custom/skills/ ──
  describe("AC5: Retro step 6 writes .customize.yaml to custom/skills/", () => {
    it("Step 6 registers .customize.yaml in custom/skills/ (not _gaia/_config/agents/)", () => {
      const step6 = extractRetroStep6();
      // Step 6 should write the registry to custom/skills/
      expect(step6).toMatch(/custom\/skills\/.*customize\.yaml/i);
    });

    it("Step 6 does NOT write .customize.yaml to _gaia/_config/agents/ as primary target", () => {
      const step6 = extractRetroStep6();
      // The primary write target should be custom/skills/, not _gaia/_config/agents/
      // _gaia/_config/agents/ may still be mentioned as a reference or fallback, but
      // the "Register in" action should point to custom/skills/
      const registerAction = step6.match(
        /Register in \.customize\.yaml[\s\S]*?(?=<\/action>|<action)/i
      );
      if (registerAction) {
        expect(registerAction[0]).toContain("custom/skills/");
      }
    });
  });

  // ── AC6: Silent fallback when custom/skills/ file does not exist ──
  describe("AC6: Silent fallback to _gaia/_config/agents/", () => {
    it("Step 3 mentions fallback to _gaia/_config/agents/ when custom/skills/ not found", () => {
      const step3 = extractStep3();
      expect(step3).toMatch(
        /fall\s*back.*_gaia\/_config\/agents\/|_gaia\/_config\/agents\/.*fall\s*back/i
      );
    });

    it("Step 3 specifies no error or warning on fallback", () => {
      const step3 = extractStep3();
      expect(step3).toMatch(/no error|no warning|silent|seamless/i);
    });
  });

  // ── AC4 (dev agents): all-dev.customize.yaml lookup in custom/skills/ ──
  describe("all-dev.customize.yaml lookup in custom/skills/", () => {
    it("Step 3 checks custom/skills/all-dev.customize.yaml for dev agents", () => {
      const step3 = extractStep3();
      expect(step3).toMatch(/custom\/skills\/all-dev\.customize\.yaml/i);
    });
  });
});
