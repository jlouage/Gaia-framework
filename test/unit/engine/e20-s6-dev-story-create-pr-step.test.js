const path = require("path");
const fs = require("fs");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

// E20-S6 — Dev-Story Step 14: Create Pull Request
//
// Verifies the Step 14 implementation replaces the E20-S6 placeholder in the
// dev-story workflow instructions.xml per architecture §10.24.5 and FR-248.
//
// Acceptance criteria:
//   AC1: Create PR via `gh pr create` targeting promotion_chain[0].branch (FR-248)
//   AC2: PR title follows `{story_key}: {story_title}` convention
//   AC3: PR body includes story key, AC summary, and story file path
//   AC4: Existing PR detected → skip creation with "PR #{number} already exists" message
//   AC5: CI provider mapping: github_actions → gh, gitlab_ci → glab
//   AC6: Missing CLI tool → HALT "Required tool {tool} not found"
//
// Test cases: MPC-28 (create), MPC-29 (existing PR skip), MPC-30 (missing tool halt)
//
// Story file: docs/implementation-artifacts/E20-S6-dev-story-step-14-create-pr.md

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

describe("E20-S6: Dev-Story Step 14 — Create Pull Request", () => {
  let xml;
  let steps;
  let step14;

  beforeAll(() => {
    xml = fs.readFileSync(INSTRUCTIONS_PATH, "utf8");
    steps = extractSteps(xml);
    step14 = steps.find((s) => s.n === 14);
  });

  describe("Structural placement", () => {
    it("Step 14 exists and is titled 'Create Pull Request'", () => {
      expect(step14).toBeDefined();
      expect(step14.title).toMatch(/Create Pull Request/i);
    });

    it("Step 14 body is no longer a placeholder", () => {
      expect(step14.body).not.toMatch(/PLACEHOLDER/);
    });

    it("Step 13 remains 'Push Feature Branch'", () => {
      const s13 = steps.find((s) => s.n === 13);
      expect(s13).toBeDefined();
      expect(s13.title).toMatch(/Push Feature Branch/i);
    });

    it("Step 15 remains 'Wait for CI'", () => {
      const s15 = steps.find((s) => s.n === 15);
      expect(s15).toBeDefined();
      expect(s15.title).toMatch(/Wait for CI/i);
    });

    it("total step count is still 19 (no renumbering)", () => {
      expect(steps).toHaveLength(19);
    });

    it("step numbering is sequential from 1 to 19 with no gaps", () => {
      const nums = steps.map((s) => s.n).sort((a, b) => a - b);
      for (let i = 0; i < nums.length; i++) {
        expect(nums[i]).toBe(i + 1);
      }
    });
  });

  describe("AC1: PR creation targets promotion_chain[0].branch (FR-248) — MPC-28", () => {
    it("Step 14 invokes 'gh pr create'", () => {
      expect(step14.body).toMatch(/gh pr create/);
    });

    it("Step 14 targets promotion_chain[0].branch via --base", () => {
      expect(step14.body).toMatch(/--base/);
      expect(step14.body).toMatch(/promotion_chain\[0\]\.branch/);
    });

    it("Step 14 references FR-248", () => {
      expect(step14.body).toMatch(/FR-248/);
    });
  });

  describe("AC2: PR title convention", () => {
    it("Step 14 describes the '{story_key}: {story_title}' title convention", () => {
      expect(step14.body).toMatch(/\{story_key\}:\s*\{story_title\}/);
    });

    it("Step 14 passes --title to gh pr create", () => {
      expect(step14.body).toMatch(/--title/);
    });
  });

  describe("AC3: PR body content", () => {
    it("Step 14 passes --body to gh pr create", () => {
      expect(step14.body).toMatch(/--body/);
    });

    it("Step 14 body description references acceptance criteria summary", () => {
      expect(step14.body).toMatch(/acceptance criteria|AC summary/i);
    });

    it("Step 14 references including the story file path in the body", () => {
      expect(step14.body).toMatch(/story file path|path to the story/i);
    });
  });

  describe("AC4: Existing PR detection — MPC-29", () => {
    it("Step 14 queries existing PRs via 'gh pr list'", () => {
      expect(step14.body).toMatch(/gh pr list/);
    });

    it("Step 14 filters by --head and --base", () => {
      expect(step14.body).toMatch(/--head/);
      expect(step14.body).toMatch(/--base/);
    });

    it("Step 14 emits the 'already exists' skip message", () => {
      expect(step14.body).toMatch(/already exists/i);
      expect(step14.body).toMatch(/proceeding to CI check/i);
    });
  });

  describe("AC5: CI provider mapping", () => {
    it("Step 14 reads promotion_chain[0].ci_provider", () => {
      expect(step14.body).toMatch(/ci_provider/);
    });

    it("Step 14 maps github_actions to gh", () => {
      expect(step14.body).toMatch(/github_actions/);
      expect(step14.body).toMatch(/\bgh\b/);
    });

    it("Step 14 maps gitlab_ci to glab", () => {
      expect(step14.body).toMatch(/gitlab_ci/);
      expect(step14.body).toMatch(/glab/);
    });
  });

  describe("AC6: Missing CLI tool halt — MPC-30", () => {
    it("Step 14 checks CLI tool availability via 'which' or 'command -v'", () => {
      expect(step14.body).toMatch(/\bwhich\b|command -v/);
    });

    it("Step 14 HALTs when the required tool is not installed", () => {
      expect(step14.body).toMatch(/HALT/);
    });

    it("Step 14 emits the 'Required tool {tool} not found' message", () => {
      expect(step14.body).toMatch(/Required tool .*not found/i);
      expect(step14.body).toMatch(/Install it or complete PR creation manually/i);
    });
  });

  describe("Backward compatibility — promotion-chain guard and no-remote skip", () => {
    it("Step 14 is skipped when the promotion-chain guard is set", () => {
      expect(step14.body).toMatch(/promotion.chain guard|promotion_chain.*absent|guard.*skip/i);
    });

    it("Step 14 is skipped when the no-remote flag from Step 13 is set", () => {
      expect(step14.body).toMatch(/no.remote/i);
    });
  });
});
