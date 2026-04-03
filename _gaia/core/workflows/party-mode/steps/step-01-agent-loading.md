# Step 1: Agent Loading

## Source 1: GAIA Agent Discovery

1. Read `_gaia/_config/agent-manifest.csv` to discover all installed agents

## Source 2: Stakeholder Discovery

2. Glob `custom/stakeholders/*.md` to discover stakeholder personas
   - Parse YAML frontmatter only: extract `name`, `role`, and `tags` fields from each file
   - The `tags` field is an optional array in frontmatter (e.g., `tags: ["hotel-ops", "cleaning"]`)
   - Build a tag-to-stakeholder index: map each tag to the list of stakeholders whose `tags` array contains it
   - Stakeholders with multiple tags in their `tags` array appear in the index under every tag they have
   - If a stakeholder has no `tags` field or an empty array, it is excluded from tag-based searches but remains available for individual selection
   - Enforce 50-file cap — warn and truncate if exceeded (FR-164)
   - Budget: frontmatter scan within 5K token limit (NFR-029)
   - If `custom/stakeholders/` does not exist or is empty, display hint: "Tip: Create stakeholder personas with `/gaia-create-stakeholder` to invite domain experts to discussions." (FR-162)

## Invitation Options

3. Ask the user which agents/stakeholders to invite to the discussion:
   - Option A: "All agents" — load all GAIA agents from manifest
   - Option B: "By module" — let user pick modules (lifecycle, dev, creative, testing)
   - Option C: "Specific agents" — pick individual agents by name from GAIA agents and stakeholders combined
   - Option D: "Stakeholders only" — pick from discovered stakeholders only; zero GAIA agents is valid (FR-160)
   - Option E: "By tag" — invite stakeholders matching a tag (FR-161)
     - Prompt the user for a tag name
     - Look up the tag in the tag-to-stakeholder index (case-insensitive matching)
     - All stakeholders whose `tags` array contains the specified tag are invited
     - If the tag matches zero stakeholders, display warning: "Tag '{tag}' matches no stakeholders" and continue with any other invitees
     - Tag-based invitations can be combined alongside individual agent/stakeholder name selections in the same invitation
     - Alternative syntax: "invite all {tag}" (e.g., "invite all hotel-ops") — parsed and resolved using the same tag index with case-insensitive matching

## Name Disambiguation

4. If a stakeholder name collides with a GAIA agent name, prefix the stakeholder with `[Stakeholder]` in the guest list and during discussion. GAIA agents always take precedence in name resolution (FR-159).

## Guest Loading

5. For each selected agent, load their persona (name, title, communication_style, principles)
6. For each selected stakeholder, note persona for JIT loading at discussion time
7. Do NOT load full agent files — only extract persona summaries
8. Present the guest list to the user for confirmation
9. Ask for the discussion topic or question
