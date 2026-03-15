# Agent Customization

Place `{agent-id}.customize.yaml` files here to override agent defaults.

## Scope Files

- `{agent-id}.customize.yaml` — applies to one specific agent
- `all-dev.customize.yaml` — applies to all 6 dev agents (angular-dev, typescript-dev, flutter-dev, java-dev, python-dev, mobile-dev)

**Precedence:** agent-specific > all-dev > default. If both `flutter-dev.customize.yaml` and `all-dev.customize.yaml` define the same key, the agent-specific value wins.

These files are loaded AFTER the agent's base `.md` file and merged at runtime.

## Available Override Keys

- `persona_overrides` — Modify persona fields (communication_style, principles, etc.)
- `menu_additions` — Add extra menu items
- `menu_removals` — Remove menu items by cmd number
- `skill_additions` — Add extra skills to the agent's skill set (accepts `{name, path}` objects for custom skills)
- `rule_additions` — Add extra rules
- `skill_overrides` — Replace an entire skill file with a custom one (dev agents only)
- `skill_section_overrides` — Replace specific sections within a skill (dev agents only)

> **Note:** `skill_overrides` and `skill_section_overrides` apply only to dev agents (agents that extend `_base-dev.md`). Other agents use knowledge fragments, which are not currently overridable via this mechanism.

## Examples

### Persona Override

`architect.customize.yaml`:

```yaml
persona_overrides:
  communication_style: "More detailed, include architecture diagrams"
  additional_principles:
    - "Always consider serverless-first"
```

### Adding a Custom Skill to a Developer

`flutter-dev.customize.yaml`:

```yaml
skill_additions:
  - name: "aws-patterns"
    path: "{project-root}/custom/skills/aws-patterns.md"
```

This gives Freya (flutter-dev) access to a custom `aws-patterns` skill. The `path` points to a file in the user-owned `custom/skills/` directory, which survives framework updates.

### Full Skill Override

Replace the entire `git-workflow` skill with a custom version for all dev agents:

`all-dev.customize.yaml`:

```yaml
skill_overrides:
  git-workflow:
    source: "{project-root}/custom/skills/git-workflow.md"
```

When any dev agent loads `git-workflow`, it reads from the custom path instead of `_gaia/dev/skills/git-workflow.md`. The custom file must use the same `<!-- SECTION: name -->` delimiter format as framework skills.

A relative path (no `{project-root}` prefix) is resolved against `custom_skills_path` from `dev/config.yaml`:

```yaml
skill_overrides:
  git-workflow:
    source: "git-workflow.md"  # resolves to {project-root}/custom/skills/git-workflow.md
```

### Section Override

Replace only the `branching` and `commits` sections of `git-workflow`, keeping `pull-requests` and `conflict-resolution` from the default:

`all-dev.customize.yaml`:

```yaml
skill_section_overrides:
  git-workflow:
    branching: "{project-root}/custom/skills/git-branching.md"
    commits: "{project-root}/custom/skills/git-commits.md"
```

Relative paths also resolve against `custom_skills_path`.

### Override for One Agent Only

Give Hugo (java-dev) a different database-design skill while all other devs keep the default:

`java-dev.customize.yaml`:

```yaml
skill_overrides:
  database-design:
    source: "{project-root}/custom/skills/database-design-postgres.md"
```

## Override Resolution Order

When the engine JIT-loads a skill or skill section, it checks in this order:

1. Active agent's `{agent-id}.customize.yaml` — `skill_overrides` then `skill_section_overrides`
2. `all-dev.customize.yaml` (for dev agents only) — same check
3. Default path from `<skill-registry>` in `_base-dev.md`

When loading from an override path, the engine scans the file for `<!-- SECTION: xxx -->` markers dynamically instead of using `_skill-index.yaml` cached line ranges.

## Custom Skills Directory

Custom skill files should be placed in `custom/skills/` at the project root (outside `_gaia/`). This directory:

- Survives framework updates (`gaia-install.sh update` only touches `_gaia/` contents)
- Should be committed to version control
- Files must use the same `<!-- SECTION: name -->` delimiter format as framework skills
- Is referenced by `custom_skills_path` in `_gaia/dev/config.yaml`
