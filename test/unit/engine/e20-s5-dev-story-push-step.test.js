const path = require("path");
const fs = require("fs");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

// E20-S5 — Dev-Story Step 13: Push Feature Branch
//
// Verifies the structural insertion of a new "Push Feature Branch" step into
// the dev-story workflow instructions.xml per architecture §10.24.5 and
// FR-247. The story inserts a new Step 13 after the current Step 12 (Commit
// Changes) and renumbers the current Steps 13–15 to 17–19.
//
// Acceptance criteria:
//   AC1: New Step 13 executes `git push -u origin {branch_name}` (FR-247)
//   AC2: No git remote → warn and skip Steps 14–16
//   AC3: Push failure → retry once after 5s, HALT if retry fails
//   AC4: Branch name derived via git-workflow skill convention
//   AC5: Absent ci_cd.promotion_chain → skip Steps 13–16 silently (NFR-045)
//
// Test cases: MPC-25 (happy path), MPC-26 (no remote), MPC-27 (retry fails)
//
// Story file: docs/implementation-artifacts/E20-S5-dev-story-step-13-push-feature-branch.md

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const INSTRUCTIONS_PATH = path.join(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/dev-story/instructions.xml"
);

// Helper — extract the <step n="N" title="..."> blocks in document order.
function extractSteps(xml) {
  const steps = [];
  const stepRegex = /<step\s+n="(\d+)"\s+title="([^"]+)"\s*>([\s\S]*?)<\/step>/g;
  let match;
  while ((match = stepRegex.exec(xml)) !== null) {
    steps.push({
      n: Number(match[1]),
      title: match[2],
      body: match[3],
    });
  }
  return steps;
}

describe("E20-S5: Dev-Story Step 13 — Push Feature Branch", () => {
  let xml;
  let steps;

  beforeAll(() => {
    xml = fs.readFileSync(INSTRUCTIONS_PATH, "utf8");
    steps = extractSteps(xml);
  });

  describe("Structural changes", () => {
    it("instructions.xml contains exactly 19 steps after insertion", () => {
      expect(steps).toHaveLength(19);
    });

    it("Step 12 remains 'Commit Changes'", () => {
      const s12 = steps.find((s) => s.n === 12);
      expect(s12).toBeDefined();
      expect(s12.title).toBe("Commit Changes");
    });

    it("Step 13 is the new 'Push Feature Branch' step", () => {
      const s13 = steps.find((s) => s.n === 13);
      expect(s13).toBeDefined();
      expect(s13.title).toMatch(/Push Feature Branch/i);
    });

    it("Steps 13–15 have been renumbered to 17–19", () => {
      const s17 = steps.find((s) => s.n === 17);
      const s18 = steps.find((s) => s.n === 18);
      const s19 = steps.find((s) => s.n === 19);
      expect(s17).toBeDefined();
      expect(s17.title).toBe("Post-Complete Gate");
      expect(s18).toBeDefined();
      expect(s18.title).toBe("Update Status");
      expect(s19).toBeDefined();
      expect(s19.title).toMatch(/Auto-Run Reviews/i);
    });

    it("step numbering is sequential from 1 to 19 with no gaps", () => {
      const nums = steps.map((s) => s.n).sort((a, b) => a - b);
      for (let i = 0; i < nums.length; i++) {
        expect(nums[i]).toBe(i + 1);
      }
    });

    it("no duplicate step numbers", () => {
      const nums = steps.map((s) => s.n);
      const unique = new Set(nums);
      expect(unique.size).toBe(nums.length);
    });
  });

  describe("AC1: git push command (FR-247) — MPC-25 happy path", () => {
    let body;
    beforeAll(() => {
      body = steps.find((s) => s.n === 13).body;
    });

    it("Step 13 invokes 'git push' with '-u' upstream flag", () => {
      expect(body).toMatch(/git push\s+-u/);
    });

    it("Step 13 references 'origin' as the remote name", () => {
      expect(body).toContain("origin");
    });

    it("Step 13 references a branch name variable or placeholder", () => {
      expect(body).toMatch(/\{branch_name\}|\{branch\}|--show-current/);
    });
  });

  describe("AC2: No-remote detection — MPC-26", () => {
    let body;
    beforeAll(() => {
      body = steps.find((s) => s.n === 13).body;
    });

    it("Step 13 checks 'git remote' before pushing", () => {
      expect(body).toMatch(/git remote/);
    });

    it("Step 13 emits a warning when no remote is configured", () => {
      expect(body).toMatch(/No git remote|no remote/i);
    });

    it("Step 13 skips Steps 14–16 when no remote is configured", () => {
      expect(body).toMatch(/skip.*(14|14.*16|promotion)/i);
    });
  });

  describe("AC3: Retry logic — MPC-27", () => {
    let body;
    beforeAll(() => {
      body = steps.find((s) => s.n === 13).body;
    });

    it("Step 13 retries push once on failure", () => {
      expect(body).toMatch(/retry/i);
    });

    it("Step 13 waits 5 seconds before retry", () => {
      expect(body).toMatch(/5\s*second/i);
    });

    it("Step 13 HALTs with actionable error if retry fails", () => {
      expect(body).toMatch(/HALT/);
    });

    it("Step 13 includes git error output in the HALT message", () => {
      expect(body).toMatch(/git.*output|error output|stderr/i);
    });
  });

  describe("AC4: Branch naming via git-workflow skill", () => {
    let body;
    beforeAll(() => {
      body = steps.find((s) => s.n === 13).body;
    });

    it("Step 13 references the git-workflow skill for branch naming", () => {
      expect(body).toMatch(/git-workflow/);
    });

    it("Step 13 derives branch name from current checked-out branch", () => {
      expect(body).toMatch(/git branch --show-current|current.*branch/i);
    });
  });

  describe("AC5: Backward compatibility — absent ci_cd guard (NFR-045)", () => {
    let body;
    beforeAll(() => {
      body = steps.find((s) => s.n === 13).body;
    });

    it("Step 13 reads global.yaml to check promotion_chain", () => {
      expect(body).toMatch(/global\.yaml/);
    });

    it("Step 13 checks for ci_cd.promotion_chain", () => {
      expect(body).toMatch(/ci_cd|promotion_chain/);
    });

    it("Step 13 skips Steps 13–16 silently when promotion_chain absent", () => {
      // Must mention silent skip of the promotion step range
      expect(body).toMatch(/skip/i);
      expect(body).toMatch(/silently|no error|no warning/i);
    });
  });

  describe("FR-247 traceability", () => {
    it("Step 13 body or a comment references FR-247", () => {
      const body = steps.find((s) => s.n === 13).body;
      // Either in body or a nearby comment — check body directly
      expect(body).toMatch(/FR-247/);
    });
  });
});
