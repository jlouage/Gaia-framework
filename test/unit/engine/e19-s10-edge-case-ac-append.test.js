import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const INSTRUCTIONS_XML = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/create-story/instructions.xml"
);

describe("E19-S10: Edge Case Results Feed into Acceptance Criteria (FR-229)", () => {
  const xml = readFileSync(INSTRUCTIONS_XML, "utf8");

  // ── AC1: Edge case results appended as AC items after sub-step ──
  describe("AC1: Append edge case results as AC items (FR-229)", () => {
    it("references FR-229", () => {
      expect(xml).toMatch(/FR-229/);
    });

    it("contains an explicit AC append step that runs after edge case sub-step", () => {
      // AC append logic must appear AFTER the edge case sub-step (Step 4b) and BEFORE step 6 output
      const edgeSubStepIdx = xml.search(/Edge Case Analysis Sub-Step/);
      const appendIdx = xml.search(
        /AC-EC|append.*edge.*case.*acceptance|edge.*case.*append.*acceptance/i
      );
      const step6Idx = xml.search(/<step n="6"/);
      expect(edgeSubStepIdx).toBeGreaterThan(-1);
      expect(appendIdx).toBeGreaterThan(edgeSubStepIdx);
      expect(appendIdx).toBeLessThan(step6Idx);
    });
  });

  // ── AC2: AC-EC{N} prefix label ──
  describe("AC2: AC-EC{N} prefix for edge case ACs", () => {
    it("defines AC-EC numbering convention in instructions", () => {
      expect(xml).toMatch(/AC-EC\{?N\}?|AC-EC\d+|AC-EC1/);
    });

    it("numbers AC-EC entries starting from 1 per story", () => {
      expect(xml).toMatch(/AC-EC.*(?:start|from).*1|restart.*AC-EC|AC-EC.*1.*per.*story/i);
    });
  });

  // ── AC3: Each AC-EC includes scenario, expected, category ──
  describe("AC3: AC-EC row includes scenario, expected, category", () => {
    it("documents the AC-EC rendering format with scenario, expected, category", () => {
      // Must reference all three fields together in the append format
      expect(xml).toMatch(/scenario[\s\S]{0,200}expected[\s\S]{0,200}category/i);
    });

    it("uses a bracketed category tag in the rendered AC-EC line", () => {
      expect(xml).toMatch(/\[category:/);
    });
  });

  // ── AC4: Primary ACs never modified or reordered ──
  describe("AC4: Primary ACs preserved", () => {
    it("states that primary ACs must not be modified or reordered", () => {
      expect(xml).toMatch(
        /primary\s+AC.*(?:not|never).*(?:modif|reorder)|never.*modify.*primary.*AC|never.*insert.*primary.*AC/i
      );
    });

    it("requires append after the last primary AC", () => {
      expect(xml).toMatch(
        /append.*(?:after|following).*(?:last\s+)?primary\s+AC|after.*last\s+primary\s+AC/i
      );
    });
  });

  // ── AC5: Zero-result handling ──
  describe("AC5: Zero edge case results handled gracefully", () => {
    it("handles empty edge_case_results with no AC-EC items and a dev note", () => {
      expect(xml).toMatch(/edge_case_results.*(?:empty|\[\]|zero|length\s*==?\s*0)/i);
      expect(xml).toMatch(/No edge cases identified\./);
    });
  });
});
