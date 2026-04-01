---
title: 'Add Stories Validation'
validation-target: 'Updated epics-and-stories.md'
---
## Story Protection
- [ ] Protection map built from sprint-status.yaml
- [ ] ZERO modifications to locked stories (in-progress, review, ready-for-dev, done)
- [ ] ZERO modifications to protected stories (invalid)
- [ ] Any backlog/validating modifications have explicit user confirmation
- [ ] Protection report displayed to user
## Epic Creation (if applicable)
- [ ] New epic ID does not collide with existing
- [ ] Epic has name, description, goal, success criteria
- [ ] User confirmed epic assignment
## Stories
- [ ] New stories follow existing format exactly
- [ ] Story IDs do not collide with existing IDs
- [ ] Each story has acceptance criteria, size, priority
- [ ] depends_on and blocks declared
- [ ] No circular dependencies introduced
- [ ] Risk levels applied (if test-plan.md exists)
- [ ] Source: CR-{cr_id} added (if change request linked)
## Change Log
- [ ] Change log entry added with date, feature name, and CR ID
## Inline Validation
- [ ] Inline validation invoked for each new story
- [ ] Fix loop executed if CRITICAL/WARNING findings found (max 3 attempts)
- [ ] Validation results recorded per story (validated / validating / degraded)
- [ ] Graceful degradation handled if Val unavailable (prerequisites missing or invocation failure)
## Existing Content
- [ ] Existing stories not modified
- [ ] Existing epic structure preserved
