# Step 1: Agent Loading

<!-- References: architecture.md#10.18.2, ADR-026, FR-158/159/160/161, NFR-029 -->

## Source 1: GAIA Agent Discovery

1. Read `_gaia/_config/agent-manifest.csv` to discover all installed GAIA agents
2. For each agent row, extract: name, displayName, title, module
3. Build the GAIA agent list (existing behavior, unchanged)

## Source 2: Stakeholder Discovery

4. Glob `custom/stakeholders/*.md` to discover stakeholder persona files
   - If the `custom/stakeholders/` directory does not exist, silently produce zero stakeholders — no error, no warning
   - Skip empty files (0 bytes) silently
   - If a file has malformed YAML frontmatter, skip it with a warning: "Skipping {filename}: invalid YAML frontmatter" — do not crash discovery
5. Parse only YAML frontmatter from each discovered stakeholder file — extract: name (required), role (required), tags (optional)
   - Do NOT load the full Markdown body at discovery time — frontmatter only
6. Enforce 50-file cap: if more than 50 stakeholder files are found, warn "Stakeholder cap exceeded: {count} files found, using first 50 alphabetically" and truncate to the first 50 sorted alphabetically
7. Track token budget during frontmatter scan — estimate each file's frontmatter at ~100 tokens (approx 400 chars). Total discovery across all stakeholder files must stay within 5K token budget (NFR-029). If cumulative budget reaches 80%, warn and stop scanning additional files.

## Merge and Display Invite List

8. Build a combined invite list from GAIA agents (Source 1) and stakeholders (Source 2)
   - GAIA agents display as: `{displayName} — {title} ({module})`
   - Stakeholders display with an `[S]` marker: `[S] {name} — {role}`
9. Name disambiguation (FR-159): compare each stakeholder name against GAIA agent displayNames (case-insensitive). If a collision is detected, prefix the stakeholder with `[Stakeholder]` in the invite list and during discussion. GAIA agents always take precedence — agents retain their original name unchanged.
10. Ask the user which participants to invite:
    - Option A: "All agents" — GAIA agents only (unchanged from original behavior)
    - Option B: "By module" — let user pick GAIA modules: lifecycle, dev, creative, testing (unchanged)
    - Option C: "Specific agents" — let user pick individual participants from the combined GAIA + stakeholder list
    - Option D: "Stakeholders only" — let user pick from stakeholders only (FR-160). This creates a valid stakeholder-only party with zero GAIA agents.
    - Option E: "By tag" — invite stakeholders by tag (FR-161, scaffolding only — full implementation in E15-S4). List available tags extracted from stakeholder frontmatter, let user select tags, invite all stakeholders matching selected tags.

## Validation

11. Validate the selection:
    - Zero GAIA agents + one or more stakeholders = valid party — the orchestrator manages discussion flow (FR-160)
    - One or more GAIA agents + zero stakeholders = valid party (original behavior)
    - One or more GAIA agents + one or more stakeholders = valid party
    - Zero GAIA agents + zero stakeholders = invalid party — halt with message: "Cannot start party: no agents or stakeholders selected. Select at least one participant."

## Load Participant Personas

12. For each selected GAIA agent: load their persona (name, title, communication_style, principles) — do NOT load full agent files, only extract persona summaries
13. For each selected stakeholder: use the frontmatter already parsed at discovery time for the persona summary. Full file content (Markdown body) is loaded JIT when the stakeholder actually participates in discussion — not at selection time. If a stakeholder file exceeds 100 lines, display a warning when the full file is loaded: "Stakeholder file {filename} exceeds 100 lines — consider trimming for optimal context usage."

## Confirm and Proceed

14. Present the guest list to the user for confirmation
15. Ask for the discussion topic or question
