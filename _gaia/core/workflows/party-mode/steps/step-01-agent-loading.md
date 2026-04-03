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
   - The `tags` field is an optional array in frontmatter (e.g., `tags: ["hotel-ops", "cleaning"]`)
   - Build a tag-to-stakeholder index: map each tag to the list of stakeholders whose `tags` array contains it
   - Stakeholders with multiple tags appear in the index under every tag they have
   - If a stakeholder has no `tags` field or an empty array, it is excluded from tag-based searches but remains available for individual selection
   - Do NOT load the full Markdown body at discovery time — frontmatter only
6. Enforce 50-file cap: if more than 50 stakeholder files are found, warn "Stakeholder cap exceeded: {count} files found, using first 50 alphabetically" and truncate to the first 50 sorted alphabetically
7. Track token budget during frontmatter scan — estimate each file's frontmatter at ~100 tokens (approx 400 chars). Total discovery across all stakeholder files must stay within 5K token budget (NFR-029). If cumulative budget reaches 80%, warn and stop scanning additional files.
8. If `custom/stakeholders/` does not exist or is empty, display hint: "Tip: Create stakeholder personas with `/gaia-create-stakeholder` to invite domain experts to discussions." (FR-162)

## Merge and Display Invite List

9. Build a combined invite list from GAIA agents (Source 1) and stakeholders (Source 2)
   - GAIA agents display as: `{displayName} — {title} ({module})`
   - Stakeholders display with an `[S]` marker: `[S] {name} — {role}`
10. Name disambiguation (FR-159): compare each stakeholder name against GAIA agent displayNames (case-insensitive). If a collision is detected, prefix the stakeholder with `[Stakeholder]` in the invite list and during discussion. GAIA agents always take precedence — agents retain their original name unchanged.
11. Ask the user which participants to invite:
    - Option A: "All agents" — GAIA agents only (unchanged from original behavior)
    - Option B: "By module" — let user pick GAIA modules: lifecycle, dev, creative, testing (unchanged)
    - Option C: "Specific agents" — let user pick individual participants from the combined GAIA + stakeholder list
    - Option D: "Stakeholders only" — let user pick from stakeholders only (FR-160). This creates a valid stakeholder-only party with zero GAIA agents.
    - Option E: "By tag" — invite stakeholders matching a tag (FR-161)
      - Prompt the user for a tag name
      - Look up the tag in the tag-to-stakeholder index (case-insensitive matching)
      - All stakeholders whose `tags` array contains the specified tag are invited
      - If the tag matches zero stakeholders, display warning: "Tag '{tag}' matches no stakeholders" and continue with any other invitees
      - Tag-based invitations can be combined alongside individual agent/stakeholder name selections in the same invitation
      - Alternative syntax: "invite all {tag}" (e.g., "invite all hotel-ops") — parsed and resolved using the same tag index with case-insensitive matching

## Validation

12. Validate the selection:
    - Zero GAIA agents + one or more stakeholders = valid party — the orchestrator manages discussion flow (FR-160)
    - One or more GAIA agents + zero stakeholders = valid party (original behavior)
    - One or more GAIA agents + one or more stakeholders = valid party
    - Zero GAIA agents + zero stakeholders = invalid party — halt with message: "Cannot start party: no agents or stakeholders selected. Select at least one participant."

## Load Participant Personas

13. For each selected GAIA agent: load their persona (name, title, communication_style, principles) — do NOT load full agent files, only extract persona summaries
14. For each selected stakeholder: use the frontmatter already parsed at discovery time for the persona summary. Full file content (Markdown body) is loaded JIT when the stakeholder actually participates in discussion — not at selection time. If a stakeholder file exceeds 100 lines, display a warning when the full file is loaded: "Stakeholder file {filename} exceeds 100 lines — consider trimming for optimal context usage."

## Confirm and Proceed

15. Present the guest list to the user for confirmation
16. Ask for the discussion topic or question
