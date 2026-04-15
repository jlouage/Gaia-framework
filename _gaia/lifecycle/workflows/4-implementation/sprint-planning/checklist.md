---
title: 'Sprint Planning Validation'
validation-target: 'Sprint plan and status files'
---
## Sprint Setup
- [ ] Sprint duration defined
- [ ] Velocity estimate set
- [ ] Sprint ID assigned
- [ ] Memory hygiene prompt shown to user (even when sidecars empty)
## Story Selection
- [ ] Only stories with status 'ready-for-dev' are selectable
- [ ] T-shirt-to-points mapping read from global.yaml sizing_map
- [ ] Stories selected within velocity
- [ ] Dependencies respected — stories with unresolved depends_on blocked
- [ ] P0 stories not selected are flagged with warning
- [ ] Priority ordering applied
- [ ] Selected story files updated with sprint_id
## Dependency Inversion Lint (E28-S33)
- [ ] Step 4b executed after story selection
- [ ] Lint result recorded in sprint plan output (no issues found, or warnings listed with suggested fixes)
## Testing Readiness
- [ ] test-plan.md checked (warn if missing)
- [ ] High-risk stories identified from risk_level field
- [ ] ATDD file status noted for each high-risk story
- [ ] Sprint plan includes Testing Readiness section
## Status
- [ ] sprint-status.yaml generated
- [ ] All stories set to 'backlog'
- [ ] Sprint ID tracked
## Output Verification
- [ ] Sprint plan file exists
- [ ] sprint-status.yaml exists and valid
