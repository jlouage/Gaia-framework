---
title: Dependency Inversion Lint (Sprint Planning)
scope: sprint-planning
used_by: ['sprint-planning/Step 4b']
origin: 'E28-S33 (triage of E28-S4 finding #2)'
---

# Dependency Inversion Lint

Sprint-planning Step 4b runs a forward-reference lint on the selected stories.
The goal is to catch dependency inversions at plan time — before the sprint
starts — so the scrum master can re-order or add an explicit `depends_on`.

## What it detects

A **dependency inversion** happens when one story's acceptance criteria
reference a resource (repo, file path, CLI command, service) that another
story in the same sprint *creates*, and the creator is scheduled at-or-after
the consumer.

The canonical motivating case is the **E28-S1 / E28-S4** historical bug:
- `E28-S1` — define `plugin.json` schema. AC3: "example plugin published to
  `gaia-public` marketplace repo."
- `E28-S4` — create `gaia-public` and `gaia-enterprise` repos.

Sprint-18 originally scheduled E28-S1 before E28-S4, which meant AC3 could
not be satisfied until mid-sprint. Resolved by re-sequencing on 2026-04-15.

## Scope

The lint is **AC-only**. Resources mentioned in Dev Notes, Technical Notes,
or Tasks-only sections do NOT trigger warnings. This is a deliberate
conservatism decision — false positives during sprint planning are costly
(they slow down the ceremony and erode trust in the lint).

## Heuristic

1. **Extract AC text** from each selected story via the
   `## Acceptance Criteria` heading.
2. **Tokenize resource identifiers** — code-fenced backtick tokens, path-like
   tokens (`foo/bar/baz`), gaia slash-commands (`/gaia-foo`), and kebab-case
   identifiers of 2+ segments (`gaia-public`, `gaia-enterprise`). Plain
   English words are excluded.
3. **Scan other stories' Tasks/Subtasks** for create-verbs (`create`, `add`,
   `scaffold`, `initialize`, `init`, `generate`, `provision`, `bootstrap`,
   `implement`, `build`, `set up`) within 120 characters before any matching
   token.
4. **Flag** when the producer is scheduled at-or-after the consumer — either
   later in the sprint order or in the same wave.

## Output

Advisory. The lint emits warnings but does **not** halt sprint planning.
Each warning includes:
- The consumer story key (whose AC references the token)
- The producer story key (whose tasks create the token)
- The token itself
- A suggested fix: re-order (move producer before consumer) or add
  `depends_on: [producer]` to the consumer story frontmatter.

The result is also recorded in the sprint-plan output document under a
"Dependency Inversion Lint" heading (either "no issues found" or the list).

## Remediation options

When a warning fires, the scrum master has three choices:

1. **Re-order** — move the producer story earlier in the execution order.
2. **Add depends_on** — edit the consumer story's frontmatter to declare
   `depends_on: [<producer_key>]`. On the next sprint planning run, the
   existing dependency blocker in Step 4 will handle the sequencing.
3. **Acknowledge and proceed** — if the reference is cosmetic (e.g., the AC
   mentions the resource only by name, not as a pre-requisite), accept the
   warning and continue. Document the acknowledgement in the sprint plan.

## Implementation

- Module: `{project-path}/scripts/lib/sprint-plan-dep-inversion-lint.js`
- Tests: `{project-path}/scripts/lib/__tests__/sprint-plan-dep-inversion-lint.test.js`
- Invoked from: sprint-planning `instructions.xml` Step 4b
- Pure ESM — no I/O; the workflow step is responsible for reading story files.

## Known limitations

- Heuristic only — a pathologically-named resource that looks like an
  English word will be missed (by design, to keep false positives low).
- Does not track transitive creation chains (A references X, B creates X,
  C creates Y that B needs). Only direct A→B edges.
- Does not parse linked architecture/requirement IDs — that is the job of
  the traceability matrix, not the lint.
