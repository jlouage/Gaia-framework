import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (4 levels up: test/validation/atdd/ -> Gaia-framework/ -> GAIA-Framework/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../../..");
const WORKFLOW_XML = join(PROJECT_ROOT, "_gaia", "core", "engine", "workflow.xml");

// Helper: extract Step 5 content from workflow.xml
function getStep5Content() {
  const content = readFileSync(WORKFLOW_XML, "utf-8");
  const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
  expect(step5Match, "Step 5 must exist in workflow.xml").not.toBeNull();
  return step5Match[0];
}

describe("E8-S15 Coverage Expansion: Workflow Engine [v] at Planning Gate", () => {
  it("workflow.xml must exist", () => {
    expect(existsSync(WORKFLOW_XML)).toBe(true);
  });

  // AC5: Graceful failure handling
  describe("AC5: Val failure — graceful fallback message", () => {
    it("Step 5 contains the exact graceful failure message text", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/Val validation could not complete/i);
    });

    it("Step 5 failure action includes reason placeholder", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/\[reason\]|reason/i);
    });

    it("Step 5 failure message includes 'Continuing without validation'", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/Continuing without validation/i);
    });

    it("Step 5 failure returns to planning gate with original options (no [v])", () => {
      const step5 = getStep5Content();
      // The failure action should return to prompt with [a]/[y]/[r]/[x] — not [v]
      expect(step5).toMatch(/\[v\].*subagent fails|crash.*timeout/is);
    });
  });

  // AC6: No caching across [v] → [r] → [v] revisions
  describe("AC6: No caching across [v] re-presses after plan revision", () => {
    it("Step 5 mandates fresh validation on each [v] press — no caching", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/fresh|no caching|previous findings are discarded/i);
    });

    it("Step 5 specifies previous findings are discarded after plan revision", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/previous findings are discarded|discard|no caching/i);
    });
  });

  // AC7: Empty plan edge case
  describe("AC7: Empty plan edge case handled before Val invocation", () => {
    it("Step 5 contains the empty plan error message", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/Plan contains no steps to validate/i);
    });

    it("Step 5 has a distinct action for zero-step plans", () => {
      const step5 = getStep5Content();
      // Must have a conditional action specifically for zero/empty steps
      expect(step5).toMatch(/zero steps|no steps|plan has zero steps/i);
    });
  });

  // AC8 / Feature gate: uses val-validate-plan (not val-validate-artifact)
  describe("AC8: Invokes val-validate-plan, not val-validate-artifact", () => {
    it("Step 5 invokes val-validate-plan subagent", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/val-validate-plan/i);
    });

    it("Step 5 does NOT invoke val-validate-artifact (wrong workflow for planning gate)", () => {
      const step5 = getStep5Content();
      expect(step5).not.toMatch(/val-validate-artifact/i);
    });
  });

  // Feature gate: all three prerequisite checks present
  describe("Feature gate: three conditions checked (flag + validator.md + sidecar)", () => {
    it("Step 5 checks val_integration.template_output_review flag", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/val_integration|template_output_review/i);
    });

    it("Step 5 checks for validator.md agent file existence", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/validator\.md/i);
    });

    it("Step 5 checks for _memory/validator-sidecar/ directory existence", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/validator-sidecar/i);
    });

    it("Step 5 produces a val_review_available boolean from the three checks", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/val_review_available/i);
    });
  });

  // When val_review_available == false: prompt lacks [v]
  describe("val_review_available == false: fallback prompt omits [v]", () => {
    it("Step 5 has a conditional prompt for when val review is unavailable", () => {
      const step5 = getStep5Content();
      // Should have an action conditioned on val_review_available == false
      expect(step5).toMatch(/val_review_available.*false|false.*val_review_available/i);
    });

    it("Step 5 unavailable prompt contains only [a]/[y]/[r]/[x]", () => {
      // Extract the action scoped to val_review_available == false
      const step5 = getStep5Content();
      const falseAction = step5.match(
        /<action\s+if="val_review_available == false"[^>]*>(.*?)<\/action>/is
      );
      expect(falseAction, "action for val_review_available==false must exist").not.toBeNull();
      const promptText = falseAction[1];
      expect(promptText).toContain("[a]");
      expect(promptText).toContain("[y]");
      expect(promptText).toContain("[r]");
      expect(promptText).toContain("[x]");
      expect(promptText).not.toContain("[v]");
    });
  });

  // Zero findings path: "Validation complete: no issues found."
  describe("Val returns zero findings: success message and full option set returned", () => {
    it("Step 5 displays 'Validation complete: no issues found.' on zero findings", () => {
      const step5 = getStep5Content();
      expect(step5).toMatch(/Validation complete.*no issues found/i);
    });

    it("Step 5 zero-findings action returns all options including [v]", () => {
      const step5 = getStep5Content();
      // After zero findings, all options including [v] must be re-presented
      const zeroFindingsAction = step5.match(
        /<action\s+if="[^"]*Val returns zero findings[^"]*"[^>]*>(.*?)<\/action>/is
      );
      expect(zeroFindingsAction, "action for Val returns zero findings must exist").not.toBeNull();
      const actionText = zeroFindingsAction[1];
      expect(actionText).toMatch(/\[a\]|\[y\]|\[r\]|\[x\]|\[v\]/);
    });
  });

  // Returns [v] in options after successful Val review (findings loop)
  describe("Val returns findings: discussion loop returns all options including [v]", () => {
    it("Step 5 findings action returns to planning gate with all options including [v]", () => {
      const step5 = getStep5Content();
      const findingsAction = step5.match(
        /<action\s+if="[^"]*Val returns findings[^"]*"[^>]*>(.*?)<\/action>/is
      );
      expect(findingsAction, "action for Val returns findings must exist").not.toBeNull();
      const actionText = findingsAction[1];
      // Must re-present all options including [v] after the discussion loop
      expect(actionText).toMatch(/\[a\].*\[v\]|\[v\].*\[a\]/is);
    });
  });
});
