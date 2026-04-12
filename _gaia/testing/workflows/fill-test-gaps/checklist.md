# Fill Test Gaps Checklist

## Pre-Start Gates
- [ ] At least one `test-gap-analysis-*.md` file exists in `docs/test-artifacts/`
- [ ] Story files or sprint-status.yaml available for status resolution

## Post-Complete Gates
- [ ] Gap report loaded and parsed without errors (Step 1)
- [ ] Severity filter applied — filtered_out_count recorded in triage header (Step 2)
- [ ] Triage map built with one row per story_key, gap types aggregated (Step 3)
- [ ] Action proposal rules from `gap-triage-rules.js` applied to every row (Step 4)
- [ ] Skip statuses (in-progress, review, blocked) correctly handled with reason recorded
- [ ] Unknown gap types marked as skip with reason `unknown_gap_type`
- [ ] Stories not found in any source marked as skip with reason `story_not_found`
- [ ] Triage table rendered as markdown and saved to template-output path (Step 5)
- [ ] Performance: 50-gap report completes Steps 1-5 in under 30 seconds
