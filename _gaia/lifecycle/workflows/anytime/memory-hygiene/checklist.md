---
title: 'Memory Hygiene Validation'
validation-target: 'Memory hygiene report'
---

## Dynamic Sidecar Discovery
- [ ] All sidecar directories discovered dynamically from config + on-disk union
- [ ] Sidecars classified by tier (Tier 1, Tier 2, Tier 3, untiered)
- [ ] Empty sidecars identified and skipped
- [ ] Archive subdirectories excluded from active scanning
- [ ] Legacy filenames detected and flagged for migration

## Tier-Aware Multi-File Scanning
- [ ] Tier 1 sidecars scanned for ground-truth.md, decision-log.md, conversation-context.md
- [ ] Tier 2 sidecars scanned for decision-log.md, conversation-context.md
- [ ] Tier 3 and untiered sidecars scanned for decision-log.md only
- [ ] Missing expected files logged with warning

## Cross-Reference Validation
- [ ] Standardized decision-log entries parsed (Status, Related fields)
- [ ] Cross-agent references validated against cross-reference matrix from config
- [ ] References to superseded/archived entries flagged as STALE
- [ ] Pre-standard format entries flagged as UNVERIFIABLE-FORMAT
- [ ] Orphaned artifact paths and story/epic keys detected

## Stale Detection via Skill
- [ ] stale-detection section loaded JIT from memory-management skill
- [ ] No inline reimplementation of stale/contradicted/orphaned detection
- [ ] All three detection categories applied (stale, contradicted, orphaned)

## Token Budget Reporting
- [ ] Token usage calculated per agent (file size bytes / 4 chars-per-token)
- [ ] Compared against session budget and ground truth budget from config
- [ ] Threshold status indicators applied (OK / warning at 80% / critical at 90% / over-budget at 100%)
- [ ] Tier 3 and untiered agents reported with "no budget enforced"
- [ ] Token Budget Table included in report

## Archival Recommendations
- [ ] Budget pressure recommendations (agents at or above 90%)
- [ ] Staleness recommendations (superseded/archived entries not in archive/)
- [ ] Age-based recommendations (entries older than 3 sprints / 42-day fallback)
- [ ] Recommendations classified as actionable vs advisory
- [ ] Archival never auto-executed — requires user confirmation per entry

## Ground Truth Refresh
- [ ] Tier 1 agents checked for stale ground-truth.md (Sprint gap > 1)
- [ ] /gaia-refresh-ground-truth recommended for stale agents
- [ ] Tier 2 and Tier 3 agents excluded from ground truth check
- [ ] Graceful degradation if sprint data unavailable

## Untiered Agent Handling
- [ ] Untiered agents (on-disk sidecar, no config entry) scanned as Tier 3
- [ ] Reported with "untiered — no budget config" in budget table
- [ ] Recommendation emitted to add to _memory/config.yaml as Tier 3

## Enhanced Report Output
- [ ] Report contains all 7 sections: Summary, Token Budget Table, Detailed Findings, Archival Recommendations, Ground Truth Refresh Recommendations, Untiered Agent Report, Skipped Sidecars
- [ ] Summary includes counts by status across all tiers and budget usage summary
- [ ] Detailed Findings grouped by sidecar and sorted by severity
- [ ] Report saved to {implementation_artifacts}/memory-hygiene-report-{date}.md

## User Actions
- [ ] All flagged entries presented to user with evidence
- [ ] User confirmed action (Keep/Archive/Delete) for each flagged entry
- [ ] Sidecar files updated per user choices
- [ ] Sidecar headers and marker comments preserved after edits
