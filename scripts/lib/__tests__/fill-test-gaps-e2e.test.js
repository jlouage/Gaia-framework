/**
 * E19-S27 — /gaia-fill-test-gaps end-to-end integration (FTG-08..FTG-13)
 *
 * These tests exercise the full Step 5 + Step 6 flow in-memory by composing
 * the three lib modules the workflow engine calls:
 *
 *   - adr037-return-adapter.normalizeReturn
 *   - gap-remediation-report-writer.renderReport
 *   - prior-remediation-loader.loadPrior (for AC6 retry semantics)
 *
 * The workflow engine (instructions.xml) orchestrates these modules at
 * runtime; these tests simulate that orchestration deterministically with
 * mock sub-workflow returns.
 *
 * Test matrix (all 6 cases from Task 5.4):
 *   FTG-08 — happy path: all approved actions succeed
 *   FTG-09 — user rejects all triage actions (0 actions executed)
 *   FTG-10 — partial success + retry (AC7)
 *   FTG-11 — /gaia-test-automate invocation
 *   FTG-12 — error recovery: single failure does not halt
 *   FTG-13 — unparseable sub-workflow return
 */

import { describe, it, expect } from "vitest";
import { normalizeReturn } from "../adr037-return-adapter.js";
import { renderReport } from "../gap-remediation-report-writer.js";
import { loadPrior } from "../prior-remediation-loader.js";
import yaml from "js-yaml";

/**
 * Minimal orchestration harness that mirrors the Step 5 loop in
 * instructions.xml. Takes a triage table (possibly pruned by loadPrior) and a
 * stub sub-workflow dispatcher; returns the tracking map ready for Step 6.
 */
