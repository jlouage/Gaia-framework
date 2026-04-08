---
title: '/gaia-ci-edit Validation'
validation-target: 'Updated ci_cd.promotion_chain in global.yaml'
---

## Pre-conditions
- [ ] global.yaml exists and is readable
- [ ] ci_cd.promotion_chain block is present (not the initial-setup path)
- [ ] Current chain passes E20-S1 schema validator before edits begin

## Operation Safety
- [ ] Remove operation ran reference scan (checkpoints + stories + test-environment.yaml)
- [ ] Remove operation required explicit confirmation when references were found
- [ ] Edit operation rejected any attempt to change the immutable `id` field
- [ ] Edit operation re-checked branch uniqueness after field changes
- [ ] Reorder operation warned when position 0 changed (PR target change)
- [ ] No operation was allowed to leave the chain with zero entries

## Schema Validation
- [ ] Modified chain passes the E20-S1 schema validator before write
- [ ] All ids are unique
- [ ] All branches are unique
- [ ] All entries have required fields (id, name, branch, ci_provider)
- [ ] All ci_provider values are in the allowed enum
- [ ] All merge_strategy values are in the allowed enum
- [ ] All ids match the slug pattern [a-z0-9-]+

## Write Safety
- [ ] Only the ci_cd.promotion_chain block was modified in global.yaml
- [ ] All other fields (framework_version, user_name, project_path, ...) are preserved
- [ ] Comments in global.yaml are preserved

## Cascade Updates
- [ ] CI pipeline configs updated if branches changed
- [ ] test-environment.yaml tier mappings updated if ids changed
- [ ] ci-setup.md regenerated or annotated
- [ ] /gaia-build-configs re-ran to refresh .resolved/ cache

## Output Verification
- [ ] Updated chain written to _gaia/_config/global.yaml
- [ ] Summary displayed to user with operation + affected entries + cascade results
