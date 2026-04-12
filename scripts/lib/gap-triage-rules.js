/**
 * Gap Triage Rules — E19-S26 (ADR-039 §10.22.8.2)
 *
 * Single source of truth for the action proposal rule table used by
 * /gaia-fill-test-gaps Step 4. This is a pure function with no I/O,
 * no side effects, and no framework dependencies — designed for
 * golden-file testing independent of workflow orchestration.
 *
 * Rule table (§10.22.8.2):
 *   uncovered-ac     + backlog/ready-for-dev   → append_ac          via /gaia-add-stories
 *   missing-test     + done                    → new_story          via /gaia-triage-findings
 *   missing-edge-case + backlog/ready-for-dev  → append_edge_case   via /gaia-add-stories
 *   unexecuted       + any status              → expand_automation  via /gaia-test-automate
 *   any gap          + in-progress/review/blocked → skip (defer)
 *   unknown gap_type                           → skip (unknown)
 *
 * @param {{ gap_type: string, story_status: string }} input
 * @returns {{ action_type: string, sub_workflow: string|null, skip_reason: string|null }}
 */

/** Statuses where remediation is deferred — story is actively being worked. */
const SKIP_STATUSES = new Set(["in-progress", "review", "blocked"]);

/** Statuses eligible for AC/edge-case appending. */
const APPENDABLE_STATUSES = new Set(["backlog", "ready-for-dev"]);

/**
 * Propose a remediation action for a single gap based on its type and the
 * referenced story's current status.
 *
 * @param {{ gap_type: string, story_status: string }} input
 * @returns {{ action_type: string, sub_workflow: string|null, skip_reason: string|null }}
 */
export function proposeAction({ gap_type, story_status }) {
  // Guard: skip statuses always defer, regardless of gap type
  if (SKIP_STATUSES.has(story_status)) {
    return {
      action_type: "skip",
      sub_workflow: null,
      skip_reason: `story is ${story_status} — defer remediation`,
    };
  }

  switch (gap_type) {
    case "uncovered-ac":
      if (APPENDABLE_STATUSES.has(story_status)) {
        return {
          action_type: "append_ac",
          sub_workflow: "/gaia-add-stories",
          skip_reason: null,
        };
      }
      // For other statuses (e.g., done, validating), no rule matches — skip
      return {
        action_type: "skip",
        sub_workflow: null,
        skip_reason: `uncovered-ac on ${story_status} story — no matching rule`,
      };

    case "missing-test":
      if (story_status === "done") {
        return {
          action_type: "new_story",
          sub_workflow: "/gaia-triage-findings",
          skip_reason: null,
        };
      }
      // missing-test on non-done, non-skip statuses — no rule matches
      return {
        action_type: "skip",
        sub_workflow: null,
        skip_reason: `missing-test on ${story_status} story — no matching rule`,
      };

    case "missing-edge-case":
      if (APPENDABLE_STATUSES.has(story_status)) {
        return {
          action_type: "append_edge_case",
          sub_workflow: "/gaia-add-stories",
          skip_reason: null,
        };
      }
      return {
        action_type: "skip",
        sub_workflow: null,
        skip_reason: `missing-edge-case on ${story_status} story — no matching rule`,
      };

    case "unexecuted":
      // unexecuted applies to any non-skip status
      return {
        action_type: "expand_automation",
        sub_workflow: "/gaia-test-automate",
        skip_reason: null,
      };

    default:
      // Unknown gap type (EC5)
      return {
        action_type: "skip",
        sub_workflow: null,
        skip_reason: "unknown_gap_type",
      };
  }
}
