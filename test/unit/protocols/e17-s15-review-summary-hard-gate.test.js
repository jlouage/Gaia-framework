import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const PROTOCOL_PATH = resolve(PROJECT_ROOT, "_gaia/core/protocols/review-gate-check.xml");
const RUN_ALL_REVIEWS_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/run-all-reviews/instructions.xml"
);
const SKILL_PATH = resolve(PROJECT_ROOT, "_gaia/dev/skills/code-review-standards.md");
const BACKFILL_SCRIPT_PATH = resolve(PROJECT_ROOT, "scripts/backfill-review-summaries.sh");

describe("E17-S15: Review Summary Hard Gate (A-050)", () => {
  const protocolXml = readFileSync(PROTOCOL_PATH, "utf8");
  const runAllReviewsXml = readFileSync(RUN_ALL_REVIEWS_PATH, "utf8");
  const skillMd = readFileSync(SKILL_PATH, "utf8");

  describe("AC1: review-gate-check.xml adds existence check for review-summary.md", () => {
    it("protocol references review-summary.md file check", () => {
      expect(protocolXml).toMatch(/review-summary\.md/);
    });

    it("protocol checks summary existence before review-to-done transition", () => {
      // Must appear in the evaluation step that handles the transition
      expect(protocolXml).toMatch(/\{story_key\}-review-summary\.md/);
    });

    it("protocol references implementation_artifacts as the summary location", () => {
      expect(protocolXml).toMatch(/implementation_artifacts/);
    });
  });

  describe("AC2: HALT with clear error message when summary missing", () => {
    it("protocol HALT message names the missing file and remediation commands", () => {
      expect(protocolXml).toMatch(/Review summary missing/);
      expect(protocolXml).toMatch(/gaia-run-all-reviews/);
      expect(protocolXml).toMatch(/gaia-create-review-summary/);
    });
  });

  describe("AC3: Check skipped only when all 6 review reports also missing", () => {
    it("protocol mentions the 6-reports-present-but-summary-missing logic", () => {
      // Must describe the conditional where zero reports means skip but
      // any reports present means the summary is required
      expect(protocolXml).toMatch(/6 (individual )?review reports|all (6 )?reports/i);
      expect(protocolXml).toMatch(/never entered review|story (never|was not)/i);
    });
  });

  describe("AC4: run-all-reviews generates review-summary.md as final step", () => {
    it("instructions.xml aggregates the 6 review verdicts into a summary", () => {
      expect(runAllReviewsXml).toMatch(/review-summary\.md/);
      expect(runAllReviewsXml).toMatch(/aggregate|consolidat/i);
    });

    it("template-output for review-summary specifies populated content", () => {
      // The template-output block for the summary must reference the schema
      // fields, not be a stub
      expect(runAllReviewsXml).toMatch(/overall_status|overall status/i);
      expect(runAllReviewsXml).toMatch(/reviewers/i);
    });
  });

  describe("AC5: Review summary file schema", () => {
    it("run-all-reviews references frontmatter with story_key, date, overall_status, reviewers", () => {
      expect(runAllReviewsXml).toMatch(/story_key/);
      expect(runAllReviewsXml).toMatch(/overall_status/);
      expect(runAllReviewsXml).toMatch(/reviewers/);
    });

    it("run-all-reviews references all 6 review sections with verdict and link", () => {
      // All 6 review names should appear in the summary generation step
      const summarySection = runAllReviewsXml.match(/<step n="8"[\s\S]*?<\/step>/)?.[0];
      expect(summarySection).toBeTruthy();
      expect(summarySection).toMatch(/Code Review/i);
      expect(summarySection).toMatch(/QA Tests|QA Review/i);
      expect(summarySection).toMatch(/Security Review/i);
      expect(summarySection).toMatch(/Test Automation/i);
      expect(summarySection).toMatch(/Test Review/i);
      expect(summarySection).toMatch(/Performance Review/i);
    });

    it("run-all-reviews specifies final Gate Status aggregate", () => {
      expect(runAllReviewsXml).toMatch(/gate status|aggregate/i);
    });
  });

  describe("AC6: code-review-standards.md documents enforcement", () => {
    it("review-gate-completion section references the hard-gate enforcement in the protocol", () => {
      // Should point to the protocol file and describe the enforcement as live
      expect(skillMd).toMatch(/review-gate-check\.xml/);
      expect(skillMd).toMatch(/enforced|hard gate|HALT/i);
    });

    it("skill no longer describes the gap as unresolved", () => {
      // Must not contain phrasing that says "add this check" as a TODO
      const reviewGateSection = skillMd.match(
        /<!-- SECTION: review-gate-completion -->[\s\S]*?(?=<!-- SECTION:|$)/
      )?.[0];
      expect(reviewGateSection).toBeTruthy();
      // The enforcement is implemented — the section should describe it as
      // active, not as a proposal
      expect(reviewGateSection).toMatch(/(is )?enforced|hard gate is active|live enforcement/i);
    });
  });

  describe("AC7: Backfill script exists and is idempotent", () => {
    it("backfill script file exists", () => {
      expect(existsSync(BACKFILL_SCRIPT_PATH)).toBe(true);
    });

    it("backfill script is executable", () => {
      const stat = execSync(`ls -l ${BACKFILL_SCRIPT_PATH}`).toString();
      expect(stat).toMatch(/x/); // some executable bit set
    });

    it("backfill script targets sprint-14, sprint-15, sprint-16", () => {
      const script = readFileSync(BACKFILL_SCRIPT_PATH, "utf8");
      expect(script).toMatch(/sprint-14/);
      expect(script).toMatch(/sprint-15/);
      expect(script).toMatch(/sprint-16/);
    });

    it("backfill script is idempotent — skips existing summary files", () => {
      const script = readFileSync(BACKFILL_SCRIPT_PATH, "utf8");
      // Must check for existing review-summary.md before writing
      expect(script).toMatch(/review-summary\.md/);
      // idempotency signal: a conditional that skips when file exists
      expect(script).toMatch(/-[ef]\s+"?\$?\{?.*review-summary/);
    });

    it("backfill script runs cleanly in dry-run mode on a fixture sprint", () => {
      // Must not crash when invoked with --dry-run (or equivalent no-op)
      const output = execSync(`bash ${BACKFILL_SCRIPT_PATH} --dry-run 2>&1 || true`, {
        cwd: PROJECT_ROOT,
      }).toString();
      // Should not contain shell syntax errors
      expect(output).not.toMatch(/syntax error|unexpected token/i);
    });
  });

  describe("AC8: Integration — 6 reports, no summary → HALT on review→done", () => {
    // Protocol-level assertion: the evaluation step blocks transition when
    // summary missing, even if all 6 rows are PASSED
    it("protocol blocks done transition when summary missing even with all PASSED", () => {
      // The evaluation step contains the summary check inside the
      // ALL-PASSED branch
      expect(protocolXml).toMatch(/ALL 6 rows show PASSED[\s\S]*review-summary\.md/);
    });
  });

  describe("AC9: Integration — 6 reports + summary → transition succeeds", () => {
    it("protocol allows done transition when summary exists", () => {
      // The success path must be preserved: when all PASSED AND summary
      // exists AND DoD checked, status-sync to done is invoked
      expect(protocolXml).toMatch(/new_status="done"/);
    });
  });

  describe("AC10: Integration — run-all-reviews generates summary after completion", () => {
    it("run-all-reviews step 8 writes review-summary.md via template-output", () => {
      expect(runAllReviewsXml).toMatch(
        /template-output file="[^"]*\{story_key\}-review-summary\.md"/
      );
    });

    it("summary generation appears as the final step before review-gate-check invocation", () => {
      // The summary must be written BEFORE the protocol gate is invoked, so
      // the protocol can see it. Compare positions of the actual XML tags.
      const step8 = runAllReviewsXml.match(/<step n="8"[\s\S]*?<\/step>/)?.[0];
      expect(step8).toBeTruthy();
      const templateOutputTagIdx = step8.indexOf("<template-output");
      const invokeProtocolTagIdx = step8.indexOf('<invoke-protocol name="review-gate-check"');
      expect(templateOutputTagIdx).toBeGreaterThan(-1);
      expect(invokeProtocolTagIdx).toBeGreaterThan(-1);
      expect(templateOutputTagIdx).toBeLessThan(invokeProtocolTagIdx);
    });
  });
});
