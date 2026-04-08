/**
 * E13-S9: Design Review & Iteration Loop — Acceptance Tests (ATDD)
 *
 * RED PHASE — These tests are intentionally failing.
 * Tests define expected behavior for the design lifecycle state machine,
 * delta sync, stakeholder convergence, and design gate.
 *
 * Story: As a design stakeholder, I want a structured review and iteration
 * loop after Figma frames are generated so that I can review, request changes,
 * and approve designs before dev agents consume them.
 *
 * Risk: HIGH | Epic: E13 — Figma MCP Integration
 */

import { describe, it, expect } from "vitest";

import {
  DESIGN_STATES,
  VALID_TRANSITIONS,
  parseDesignFrontmatter,
  isValidTransition,
  transitionDesignState,
  recordStakeholderApproval,
  checkStakeholderConvergence,
  incrementIterationCount,
  checkIterationWarning,
  checkDesignGate,
  detectStaleDesign,
} from "../../../src/design-lifecycle/design-state.js";

import {
  computeTokenDiff,
  applyTokenDelta,
  formatChangelogEntry,
  appendChangelog,
} from "../../../src/design-lifecycle/delta-sync.js";

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeUxDesignContent({ state = "draft", stakeholders = [], iterationCount = 0 } = {}) {
  const stakeholderYaml =
    stakeholders.length > 0
      ? `design_stakeholders:\n${stakeholders
          .map(
            (s) =>
              `  - id: ${s.id}\n    name: "${s.name}"\n    role_tag: "${s.role_tag || "design"}"\n    approved: ${s.approved || false}\n    approved_at: ${s.approved_at || "null"}`
          )
          .join("\n")}`
      : "design_stakeholders: []";

  return `---
design_state: ${state}
${stakeholderYaml}
design_iteration_count: ${iterationCount}
---

# UX Design

Content here.
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1: Design artifacts track state via ux-design.md YAML frontmatter
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC1: Design state tracking via frontmatter", () => {
  it("should define all 5 valid design states", () => {
    expect(DESIGN_STATES).toEqual(["draft", "review", "approved", "in-dev", "stale"]);
  });

  it("should parse design_state from ux-design.md frontmatter", () => {
    const content = makeUxDesignContent({ state: "review" });
    const parsed = parseDesignFrontmatter(content);

    expect(parsed.design_state).toBe("review");
  });

  it("should parse design_stakeholders array from frontmatter", () => {
    const content = makeUxDesignContent({
      state: "review",
      stakeholders: [
        { id: "derek", name: "Derek (PM)", role_tag: "design" },
        { id: "christy", name: "Christy (UX)", role_tag: "ux" },
      ],
    });
    const parsed = parseDesignFrontmatter(content);

    expect(parsed.design_stakeholders).toHaveLength(2);
    expect(parsed.design_stakeholders[0].id).toBe("derek");
    expect(parsed.design_stakeholders[1].id).toBe("christy");
  });

  it("should parse design_iteration_count from frontmatter", () => {
    const content = makeUxDesignContent({ iterationCount: 3 });
    const parsed = parseDesignFrontmatter(content);

    expect(parsed.design_iteration_count).toBe(3);
  });

  it("should default design_iteration_count to 0 when missing", () => {
    const content = `---
design_state: draft
design_stakeholders: []
---
# UX Design
`;
    const parsed = parseDesignFrontmatter(content);

    expect(parsed.design_iteration_count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Generate Mode sets design_state to draft
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC2: Generate Mode sets draft state", () => {
  it("should set design_state to draft on new ux-design.md creation", () => {
    const content = makeUxDesignContent({ state: "draft" });
    const parsed = parseDesignFrontmatter(content);

    expect(parsed.design_state).toBe("draft");
  });

  it("should transition to draft state when content is written", () => {
    // Simulate a file that has no design_state yet, then receives draft
    const content = `---
template: ux-design
---
# UX Design
`;
    // transitionDesignState should set initial state
    const updated = transitionDesignState(content, "draft", { initial: true });
    const parsed = parseDesignFrontmatter(updated);

    expect(parsed.design_state).toBe("draft");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: draft <-> review transitions
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC3: Draft/review state transitions", () => {
  it("should allow draft -> review transition", () => {
    expect(isValidTransition("draft", "review")).toBe(true);
  });

  it("should allow review -> draft transition (changes requested)", () => {
    expect(isValidTransition("review", "draft")).toBe(true);
  });

  it("should reject invalid transitions (draft -> approved)", () => {
    expect(isValidTransition("draft", "approved")).toBe(false);
  });

  it("should reject invalid transitions (draft -> in-dev)", () => {
    expect(isValidTransition("draft", "in-dev")).toBe(false);
  });

  it("should reject invalid transitions (approved -> draft)", () => {
    expect(isValidTransition("approved", "draft")).toBe(false);
  });

  it("should transition design_state in file content from draft to review", () => {
    const content = makeUxDesignContent({ state: "draft" });
    const updated = transitionDesignState(content, "review");
    const parsed = parseDesignFrontmatter(updated);

    expect(parsed.design_state).toBe("review");
  });

  it("should transition design_state from review back to draft", () => {
    const content = makeUxDesignContent({ state: "review" });
    const updated = transitionDesignState(content, "draft");
    const parsed = parseDesignFrontmatter(updated);

    expect(parsed.design_state).toBe("draft");
  });

  it("should throw on invalid transition attempt", () => {
    const content = makeUxDesignContent({ state: "draft" });

    expect(() => transitionDesignState(content, "approved")).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4: Delta sync for design changes (incremental, not full regeneration)
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC4: Delta sync for design changes", () => {
  const currentTokens = {
    "color.primary.500": { $value: "#3B82F6", $type: "color" },
    "color.surface.bg": { $value: "#FFFFFF", $type: "color" },
    "spacing.xs": { $value: "4px", $type: "dimension" },
  };

  it("should detect added tokens", () => {
    const newTokens = {
      ...currentTokens,
      "color.surface.overlay": { $value: "rgba(0,0,0,0.4)", $type: "color" },
    };
    const diff = computeTokenDiff(currentTokens, newTokens);

    expect(Object.keys(diff.added)).toContain("color.surface.overlay");
    expect(diff.removed).toHaveLength(0);
  });

  it("should detect removed tokens", () => {
    const { "spacing.xs": _removed, ...newTokens } = currentTokens;
    const diff = computeTokenDiff(currentTokens, newTokens);

    expect(diff.removed).toContain("spacing.xs");
    expect(Object.keys(diff.added)).toHaveLength(0);
  });

  it("should detect modified tokens", () => {
    const newTokens = {
      ...currentTokens,
      "color.primary.500": { $value: "#2563EB", $type: "color" },
    };
    const diff = computeTokenDiff(currentTokens, newTokens);

    expect(Object.keys(diff.modified)).toContain("color.primary.500");
    expect(diff.modified["color.primary.500"].$value).toBe("#2563EB");
  });

  it("should preserve unchanged tokens", () => {
    const newTokens = {
      ...currentTokens,
      "color.primary.500": { $value: "#2563EB", $type: "color" },
    };
    const diff = computeTokenDiff(currentTokens, newTokens);

    expect(diff.unchanged).toContain("color.surface.bg");
  });

  it("should apply delta incrementally without overwriting unchanged tokens", () => {
    const delta = {
      added: { "color.accent": { $value: "#F59E0B", $type: "color" } },
      removed: ["spacing.xs"],
      modified: { "color.primary.500": { $value: "#2563EB", $type: "color" } },
    };
    const updated = applyTokenDelta(currentTokens, delta);

    // Added
    expect(updated["color.accent"]).toBeDefined();
    expect(updated["color.accent"].$value).toBe("#F59E0B");
    // Removed
    expect(updated["spacing.xs"]).toBeUndefined();
    // Modified
    expect(updated["color.primary.500"].$value).toBe("#2563EB");
    // Unchanged preserved
    expect(updated["color.surface.bg"].$value).toBe("#FFFFFF");
  });

  it("should handle empty diff (no changes)", () => {
    const diff = computeTokenDiff(currentTokens, currentTokens);

    expect(Object.keys(diff.added)).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(Object.keys(diff.modified)).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: Token changelog appended on each delta sync
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC5: Token changelog", () => {
  it("should format a changelog entry with token path, change, old/new values", () => {
    const delta = {
      added: { "color.surface.overlay": { $value: "rgba(0,0,0,0.4)", $type: "color" } },
      removed: ["spacing.xs"],
      modified: { "color.primary.500": { $value: "#2563EB", $type: "color" } },
    };
    const metadata = {
      timestamp: "2026-04-07T14:22:00Z",
      source: "Figma (file: abc123, page: Main)",
    };

    const entry = formatChangelogEntry(delta, metadata);

    expect(entry).toContain("2026-04-07T14:22:00Z");
    expect(entry).toContain("color.primary.500");
    expect(entry).toContain("modified");
    expect(entry).toContain("color.surface.overlay");
    expect(entry).toContain("added");
    expect(entry).toContain("spacing.xs");
    expect(entry).toContain("removed");
  });

  it("should include table headers: Token Path, Change, Old Value, New Value", () => {
    const delta = {
      added: {},
      removed: [],
      modified: { "color.primary.500": { $value: "#2563EB", $type: "color" } },
    };
    const metadata = { timestamp: "2026-04-07T14:22:00Z", source: "Test" };

    const entry = formatChangelogEntry(delta, metadata);

    expect(entry).toContain("Token Path");
    expect(entry).toContain("Change");
    expect(entry).toContain("Old Value");
    expect(entry).toContain("New Value");
  });

  it("should append to existing changelog content", () => {
    const existing = "# Token Changelog\n\nPrevious entries here.\n";
    const newEntry = "## 2026-04-07 — Delta sync\n\n| Token Path | Change |\n";

    const result = appendChangelog(existing, newEntry);

    expect(result).toContain("Previous entries here.");
    expect(result).toContain("2026-04-07 — Delta sync");
  });

  it("should create changelog from empty string", () => {
    const result = appendChangelog("", "## 2026-04-07 — First sync\n");

    expect(result).toContain("# Token Changelog");
    expect(result).toContain("2026-04-07 — First sync");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6: Stakeholder convergence and approval
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC6: Stakeholder convergence and approval", () => {
  it("should record per-stakeholder approval with timestamp", () => {
    const content = makeUxDesignContent({
      state: "review",
      stakeholders: [
        { id: "derek", name: "Derek (PM)", role_tag: "design", approved: false },
        { id: "christy", name: "Christy (UX)", role_tag: "ux", approved: false },
      ],
    });

    const updated = recordStakeholderApproval(content, "derek", "2026-04-07T10:30:00Z");
    const parsed = parseDesignFrontmatter(updated);

    const derek = parsed.design_stakeholders.find((s) => s.id === "derek");
    expect(derek.approved).toBe(true);
    expect(derek.approved_at).toBe("2026-04-07T10:30:00Z");
  });

  it("should not affect other stakeholders when one approves", () => {
    const content = makeUxDesignContent({
      state: "review",
      stakeholders: [
        { id: "derek", name: "Derek (PM)", role_tag: "design", approved: false },
        { id: "christy", name: "Christy (UX)", role_tag: "ux", approved: false },
      ],
    });

    const updated = recordStakeholderApproval(content, "derek", "2026-04-07T10:30:00Z");
    const parsed = parseDesignFrontmatter(updated);

    const christy = parsed.design_stakeholders.find((s) => s.id === "christy");
    expect(christy.approved).toBe(false);
    expect(christy.approved_at).toBeNull();
  });

  it("should detect convergence when all tagged stakeholders approved", () => {
    const stakeholders = [
      {
        id: "derek",
        name: "Derek",
        role_tag: "design",
        approved: true,
        approved_at: "2026-04-07T10:30:00Z",
      },
      {
        id: "christy",
        name: "Christy",
        role_tag: "ux",
        approved: true,
        approved_at: "2026-04-07T11:00:00Z",
      },
    ];
    const result = checkStakeholderConvergence(stakeholders);

    expect(result.converged).toBe(true);
    expect(result.approved).toBe(2);
    expect(result.total).toBe(2);
  });

  it("should not converge when some stakeholders have not approved", () => {
    const stakeholders = [
      {
        id: "derek",
        name: "Derek",
        role_tag: "design",
        approved: true,
        approved_at: "2026-04-07T10:30:00Z",
      },
      { id: "christy", name: "Christy", role_tag: "ux", approved: false, approved_at: null },
    ];
    const result = checkStakeholderConvergence(stakeholders);

    expect(result.converged).toBe(false);
    expect(result.approved).toBe(1);
    expect(result.total).toBe(2);
  });

  it("should handle zero stakeholders — converged is false", () => {
    const result = checkStakeholderConvergence([]);

    expect(result.converged).toBe(false);
    expect(result.total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC7: Design gate blocks dev-story when design not approved
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC7: Design gate for /gaia-dev-story", () => {
  it("should allow when design_state is approved", () => {
    const result = checkDesignGate("approved", true);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeNull();
  });

  it("should allow when design_state is in-dev", () => {
    const result = checkDesignGate("in-dev", true);
    expect(result.allowed).toBe(true);
  });

  it("should block when design_state is draft", () => {
    const result = checkDesignGate("draft", true);
    expect(result.allowed).toBe(false);
    expect(result.warning).toContain("draft");
  });

  it("should block when design_state is review", () => {
    const result = checkDesignGate("review", true);
    expect(result.allowed).toBe(false);
    expect(result.warning).toContain("review");
  });

  it("should block when design_state is stale", () => {
    const result = checkDesignGate("stale", true);
    expect(result.allowed).toBe(false);
    expect(result.warning).toContain("stale");
  });

  it("should silently allow when no ux-design.md exists (null state)", () => {
    const result = checkDesignGate(null, false);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeNull();
  });

  it("should silently allow when ux-design.md exists but no figma metadata", () => {
    const result = checkDesignGate("draft", false);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC8: Stale detection when design changes after dev starts
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC8: Stale detection and dev warning", () => {
  it("should detect stale when version hashes differ", () => {
    const result = detectStaleDesign("abc12345", "def67890");
    expect(result.stale).toBe(true);
  });

  it("should not flag stale when version hashes match", () => {
    const result = detectStaleDesign("abc12345", "abc12345");
    expect(result.stale).toBe(false);
  });

  it("should return changed token paths when stale detected", () => {
    // The function receives diff information to identify changed tokens
    const result = detectStaleDesign("abc12345", "def67890", {
      changedTokens: ["color.primary.500", "spacing.xs"],
    });
    expect(result.changedTokens).toContain("color.primary.500");
    expect(result.changedTokens).toContain("spacing.xs");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC9: Iteration cycle warning at 5+ cycles
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9 AC9: Iteration cycle warning", () => {
  it("should increment iteration count on review -> draft transition", () => {
    const content = makeUxDesignContent({ state: "review", iterationCount: 2 });
    const result = incrementIterationCount(content);

    expect(result.count).toBe(3);

    const parsed = parseDesignFrontmatter(result.content);
    expect(parsed.design_iteration_count).toBe(3);
  });

  it("should not warn when iteration count < 5", () => {
    const result = checkIterationWarning(4);
    expect(result.warning).toBe(false);
    expect(result.message).toBeNull();
  });

  it("should warn when iteration count = 5", () => {
    const result = checkIterationWarning(5);
    expect(result.warning).toBe(true);
    expect(result.message).toContain("5");
  });

  it("should warn when iteration count > 5", () => {
    const result = checkIterationWarning(8);
    expect(result.warning).toBe(true);
    expect(result.message).toContain("8");
  });

  it("should warn with NFR-030 reference", () => {
    const result = checkIterationWarning(5);
    expect(result.message).toMatch(/NFR-030/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional transition coverage
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S9: Full state transition matrix", () => {
  it("should allow review -> approved", () => {
    expect(isValidTransition("review", "approved")).toBe(true);
  });

  it("should allow approved -> in-dev", () => {
    expect(isValidTransition("approved", "in-dev")).toBe(true);
  });

  it("should allow in-dev -> stale", () => {
    expect(isValidTransition("in-dev", "stale")).toBe(true);
  });

  it("should allow stale -> review", () => {
    expect(isValidTransition("stale", "review")).toBe(true);
  });

  it("should reject stale -> draft (must go through review)", () => {
    expect(isValidTransition("stale", "draft")).toBe(false);
  });

  it("should reject in-dev -> draft", () => {
    expect(isValidTransition("in-dev", "draft")).toBe(false);
  });

  it("should reject approved -> review", () => {
    expect(isValidTransition("approved", "review")).toBe(false);
  });
});
