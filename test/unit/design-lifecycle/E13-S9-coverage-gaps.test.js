/**
 * E13-S9: Design Review & Iteration Loop — Coverage Gap Tests
 *
 * Additional tests added by /gaia-test-automate to fill coverage gaps
 * identified during the Test Automation review.
 *
 * Covers: edge cases not in the primary ATDD test file.
 */

import { describe, it, expect } from "vitest";

import {
  parseDesignFrontmatter,
  transitionDesignState,
  recordStakeholderApproval,
  incrementIterationCount,
} from "../../../src/design-lifecycle/design-state.js";

import {
  computeTokenDiff,
  applyTokenDelta,
  formatChangelogEntry,
} from "../../../src/design-lifecycle/delta-sync.js";

// ── parseDesignFrontmatter edge cases ────────────────────────────────────────

describe("E13-S9 coverage: parseDesignFrontmatter edge cases", () => {
  it("should return null state when content has no frontmatter delimiters", () => {
    const content = "# UX Design\n\nNo frontmatter here.";
    const result = parseDesignFrontmatter(content);

    expect(result.design_state).toBeNull();
    expect(result.design_stakeholders).toEqual([]);
    expect(result.design_iteration_count).toBe(0);
  });

  it("should handle frontmatter with no design fields at all", () => {
    const content = "---\ntemplate: ux-design\n---\n# UX Design\n";
    const result = parseDesignFrontmatter(content);

    expect(result.design_state).toBeNull();
    expect(result.design_iteration_count).toBe(0);
  });
});

// ── transitionDesignState edge cases ────────────────────────────────────────

describe("E13-S9 coverage: transitionDesignState edge cases", () => {
  it("should throw when newState is not a valid design state", () => {
    const content =
      "---\ndesign_state: draft\ndesign_stakeholders: []\ndesign_iteration_count: 0\n---\n";

    expect(() => transitionDesignState(content, "invalid-state")).toThrow("Invalid design state");
  });

  it("should insert design_state field when it does not exist in frontmatter", () => {
    const content = "---\ntemplate: ux-design\n---\n# UX Design\n";
    const updated = transitionDesignState(content, "draft", { initial: true });

    expect(updated).toContain("design_state: draft");
  });
});

// ── recordStakeholderApproval edge cases ────────────────────────────────────

describe("E13-S9 coverage: recordStakeholderApproval edge cases", () => {
  it("should throw when stakeholder ID does not exist", () => {
    const content = `---
design_state: review
design_stakeholders:
  - id: derek
    name: "Derek (PM)"
    role_tag: "design"
    approved: false
    approved_at: null
design_iteration_count: 0
---
`;
    expect(() => recordStakeholderApproval(content, "unknown-id", "2026-04-07T00:00:00Z")).toThrow(
      "Stakeholder not found: unknown-id"
    );
  });
});

// ── incrementIterationCount edge cases ──────────────────────────────────────

describe("E13-S9 coverage: incrementIterationCount edge cases", () => {
  it("should insert design_iteration_count field when absent from frontmatter", () => {
    const content = "---\ndesign_state: draft\ndesign_stakeholders: []\n---\n# UX Design\n";
    const result = incrementIterationCount(content);

    expect(result.count).toBe(1);
    expect(result.content).toContain("design_iteration_count: 1");
  });
});

// ── computeTokenDiff edge cases ─────────────────────────────────────────────

describe("E13-S9 coverage: computeTokenDiff edge cases", () => {
  it("should handle both inputs being empty objects", () => {
    const diff = computeTokenDiff({}, {});

    expect(Object.keys(diff.added)).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(Object.keys(diff.modified)).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
  });
});

// ── applyTokenDelta edge cases ──────────────────────────────────────────────

describe("E13-S9 coverage: applyTokenDelta edge cases", () => {
  it("should return identical object when delta is empty (no-op)", () => {
    const tokens = {
      "color.primary": { $value: "#3B82F6", $type: "color" },
    };
    const result = applyTokenDelta(tokens, { added: {}, removed: [], modified: {} });

    expect(result).toEqual(tokens);
    expect(result["color.primary"].$value).toBe("#3B82F6");
  });
});

// ── formatChangelogEntry edge cases ─────────────────────────────────────────

describe("E13-S9 coverage: formatChangelogEntry with all change types", () => {
  it("should include all three change types in a single entry", () => {
    const delta = {
      added: { "color.new": { $value: "#FFCC00", $type: "color" } },
      removed: ["spacing.deprecated"],
      modified: { "color.primary": { $value: "#2563EB", $type: "color" } },
    };
    const meta = { timestamp: "2026-04-07T12:00:00Z", source: "Figma (file: xyz, page: Design)" };

    const entry = formatChangelogEntry(delta, meta);

    expect(entry).toContain("added");
    expect(entry).toContain("removed");
    expect(entry).toContain("modified");
    expect(entry).toContain("color.new");
    expect(entry).toContain("spacing.deprecated");
    expect(entry).toContain("color.primary");
  });
});
