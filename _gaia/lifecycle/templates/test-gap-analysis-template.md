---
mode: coverage
date: "{date}"
project: "{project_name}"
story_count: 0
gap_count: 0
---

# Test Gap Analysis — {date}

> **Schema version:** 1.0.0
> **Traces to:** FR-223, ADR-030 §10.22
> **Story:** E19-S3
> **Template location:** `_gaia/lifecycle/templates/test-gap-analysis-template.md`
>
> Standardized output schema for the `/gaia-test-gap-analysis` workflow.
> This template scaffolds the `test-gap-analysis-{date}.md` artifact written by
> the workflow in both `coverage` and `verification` modes. Downstream tools and
> agents parse this file — keep the schema stable and bump the schema version on
> any breaking change.

## Schema Definition

The output file consists of five mandatory sections, in this order:

1. **YAML frontmatter** — five required fields (see below)
2. **Executive Summary** — high-level narrative and headline numbers
3. **Gap Table** — one row per gap, four columns
4. **Per-Story Detail** — one subsection per story with gaps
5. **Recommendations** — prioritized remediation actions

### YAML Frontmatter

Five required fields, parsed by `js-yaml` without error (AC4):

| Field | Type | Description |
|-------|------|-------------|
| `mode` | enum | `coverage` or `verification` — matches the workflow mode that produced the file |
| `date` | string | ISO-8601 date the gap analysis was run (e.g., `2026-04-09`) |
| `project` | string | Project name (from `global.yaml` `project_name`) |
| `story_count` | integer | Number of stories analyzed in this run |
| `gap_count` | integer | Total number of gaps detected across all stories |

All five fields are required. Missing any field MUST be flagged by Val as a
WARNING (AC6). The frontmatter block MUST be delimited by `---` lines at the
top of the file and MUST parse cleanly with any standards-compliant YAML
parser.

### Gap Type Enum (closed)

Gap types are drawn from a fixed, **closed** enum. No extension is permitted
without a schema version bump (AC2).

| Value | Description |
|-------|-------------|
| `missing-test` | An acceptance criterion or requirement has no associated test case in `test-plan.md` |
| `unexecuted` | A test case exists but was never run (no JUnit, LCOV, or E17 evidence) |
| `uncovered-ac` | An acceptance criterion on a story is not referenced by any test case ID |
| `missing-edge-case` | The test plan references the story but fails to cover a required edge case documented in story Test Scenarios or ATDD |

Any value outside this enum MUST be flagged by Val as CRITICAL.

### Severity Enum

Severity values are also fixed (AC3):

| Value | Description |
|-------|-------------|
| `critical` | Blocks release — high-risk story with no coverage |
| `high` | Significant coverage gap requiring prompt attention |
| `medium` | Moderate gap, should be addressed in the current sprint |
| `low` | Minor gap, can be deferred |

Any value outside this enum MUST be flagged by Val as CRITICAL.

## Executive Summary

{1-3 sentence narrative summarizing the run.}

- **Stories analyzed:** {story_count}
- **Gaps detected:** {gap_count}
- **Overall coverage rate:** {aggregate_coverage_pct}%
- **Generated vs Executed:** {total_executed}/{total_generated} ({aggregate_exec_ratio}%)
- **Mode:** {mode}

If `gap_count` is 0, state `No coverage gaps detected.` explicitly.

The **Generated vs Executed** row (E19-S7, FR-226) reports the aggregate
number of generated test cases vs. the number actually executed across all
stories. It is rendered as `{total_executed}/{total_generated} ({aggregate_exec_ratio}%)`.
When `total_generated` is 0, the row renders as `0/0 (0.0%)` — no
division-by-zero error. The aggregate is computed by summing per-story
`generated` and `executed` counts from the Per-Story Detail section.

The `Overall coverage rate` is the aggregate `(tested_acs / total_acs) * 100`
computed across all included epics by the Per-Module Coverage step (E19-S6,
FR-225). It replaces any prior per-story averaged figure and is rounded to one
decimal place.

## Per-Module Coverage

> **Traces to:** FR-225, ADR-030 §10.22
> **Story:** E19-S6
>
> Per-epic coverage percentage calculated as `(tested_acs / total_acs) * 100`,
> rounded to one decimal place. Rows sorted by `coverage_pct` ascending (lowest
> coverage first); ties broken by `module` key lexicographical ascending. Epics
> with zero story files are excluded from the table — a footnote reports how
> many were excluded when that count is non-zero.

| module | total_acs | tested_acs | coverage_pct | gap_count |
|--------|-----------|------------|--------------|-----------|
| E19 | 24 | 18 | 75.0% | 6 |
| E1  | 12 |  6 | 50.0% | 6 |

> _{N} epics with no story files were excluded._

