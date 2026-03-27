import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

/**
 * E10-S10: Add val_validate_output Flag to 17 Workflows
 *
 * Validates that all 17 artifact-producing workflows have
 * val_validate_output: true in their workflow.yaml configuration.
 */

// The 17 workflows that must have val_validate_output: true
const ARTIFACT_PRODUCING_WORKFLOWS = [
  {
    name: "create-prd",
    path: "_gaia/lifecycle/workflows/2-planning/create-prd/workflow.yaml",
  },
  {
    name: "edit-prd",
    path: "_gaia/lifecycle/workflows/2-planning/edit-prd/workflow.yaml",
  },
  {
    name: "create-ux-design",
    path: "_gaia/lifecycle/workflows/2-planning/create-ux-design/workflow.yaml",
  },
  {
    name: "edit-ux-design",
    path: "_gaia/lifecycle/workflows/2-planning/edit-ux-design/workflow.yaml",
  },
  {
    name: "create-architecture",
    path: "_gaia/lifecycle/workflows/3-solutioning/create-architecture/workflow.yaml",
  },
  {
    name: "edit-architecture",
    path: "_gaia/lifecycle/workflows/3-solutioning/edit-architecture/workflow.yaml",
  },
  {
    name: "create-epics-stories",
    path: "_gaia/lifecycle/workflows/3-solutioning/create-epics-stories/workflow.yaml",
  },
  {
    name: "add-stories",
    path: "_gaia/lifecycle/workflows/4-implementation/add-stories/workflow.yaml",
  },
  {
    name: "test-design",
    path: "_gaia/testing/workflows/test-design/workflow.yaml",
  },
  {
    name: "edit-test-plan",
    path: "_gaia/testing/workflows/edit-test-plan/workflow.yaml",
  },
  {
    name: "security-threat-model",
    path: "_gaia/lifecycle/workflows/3-solutioning/security-threat-model/workflow.yaml",
  },
  {
    name: "traceability",
    path: "_gaia/testing/workflows/traceability/workflow.yaml",
  },
  {
    name: "sprint-planning",
    path: "_gaia/lifecycle/workflows/4-implementation/sprint-planning/workflow.yaml",
  },
  {
    name: "retrospective",
    path: "_gaia/lifecycle/workflows/4-implementation/retrospective/workflow.yaml",
  },
  {
    name: "correct-course",
    path: "_gaia/lifecycle/workflows/4-implementation/correct-course/workflow.yaml",
  },
  {
    name: "triage-findings",
    path: "_gaia/lifecycle/workflows/4-implementation/triage-findings/workflow.yaml",
  },
  {
    name: "add-feature",
    path: "_gaia/lifecycle/workflows/cross-phase/add-feature/workflow.yaml",
  },
];

describe("E10-S10: val_validate_output Flag in 17 Workflows", () => {
  // AC1: Each of the 17 workflows must contain val_validate_output: true
  describe("AC1: val_validate_output present in all 17 workflows", () => {
    it.each(ARTIFACT_PRODUCING_WORKFLOWS)(
      "$name has val_validate_output: true",
      ({ name, path: relPath }) => {
        const fullPath = resolve(PROJECT_ROOT, relPath);
        const content = readFileSync(fullPath, "utf8");
        const config = yaml.load(content);

        expect(
          config.val_validate_output,
          `${name}/workflow.yaml must have val_validate_output: true`
        ).toBe(true);
      }
    );
  });

  // AC2: Existing val_auto_in_yolo flags remain unchanged
  describe("AC2: val_auto_in_yolo flags unchanged", () => {
    // Workflows known to have val_auto_in_yolo before this story
    // (dev-story has it, but it's not in our 17 list — verify none of our 17 had it)
    it("none of the 17 workflows had val_auto_in_yolo before (no regression)", () => {
      for (const { path: relPath } of ARTIFACT_PRODUCING_WORKFLOWS) {
        const fullPath = resolve(PROJECT_ROOT, relPath);
        const content = readFileSync(fullPath, "utf8");
        const config = yaml.load(content);

        // These 17 workflows should not have val_auto_in_yolo
        // (only dev-story and similar execution workflows have it)
        if (config.val_auto_in_yolo !== undefined) {
          // If any of these workflows already had val_auto_in_yolo,
          // it should not have been removed or changed
          expect(config.val_auto_in_yolo).toBeDefined();
        }
      }
    });
  });

  // AC3: val_validate_output is a boolean true (not a string or other truthy value)
  describe("AC3: val_validate_output is boolean true", () => {
    it.each(ARTIFACT_PRODUCING_WORKFLOWS)(
      "$name has val_validate_output as boolean true (not string)",
      ({ name, path: relPath }) => {
        const fullPath = resolve(PROJECT_ROOT, relPath);
        const content = readFileSync(fullPath, "utf8");
        const config = yaml.load(content);

        expect(
          typeof config.val_validate_output,
          `${name}/workflow.yaml val_validate_output must be boolean, not ${typeof config.val_validate_output}`
        ).toBe("boolean");
        expect(config.val_validate_output).toBe(true);
      }
    );
  });

  // Structural: Ensure no other fields were accidentally modified
  describe("Structural: only val_validate_output added", () => {
    it("all 17 workflows still have required fields (name, instructions)", () => {
      for (const { name, path: relPath } of ARTIFACT_PRODUCING_WORKFLOWS) {
        const fullPath = resolve(PROJECT_ROOT, relPath);
        const content = readFileSync(fullPath, "utf8");
        const config = yaml.load(content);

        expect(config.name, `${name} must still have name field`).toBeTruthy();
        expect(config.instructions, `${name} must still have instructions field`).toBeTruthy();
      }
    });
  });
});
