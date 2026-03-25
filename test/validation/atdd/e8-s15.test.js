import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (4 levels up: test/validation/atdd/ -> Gaia-framework/ -> GAIA-Framework/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../../..");
const WORKFLOW_XML = join(PROJECT_ROOT, "_gaia", "core", "engine", "workflow.xml");

describe("E8-S15: Workflow Engine [v] at Planning Gate", () => {
  // AC1: workflow.xml Step 5 planning gate prompt extended with [v] Review with Val (recommended)
  describe("AC1: Planning gate prompt includes [v] Review with Val option", () => {
    it("Step 5 planning gate contains [v] Review with Val option", () => {
      expect(existsSync(WORKFLOW_XML), "workflow.xml must exist").toBe(true);

      const content = readFileSync(WORKFLOW_XML, "utf-8");

      // Must be within Step 5 (Planning Gate) context
      const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
      expect(step5Match, "Step 5 must exist in workflow.xml").not.toBeNull();

      const step5Content = step5Match[0];
      expect(step5Content).toMatch(/\[v\].*Review with Val/i);
    });

    it("Val option is marked as recommended", () => {
      const content = readFileSync(WORKFLOW_XML, "utf-8");
      const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
      const step5Content = step5Match[0];
      expect(step5Content).toMatch(/\[v\].*recommended/i);
    });
  });

  // AC2: Same discussion → selective sharing → revalidation loop as template-output
  describe("AC2: Val review follows discussion/sharing/revalidation loop", () => {
    it("Step 5 contains discussion loop for Val review", () => {
      const content = readFileSync(WORKFLOW_XML, "utf-8");
      const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
      expect(step5Match).not.toBeNull();

      const step5Content = step5Match[0].toLowerCase();

      // Discussion pattern: user can discuss findings with Val
      expect(step5Content, "Must contain discussion interaction").toMatch(/discuss|discussion/);

      // Selective sharing: user can selectively share/accept findings
      expect(step5Content, "Must contain selective sharing pattern").toMatch(
        /selective|select|share|accept|dismiss/
      );

      // Revalidation: ability to re-run validation after changes
      expect(step5Content, "Must contain revalidation loop").toMatch(
        /revalidat|re-validat|validate again|run again/
      );
    });
  });

  // AC3: Existing [a]/[y]/[r]/[x] options unaffected
  describe("AC3: Existing planning gate options preserved", () => {
    const requiredOptions = [
      { key: "[a]", label: "Approve" },
      { key: "[y]", label: "YOLO" },
      { key: "[r]", label: "Revise" },
      { key: "[x]", label: "Abort" },
    ];

    it.each(requiredOptions)("Planning gate still contains $key option", ({ key }) => {
      const content = readFileSync(WORKFLOW_XML, "utf-8");
      const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
      expect(step5Match).not.toBeNull();

      const step5Content = step5Match[0];
      expect(step5Content).toContain(key);
    });

    it("all four original prompt options appear in a single action", () => {
      const content = readFileSync(WORKFLOW_XML, "utf-8");
      const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
      const step5Content = step5Match[0];

      // The original prompt line should still contain all four options together
      expect(step5Content).toMatch(/\[a\].*\[y\].*\[r\].*\[x\]/s);
    });
  });

  // AC4: Feature gated with conditional check
  describe("AC4: Val review option is feature-gated", () => {
    it("Step 5 contains a conditional check for Val review", () => {
      const content = readFileSync(WORKFLOW_XML, "utf-8");
      const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
      expect(step5Match).not.toBeNull();

      const step5Content = step5Match[0];

      // Must have a conditional (if attribute or check tag) gating the Val feature
      const hasConditional =
        /if=.*val/i.test(step5Content) ||
        /<check.*val/i.test(step5Content) ||
        /<action\s+if=.*val/i.test(step5Content) ||
        /val.*gate/i.test(step5Content) ||
        /feature.*gate/i.test(step5Content) ||
        /val-validate-plan/i.test(step5Content);

      expect(hasConditional, "Val review must be behind a conditional/feature gate").toBe(true);
    });

    it("feature gate checks for Val workflow existence or configuration", () => {
      const content = readFileSync(WORKFLOW_XML, "utf-8");
      const step5Match = content.match(/<step\s+n="5"[^>]*>[\s\S]*?<\/step>/);
      const step5Content = step5Match[0];

      // The gate should reference either the val-validate-plan workflow, validator agent, or a config flag
      const hasGateTarget =
        /val-validate-plan/i.test(step5Content) ||
        /validator/i.test(step5Content) ||
        /val_enabled/i.test(step5Content) ||
        /enable_val/i.test(step5Content);

      expect(
        hasGateTarget,
        "Feature gate must reference Val workflow, validator agent, or config flag"
      ).toBe(true);
    });
  });
});
