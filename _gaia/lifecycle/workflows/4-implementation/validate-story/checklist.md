---
title: 'Story Validation Check'
validation-target: 'Story validation'
---
## Full Validation (Step 2)
- [ ] YAML frontmatter — all 14 required fields present and valid
- [ ] Completeness — all template sections present
- [ ] Clarity — ACs in Given/When/Then, subtasks linked, DoD measurable
- [ ] Semantic quality — duplicate detection, ADR cross-references
- [ ] Dependencies — all declared dependencies exist and resolve
- [ ] Factual verification — claims verified against filesystem and ground truth
- [ ] Review Gate vocabulary — all rows in {UNVERIFIED, PASSED, FAILED}
## Fix Loop (Step 3)
- [ ] SM fixes findings, Val re-validates
- [ ] Hard limit: 3 validation attempts max
- [ ] PASS → status set to ready-for-dev
- [ ] FAIL after 3 → status stays validating
## Report (Step 4)
- [ ] Validation result appended to story file
- [ ] Separate validation report created at story-validation-{story_key}.md
## Val Memory (Step 5)
- [ ] Decision-log entry auto-saved with standardized format
- [ ] Conversation-context updated with session summary
- [ ] Memory save is non-blocking
