import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const FIXTURES_DIR = join(
  PROJECT_ROOT,
  "Gaia-framework",
  "test",
  "fixtures",
  "instructions",
);

// Dynamic import of the validator module
const validatorPath = join(
  PROJECT_ROOT,
  "Gaia-framework",
  "test",
  "validators",
  "instruction-validator.js",
);

function findInstructionFiles() {
  const result = execSync(
    `find -L "${GAIA_DIR}" -name "instructions.xml" -not -path "*/node_modules/*" -not -path "*/_backups/*"`,
    { encoding: "utf8" },
  );
  return result
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
}

describe("Tier 1: Instruction XML Validation", () => {
  const instructionFiles = findInstructionFiles();

  // ── Fixture-based unit tests ────────────────────────────────

  describe("Fixtures: Well-formedness (AC1)", () => {
    it("valid instruction XML passes", async () => {
      const { validateWellFormedness } = await import(validatorPath);
      const result = validateWellFormedness(
        join(FIXTURES_DIR, "valid-instruction.xml"),
      );
      expect(result.errors).toHaveLength(0);
    });

    it("malformed XML reports error", async () => {
      const { validateWellFormedness } = await import(validatorPath);
      const result = validateWellFormedness(join(FIXTURES_DIR, "malformed.xml"));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("XML parse error");
    });
  });

  describe("Fixtures: Step numbering (AC2)", () => {
    it("valid sequential steps pass", async () => {
      const { validateStepNumbering } = await import(validatorPath);
      const result = validateStepNumbering(
        join(FIXTURES_DIR, "valid-instruction.xml"),
      );
      expect(result.errors).toHaveLength(0);
    });

    it("step gap detected", async () => {
      const { validateStepNumbering } = await import(validatorPath);
      const result = validateStepNumbering(
        join(FIXTURES_DIR, "step-gap.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("step 3 missing");
    });

    it("duplicate step detected", async () => {
      const { validateStepNumbering } = await import(validatorPath);
      const result = validateStepNumbering(
        join(FIXTURES_DIR, "step-duplicate.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Duplicate step number: 2");
    });
  });

  describe("Fixtures: Template-output variables (AC3)", () => {
    it("valid variables pass", async () => {
      const { validateTemplateOutputVariables } = await import(validatorPath);
      const result = validateTemplateOutputVariables(
        join(FIXTURES_DIR, "valid-instruction.xml"),
      );
      expect(result.errors).toHaveLength(0);
    });

    it("invalid variable detected", async () => {
      const { validateTemplateOutputVariables } = await import(validatorPath);
      const result = validateTemplateOutputVariables(
        join(FIXTURES_DIR, "invalid-variable.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Unrecognized variable: {invalid_var}");
    });
  });

  describe("Fixtures: Skill/knowledge references (AC4)", () => {
    it("broken skill ref detected", async () => {
      const { validateSkillKnowledgeReferences } = await import(validatorPath);
      const result = validateSkillKnowledgeReferences(
        join(FIXTURES_DIR, "broken-skill-ref.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("file not found");
    });

    it("valid text-embedded skill ref passes", async () => {
      const { validateSkillKnowledgeReferences } = await import(validatorPath);
      const result = validateSkillKnowledgeReferences(
        join(FIXTURES_DIR, "text-embedded-refs.xml"),
      );
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Fixtures: invoke-task references (AC5)", () => {
    it("broken task ref detected", async () => {
      const { validateInvokeTaskReferences } = await import(validatorPath);
      const result = validateInvokeTaskReferences(
        join(FIXTURES_DIR, "broken-task-ref.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Task file not found");
    });
  });

  describe("Fixtures: invoke-workflow references (AC6)", () => {
    it("broken workflow ref detected", async () => {
      const { validateInvokeWorkflowReferences } = await import(validatorPath);
      const result = validateInvokeWorkflowReferences(
        join(FIXTURES_DIR, "broken-workflow-ref.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Workflow file not found");
    });
  });

  describe("Fixtures: invoke-protocol references (AC8)", () => {
    it("broken protocol ref detected", async () => {
      const { validateInvokeProtocolReferences } = await import(validatorPath);
      const result = validateInvokeProtocolReferences(
        join(FIXTURES_DIR, "broken-protocol-ref.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Protocol file not found");
    });
  });

  describe("Fixtures: Check elements (AC9)", () => {
    it("valid check elements pass", async () => {
      const { validateCheckElements } = await import(validatorPath);
      const result = validateCheckElements(
        join(FIXTURES_DIR, "valid-instruction.xml"),
      );
      expect(result.errors).toHaveLength(0);
    });

    it("empty check condition detected", async () => {
      const { validateCheckElements } = await import(validatorPath);
      const result = validateCheckElements(
        join(FIXTURES_DIR, "empty-check-condition.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Empty condition");
    });

    it("empty check body detected", async () => {
      const { validateCheckElements } = await import(validatorPath);
      const result = validateCheckElements(
        join(FIXTURES_DIR, "empty-check-body.xml"),
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Empty body");
    });
  });

  // ── Real framework validation (regression guard) ───────────

  describe("Real framework: All instruction files pass all checks", () => {
    it("should discover instruction files", () => {
      expect(instructionFiles.length).toBeGreaterThan(0);
    });

    it("all instruction files are well-formed XML", async () => {
      const { validateWellFormedness } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateWellFormedness(file);
        expect(result.errors, `XML errors in ${file}`).toHaveLength(0);
      }
    });

    it("all instruction files have sequential step numbers", async () => {
      const { validateStepNumbering } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateStepNumbering(file);
        expect(result.errors, `Step errors in ${file}`).toHaveLength(0);
      }
    });

    it("all template-output variables are canonical", async () => {
      const { validateTemplateOutputVariables } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateTemplateOutputVariables(file);
        expect(result.errors, `Variable errors in ${file}`).toHaveLength(0);
      }
    });

    it("all skill/knowledge references resolve", async () => {
      const { validateSkillKnowledgeReferences } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateSkillKnowledgeReferences(file);
        expect(result.errors, `Skill ref errors in ${file}`).toHaveLength(0);
      }
    });

    it("all invoke-task references resolve", async () => {
      const { validateInvokeTaskReferences } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateInvokeTaskReferences(file);
        expect(result.errors, `Task ref errors in ${file}`).toHaveLength(0);
      }
    });

    it("all invoke-workflow references resolve", async () => {
      const { validateInvokeWorkflowReferences } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateInvokeWorkflowReferences(file);
        expect(result.errors, `Workflow ref errors in ${file}`).toHaveLength(0);
      }
    });

    it("all invoke-protocol references resolve", async () => {
      const { validateInvokeProtocolReferences } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateInvokeProtocolReferences(file);
        expect(result.errors, `Protocol ref errors in ${file}`).toHaveLength(0);
      }
    });

    it("all check elements are valid", async () => {
      const { validateCheckElements } = await import(validatorPath);
      for (const file of instructionFiles) {
        const result = validateCheckElements(file);
        expect(result.errors, `Check element errors in ${file}`).toHaveLength(0);
      }
    });
  });
});
