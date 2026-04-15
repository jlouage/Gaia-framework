/**
 * E28-S33 — Sprint-plan dependency inversion lint unit tests
 *
 * Test IDs:
 *   SPDI-01 — Happy path: known-good sprint plan produces no warnings
 *   SPDI-02 — E28-S1 / E28-S4 historical regression fixture
 *   SPDI-03 — Resource only in Dev Notes (not AC) → no warning (AC-only scope)
 *   SPDI-04 — Producer before consumer → no warning (ordering respected)
 *   SPDI-05 — Same wave (equal order) forward-reference → warning
 *   SPDI-06 — Tokenizer extracts code-fenced, path, and kebab tokens
 *   SPDI-07 — formatWarnings output shape
 */

import { describe, it, expect } from "vitest";
import {
  lintSprintPlan,
  tokenizeResources,
  extractAcceptanceCriteria,
  extractTasks,
  findCreatedTokens,
  formatWarnings,
} from "../sprint-plan-dep-inversion-lint.js";

const storyA_good = `---
key: E1-S1
---
# Story: Login

## Acceptance Criteria

- [ ] AC1: User can log in with valid credentials.
- [ ] AC2: Invalid credentials show an error.

## Tasks / Subtasks

- [ ] Task 1: Add login form
`;

const storyB_good = `---
key: E1-S2
---
# Story: Password reset

## Acceptance Criteria

- [ ] AC1: User can request a password reset email.

## Tasks / Subtasks

- [ ] Task 1: Create reset endpoint
`;

// Historical regression — E28-S1 AC3 references "marketplace repo"
// which E28-S4 creates via gaia-public / gaia-enterprise scaffolding.
const storyE28S1 = `---
key: E28-S1
---
# Story: Plugin manifest schema

## Acceptance Criteria

- [ ] AC1: plugin.json schema defined.
- [ ] AC2: Validator accepts valid plugins.
- [ ] AC3: Example plugin published to \`gaia-public\` marketplace repo.

## Tasks / Subtasks

- [ ] Task 1: Draft schema
- [ ] Task 2: Wire validator
`;

const storyE28S4 = `---
key: E28-S4
---
# Story: Create gaia-public and gaia-enterprise repos

## Acceptance Criteria

- [ ] AC1: Two repos exist.

## Tasks / Subtasks

- [ ] Task 1: Create \`gaia-public\` repo on GitHub
- [ ] Task 2: Create \`gaia-enterprise\` repo on GitHub
- [ ] Task 3: Scaffold initial structure
`;

const storyDevNotesOnly = `---
key: E9-S9
---
# Story: Something

## Acceptance Criteria

- [ ] AC1: Generic requirement with no resource tokens.

## Tasks / Subtasks

- [ ] Task 1: Do the thing

## Dev Notes

- Depends on \`gaia-public\` being available. (Dev Notes only — not AC.)
`;

const storyCreatesPublic = `---
key: E9-S10
---
# Story: Repo creator

## Acceptance Criteria

- [ ] AC1: Repos exist.

## Tasks / Subtasks

- [ ] Task 1: Create \`gaia-public\` repo
`;

describe("SPDI-01: happy path — known-good plan", () => {
  it("produces no warnings when ACs do not forward-reference", () => {
    const warnings = lintSprintPlan([
      { key: "E1-S1", order: 1, markdown: storyA_good },
      { key: "E1-S2", order: 2, markdown: storyB_good },
    ]);
    expect(warnings).toEqual([]);
  });
});

describe("SPDI-02: E28-S1 / E28-S4 historical regression", () => {
  it("warns when E28-S1 AC references gaia-public but E28-S4 creates it later", () => {
    const warnings = lintSprintPlan([
      { key: "E28-S1", order: 1, markdown: storyE28S1 },
      { key: "E28-S4", order: 2, markdown: storyE28S4 },
    ]);
    expect(warnings.length).toBeGreaterThan(0);
    const w = warnings.find(
      (x) => x.consumer === "E28-S1" && x.producer === "E28-S4",
    );
    expect(w).toBeDefined();
    expect(w.token).toContain("gaia-public");
    expect(w.message).toMatch(/Dependency inversion/);
    expect(w.message).toMatch(/move E28-S4 before E28-S1/);
  });
});

describe("SPDI-03: AC-only scope (Dev Notes ignored)", () => {
  it("does not warn when a forward reference lives only in Dev Notes", () => {
    const warnings = lintSprintPlan([
      { key: "E9-S9", order: 1, markdown: storyDevNotesOnly },
      { key: "E9-S10", order: 2, markdown: storyCreatesPublic },
    ]);
    expect(warnings).toEqual([]);
  });
});

describe("SPDI-04: producer scheduled before consumer", () => {
  it("does not warn when producer runs first (ordering respected)", () => {
    const warnings = lintSprintPlan([
      { key: "E28-S4", order: 1, markdown: storyE28S4 },
      { key: "E28-S1", order: 2, markdown: storyE28S1 },
    ]);
    expect(warnings).toEqual([]);
  });
});

describe("SPDI-05: same-wave forward reference", () => {
  it("warns when two stories share the same order value", () => {
    const warnings = lintSprintPlan([
      { key: "E28-S1", order: 1, markdown: storyE28S1 },
      { key: "E28-S4", order: 1, markdown: storyE28S4 },
    ]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toMatch(/same wave/);
  });
});

describe("SPDI-06: tokenizer", () => {
  it("extracts code-fenced, path-like, and kebab tokens", () => {
    const tokens = tokenizeResources(
      "AC1: Example plugin published to `gaia-public` marketplace repo and foo/bar/baz.",
    );
    expect(tokens.has("gaia-public")).toBe(true);
    expect(tokens.has("foo/bar/baz")).toBe(true);
  });

  it("ignores short english words", () => {
    const tokens = tokenizeResources("AC1: User can log in.");
    // nothing identifier-like should be captured
    expect(tokens.size).toBe(0);
  });

  it("extractAcceptanceCriteria returns the AC block only", () => {
    const ac = extractAcceptanceCriteria(storyE28S1);
    expect(ac).toMatch(/AC3.*gaia-public/);
    expect(ac).not.toMatch(/Task 1/);
  });

  it("extractTasks returns the tasks block only", () => {
    const tasks = extractTasks(storyE28S4);
    expect(tasks).toMatch(/Create `gaia-public`/);
    expect(tasks).not.toMatch(/Two repos exist/);
  });

  it("findCreatedTokens matches create-verbs with tokens", () => {
    const acTokens = new Set(["gaia-public", "gaia-enterprise"]);
    const created = findCreatedTokens(
      extractTasks(storyE28S4).toLowerCase(),
      acTokens,
    );
    expect(created.has("gaia-public")).toBe(true);
    expect(created.has("gaia-enterprise")).toBe(true);
  });
});

describe("SPDI-07: formatWarnings", () => {
  it("reports no-issues cleanly", () => {
    expect(formatWarnings([])).toBe("Dependency inversion lint: no issues found.");
  });

  it("lists each warning message", () => {
    const out = formatWarnings([
      {
        consumer: "A",
        producer: "B",
        token: "x",
        message: "Dependency inversion: A references x, B creates it.",
      },
    ]);
    expect(out).toMatch(/1 warning/);
    expect(out).toMatch(/A references x/);
  });
});
