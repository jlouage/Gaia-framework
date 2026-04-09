---
title: 'Dev Story Validation'
validation-target: 'Story implementation'
---
## Pre-conditions
- [ ] Story loaded successfully
- [ ] Status verified as ready-for-dev
- [ ] No unresolved blockers
## Implementation
- [ ] Each AC has corresponding test
- [ ] Each subtask completed
- [ ] TDD cycle followed (red/green/refactor)
## Conditional (if applicable)
- [ ] API changes: contract tests added
- [ ] DB changes: reversible migration script created
- [ ] Gradual rollout: feature flag configured
## Quality
- [ ] All tests pass
- [ ] No lint errors
- [ ] Code follows conventions
- [ ] PR merged to {promotion_chain[0].branch}
## Completion
- [ ] Status updated to review
- [ ] sprint-status.yaml updated
- [ ] All Definition of Done items verified complete
- [ ] Files changed list in story file
- [ ] Checkpoint archived
- [ ] PR merged to promotion_chain[0] via configured merge strategy (when ci_cd.promotion_chain is configured)
