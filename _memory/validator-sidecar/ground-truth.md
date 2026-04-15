---
agent: validator
tier: 1
token_budget: 200000
last_refresh: "2026-04-15"
entry_count: 58
estimated_tokens: 4500
---

# Ground Truth — Validator Agent

> Seed baseline regenerated from the running validator sidecar by dev-story E28-S3 as the gating prerequisite for the GAIA Native Conversion Program (AF-2026-04-15-1). New installs bootstrap with this baseline. Val overwrites entries during live sessions via `/gaia-refresh-ground-truth`.

<!-- last-refresh: 2026-04-15T00:00:00Z -->
<!-- mode: full (seed) -->
<!-- entry-count: 58 -->
<!-- refreshed-by: dev-story E28-S3 (GAIA Native Conversion Program baseline) -->

---

## Planning Baseline (E28-S3 refresh — GAIA Native Conversion Program)

**[planning-baseline]** PRD v1.29.0 — primary product requirements document at `docs/planning-artifacts/prd.md`. Includes §4.27 for the GAIA Native Conversion Program, Goal G22, Milestone M16.
Source: `docs/planning-artifacts/prd.md` | Verified: 2026-04-15 | Count: 1

**[planning-baseline]** Architecture v1.20.0 — architecture document at `docs/planning-artifacts/architecture.md` (frontmatter version: 1.20.0, baseline_version: 1.63.0, mode: brownfield). NOTE: some downstream artifacts reference "Architecture v1.21.0"; the actual on-disk frontmatter at the time of this seed refresh is v1.20.0.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[planning-baseline]** Active ADR set for E28 includes ADR-041 through ADR-048, inline in architecture.md §Decision Log table (lines 96–103), all currently in `Proposed` status. No `docs/planning-artifacts/adrs/` directory exists — ADRs are inline.
Source: `docs/planning-artifacts/architecture.md` §Decision Log | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-041 — Native Execution Model via Claude Code Skills + Subagents + Plugins + Hooks. Status: Proposed. Supersedes ADR-037. Traces: PRD v1.29.0, FR-323/324/328, M16, G22.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-042 — Scripts-over-LLM for Deterministic Operations. ~10 foundation bash scripts. Status: Proposed. Traces: PRD v1.29.0, FR-325, NFR-048, NFR-052.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-043 — Plugin Packaging via Two Marketplaces (gaiastudio/gaia-public OSS + gaiastudio/gaia-enterprise paid). Status: Proposed. Traces: PRD v1.29.0, FR-322, FR-332, NFR-051.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-044 — Config Split (local global.yaml vs shared project-config.yaml). Status: Proposed. Traces: PRD v1.29.0, FR-326.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-045 — Review Gate via Sequential `context: fork` Subagents. Status: Proposed. Traces: PRD v1.29.0, FR-330.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-046 — Hybrid Memory Loading (ground-truth in spawn prompt; decision-log via `!scripts/memory-loader.sh`). Status: Proposed. Traces: PRD v1.29.0, FR-331.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-047 — Project Structure Option B — Three-Repo Working Directory during conversion. Status: Proposed. Traces: PRD v1.29.0, FR-334, FR-335.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

**[adr]** ADR-048 — Engine Deletion as Program-Closing Action (LAST action after parity tests). CI guard rejects earlier deletions. Status: Proposed. Traces: PRD v1.29.0, FR-328, Val W5.
Source: `docs/planning-artifacts/architecture.md` | Verified: 2026-04-15 | Count: 1

---

## Variable Inventory (seed)

**[variable-inventory]** Package name: gaia-framework | Framework version in global.yaml: 1.127.6-rc.1 (at time of seed refresh)
Source: `_gaia/_config/global.yaml` | Verified: 2026-04-15 | Count: 1

**[variable-inventory]** project_path: "Gaia-framework" — application source lives at {project-root}/Gaia-framework/
Source: `_gaia/_config/global.yaml` | Verified: 2026-04-15 | Count: 1

**[variable-inventory]** ci_cd.promotion_chain: staging → main (github_actions, merge strategy: merge)
Source: `_gaia/_config/global.yaml` | Verified: 2026-04-15 | Count: 1

---

## Notes

This seed file is the distributable baseline committed to git for new installs of GAIA. The authoritative running ground truth lives outside this repo at `{project-root}/_memory/validator-sidecar/ground-truth.md` — that is the file Val reads during validation sessions. See dev-story E28-S3 for the refresh rationale and archive location of pre-refresh state.
