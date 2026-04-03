# Custom Stakeholders Directory

This directory is the user-owned location for custom stakeholder persona files. It lives outside `_gaia/` so it **survives framework updates** -- `gaia-install.sh update` only touches `_gaia/` contents.

## Usage

Place stakeholder persona `.md` files here. These files define stakeholder agents that participate in Party Mode (`/gaia-party`) group discussions.

### Creating a stakeholder persona

1. Create a markdown file following the stakeholder schema:
   ```
   custom/stakeholders/cfo.md
   ```
2. Define the stakeholder's persona, expertise, communication style, and priorities
3. The Party Mode workflow discovers stakeholder files from this directory automatically

## File Format

Stakeholder persona files must follow the schema defined by ADR-026:

- YAML frontmatter with `name`, `role`, `expertise`, `priorities`
- Markdown body with persona details, communication style, and decision-making criteria

## Version Control

This directory should be committed to your project's version control. Custom stakeholders are team-specific configuration, not framework internals.

## Reference

- Stakeholder schema: ADR-026 in architecture.md
- Custom skills directory: `custom/skills/`
- Custom templates directory: `custom/templates/`
