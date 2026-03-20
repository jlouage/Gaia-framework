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
## Elaboration
- [ ] Step 4 offers [u] user answers or [a] agent-assisted elaboration
- [ ] Agent-assisted mode spawns PM (Derek) and Architect (Theo) subagents in parallel
- [ ] PM subagent loads epics-and-stories.md, prd.md, ux-design.md
- [ ] Architect subagent loads architecture.md, test-plan.md, epics-and-stories.md
- [ ] Consolidated agent responses presented for user review before proceeding
## Pre-Save Validation
- [ ] Pre-save validation step (Step 6) runs before Generate Output (Step 7)
- [ ] Val validates ALL stories (no low-risk skip) — only skip is val_integration explicitly false
- [ ] val_integration defaults to enabled — only skip when explicitly set to false
- [ ] Draft written to temporary file (.draft-{story_key}.md) for Val to validate
- [ ] Val invoked via invoke-workflow to val-validate-artifact on draft
- [ ] Error handling: Val failure logs warning and continues (does not block story creation)
- [ ] Approved findings applied to story content before final save
- [ ] Draft file deleted after validation (whether passed, failed, or skipped)
- [ ] Validation results auto-saved to Val memory sidecar (no user prompt)
- [ ] Decision-log entry appended with standardized header format
- [ ] Conversation-context updated with session summary (replace semantics)
- [ ] Memory save is non-blocking — failure logs warning and continues
## Output Verification
- [ ] Story file exists at {implementation_artifacts}/{story_key}-{story_title_slug}.md
- [ ] Filename starts with story key (e.g., 1.2-user-login.md)
