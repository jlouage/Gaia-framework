import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (4 levels up: test/validation/atdd/ -> Gaia-framework/ -> GAIA-Framework/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../../..");
const ENGINE_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "core",
  "engine",
  "workflow.xml",
);
const GLOBAL_YAML_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "_config",
  "global.yaml",
);

describe("E8-S14: Workflow Engine [v] at Template-Output", () => {
  // AC1: Feature gate → prompt shows [c][y][e][v] when all conditions met
  describe("AC1: template-output prompt extended with [v] Review with Val", () => {
    it("workflow.xml Step 6 template-output section contains [v] option text", () => {
      expect(existsSync(ENGINE_PATH), "workflow.xml must exist").toBe(true);

      const content = readFileSync(ENGINE_PATH, "utf-8");
      // The prompt must include [v] as an option alongside [c], [y], [e]
      expect(content).toMatch(/\[v\]/);
      expect(content).toMatch(/Review with Val/i);
    });

    it("workflow.xml contains conditional check for val_integration.template_output_review", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/val_integration/);
      expect(content).toMatch(/template_output_review/);
    });

    it("workflow.xml contains existence check for validator.md", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/validator\.md/);
    });

    it("workflow.xml contains existence check for validator-sidecar directory", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/validator-sidecar/);
    });
  });

  // AC2: [v] spawns val-validate-artifact as subagent
  describe("AC2: [v] invokes val-validate-artifact as subagent", () => {
    it("workflow.xml references val-validate-artifact invocation when [v] is pressed", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/val-validate-artifact/);
    });

    it("workflow.xml passes artifact file path to val-validate-artifact", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      // Must pass artifact path context to the subagent
      const hasArtifactPath =
        content.includes("artifact_path") ||
        content.includes("artifact path") ||
        content.includes("file path");
      expect(hasArtifactPath, "Must pass artifact path to Val subagent").toBe(
        true,
      );
    });

    it("workflow.xml passes workflow name context to val-validate-artifact", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      const hasWorkflowName =
        content.includes("source_workflow") ||
        content.includes("workflow name") ||
        content.includes("current workflow");
      expect(
        hasWorkflowName,
        "Must pass workflow name to Val subagent",
      ).toBe(true);
    });
  });

  // AC3: Findings presented → user approves subset → only approved written → returns to prompt
  describe("AC3: findings approval and selective write-back", () => {
    it("workflow.xml contains user approval step for Val findings", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      const hasApproval =
        content.includes("approve") && content.includes("findings");
      expect(
        hasApproval,
        "Must allow user to approve findings before writing",
      ).toBe(true);
    });

    it("workflow.xml returns to template-output prompt after findings are written", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      // After Val flow, engine should return to the template-output prompt
      const hasReturnToPrompt =
        content.includes("return to") &&
        (content.includes("template-output") || content.includes("prompt"));
      expect(
        hasReturnToPrompt,
        "Must return to template-output prompt after Val completes",
      ).toBe(true);
    });
  });

  // AC4: Zero findings → "no issues found" message
  describe("AC4: zero findings displays no-issues message", () => {
    it("workflow.xml contains 'no issues found' or equivalent message for zero findings", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      const hasZeroMsg =
        content.includes("no issues found") ||
        content.includes("no issues") ||
        content.includes("zero issues");
      expect(
        hasZeroMsg,
        "Must display 'no issues found' when Val returns clean",
      ).toBe(true);
    });
  });

  // AC5: Val failure → graceful error → returns to prompt
  describe("AC5: Val failure is handled gracefully", () => {
    it("workflow.xml contains failure handling for Val subagent", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      const hasFailureHandling =
        content.includes("could not complete") ||
        content.includes("fail") ||
        content.includes("error");
      const hasGraceful =
        content.includes("continuing without validation") ||
        content.includes("return to") ||
        content.includes("graceful");
      expect(
        hasFailureHandling && hasGraceful,
        "Must handle Val failure gracefully and return to prompt",
      ).toBe(true);
    });
  });

  // AC6: Empty artifact → skip message without invoking Val
  describe("AC6: empty artifact guard", () => {
    it("workflow.xml checks for empty/unwritten artifact before invoking Val", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      const hasEmptyCheck =
        content.includes("no artifact content") ||
        content.includes("empty") ||
        content.includes("not been written");
      expect(
        hasEmptyCheck,
        "Must check for empty artifact and skip Val invocation",
      ).toBe(true);
    });
  });

  // AC7: Gate disabled → no [v] option, no error
  describe("AC7: feature gate disabled hides [v] silently", () => {
    it("global.yaml contains val_integration section", () => {
      expect(existsSync(GLOBAL_YAML_PATH), "global.yaml must exist").toBe(
        true,
      );

      const content = readFileSync(GLOBAL_YAML_PATH, "utf-8");
      expect(content).toMatch(/val_integration/);
    });

    it("global.yaml contains template_output_review boolean flag", () => {
      const content = readFileSync(GLOBAL_YAML_PATH, "utf-8");
      expect(content).toMatch(/template_output_review/);
    });

    it("workflow.xml conditionally hides [v] when gate conditions are not met", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      // The [v] display must be inside a conditional block
      const hasConditional =
        content.includes("if") &&
        content.includes("val_integration") &&
        content.includes("[v]");
      expect(
        hasConditional,
        "The [v] option must be conditionally displayed based on gate checks",
      ).toBe(true);
    });
  });

  // AC8: Existing [c][y][e] options unaffected — zero regression
  describe("AC8: existing [c][y][e] options unaffected", () => {
    it("workflow.xml still contains [c] Continue option", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/\[c\]/);
      expect(content).toMatch(/Continue/);
    });

    it("workflow.xml still contains [y] YOLO option", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/\[y\]/);
    });

    it("workflow.xml still contains [e] Edit option", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/\[e\]/);
      expect(content).toMatch(/Edit/);
    });

    it("workflow.xml template-output normal mode prompt contains all four options [c][y][e][v]", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      // When gate is enabled, all four must appear in a single prompt line
      const hasAllFour =
        content.includes("[c]") &&
        content.includes("[y]") &&
        content.includes("[e]") &&
        content.includes("[v]");
      expect(
        hasAllFour,
        "Template-output prompt must contain [c], [y], [e], and [v]",
      ).toBe(true);
    });
  });
});
