# Custom Skills Directory

This directory is the user-owned location for custom skill files and section overrides. It lives outside `_gaia/` so it **survives framework updates** — `gaia-install.sh update` only touches `_gaia/` contents.

## Usage

Place custom skill files here, then register them in `_gaia/_config/agents/{agent-id}.customize.yaml` or `_gaia/_config/agents/all-dev.customize.yaml`.

### Full skill override

To replace the entire `git-workflow` skill for all dev agents:

1. Copy and modify the default skill:
   ```
   cp _gaia/dev/skills/git-workflow.md custom/skills/git-workflow.md
   ```
2. Edit `custom/skills/git-workflow.md` with your team's conventions
3. Register in `_gaia/_config/agents/all-dev.customize.yaml`:
   ```yaml
   skill_overrides:
     git-workflow:
       source: "git-workflow.md"
   ```

### Section override

To replace only the `branching` section of `git-workflow`:

1. Create `custom/skills/git-branching.md` with your branching strategy
2. Register in `_gaia/_config/agents/all-dev.customize.yaml`:
   ```yaml
   skill_section_overrides:
     git-workflow:
       branching: "git-branching.md"
   ```

### New custom skill

To add a skill that doesn't exist in the framework:

1. Create the skill file here (e.g., `aws-patterns.md`)
2. Use `<!-- SECTION: name -->` markers above each H2 heading
3. Register in the agent's customize.yaml:
   ```yaml
   skill_additions:
     - name: "aws-patterns"
       path: "{project-root}/custom/skills/aws-patterns.md"
   ```

## File Format

Custom skill files must follow the same format as framework skills:

- YAML frontmatter with `name`, `version`, `applicable_agents`
- `<!-- SECTION: section-id -->` HTML comment above each H2 heading
- H2/H3 headings for content structure

The engine scans override files for section markers dynamically (it does not use `_skill-index.yaml` line ranges for custom files).

## Version Control

This directory should be committed to your project's version control. Custom skills are team-specific configuration, not framework internals.

## Reference

- Override keys documentation: `_gaia/_config/agents/CUSTOMIZATION-README.md`
- Default skill files: `_gaia/dev/skills/`
- Skill index: `_gaia/dev/skills/_skill-index.yaml`
- Config path: `custom_skills_path` in `_gaia/dev/config.yaml`
