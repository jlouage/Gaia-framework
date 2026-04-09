import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const INSTRUCTIONS_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/run-all-reviews/instructions.xml"
);

describe("E17-S3: Progressive Nudge After /gaia-run-all-reviews (FR-193)", () => {
  const xml = readFileSync(INSTRUCTIONS_PATH, "utf8");

  describe("AC1: Nudge Block rendered at completion with gate table, outcome, suggested command", () => {
    it("declares a Progressive Nudge Block action in Step 8", () => {
      expect(xml).toMatch(/Progressive Nudge Block/);
    });

    it("renders a gate summary table (gate name, status, report)", () => {
      // The nudge must render a table with gate name, status, linked report
      expect(xml).toMatch(/gate summary table/i);
      expect(xml).toMatch(/gate name/i);
      expect(xml).toMatch(/linked report/i);
    });

    it("renders the overall outcome classification", () => {
      expect(xml).toMatch(/ALL PASSED/);
      expect(xml).toMatch(/N FAILED/);
      expect(xml).toMatch(/N UNVERIFIED/);
    });

    it("renders a suggested next command line", () => {
      expect(xml).toMatch(/Suggested next/i);
    });
  });

  describe("AC2: ALL PASSED suggests /gaia-check-review-gate", () => {
    it("nudge ALL PASSED branch suggests /gaia-check-review-gate {story_key}", () => {
      expect(xml).toMatch(/\/gaia-check-review-gate \{story_key\}/);
    });
  });

  describe("AC3: Any FAILED suggests /gaia-correct-course with failed gate list", () => {
    it("nudge FAILED branch suggests /gaia-correct-course", () => {
      expect(xml).toMatch(/\/gaia-correct-course/);
    });

    it("nudge FAILED branch lists failed gate names", () => {
      expect(xml).toMatch(/failed gate[s]?/i);
    });
  });

  describe("AC4: Any UNVERIFIED identifies which reviews have not yet run", () => {
    it("nudge UNVERIFIED branch lists unrun gates", () => {
      expect(xml).toMatch(/UNVERIFIED/);
      expect(xml).toMatch(/unrun|not yet run|still at UNVERIFIED/i);
    });

    it("nudge UNVERIFIED branch suggests individual review commands per unrun gate", () => {
      // Must reference the 6 individual review commands as per-gate suggestions
      expect(xml).toMatch(
        /gaia-code-review.*gaia-qa-tests.*gaia-security-review.*gaia-test-automate.*gaia-test-review.*gaia-review-perf/s
      );
    });
  });

  describe("AC5: Nudge renders in both normal and YOLO modes", () => {
    it("nudge is declared unconditional of execution mode", () => {
      expect(xml).toMatch(/all execution modes|normal and YOLO|both modes/i);
    });
  });

  describe("AC6: Nudge is additive, does not replace existing completion output", () => {
    it("nudge is additive to the existing review summary output", () => {
      expect(xml).toMatch(/additive|does not (replace|block)/i);
    });

    it("nudge renders AFTER the review-summary template-output is saved", () => {
      const summaryIdx = xml.indexOf("story_key}-review-summary.md");
      const nudgeIdx = xml.indexOf("Progressive Nudge Block");
      expect(summaryIdx).toBeGreaterThan(-1);
      expect(nudgeIdx).toBeGreaterThan(-1);
      expect(nudgeIdx).toBeGreaterThan(summaryIdx);
    });
  });
});
