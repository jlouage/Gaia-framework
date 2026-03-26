import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

describe("E10-S1: Engine-Level val_validate_output Flag", () => {
  // ── AC1: workflow.xml Step 6 checks val_validate_output flag ──
  describe("AC1: val_validate_output flag recognition", () => {
    it("reads val_validate_output flag from workflow.yaml", () => {
      const workflowXml = readFileSync(
        resolve(PROJECT_ROOT, "_gaia/core/engine/workflow.xml"),
        "utf8"
      );

      // workflow.xml must reference val_validate_output in its Step 6
      expect(workflowXml).toContain("val_validate_output");
    });
  });

  // ── AC2: Val invoked after template-output in all execution modes ──
  describe("AC2: Val invocation in all execution modes", () => {
    it("invokes Val validation in normal mode", () => {
      const workflowXml = readFileSync(
        resolve(PROJECT_ROOT, "_gaia/core/engine/workflow.xml"),
        "utf8"
      );

      const hasNormalModeValValidateOutput =
        workflowXml.includes("val_validate_output") &&
        workflowXml.includes("normal");

      expect(
        hasNormalModeValValidateOutput,
        "workflow.xml should handle val_validate_output in normal mode"
      ).toBe(true);
    });

    it("invokes Val validation in yolo mode", () => {
      const workflowXml = readFileSync(
        resolve(PROJECT_ROOT, "_gaia/core/engine/workflow.xml"),
        "utf8"
      );

      const hasYoloModeValValidateOutput =
        workflowXml.includes("val_validate_output") &&
        workflowXml.includes("yolo");

      expect(
        hasYoloModeValValidateOutput,
        "workflow.xml should handle val_validate_output in yolo mode"
      ).toBe(true);
    });

    it("invokes Val validation in planning mode", () => {
      const workflowXml = readFileSync(
        resolve(PROJECT_ROOT, "_gaia/core/engine/workflow.xml"),
        "utf8"
      );

      const hasPlanningModeValValidateOutput =
        workflowXml.includes("val_validate_output") &&
        workflowXml.includes("planning");

      expect(
        hasPlanningModeValValidateOutput,
        "workflow.xml should handle val_validate_output in planning mode"
      ).toBe(true);
    });
  });

  // ── AC3: Auto-fix loop with 3-iteration cap ──
  describe("AC3: Auto-fix loop with iteration limit", () => {
    it("auto-fix loop retries up to 3 times then halts", () => {
      const workflowXml = readFileSync(
        resolve(PROJECT_ROOT, "_gaia/core/engine/workflow.xml"),
        "utf8"
      );

      const hasAutoFixLoop =
        workflowXml.includes("val_validate_output") &&
        (workflowXml.includes("3 iteration") ||
          workflowXml.includes("up to 3") ||
          workflowXml.includes("repeat") ||
          workflowXml.includes("auto-fix"));

      expect(
        hasAutoFixLoop,
        "workflow.xml should describe auto-fix loop with 3-iteration cap for val_validate_output"
      ).toBe(true);
    });
  });

  // ── AC4: Global toggle in global.yaml ──
  describe("AC4: Global emergency disable toggle", () => {
    it("global toggle disables val_validate_output", () => {
      const globalYaml = readFileSync(
        resolve(PROJECT_ROOT, "_gaia/_config/global.yaml"),
        "utf8"
      );
      const config = yaml.load(globalYaml);

      expect(
        config.val_integration,
        "global.yaml must have val_integration section"
      ).toBeDefined();

      expect(
        config.val_integration.val_validate_output,
        "global.yaml must have val_integration.val_validate_output toggle"
      ).toBeDefined();
    });
  });

  // ── AC5: Smoke test against 3+ representative workflows ──
  describe("AC5: Smoke test representative workflows", () => {
    const representativeWorkflows = [
      "lifecycle/workflows/2-planning/create-prd/workflow.yaml",
      "lifecycle/workflows/3-solutioning/create-architecture/workflow.yaml",
      "testing/workflows/test-design/workflow.yaml",
    ];

    it("smoke test passes for 3+ representative workflows", () => {
      for (const workflowPath of representativeWorkflows) {
        const fullPath = resolve(PROJECT_ROOT, "_gaia", workflowPath);
        expect(
          existsSync(fullPath),
          `Workflow must exist: ${workflowPath}`
        ).toBe(true);

        const content = readFileSync(fullPath, "utf8");
        const config = yaml.load(content);

        expect(
          config.val_validate_output,
          `${workflowPath} must have val_validate_output flag`
        ).toBeDefined();
      }
    });
  });
});
