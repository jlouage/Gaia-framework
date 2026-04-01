---
title: 'Add Feature Triage Validation'
validation-target: 'Feature/Enhancement/Patch Triage and Cascade'
---
## Intake
- [ ] User description captured
- [ ] Driver identified (user feedback / stakeholder / technical / market / regulatory)
- [ ] Urgency classified (critical / high / normal)
- [ ] Feature ID assigned (AF-{date}-{seq})
## Classification
- [ ] Change classified as patch / enhancement / feature
- [ ] Affected artifacts list built based on classification
- [ ] Classification confirmed by user
## Impact Scan
- [ ] Each affected artifact scanned for specific sections impacted
- [ ] Impact summary generated per artifact
## Val Review
- [ ] Proposed changes validated by Val
- [ ] CRITICAL findings addressed before proceeding
- [ ] WARNING findings noted
## Approval
- [ ] Triage plan presented to user
- [ ] User APPROVED or REJECTED the plan
## CR Record (if applicable)
- [ ] CR record created for enhancements and features
- [ ] Skipped for patches with justification
## Cascade
- [ ] Cascade follows corrected lifecycle order: PRD → UX → Architecture → Test Plan → Threat Model → Traceability
- [ ] Only affected artifacts processed — patches skip most steps
- [ ] Each step spawned as subagent (owning agent's workflow)
- [ ] Cascade manifest tracks state across steps
- [ ] Failed steps handled with retry/skip/abort options
- [ ] Checkpoint saved for /gaia-resume recovery
## Story
- [ ] Implementation stories created (patch, enhancement, and feature all create stories via subagent)
- [ ] Story keys captured
## Assessment Doc
- [ ] Assessment document generated at {planning_artifacts}/add-feature-{feature_id}.md
- [ ] All sections populated (classification, impact, cascade results, stories, next steps)
## Completion
- [ ] Next steps communicated based on classification
- [ ] Cascade manifest finalized
