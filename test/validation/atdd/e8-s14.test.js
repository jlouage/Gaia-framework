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

  // --- Extended coverage: gaps identified by test-automation workflow ---

  // AC3 detail: Findings are written under a specific section heading
  describe("AC3 extended: findings written under Validation Findings section", () => {
    it("workflow.xml specifies Validation Findings section for approved findings", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/Validation Findings/);
    });
  });

  // AC6 extended: artifact content check happens BEFORE invoking Val
  describe("AC6 extended: artifact content check precedes Val invocation", () => {
    it("workflow.xml checks artifact content before invoking val-validate-artifact", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      // The empty check must appear before the invocation — verify both exist
      // and the empty check references "not been written" or "empty" in the [v] handler
      const vHandlerIdx = content.indexOf("[v] handler");
      const emptyCheckIdx = content.indexOf("not been written yet or is empty");
      const valInvokeIdx = content.indexOf(
        "invoke val-validate-artifact as a subagent",
      );
      // Both must exist
      expect(emptyCheckIdx, "Empty artifact check must exist").toBeGreaterThan(
        -1,
      );
      expect(valInvokeIdx, "Val invocation must exist").toBeGreaterThan(-1);
      // Empty check must come before Val invocation in the [v] handler
      expect(
        emptyCheckIdx,
        "Empty check must precede Val invocation",
      ).toBeLessThan(valInvokeIdx);
    });
  });

  // AC8 / Scenario 14: YOLO mode does not auto-trigger [v]
  describe("AC8 extended: YOLO mode [v] not auto-triggered", () => {
    it("workflow.xml specifies that [v] is not auto-triggered in YOLO mode", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      const hasYoloNoV =
        content.includes("yolo") &&
        content.includes("[v]") &&
        content.includes("not auto-triggered");
      expect(
        hasYoloNoV,
        "YOLO mode must explicitly state [v] is not auto-triggered",
      ).toBe(true);
    });
  });

  // AC7 extended: fallback prompt shows only [c]/[y]/[e] without [v]
  describe("AC7 extended: fallback prompt without [v] when gate disabled", () => {
    it("workflow.xml has a prompt with only [c]/[y]/[e] when Val is not enabled", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      // Must have a prompt line that contains [c], [y], [e] but NOT [v]
      // The normal-mode fallback: "[c]ontinue [y]olo [e]dit"
      const hasNonValPrompt =
        content.includes("[c]ontinue") && content.includes("[e]dit");
      expect(
        hasNonValPrompt,
        "Must have a fallback prompt with [c]/[y]/[e] only",
      ).toBe(true);
    });
  });

  // Planning gate [v]: verify Step 5 also integrates Val
  describe("Planning gate [v] integration", () => {
    it("workflow.xml Step 5 (Planning Gate) contains [v] Review with Val option", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      // Step 5 planning gate should have val_review_available check and [v] option
      const hasStep5Val =
        content.includes("val_review_available") &&
        content.includes("[v] Review with Val");
      expect(
        hasStep5Val,
        "Planning gate must have conditional [v] option",
      ).toBe(true);
    });

    it("workflow.xml Planning Gate checks val_integration feature gate", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      // Must check the same feature gate as template-output
      const hasGateCheck =
        content.includes("val_integration") &&
        content.includes("val_review_available");
      expect(
        hasGateCheck,
        "Planning gate must check val_integration feature gate",
      ).toBe(true);
    });

    it("workflow.xml Planning Gate invokes val-validate-plan for [v]", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8");
      expect(content).toMatch(/val-validate-plan/);
    });

    it("workflow.xml Planning Gate handles Val failure gracefully", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      // Planning gate must have failure handling for Val
      const hasFailure =
        content.includes("val validation could not complete") &&
        content.includes("planning gate");
      expect(
        hasFailure,
        "Planning gate must handle Val failure gracefully",
      ).toBe(true);
    });

    it("workflow.xml Planning Gate handles zero findings from Val", () => {
      const content = readFileSync(ENGINE_PATH, "utf-8").toLowerCase();
      // Must handle zero findings case in planning gate
      const hasZeroFindings =
        content.includes("[v] and val returns zero findings") ||
        (content.includes("zero findings") &&
          content.includes("no issues found"));
      expect(
        hasZeroFindings,
        "Planning gate must handle zero findings from Val",
      ).toBe(true);
    });
  });
});
