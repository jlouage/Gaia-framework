---
title: 'Story Creation Validation'
validation-target: 'Story file'
---
## Structure
- [ ] YAML frontmatter present with all 14 required fields: key, title, epic, status, priority, size, points, risk, sprint_id, depends_on, blocks, traces_to, date, author
- [ ] Acceptance criteria section complete
- [ ] Technical notes included
- [ ] Subtasks defined
- [ ] Definition of Done checklist present
## Quality
- [ ] Each AC uses Given/When/Then format
- [ ] Each AC is testable
- [ ] Dependencies correctly declared
- [ ] Status set to backlog
## Auto-Validation
- [ ] Auto-validation step (Step 7) present in instructions.xml
- [ ] Low-risk stories skip auto-validation silently
- [ ] val_integration config flag respected (absent/false = skip)
- [ ] Val invoked via invoke-workflow to val-validate-artifact
- [ ] Error handling: Val failure logs warning and continues (does not block story creation)
- [ ] YOLO mode: silent pass-through on zero findings, pause on non-zero
- [ ] Discussion → selective sharing loop for findings matches E8-S6 pattern
## Output Verification
- [ ] Story file exists at {implementation_artifacts}/{story_key}-{story_title_slug}.md
- [ ] Filename starts with story key (e.g., 1.2-user-login.md)
