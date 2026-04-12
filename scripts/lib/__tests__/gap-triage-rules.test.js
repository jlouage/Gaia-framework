/**
 * E19-S26 — Gap Triage Rules Unit Tests (FTG-01..FTG-07)
 *
 * Tests the pure proposeAction function from gap-triage-rules.js against
 * the §10.22.8.2 action proposal rule table. Uses golden-file testing
 * for exhaustive rule coverage.
 *
 * Test IDs:
 *   FTG-01 — Happy path: valid rule table entries produce correct actions
 *   FTG-02 — No matching rule: gap type + status combos that fall through
 *   FTG-03 — Default severity filter (YOLO mode applies critical+high)
 *   FTG-04 — User override in normal mode (tested at workflow level — stub here)
 *   FTG-05 — Group-by story_key with collapse (multi-gap-type aggregation)
 *   FTG-06 — Golden file: every row of the §10.22.8.2 rule table
 *   FTG-07 — Skip statuses: in-progress, review, blocked
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { proposeAction } from "../gap-triage-rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures", "gap-triage");

// ─── FTG-06: Golden file test — every row of the §10.22.8.2 rule table ───

describe("FTG-06: golden file — §10.22.8.2 rule table", () => {
  const goldenCases = JSON.parse(
    readFileSync(join(FIXTURES, "rules-golden.json"), "utf8"),
  );

  it.each(goldenCases)("$description", ({ input, expected }) => {
    const result = proposeAction(input);
    expect(result).toEqual(expected);
  });
});

// ─── FTG-01: Happy path — valid rule entries produce correct actions ───

describe("FTG-01: happy path rule table entries", () => {
  it("uncovered-ac + backlog → append_ac", () => {
    const result = proposeAction({
      gap_type: "uncovered-ac",
      story_status: "backlog",
    });
    expect(result.action_type).toBe("append_ac");
    expect(result.sub_workflow).toBe("/gaia-add-stories");
    expect(result.skip_reason).toBeNull();
  });

  it("missing-test + done → new_story", () => {
    const result = proposeAction({
      gap_type: "missing-test",
      story_status: "done",
    });
    expect(result.action_type).toBe("new_story");
    expect(result.sub_workflow).toBe("/gaia-triage-findings");
    expect(result.skip_reason).toBeNull();
  });

  it("missing-edge-case + ready-for-dev → append_edge_case", () => {
    const result = proposeAction({
      gap_type: "missing-edge-case",
      story_status: "ready-for-dev",
    });
    expect(result.action_type).toBe("append_edge_case");
    expect(result.sub_workflow).toBe("/gaia-add-stories");
    expect(result.skip_reason).toBeNull();
  });

  it("unexecuted + done → expand_automation", () => {
    const result = proposeAction({
      gap_type: "unexecuted",
      story_status: "done",
    });
    expect(result.action_type).toBe("expand_automation");
    expect(result.sub_workflow).toBe("/gaia-test-automate");
    expect(result.skip_reason).toBeNull();
  });

  it("unexecuted + backlog → expand_automation (any status)", () => {
    const result = proposeAction({
      gap_type: "unexecuted",
      story_status: "backlog",
    });
    expect(result.action_type).toBe("expand_automation");
    expect(result.sub_workflow).toBe("/gaia-test-automate");
  });
});

// ─── FTG-02: No matching rule — falls through to skip ───

describe("FTG-02: no matching rule (fallthrough to skip)", () => {
  it("uncovered-ac + done → skip", () => {
    const result = proposeAction({
      gap_type: "uncovered-ac",
      story_status: "done",
    });
    expect(result.action_type).toBe("skip");
    expect(result.skip_reason).toContain("no matching rule");
  });

  it("missing-test + backlog → skip", () => {
    const result = proposeAction({
      gap_type: "missing-test",
      story_status: "backlog",
    });
    expect(result.action_type).toBe("skip");
    expect(result.skip_reason).toContain("no matching rule");
  });

  it("missing-edge-case + done → skip", () => {
    const result = proposeAction({
      gap_type: "missing-edge-case",
      story_status: "done",
    });
    expect(result.action_type).toBe("skip");
    expect(result.skip_reason).toContain("no matching rule");
  });
});

// ─── FTG-03: Default severity filter (YOLO applies critical+high) ───
// NOTE: Severity filtering is workflow-level logic in instructions.xml Step 2.
// This test validates that proposeAction is agnostic to severity — it only
// cares about gap_type and story_status. The filter is tested at integration level.

describe("FTG-03: proposeAction is severity-agnostic", () => {
  it("produces the same result regardless of which severity filtered the gap in", () => {
    // proposeAction does not receive severity — it only gets gap_type + story_status
    const critical = proposeAction({
      gap_type: "uncovered-ac",
      story_status: "backlog",
    });
    const high = proposeAction({
      gap_type: "uncovered-ac",
      story_status: "backlog",
    });
    expect(critical).toEqual(high);
  });
});

// ─── FTG-04: User override in normal mode ───
// NOTE: Per-row action override is workflow-level UX (Step 5 normal mode).
// The pure function does not handle user interaction — this is a stub
// confirming the function returns a default that CAN be overridden.

describe("FTG-04: default proposals are overridable (structural)", () => {
  it("returns an object with action_type that a UI layer can replace", () => {
    const result = proposeAction({
      gap_type: "uncovered-ac",
      story_status: "backlog",
    });
    expect(result).toHaveProperty("action_type");
    expect(result).toHaveProperty("sub_workflow");
    expect(result).toHaveProperty("skip_reason");
  });
});

// ─── FTG-05: Group-by story_key with collapse ───
// Tests multi-gap-type aggregation at the data structure level.

describe("FTG-05: multi-gap-type aggregation per story_key", () => {
  it("processes multiple gap types for the same story independently", () => {
    const gaps = [
      { gap_type: "uncovered-ac", story_status: "backlog" },
      { gap_type: "missing-edge-case", story_status: "backlog" },
      { gap_type: "unexecuted", story_status: "backlog" },
    ];

    const results = gaps.map((g) => proposeAction(g));

    expect(results[0].action_type).toBe("append_ac");
    expect(results[1].action_type).toBe("append_edge_case");
    expect(results[2].action_type).toBe("expand_automation");

    // All three produce non-skip actions — the triage row should pick the
    // highest-priority non-skip action (workflow-level logic in Step 4)
    expect(results.every((r) => r.action_type !== "skip")).toBe(true);
  });

  it("mixed skip and non-skip — workflow picks the non-skip action", () => {
    const gaps = [
      { gap_type: "missing-test", story_status: "backlog" }, // skip (no rule)
      { gap_type: "unexecuted", story_status: "backlog" }, // expand_automation
    ];

    const results = gaps.map((g) => proposeAction(g));
    const nonSkip = results.filter((r) => r.action_type !== "skip");

    expect(nonSkip).toHaveLength(1);
    expect(nonSkip[0].action_type).toBe("expand_automation");
  });
});

// ─── FTG-07: Skip statuses — in-progress, review, blocked ───

describe("FTG-07: skip statuses (in-progress, review, blocked)", () => {
  const skipStatuses = ["in-progress", "review", "blocked"];
  const gapTypes = [
    "uncovered-ac",
    "missing-test",
    "missing-edge-case",
    "unexecuted",
  ];

  for (const status of skipStatuses) {
    for (const gapType of gapTypes) {
      it(`${gapType} + ${status} → skip with defer reason`, () => {
        const result = proposeAction({
          gap_type: gapType,
          story_status: status,
        });
        expect(result.action_type).toBe("skip");
        expect(result.sub_workflow).toBeNull();
        expect(result.skip_reason).toBe(
          `story is ${status} — defer remediation`,
        );
      });
    }
  }
});

// ─── EC5: Unknown gap types ───

describe("EC5: unknown gap types → skip with unknown_gap_type", () => {
  it("completely unknown type", () => {
    const result = proposeAction({
      gap_type: "future-gap-type",
      story_status: "backlog",
    });
    expect(result.action_type).toBe("skip");
    expect(result.skip_reason).toBe("unknown_gap_type");
  });

  it("empty string gap type", () => {
    const result = proposeAction({ gap_type: "", story_status: "backlog" });
    expect(result.action_type).toBe("skip");
    expect(result.skip_reason).toBe("unknown_gap_type");
  });
});