function runStep5(triage, dispatch) {
  const tracking = [];
  for (const row of triage) {
    if (!row.approved) continue;
    if (row.action_type === "skip") {
      tracking.push({ ...row, status: "skipped" });
      continue;
    }
    // AC2: runtime assertion — bundled-only.
    const ref = (row.sub_workflow || "").replace(/^\//, "").replace(/^gaia-/, "");
    if (!["add-stories", "triage-findings", "test-automate"].includes(ref)) {
      throw new Error(
        `workflow-author error: invoke-workflow ref="${row.sub_workflow}" not in allowed bundled set`,
      );
    }
    const raw = dispatch(ref, row);
    const normalized = normalizeReturn(raw, ref);
    const status =
      normalized.status === "ok"
        ? "succeeded"
        : normalized.status === "needs_user"
          ? "failed"
          : normalized.status === "halted"
            ? "failed"
            : "failed";
    tracking.push({
      story_key: row.story_key,
      action_type: row.action_type,
      sub_workflow: ref,
      status,
      artifacts: normalized.artifacts,
      error: status === "failed" ? normalized.summary : null,
    });
  }
  return tracking;
}

const SOURCE = "docs/test-artifacts/test-gap-analysis-2026-04-10.md";

const baseTriage = [
  {
    story_key: "E17-S3",
    action_type: "append_ac",
    sub_workflow: "/gaia-add-stories",
    approved: true,
  },
  {
    story_key: "E17-S4",
    action_type: "append_ac",
    sub_workflow: "/gaia-add-stories",
    approved: true,
  },
  {
    story_key: "E17-S5",
    action_type: "append_ac",
    sub_workflow: "/gaia-add-stories",
    approved: true,
  },
];

/* ─── FTG-08 — happy path ─────────────────────────────────────── */
describe("FTG-08: happy path — all approved actions succeed", () => {
  it("produces 3 succeeded, 0 failed, 0 skipped", () => {
    const tracking = runStep5(baseTriage, (ref, row) => ({
      story_key: row.story_key,
      appended_ac: "- [ ] AC9 — new",
      story_file: `docs/implementation-artifacts/${row.story_key}-foo.md`,
    }));

    expect(tracking.filter((r) => r.status === "succeeded")).toHaveLength(3);
    expect(tracking.filter((r) => r.status === "failed")).toHaveLength(0);

    const md = renderReport({
      trackingMap: tracking,
      sourceGapReport: SOURCE,
      sourceFeatureId: null,
      executionDate: "2026-04-12",
    });
    const fm = yaml.load(md.slice(4, md.indexOf("\n---\n", 3)));
    expect(fm.succeeded).toBe(3);
    expect(fm.total_actions).toBe(3);
  });
});

/* ─── FTG-09 — user rejects all ───────────────────────────────── */
describe("FTG-09: user rejects all triage actions", () => {
  it("produces 0 actions executed", () => {
    const triage = baseTriage.map((r) => ({ ...r, approved: false }));
    const tracking = runStep5(triage, () => {
      throw new Error("should not be dispatched");
    });
    expect(tracking).toHaveLength(0);

    const md = renderReport({
      trackingMap: tracking,
      sourceGapReport: SOURCE,
      sourceFeatureId: null,
      executionDate: "2026-04-12",
    });
    expect(md).toMatch(/\| — \| — \| — \| — \| — \| — \| — \|/);
  });
});

/* ─── FTG-10 — partial success + retry (AC7) ──────────────────── */
describe("FTG-10: partial success + retry (AC7)", () => {
  it("first run produces 4 succeeded + 1 failed; second run retries only the 1 failed", () => {
    const triage5 = [
      ...baseTriage,
      {
        story_key: "E17-S6",
        action_type: "append_ac",
        sub_workflow: "/gaia-add-stories",
        approved: true,
      },
      {
        story_key: "E17-BAD",
        action_type: "append_ac",
        sub_workflow: "/gaia-add-stories",
        approved: true,
      },
    ];

    // First run: E17-BAD returns error.
    const firstTracking = runStep5(triage5, (ref, row) => {
      if (row.story_key === "E17-BAD") return { error: "story not found" };
      return {
        appended_ac: "ac",
        story_file: `docs/implementation-artifacts/${row.story_key}-foo.md`,
      };
    });
    expect(firstTracking.filter((r) => r.status === "succeeded")).toHaveLength(4);
    expect(firstTracking.filter((r) => r.status === "failed")).toHaveLength(1);

    // Simulate Step 4 re-run: loadPrior skips succeeded rows.
    const now = new Date("2026-04-12T12:00:00Z");
    const priorMd = renderReport({
      trackingMap: firstTracking,
      sourceGapReport: SOURCE,
      sourceFeatureId: null,
      executionDate: "2026-04-12",
    });
    const fs = {
      readdirSync: () => ["gap-remediation-report-2026-04-12.md"],
      readFileSync: () => priorMd,
      statSync: () => ({ mtimeMs: now.getTime() - 60 * 60 * 1000 }),
    };
    const prior = loadPrior(
      {
        sourceGapReportPath: SOURCE,
        testArtifactsDir: "/test-artifacts",
        now,
      },
      fs,
    );
    expect(Object.keys(prior.skipMap)).toHaveLength(4);

    // Prune triage by skipMap.
    const retried = triage5.filter((r) => !(r.story_key in prior.skipMap));
    expect(retried).toHaveLength(1);
    expect(retried[0].story_key).toBe("E17-BAD");

    // Second run: this time E17-BAD succeeds.
    const secondTracking = runStep5(retried, () => ({
      appended_ac: "ac",
      story_file: "docs/implementation-artifacts/E17-BAD-foo.md",
    }));
    expect(secondTracking).toHaveLength(1);
    expect(secondTracking[0].status).toBe("succeeded");
  });
});

/* ─── FTG-11 — /gaia-test-automate invocation ─────────────────── */
describe("FTG-11: /gaia-test-automate invocation", () => {
  it("maps the return via the adapter to ok/succeeded", () => {
    const triage = [
      {
        story_key: "E20-S1",
        action_type: "expand_automation",
        sub_workflow: "/gaia-test-automate",
        approved: true,
      },
    ];
    const tracking = runStep5(triage, () => ({
      generated_tests: 4,
      test_files: ["test/unit/e20-s1.test.js"],
    }));
    expect(tracking[0].status).toBe("succeeded");
    expect(tracking[0].artifacts).toContain("test/unit/e20-s1.test.js");
  });
});

/* ─── FTG-12 — error recovery: single failure ─────────────────── */
describe("FTG-12: error recovery — single failure does not halt", () => {
  it("continues to next action after error", () => {
    const tracking = runStep5(baseTriage, (ref, row) => {
      if (row.story_key === "E17-S4") return { error: "mid-run failure" };
      return {
        appended_ac: "ac",
        story_file: `docs/implementation-artifacts/${row.story_key}-foo.md`,
      };
    });
    expect(tracking).toHaveLength(3);
    expect(tracking.map((r) => r.status)).toEqual([
      "succeeded",
      "failed",
      "succeeded",
    ]);
    expect(tracking[1].error).toMatch(/mid-run failure/);
  });
});

/* ─── FTG-13 — unparseable sub-workflow return ────────────────── */
describe("FTG-13: unparseable sub-workflow return", () => {
  it("marks the action failed with a diagnostic summary", () => {
    const triage = [
      {
        story_key: "E1-S1",
        action_type: "append_ac",
        sub_workflow: "/gaia-add-stories",
        approved: true,
      },
    ];
    const tracking = runStep5(triage, () => "garbage string");
    expect(tracking[0].status).toBe("failed");
    expect(tracking[0].error).toMatch(/non-object/);
  });

  it("rejects a disallowed ref with a runtime author error (AC2)", () => {
    const triage = [
      {
        story_key: "E1-S1",
        action_type: "append_ac",
        sub_workflow: "/gaia-random-workflow",
        approved: true,
      },
    ];
    expect(() => runStep5(triage, () => ({}))).toThrow(
      /workflow-author error/,
    );
  });
});
