import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (4 levels up: test/validation/atdd/ -> Gaia-framework/ -> GAIA-Framework/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../../..");
const WORKFLOW_DIR = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "val-validate-plan"
);

describe("E8-S7: val-validate-plan Workflow", () => {
  // AC1: Required workflow files exist
  describe("AC1: workflow.yaml, instructions.xml, checklist.md exist", () => {
    const requiredFiles = ["workflow.yaml", "instructions.xml", "checklist.md"];

    it.each(requiredFiles)("val-validate-plan/%s exists", (file) => {
      expect(existsSync(join(WORKFLOW_DIR, file)), `Missing file: val-validate-plan/${file}`).toBe(
        true
      );
    });
  });

  // AC2: Plan validation protocol steps in instructions.xml
  describe("AC2: instructions contain parse, verify targets, verify bumps, verify completeness, cross-reference", () => {
    it("instructions.xml contains all required protocol steps", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      expect(existsSync(instrPath), "instructions.xml must exist").toBe(true);

      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      const requiredSteps = [
        {
          name: "parse plan",
          patterns: ["parse plan", "parse the plan", "load plan"],
        },
        {
          name: "verify file targets",
          patterns: ["file target", "target file", "verify file", "targets exist"],
        },
        {
          name: "verify version bumps",
          patterns: ["version bump", "version change", "bump"],
        },
        {
          name: "verify completeness",
          patterns: ["completeness", "complete", "missing"],
        },
        {
          name: "cross-reference",
          patterns: ["cross-reference", "cross reference", "ground truth"],
        },
      ];

      for (const step of requiredSteps) {
        const found = step.patterns.some((p) => content.includes(p));
        expect(found, `Missing protocol step: ${step.name}`).toBe(true);
      }
    });
  });

  // AC3: Findings output format
  describe("AC3: instructions reference Plan Validation Findings", () => {
    it("instructions.xml references Plan Validation Findings section", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      expect(existsSync(instrPath), "instructions.xml must exist").toBe(true);

      const content = readFileSync(instrPath, "utf-8");
      expect(content).toMatch(/Plan Validation Findings/i);
    });
  });

  // AC4: Manifest entry
  describe("AC4: workflow-manifest.csv contains val-validate-plan", () => {
    it("val-validate-plan is listed in workflow-manifest.csv", () => {
      const manifestPath = join(PROJECT_ROOT, "_gaia", "_config", "workflow-manifest.csv");
      expect(existsSync(manifestPath), "workflow-manifest.csv must exist").toBe(true);

      const content = readFileSync(manifestPath, "utf-8");
      expect(content).toContain("val-validate-plan");
    });
  });

  // AC5: ADR cross-reference in instructions
  describe("AC5: instructions reference ADR cross-reference verification", () => {
    it("instructions.xml contains ADR cross-reference logic", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      expect(content).toMatch(/ADR/i);
      expect(content).toMatch(/architecture/i);
    });
  });

  // AC6: Discussion loop for findings review
  describe("AC6: instructions contain discussion loop for findings", () => {
    it("instructions.xml contains approve/dismiss/edit discussion loop", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();
      expect(content).toContain("approve");
      expect(content).toContain("dismiss");
      expect(content).toContain("edit");
    });
  });

  // AC7: Slash command file exists
  describe("AC7: slash command file exists", () => {
    it(".claude/commands/gaia-val-validate-plan.md exists", () => {
      const cmdPath = join(PROJECT_ROOT, ".claude", "commands", "gaia-val-validate-plan.md");
      expect(
        existsSync(cmdPath),
        "Slash command file must exist at .claude/commands/gaia-val-validate-plan.md"
      ).toBe(true);
    });
  });

  // AC8: model_override: opus in workflow.yaml
  describe("AC8: model_override opus enforcement", () => {
    it("workflow.yaml contains model_override: opus", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      expect(existsSync(workflowPath), "workflow.yaml must exist").toBe(true);

      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/model_override:\s*opus/);
    });
  });

  // Structural: workflow.yaml field completeness
  describe("workflow.yaml field completeness", () => {
    it("workflow.yaml contains required fields: name, module, agent, instructions, validation", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");

      const requiredFields = ["name:", "module:", "agent:", "instructions:", "validation:"];
      for (const field of requiredFields) {
        expect(content, `Missing field: ${field}`).toContain(field);
      }
    });

    it("workflow.yaml declares agent as validator", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/agent:\s*validator/);
    });

    it("workflow.yaml declares module as lifecycle", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/module:\s*lifecycle/);
    });

    it("workflow.yaml declares quality_gates", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toContain("quality_gates:");
    });
  });

  // Structural: instructions.xml step count and ordering
  describe("instructions.xml step structure", () => {
    it("instructions.xml contains 7 numbered steps", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      const stepMatches = content.match(/<step\s+n="(\d+)"/g);
      expect(stepMatches).not.toBeNull();
      expect(stepMatches.length).toBe(7);
    });

    it("steps are numbered sequentially 1 through 7", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      for (let i = 1; i <= 7; i++) {
        expect(content).toContain(`<step n="${i}"`);
      }
    });
  });

  // Structural: JIT skill section references
  describe("JIT skill section loading", () => {
    it("instructions.xml references validation-patterns skill sections", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      const requiredSections = [
        "claim-extraction",
        "filesystem-verification",
        "severity-classification",
        "findings-formatting",
      ];
      for (const section of requiredSections) {
        expect(content, `Missing skill section reference: ${section}`).toContain(section);
      }
    });
  });

  // Structural: severity classification keywords
  describe("severity classification in instructions", () => {
    it("instructions.xml uses CRITICAL, WARNING, INFO severity levels", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      expect(content).toContain("CRITICAL");
      expect(content).toContain("WARNING");
      expect(content).toContain("INFO");
    });
  });

  // Structural: action verb classification
  describe("action verb classification in instructions", () => {
    it("instructions.xml classifies Create/Add vs Modify/Update vs Delete/Remove", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");

      // Create/Add group
      expect(content).toMatch(/Create\s*\/\s*Add/i);
      // Modify/Update group
      expect(content).toMatch(/Modify\s*\/\s*Update/i);
      // Delete/Remove group
      expect(content).toMatch(/Delete\s*\/\s*Remove/i);
    });
  });

  // Structural: checklist completeness
  describe("checklist.md completeness", () => {
    it("checklist.md contains structure, protocol, quality, and integration sections", () => {
      const checklistPath = join(WORKFLOW_DIR, "checklist.md");
      const content = readFileSync(checklistPath, "utf-8");
      expect(content).toContain("## Structure");
      expect(content).toContain("## Protocol Completeness");
      expect(content).toContain("## Quality");
      expect(content).toContain("## Integration");
    });
  });
});
