# Custom Stakeholders

Stakeholder files are lightweight discussion-only personas for Party Mode. They participate in group discussions but have **no workflow execution, no code implementation, and no agent capabilities**.

## Directory Convention

Place stakeholder `.md` files in this directory: `custom/stakeholders/`.

This follows the `custom/` overlay pattern (ADR-020, ADR-026) that survives framework updates. The installer creates this directory during `init` and never modifies its contents during `update`.

## File Schema (FR-156)

Each stakeholder file uses YAML frontmatter for structured metadata and a free-form Markdown body for personality and context.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name shown in Party Mode |
| `role` | string | Title or function (e.g., "CTO", "Housekeeper Manager") |
| `expertise` | string | Domain knowledge areas |
| `personality` | string | Communication style and behavioral traits |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `perspective` | string | Worldview or lens for evaluating ideas |
| `tags` | list of strings | Group labels for tag-based invitations (FR-161) |

### Markdown Body

The body below the frontmatter is free-form. No required structure. Use it for background context, biases, domain knowledge, or discussion style notes.

## Constraints (FR-164, NFR-029)

- **Max 100 lines** per stakeholder file (frontmatter + body)
- **Max 50 files** in `custom/stakeholders/`
- **5K token budget** for frontmatter-only discovery scan during Party Mode

## Restrictions

Stakeholders are strictly scoped to Party Mode discussions. They have:

- **No agent-manifest entry** -- not listed in `agent-manifest.csv`
- **No memory sidecar** -- no persistent memory across sessions
- **No activation protocol** -- no slash command or greeting
- **No workflow integration** -- cannot execute workflows or implement code

## Naming Convention

Files use kebab-case slugs derived from the stakeholder name: `{name-slug}.md`

Examples: `maria-santos.md`, `chief-technology-officer.md`

## Example

See `maria-santos.md` in this directory for a complete example with all required and optional fields populated.

## References

- Architecture 10.18.1: Stakeholder File Schema
- PRD 4.18.1: Stakeholder File Schema & Directory Convention
- ADR-020: Custom directory convention
- ADR-026: Stakeholder agents architecture
