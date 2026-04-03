import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";
import { walkFiles } from "../../validation/helpers/fs-walk.js";
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const VALIDATOR_PATH = join(PROJECT_ROOT, "test", "validators", "instruction-validator.js");
const IMPL_TEST_PATH = join(PROJECT_ROOT, "test", "validation", "tier1", "instructions.test.js");

// Canonical variable set per AC3 — maintained as constant
const VALID_VARIABLES = new Set([
  "project-root",
  "project-path",
  "installed_path",
  "planning_artifacts",
  "implementation_artifacts",
  "test_artifacts",
  "creative_artifacts",
  "story_key",
  "story_title_slug",
  "date",
  "data_path",
  "epic_key",
  "version",
  "target",
  "spec_name",
  "sprint_id",
  "cr_id",
  "mode",
  "slug",
]);

function findInstructionFiles() {
  return walkFiles(GAIA_DIR, {
    namePattern: "instructions.xml",
    exclude: ["node_modules", "_backups"],
  });
}

describe("ATDD E1-S4: Instruction XML Validation", () => {
  const instructionFiles = findInstructionFiles();

  // Sanity check — we expect instruction files to be found
  it("should discover instruction XML files in _gaia/", () => {
    expect(instructionFiles.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // AC1: All instruction files are well-formed XML (using fast-xml-parser)
  // ---------------------------------------------------------------------------
  describe("AC1: Well-formed XML (fast-xml-parser)", () => {
    it("instruction-validator.js exports a wellFormedness check", async () => {
      expect(existsSync(VALIDATOR_PATH), "Validator module must exist").toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateWellFormedness).toBe("function");
    });

    it("all instruction files pass well-formedness check", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateWellFormedness(file);
        expect(result.errors, `XML parse errors in ${file}`).toHaveLength(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC2: Step numbers are sequential (no gaps, no duplicates)
  // ---------------------------------------------------------------------------
  describe("AC2: Sequential step numbers", () => {
    it("instruction-validator.js exports a stepNumbering check", async () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateStepNumbering).toBe("function");
    });

    it("all instruction files have sequential step numbers", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateStepNumbering(file);
        expect(result.errors, `Step numbering errors in ${file}`).toHaveLength(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC3: template-output file attributes use only valid variable references
  // ---------------------------------------------------------------------------
  describe("AC3: Template-output variable references", () => {
    it("instruction-validator.js exports a templateOutputVariables check", async () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateTemplateOutputVariables).toBe("function");
    });

    it("all instruction files use only canonical variables in template-output file attrs", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateTemplateOutputVariables(file);
        expect(result.errors, `Invalid variable references in ${file}`).toHaveLength(0);
      }
    });

    it("validator uses the canonical variable set (18 variables)", async () => {
      const validator = await import(VALIDATOR_PATH);
      expect(validator.VALID_VARIABLES).toBeDefined();
      // Must contain all canonical variables
      for (const v of VALID_VARIABLES) {
        expect(validator.VALID_VARIABLES.has(v), `Missing canonical variable: ${v}`).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC4: Skill/knowledge load references point to existing files
  //       (both structured attributes AND text-embedded paths in <action>)
  // ---------------------------------------------------------------------------
  describe("AC4: Skill/knowledge references", () => {
    it("instruction-validator.js exports a skillKnowledgeReferences check", async () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateSkillKnowledgeReferences).toBe("function");
    });

    it("all skill/knowledge references resolve to existing files", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateSkillKnowledgeReferences(file);
        expect(result.errors, `Broken skill/knowledge refs in ${file}`).toHaveLength(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC5: invoke-task references point to existing task files
  //       (both structured elements AND text-embedded paths)
  // ---------------------------------------------------------------------------
  describe("AC5: invoke-task references", () => {
    it("instruction-validator.js exports an invokeTaskReferences check", async () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateInvokeTaskReferences).toBe("function");
    });

    it("all invoke-task references resolve to existing files", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateInvokeTaskReferences(file);
        expect(result.errors, `Broken invoke-task refs in ${file}`).toHaveLength(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC6: invoke-workflow references point to existing workflow.yaml files
  // ---------------------------------------------------------------------------
  describe("AC6: invoke-workflow references", () => {
    it("instruction-validator.js exports an invokeWorkflowReferences check", async () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateInvokeWorkflowReferences).toBe("function");
    });

    it("all invoke-workflow references resolve to existing files", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateInvokeWorkflowReferences(file);
        expect(result.errors, `Broken invoke-workflow refs in ${file}`).toHaveLength(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC7: Test file exists at test/validation/tier1/instructions.test.js
  // ---------------------------------------------------------------------------
  describe("AC7: Implementation test file location", () => {
    it("test/validation/tier1/instructions.test.js exists", () => {
      expect(
        existsSync(IMPL_TEST_PATH),
        "Implementation test file must exist at test/validation/tier1/instructions.test.js"
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AC8: invoke-protocol references resolve to existing protocol files
  // ---------------------------------------------------------------------------
  describe("AC8: invoke-protocol references", () => {
    it("instruction-validator.js exports an invokeProtocolReferences check", async () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateInvokeProtocolReferences).toBe("function");
    });

    it("all invoke-protocol references resolve to existing files", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateInvokeProtocolReferences(file);
        expect(result.errors, `Broken invoke-protocol refs in ${file}`).toHaveLength(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // AC9: <check> elements have non-empty body; if-attribute checks have non-empty conditions
  // ---------------------------------------------------------------------------
  describe("AC9: Check element validation", () => {
    it("instruction-validator.js exports a checkElements check", async () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
      const validator = await import(VALIDATOR_PATH);
      expect(typeof validator.validateCheckElements).toBe("function");
    });

    it("all check elements have non-empty bodies and conditions", async () => {
      const validator = await import(VALIDATOR_PATH);
      for (const file of instructionFiles) {
        const result = validator.validateCheckElements(file);
        expect(result.errors, `Invalid check elements in ${file}`).toHaveLength(0);
      }
    });
  });
});
