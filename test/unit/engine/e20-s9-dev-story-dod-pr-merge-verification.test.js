import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const INSTRUCTIONS_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/dev-story/instructions.xml"
);
const CHECKLIST_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/dev-story/checklist.md"
);

// Helper — extract the full text of a <step n="N" ...> ... </step> block.
function extractStep(xml, n) {
  const re = new RegExp(`<step\\s+n="${n}"[\\s\\S]*?</step>`, "m");
  const match = xml.match(re);
  return match ? match[0] : null;
}

describe("E20-S9: Dev-Story DoD Update — PR Merge Verification (MPC-38)", () => {
  const xml = readFileSync(INSTRUCTIONS_PATH, "utf8");
  const checklist = readFileSync(CHECKLIST_PATH, "utf8");

  describe("AC1: DoD checklist includes PR-merge item with branch interpolation", () => {
    it("checklist.md includes a 'PR merged to {promotion_chain[0].branch}' item under Quality", () => {
      // The Quality group must carry the new line with the interpolation token
      expect(checklist).toMatch(
        /## Quality[\s\S]*- \[ \] PR merged to \{promotion_chain\[0\]\.branch\}[\s\S]*## Completion/
      );
    });

    it("Step 10 (DoD) renders a PR-merge line when promotion_chain is defined", () => {
      const step = extractStep(xml, 10);
      expect(step).not.toBeNull();
      // Must reference the DoD item for PR merge tied to promotion_chain[0].branch
      expect(step).toMatch(/PR merged to/);
      expect(step).toMatch(/promotion_chain\[0\]\.branch/);
    });

    it("Step 10 resolves {promotion_chain[0].branch} at render time — literal token never lands in story file", () => {
      const step = extractStep(xml, 10);
      // Must explicitly document that the token is resolved from global.yaml at render time
      expect(step).toMatch(/render.?time|resolve.*global\.yaml|read.*global\.yaml/i);
      expect(step).toMatch(/literal.*token.*never|MUST NEVER.*literal|never appear/i);
    });
  });

  describe("AC2: DoD item auto-checked after Step 16 (Merge PR) succeeds", () => {
    it("Step 15 (Merge PR) success handler auto-checks the DoD item in story file", () => {
      // The merge PR step in this branch is n="15" (see E20-S8 numbering note)
      const step = extractStep(xml, 16);
      expect(step).not.toBeNull();
      // Must rewrite the DoD line from [ ] to [x] on successful merge
      expect(step).toMatch(/auto-?check|\[x\].*PR merged|PR merged.*\[x\]/i);
      expect(step).toMatch(/story file|story markdown|\{story_key\}/);
    });
  });

  describe("AC3: Absent ci_cd block renders as N/A", () => {
    it("Step 10 renders the merge item as N/A when ci_cd.promotion_chain is absent", () => {
      const step = extractStep(xml, 10);
      expect(step).toContain("PR merged — N/A (no promotion chain configured)");
    });

    it("Step 10 marks the N/A variant as pre-checked ([x]) so it is non-blocking", () => {
      const step = extractStep(xml, 10);
      // The N/A variant must be emitted as "- [x] PR merged — N/A ..."
      expect(step).toMatch(/\[x\]\s*PR merged — N\/A/);
    });
  });

  describe("AC4: Gate blocks in-progress → review when DoD item unchecked", () => {
    it("Step 14 (Update Status to review) gates on the PR-merge DoD item", () => {
      const step = extractStep(xml, 18);
      expect(step).not.toBeNull();
      expect(step).toMatch(/PR merged/);
      // Must verify item is checked OR N/A before allowing status-sync
      expect(step).toMatch(/checked.*N\/A|N\/A.*checked|satisfied/i);
    });

    it("Step 14 halts with actionable message naming the missing DoD item", () => {
      const step = extractStep(xml, 18);
      expect(step).toMatch(/HALT/);
      expect(step).toMatch(
        /Cannot transition.*review|DoD item.*PR merged.*not satisfied|PR merged.*not satisfied/
      );
    });
  });

  describe("AC5: Gate passes when DoD item is checked or N/A", () => {
    it("Step 14 proceeds with status-sync when gate passes", () => {
      const step = extractStep(xml, 18);
      expect(step).toContain("status-sync");
      expect(step).toMatch(/new_status="review"/);
    });
  });

  describe("AC6: Backward compatibility — no behavior change when ci_cd is absent", () => {
    it("Step 10 detects absent ci_cd silently without warnings or errors", () => {
      const step = extractStep(xml, 10);
      // Must read ci_cd from resolved global.yaml at render time
      expect(step).toMatch(/ci_cd/);
      // Must not emit warnings when absent
      expect(step).toMatch(/no warning|silently|no error/i);
    });

    it("Step 14 gate is bypassed (passes trivially) when DoD item is N/A", () => {
      const step = extractStep(xml, 18);
      // The gate must treat N/A the same as checked — passes trivially
      expect(step).toMatch(/N\/A/);
    });
  });

  describe("Checklist grouping — item lives under Quality group, not Completion", () => {
    it("checklist.md has Quality section containing the new PR merge item", () => {
      const qualityMatch = checklist.match(/## Quality([\s\S]*?)##/);
      expect(qualityMatch).not.toBeNull();
      expect(qualityMatch[1]).toMatch(/PR merged to \{promotion_chain\[0\]\.branch\}/);
    });
  });
});
