const path = require("path");
const fs = require("fs");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

// E20-S7 — Dev-Story Step 15: Wait for CI Checks
//
// Verifies the Step 15 implementation replaces the placeholder with a fully
// specified "Wait for CI Checks" step per architecture §10.24.5, FR-249, NFR-043.
//
// Acceptance criteria:
//   AC1: Polls CI check status at 30-second intervals using `gh pr checks {pr_number}` (FR-249)
//   AC2: Progress display shows check name, status (pending/running/passed/failed), elapsed time
//   AC3: Timeout default 15 minutes, configurable via ci_cd.ci_timeout_minutes (NFR-043)
//   AC4: On timeout: halt with pending checks list + /gaia-resume guidance, story stays in-progress
//   AC5: On all checks passed: success summary, advance to Step 16 (Merge PR)
//   AC6: On any check failed: failure details (name, log excerpt, URL), halt with /gaia-resume guidance
//   AC7: Empty/absent ci_checks → auto-pass "No CI checks configured — proceeding to merge"
//   AC8: Absent ci_cd.promotion_chain → skip step entirely (NFR-045 backward compat)
//
// Test cases: MPC-25 (polling cadence), MPC-26 (failure), MPC-27 (timeout), MPC-35 (custom timeout)
//
// Story file: docs/implementation-artifacts/E20-S7-dev-story-step-15-wait-for-ci-checks.md

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

describe("E20-S7: Dev-Story Step 15 — Wait for CI Checks", () => {
  let xml;
  let steps;
  let step15;

  beforeAll(() => {
    xml = fs.readFileSync(INSTRUCTIONS_PATH, "utf8");
    steps = extractSteps(xml);
    step15 = steps.find((s) => s.n === 15);
  });

  describe("Structural placement", () => {
    it("Step 15 exists and is titled 'Wait for CI' (or similar)", () => {
      expect(step15).toBeDefined();
      expect(step15.title).toMatch(/Wait for CI/i);
    });

    it("Step 15 body is no longer a placeholder", () => {
      expect(step15.body).not.toMatch(/PLACEHOLDER/);
    });

    it("Step 15 body is substantive (at least 500 characters)", () => {
      expect(step15.body.length).toBeGreaterThan(500);
    });

    it("Auto-Run Reviews step still exists after Step 15", () => {
      const reviewsStep = steps.find((s) => /Auto-Run Reviews/i.test(s.title));
      expect(reviewsStep).toBeDefined();
      expect(reviewsStep.n).toBeGreaterThan(15);
    });

    it("step numbering is sequential from 1 with no gaps", () => {
      const nums = steps.map((s) => s.n).sort((a, b) => a - b);
      for (let i = 0; i < nums.length; i++) {
        expect(nums[i]).toBe(i + 1);
      }
    });
  });

  describe("AC1: 30-second polling using gh pr checks (FR-249) — MPC-25", () => {
    it("Step 15 references 'gh pr checks' or equivalent CI polling command", () => {
      expect(step15.body).toMatch(/gh\s+pr\s+checks/);
    });

    it("Step 15 references 30-second polling interval", () => {
      expect(step15.body).toMatch(/30[- ]?second|30s\b/i);
    });

    it("Step 15 references FR-249", () => {
      expect(step15.body).toMatch(/FR-249/);
    });

    it("Step 15 uses the PR number from Step 14", () => {
      expect(step15.body).toMatch(/pr_number|PR number|\{pr_number\}/i);
    });
  });

  describe("AC2: Progress display with check name, status, elapsed time", () => {
    it("Step 15 progress output lists pending/running/passed/failed states", () => {
      expect(step15.body).toMatch(/pending/i);
      expect(step15.body).toMatch(/running/i);
      expect(step15.body).toMatch(/passed|success/i);
      expect(step15.body).toMatch(/failed|failure/i);
    });

    it("Step 15 progress output includes elapsed time", () => {
      expect(step15.body).toMatch(/elapsed/i);
    });

    it("Step 15 progress output includes check name", () => {
      expect(step15.body).toMatch(/check name/i);
    });
  });

  describe("AC3: Timeout default 15 min, configurable via ci_cd.ci_timeout_minutes (NFR-043) — MPC-35", () => {
    it("Step 15 references ci_cd.ci_timeout_minutes", () => {
      expect(step15.body).toMatch(/ci_timeout_minutes/);
    });

    it("Step 15 references a 15-minute default", () => {
      expect(step15.body).toMatch(/15[- ]?minute|default.*15|15.*default/i);
    });

    it("Step 15 references NFR-043", () => {
      expect(step15.body).toMatch(/NFR-043/);
    });
  });

  describe("AC4: Timeout halt with pending list and resume guidance — MPC-27", () => {
    it("Step 15 includes the exact timeout halt message format", () => {
      expect(step15.body).toMatch(/CI checks timed out after \{N\} minutes/);
      expect(step15.body).toMatch(/Checks still pending:\s*\{list\}/);
      expect(step15.body).toMatch(/Resume with \/gaia-resume/);
    });

    it("Step 15 preserves story status as in-progress on timeout", () => {
      expect(step15.body).toMatch(/in-progress/);
    });
  });

  describe("AC5: All passed — success summary and advance to Step 16", () => {
    it("Step 15 describes success summary on all-passed", () => {
      expect(step15.body).toMatch(/success summary/i);
    });

    it("Step 15 advances to Step 16 on success", () => {
      expect(step15.body).toMatch(/Step\s*16/i);
    });
  });

  describe("AC6: Failure halt with check name, log excerpt, URL — MPC-26", () => {
    it("Step 15 includes the exact failure halt message format", () => {
      expect(step15.body).toMatch(/CI check \{name\} failed/);
      expect(step15.body).toMatch(/Fix the issue, push again/);
      expect(step15.body).toMatch(/resume with \/gaia-resume/i);
    });

    it("Step 15 extracts CI run URL and log excerpt on failure", () => {
      expect(step15.body).toMatch(/CI run URL|run URL/i);
      expect(step15.body).toMatch(/log excerpt|failure log/i);
    });
  });

  describe("AC7: Empty/absent ci_checks auto-pass", () => {
    it("Step 15 handles empty/absent ci_checks with the 'No CI checks configured' message", () => {
      expect(step15.body).toMatch(/No CI checks configured/);
      expect(step15.body).toMatch(/proceeding to merge/i);
    });
  });

  describe("AC8: Backward compatibility — promotion chain absent (NFR-045)", () => {
    it("Step 15 is skipped when ci_cd.promotion_chain is absent", () => {
      expect(step15.body).toMatch(/promotion.chain guard|promotion_chain.*absent|chain.*absent/i);
    });

    it("Step 15 references NFR-045 or backward compatibility", () => {
      expect(step15.body).toMatch(/NFR-045|backward.compat/i);
    });
  });

  describe("Resilience — transient error handling and monotonic clock", () => {
    it("Step 15 describes transient network error handling (log and retry)", () => {
      expect(step15.body).toMatch(/transient|retry|network error/i);
    });

    it("Step 15 uses a monotonic clock for elapsed time", () => {
      expect(step15.body).toMatch(/monotonic/i);
    });
  });

  describe("Threat T26 — no merge without passing CI", () => {
    it("Step 15 references threat T26 or its mitigation intent", () => {
      expect(step15.body).toMatch(/T26|merge without passing CI|threat/i);
    });
  });
});
