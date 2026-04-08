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
  const re = new RegExp(
    `<step\\s+n="${n}"[\\s\\S]*?</step>`,
    "m"
  );
  const match = xml.match(re);
  return match ? match[0] : null;
}

describe("E20-S8: Dev-Story Step 16 — Merge PR", () => {
  const xml = readFileSync(INSTRUCTIONS_PATH, "utf8");

  describe("AC1, AC2: Merge PR step exists with strategy flag", () => {
    it("has a Merge PR step (<step ... title=\"Merge PR\">)", () => {
      expect(xml).toMatch(/<step\s+n="\d+"\s+title="Merge PR">/);
    });

    it("Step 16 references gh pr merge with strategy flag", () => {
      const step = extractStep(xml, 15);
      expect(step).not.toBeNull();
      expect(step).toContain("gh pr merge");
      // Must support all three strategy flags
      expect(step).toMatch(/--merge/);
      expect(step).toMatch(/--squash/);
      expect(step).toMatch(/--rebase/);
    });

    it("Step 16 reads merge_strategy from promotion_chain[0]", () => {
      const step = extractStep(xml, 15);
      expect(step).toContain("promotion_chain[0].merge_strategy");
    });

    it("Step 16 passes exactly one strategy flag (never combines flags)", () => {
      const step = extractStep(xml, 15);
      // Must explicitly state "exactly one" or "single" strategy flag
      expect(step).toMatch(/exactly one|single.*strategy|one strategy flag/i);
    });
  });

  describe("AC3: Merge conflict halt message", () => {
    it("Step 16 halts with the exact conflict message", () => {
      const step = extractStep(xml, 15);
      expect(step).toContain(
        "Merge conflict detected. Resolve conflicts locally, push, and resume with /gaia-resume."
      );
    });

    it("Step 16 preserves story status in-progress on conflict", () => {
      const step = extractStep(xml, 15);
      expect(step).toMatch(/in-progress/);
    });
  });

  describe("AC4: Branch protection failure handling", () => {
    it("Step 16 detects branch protection failures", () => {
      const step = extractStep(xml, 15);
      expect(step).toMatch(/branch protection|required.*review|required.*status check/i);
    });

    it("Step 16 lists unmet requirements on protection halt", () => {
      const step = extractStep(xml, 15);
      expect(step).toMatch(/unmet requirement|actionable/i);
    });
  });

  describe("AC5, AC6: Branch deletion configuration", () => {
    it("Step 16 reads ci_cd.delete_branch_after_merge", () => {
      const step = extractStep(xml, 15);
      expect(step).toContain("delete_branch_after_merge");
    });

    it("Step 16 uses --delete-branch when enabled", () => {
      const step = extractStep(xml, 15);
      expect(step).toContain("--delete-branch");
    });

    it("Step 16 treats missing delete_branch_after_merge as true (default)", () => {
      const step = extractStep(xml, 15);
      expect(step).toMatch(/default.*true|missing.*true|absent.*true/i);
    });

    it("Step 16 logs skip line when delete_branch_after_merge is false", () => {
      const step = extractStep(xml, 15);
      expect(step).toContain(
        "Branch deletion skipped per ci_cd.delete_branch_after_merge: false"
      );
    });
  });

  describe("AC7: Story key in merge commit", () => {
    it("Step 16 appends 'Story: {story_key}' to the merge commit body", () => {
      const step = extractStep(xml, 15);
      expect(step).toMatch(/Story: \{story_key\}/);
      expect(step).toContain("--body");
    });
  });

  describe("AC8: Backward compatibility guard", () => {
    it("Step 16 skips silently when promotion_chain is absent", () => {
      const step = extractStep(xml, 15);
      expect(step).toMatch(/promotion_chain/);
      expect(step).toMatch(/skip.*silent|no error.*no warning|silently/i);
    });
  });

  describe("AC9: Invalid merge strategy halt (T27 mitigation)", () => {
    it("Step 16 validates merge_strategy is one of merge|squash|rebase", () => {
      const step = extractStep(xml, 15);
      expect(step).toContain(
        "Invalid merge_strategy"
      );
      expect(step).toContain("Allowed: merge, squash, rebase");
    });

    it("Step 16 never uses --admin or any protection bypass flag", () => {
      const step = extractStep(xml, 15);
      expect(step).not.toContain("--admin");
    });
  });

  describe("Idempotency: re-invoke after successful merge", () => {
    it("Step 16 detects already-merged state via gh pr view", () => {
      const step = extractStep(xml, 15);
      expect(step).toContain("gh pr view");
      expect(step).toMatch(/merged|mergedAt/);
    });
  });

  describe("Sequencing: Step 16 is wired correctly into the workflow", () => {
    it("Merge PR step sits immediately before Auto-Run Reviews", () => {
      // Merge PR step must appear before Auto-Run Reviews in the file
      const mergeIdx = xml.search(/<step\s+n="\d+"\s+title="Merge PR">/);
      const reviewsIdx = xml.search(/<step\s+n="\d+"\s+title="Auto-Run Reviews/);
      expect(mergeIdx).toBeGreaterThan(-1);
      expect(reviewsIdx).toBeGreaterThan(-1);
      expect(mergeIdx).toBeLessThan(reviewsIdx);
    });

    it("Step 16 writes a checkpoint on completion", () => {
      const step = extractStep(xml, 15);
      expect(step).toMatch(/checkpoint/i);
    });
  });

  describe("Checklist integration (Task 10 — merge-success criterion)", () => {
    it("checklist.md includes a PR-merge completion item", () => {
      const checklist = readFileSync(CHECKLIST_PATH, "utf8");
      expect(checklist).toMatch(/PR merged|merge.*success|merged to.*promotion/i);
    });
  });
});