When every included epic has zero ACs (the workflow finds story files but no
acceptance criteria items), render a single row reading
`| — | 0 | 0 | 0.0% | 0 |` and keep the aggregate `aggregate_coverage_pct`
at `0.0%`. The calculation is deterministic — identical inputs always produce
byte-identical rows and aggregate values (AC5).

## Gap Table

Flat table of every gap in this run. Columns (in this order) are canonical:

| story_key | gap_type | severity | description |
|-----------|----------|----------|-------------|
| E1-S1 | uncovered-ac | high | AC3 has no matching test case in test-plan.md |
| E1-S2 | missing-edge-case | medium | Test scenario 4 (empty input) is not exercised |

- `story_key` — the canonical story key (e.g., `E19-S3`)
- `gap_type` — one of the four values from the closed enum above
- `severity` — one of the four values from the severity enum above
- `description` — one-line summary of the gap (keep under 120 chars)

If no gaps exist, render the table header alone with a single row reading
`| — | — | — | No gaps detected |`.

## Per-Story Detail

One subsection per story that has one or more rows in the Gap Table.

### {story_key} — {story_title}

- **Total ACs:** {count}
- **Covered ACs:** {count}
- **Uncovered ACs:** {list of AC identifiers}
- **Missing tests:** {list of test case IDs or descriptions}
- **generated:** {count of generated test cases for this story}
- **executed:** {count of executed test cases for this story}
- **exec_ratio:** {executed / generated * 100, one decimal}% (E19-S7, FR-226)
- **Remediation:** {1-2 sentence suggested action}

Stories with zero gaps MAY be omitted from this section to keep the document
focused. The Gap Table is the canonical list.

The `generated`, `executed`, and `exec_ratio` fields are required on every
story subsection that reports verification results (E19-S7, FR-226). When
`generated` is 0, render `exec_ratio` as `0.0%` with a note rather than
raising a division-by-zero error. When `executed` is 0 and `generated > 0`,
the story MUST be flagged as `HIGH` gap priority in the Gap Table and in
the per-story remediation line.

## Recommendations

Prioritized list of concrete next steps, ordered by severity:

1. **{critical|high|medium|low}** — {action} — owner: {agent or team}
2. ...

Each recommendation SHOULD map to one or more Gap Table rows so downstream
tools can generate traceability.

## Frontend Dimensions

> **Traces to:** FR-224, ADR-030 §10.22.3
> **Story:** E19-S5
>
> Six-dimension test-type breakdown for frontend projects. This section is
> **present only when** the workflow detects the scanned project as a
> frontend stack (Angular, Flutter, React, Vue, Svelte, or a generic
> `src/app/` layout). For non-frontend projects the section is **omitted
> entirely** — no empty table, no error, no warning.

| Dimension | Gap Count | Coverage Score | Top-3 Uncovered |
|-----------|-----------|----------------|-----------------|
| Unit Tests | {count} | {0-100}% | {list or "—"} |
| E2E Tests | {count} | {0-100}% | {list or "—"} |
| Cross-browser | {count} | {0-100}% | {list or "—"} |
| Accessibility | {count} | {0-100}% | {list or "—"} |
| Visual Regression | {count} | {0-100}% | {list or "—"} |
| Responsive | {count} | {0-100}% | {list or "—"} |

**Detection signals** (per architecture §10.22.3):

- **Unit Tests** — `*.test.{ts,js}` / `*.spec.{ts,js}` in `src/`; gap if coverage < 60%
- **E2E Tests** — Playwright or Cypress spec files; gap if none found
- **Cross-browser** — browser matrix in `playwright.config.{ts,js}` or `cypress.config.{ts,js}`; gap if `browsers: [chromium]` only or absent
- **Accessibility** — `axe-core`, `jest-axe`, `@testing-library/jest-axe`, `@axe-core/playwright`, or `cypress-axe` in package.json; gap if none installed
- **Visual Regression** — Percy, Chromatic, or `playwright-visual-comparisons` in package.json; gap if none configured
- **Responsive** — viewport resize tests, `--viewport` flag in Playwright, or `cy.viewport` in Cypress; gap if absent from test files

Per-dimension coverage scores feed into E19-S6's overall coverage percentage
calculation. A non-frontend project's output skips this section entirely and
E19-S6 falls back to the generic Gap Table totals.

---

## Notes

- This template is read by `/gaia-test-gap-analysis` in both coverage and
  verification modes. The workflow populates placeholder values and writes
  the result to `{test_artifacts}/test-gap-analysis-{date}.md`.
- The gap type enum is **closed**. Adding a new gap type is a breaking change
  and requires a schema version bump in the `Schema version` header above.
- Val validates output files against this schema via the
  `gap-analysis-output` ruleset in `_memory/validator-sidecar/ground-truth.md`.
- Per ADR-020, projects MAY override this template by placing a file at
  `custom/templates/test-gap-analysis-template.md`.
