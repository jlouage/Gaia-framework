import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

describe("E19-S8: Edge Case Size Gate (S Skip, M+ Run)", () => {
  const createStoryXml = readFileSync(
    resolve(
      PROJECT_ROOT,
      "_gaia/lifecycle/workflows/4-implementation/create-story/instructions.xml"
    ),
    "utf8"
  );

  // ── AC1 + AC5: Size gate check tag in create-story instructions ──
  describe("AC1 + AC5: Size gate via check tag skips edge case for S stories", () => {
    it("contains a check tag that evaluates story size", () => {
      // The instructions must have a <check> tag referencing size
      expect(createStoryXml).toMatch(/<check\s[^>]*if="[^"]*size[^"]*"/);
    });

    it("skips edge case analysis when size is S", () => {
      // Must contain logic that skips edge case for S-sized stories
      expect(createStoryXml).toMatch(/size\s*==\s*['"]?S['"]?.*[Ss]kip.*edge\s*case/is);
    });
  });

  // ── AC2: Edge case mandatory for M/L/XL stories ──
  describe("AC2: Edge case mandatory for M, L, XL stories", () => {
    it("makes edge case analysis mandatory for M+ stories", () => {
      // Must contain logic that requires edge case for M, L, XL
      expect(createStoryXml).toMatch(
        /size\s*(in|==)\s*\[?\s*['"]?M['"]?.*edge\s*case.*mandatory/is
      );
    });
  });

  // ── AC3: Gate decision logged in Dev Notes ──
  describe("AC3: Gate decision logged in Dev Notes", () => {
    it("logs skip decision for S stories in Dev Notes or story output", () => {
      // Must mention logging the gate decision
      expect(createStoryXml).toMatch(/[Ee]dge\s*case\s*analysis:\s*skipped\s*\(size=S\)/);
    });

    it("logs completion decision for M+ stories in Dev Notes or story output", () => {
      // Must mention logging the gate decision for M+ sizes
      expect(createStoryXml).toMatch(/[Ee]dge\s*case\s*analysis:\s*completed\s*\(size=/);
    });
  });

  // ── AC4: YOLO mode auto-fires gate without user prompt ──
  describe("AC4: YOLO mode auto-fires gate", () => {
    it("gate logic executes automatically in YOLO mode without user interaction", () => {
      // The gate should be a <check> tag (auto-evaluated) not an <ask> tag
      // Check that the size gate uses <check> not <ask>
      const sizeGateSection = createStoryXml.match(
        /<check\s[^>]*if="[^"]*size[^"]*"[^>]*>[\s\S]*?<\/check>/
      );
      expect(sizeGateSection).not.toBeNull();

      // The size gate check should NOT require user interaction (no <ask> inside the gate)
      if (sizeGateSection) {
        expect(sizeGateSection[0]).not.toMatch(/<ask>/);
      }
    });
  });

  // ── Gate placement: between size determination and story output ──
  describe("Gate placement validation", () => {
    it("size gate appears after step 4 (elaboration) and before or in step 6 (output)", () => {
      // The gate should be in step 4 (after size is known from epics) or step 5,
      // but definitely before step 6 (Generate Output)
      const step6Match = createStoryXml.match(/<step n="6"[\s\S]*?<\/step>/);
      expect(step6Match).not.toBeNull();

      // Find where the size gate check is
      const sizeGateIndex = createStoryXml.search(/<check\s[^>]*if="[^"]*size[^"]*"/);
      const step6Index = createStoryXml.search(/<step n="6"/);

      expect(sizeGateIndex).toBeGreaterThan(-1);
      expect(sizeGateIndex).toBeLessThan(step6Index);
    });
  });
});
