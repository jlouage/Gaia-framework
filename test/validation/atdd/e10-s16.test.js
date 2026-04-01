import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const ADD_STORIES_DIR = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "add-stories"
);
const INSTRUCTIONS = join(ADD_STORIES_DIR, "instructions.xml");
const CHECKLIST = join(ADD_STORIES_DIR, "checklist.md");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E10-S16: Add Inline Validation Step to add-stories", () => {
  // AC1: A new validation step is added after the "Append to Epics and Stories" step
  // that invokes val-validate-artifact
  describe("AC1: Inline validation step exists after epics-and-stories append", () => {
    it("instructions.xml contains a validation step referencing val-validate-artifact", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toContain("val-validate-artifact");
    });

    it("the validation step appears after the epics-and-stories append step", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const appendIndex = content.indexOf("Append to Epics and Stories");
      const valIndex = content.indexOf("val-validate-artifact");
      expect(appendIndex).toBeGreaterThan(-1);
      expect(valIndex).toBeGreaterThan(-1);
      expect(valIndex).toBeGreaterThan(appendIndex);
    });
  });

  // AC2: The inline validation step runs a fix loop with max 3 attempts
  // for CRITICAL/WARNING findings
  describe("AC2: Fix loop with max 3 attempts for CRITICAL/WARNING", () => {
    it("instructions.xml mentions a fix loop mechanism", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasFixLoop = /fix.?loop/i.test(content);
      expect(hasFixLoop).toBe(true);
    });

    it("instructions.xml specifies a maximum of 3 attempts", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasMaxAttempts = /3\s*attempt|max.*3|maximum.*3|attempt.*3/i.test(content);
      expect(hasMaxAttempts).toBe(true);
    });

    it("instructions.xml references CRITICAL and WARNING severity levels", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/CRITICAL/i);
      expect(content).toMatch(/WARNING/i);
    });
  });

  // AC3: Stories that pass validation are noted as validated; stories that fail
  // after 3 attempts are marked with status "validating" (not "ready-for-dev")
  describe("AC3: Validated vs validating status handling", () => {
    it("instructions.xml references validated status for passing stories", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/validated/i);
    });

    it("instructions.xml references validating status for stories that fail after max attempts", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/validating/i);
    });

    it("instructions.xml distinguishes between pass and fail outcomes for validation", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Both "validated" (pass) and "validating" (fail/stuck) should appear
      const hasValidated = /\bvalidated\b/i.test(content);
      const hasValidating = /\bvalidating\b/i.test(content);
      expect(hasValidated).toBe(true);
      expect(hasValidating).toBe(true);
    });
  });

  // AC4: checklist.md is updated with validation checklist items
  describe("AC4: Checklist updated with validation items", () => {
    it("checklist.md contains an inline validation invoked item", () => {
      const content = loadFile(CHECKLIST);
      expect(content).not.toBeNull();
      expect(content).toMatch(/inline validation/i);
    });

    it("checklist.md contains a fix loop executed item", () => {
      const content = loadFile(CHECKLIST);
      expect(content).not.toBeNull();
      expect(content).toMatch(/fix loop/i);
    });

    it("checklist.md contains a validation results recorded item", () => {
      const content = loadFile(CHECKLIST);
      expect(content).not.toBeNull();
      expect(content).toMatch(/validation results/i);
    });
  });

  // AC5: Inline validation works both standalone and as subagent from add-feature
  // (2-level nesting max)
  describe("AC5: Standalone and subagent compatibility", () => {
    it("instructions.xml handles both standalone and subagent invocation", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasStandaloneRef = /standalone|subagent|sub-agent|nesting|add-feature/i.test(content);
      expect(hasStandaloneRef).toBe(true);
    });

    it("instructions.xml mentions 2-level nesting limit", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasNestingLimit = /2.level|nesting.*max|max.*nesting|nesting.*2/i.test(content);
      expect(hasNestingLimit).toBe(true);
    });
  });

  // AC6: INFO-level findings are logged but do not trigger fix loop or block progression
  describe("AC6: INFO-level findings are non-blocking", () => {
    it("instructions.xml treats INFO findings as non-blocking", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/INFO/);
    });

    it("instructions.xml specifies INFO findings do not trigger fix loop", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Should mention that INFO does not block or does not trigger fix loop
      const hasInfoNonBlocking =
        /INFO.{0,80}(non.?blocking|log|skip|ignore|do not|don.t)/i.test(content) ||
        /(non.?blocking|log|skip|ignore|do not|don.t).{0,80}INFO/i.test(content);
      expect(hasInfoNonBlocking).toBe(true);
    });
  });

  // AC7: Graceful degradation when Val prerequisites missing
  describe("AC7: Graceful degradation when Val unavailable", () => {
    it("instructions.xml checks Val prerequisites before invocation", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasPrereqCheck = /prerequisite|validator\.md|validator-sidecar/i.test(content);
      expect(hasPrereqCheck).toBe(true);
    });

    it("instructions.xml handles Val invocation failure gracefully", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasGraceful = /warn_and_continue|graceful|degrad|warn.*continue|log.*warning/i.test(
        content
      );
      expect(hasGraceful).toBe(true);
    });

    it("instructions.xml marks story as validating on Val failure", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Should mention marking as validating when Val is unavailable
      const hasValidatingOnFail =
        /validating/i.test(content) && /unavailable|fail|missing|degrad/i.test(content);
      expect(hasValidatingOnFail).toBe(true);
    });
  });

  // AC8: Batch mode — independent per-story validation
  describe("AC8: Batch mode with independent per-story validation", () => {
    it("instructions.xml iterates over each newly created story", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasBatchIteration = /for each|each.*story|per.story|batch.*iteration|iterate/i.test(
        content
      );
      expect(hasBatchIteration).toBe(true);
    });

    it("instructions.xml ensures one story failure does not block others", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasIndependence = /continue.*next.*story|independent|does not block|next story/i.test(
        content
      );
      expect(hasIndependence).toBe(true);
    });

    it("instructions.xml reports batch validation summary", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const hasSummary = /batch.*summary|validation summary|summary/i.test(content);
      expect(hasSummary).toBe(true);
    });
  });

  // Structural integrity tests
  describe("Structural: Step numbering and existing steps preserved", () => {
    it("instructions.xml has 9 steps total", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      const stepMatches = content.match(/<step\s+n="\d+"/g);
      expect(stepMatches).not.toBeNull();
      expect(stepMatches.length).toBe(9);
    });

    it("Step 8 is titled Inline Validation", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/<step\s+n="8"\s+title="Inline Validation"/);
    });

    it("Step 9 is titled Next Steps (renumbered from 8)", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/<step\s+n="9"\s+title="Next Steps"/);
    });

    it("existing Steps 1-7 are unchanged", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/<step\s+n="1"\s+title="Load and Analyze Existing State"/);
      expect(content).toMatch(/<step\s+n="2"\s+title="Identify New Requirements"/);
      expect(content).toMatch(/<step\s+n="3"\s+title="Epic Decision/);
      expect(content).toMatch(/<step\s+n="4"\s+title="Create New Epic"/);
      expect(content).toMatch(/<step\s+n="5"\s+title="Define New Stories"/);
      expect(content).toMatch(/<step\s+n="6"\s+title="Protection Validation"/);
      expect(content).toMatch(/<step\s+n="7"\s+title="Append to Epics and Stories"/);
    });
  });
});
