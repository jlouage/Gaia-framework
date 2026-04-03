---
title: 'Create Stakeholder Validation'
validation-target: 'Stakeholder file'
---
## Structure
- [ ] workflow.yaml present with agent: orchestrator
- [ ] instructions.xml present with sequential steps
- [ ] checklist.md present
- [ ] Registered in workflow-manifest.csv
- [ ] Slash command file exists at .claude/commands/gaia-create-stakeholder.md
## Input Collection
- [ ] Required fields prompted: name, role, expertise, personality
- [ ] Optional fields prompted: perspective, tags
- [ ] Required field validation (non-empty check)
## Validation Guards
- [ ] 50-file cap enforced before file creation
- [ ] Case-insensitive duplicate name detection against existing stakeholder name frontmatter
- [ ] custom/stakeholders/ directory auto-created if missing
## Output
- [ ] Filename is kebab-case slug of name with .md extension
- [ ] File written to custom/stakeholders/{slug}.md
- [ ] YAML frontmatter includes all required fields
- [ ] Optional fields included only when provided
- [ ] Markdown body with ## Background section
- [ ] File does not exceed 100 lines
