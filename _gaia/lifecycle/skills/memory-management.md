---
name: memory-management
version: '1.0'
applicable_agents: [all]
description: 'Session load/save, decision formatting, stale detection, deduplication, context summarization'
---

<!-- SECTION: decision-formatting -->
## Decision Entry Format (ADR-016)

All decision-log entries use this standardized format:

```markdown
### [YYYY-MM-DD] Decision Title

- **Agent:** {agent ID}
- **Workflow:** {workflow name}
- **Sprint:** {sprint ID}
- **Type:** architectural | implementation | validation | process
- **Status:** active | superseded | revoked
- **Related:** {artifact paths, story keys}

{Decision body — describe what was decided and why}
```

**Decision types:**
- `architectural` — system structure, technology choices, ADR-level decisions
- `implementation` — coding patterns, library usage, algorithm choices
- `validation` — test strategies, quality thresholds, coverage decisions
- `process` — workflow changes, ceremony adjustments, team agreements

**Status values:**
- `active` — current, in effect
- `superseded` — replaced by a newer decision (link to replacement)
- `revoked` — withdrawn, no longer applies

**Field constraints:**
- Date: ISO 8601 (YYYY-MM-DD)
- Agent: must match an agent ID from the agent manifest
- Sprint: sprint ID from sprint-status.yaml, or "pre-sprint" if decided outside a sprint
- Related: comma-separated list of artifact paths or story keys (e.g., `docs/planning-artifacts/architecture.md, E3-S1`)
<!-- END SECTION -->

<!-- SECTION: session-load -->
## Session Load

Load agent memory from a sidecar directory. Agent-agnostic — takes sidecar path and tier config as inputs.

**Parameters:**
- `sidecar_path` — absolute path to the agent's sidecar directory
- `tier_budget` — session token budget (Tier 1: 300K, Tier 2: 100K, Tier 3: no explicit budget)
- `recent_n` — number of recent decision entries to load (default: 20)

**Procedure:**
1. Check if `sidecar_path` directory exists
2. If directory does not exist: return empty data structures (empty decision log, empty conversation context, empty third file) without errors and do not create any files or directories
3. If directory exists, read up to 3 files:
   - `decision-log.md` — parse entries using the ADR-016 standard format (date, agent ID, workflow, sprint, type, status, related, body). Load the most recent `recent_n` entries that fit within the tier token budget
   - `conversation-context.md` — load full content (Tier 1 and Tier 2 only)
   - Third file (agent-specific, e.g., `ground-truth.md`) — load if present, treat as opaque content
4. If any file is missing or empty: return an empty data structure for that file — no error, no file creation
5. Calculate total loaded tokens (approximate: character count / 4). If total exceeds `tier_budget`, trim oldest decision entries first

**Empty-state guarantees:**
- Missing directory → empty structures, no errors, no file creation
- Missing files → empty structures per file, no errors
- Empty files (0 bytes) → empty structures, graceful handling
<!-- END SECTION -->

<!-- SECTION: session-save -->
## Session Save

Persist agent session data to sidecar files. Agent-agnostic — takes sidecar path and tier config as inputs.

**Parameters:**
- `sidecar_path` — absolute path to the agent's sidecar directory
- `tier_budget` — session token budget for this agent's tier
- `new_entries` — list of decision entries to append (using ADR-016 standard format: date, agent ID, workflow, sprint, type, status, related, body)
- `context_summary` — compressed session summary for conversation-context.md
- `third_file_content` — updated content for agent-specific third file (optional)

**Procedure:**
1. Ensure `sidecar_path` directory exists (create if needed via `mkdir -p`)
2. **decision-log.md** — append new entries:
   - Read the entire file into memory (full-file read)
   - Append `new_entries` in memory
   - Write the entire file back (full-file write). Last writer wins for concurrent access
   - Never use partial writes or stream appends
3. **conversation-context.md** — replace (rolling summary, not append):
   - Write `context_summary` as the full file content (overwrites previous)
4. **Third file** — update if `third_file_content` provided:
   - Read entire file, replace in memory, write entire file back

**Token budget enforcement (before write):**
- Calculate projected file size after append (current size + new entries size)
- Approximate tokens: character count / 4
- If projected size exceeds `tier_budget`: warn with current/max budget and offer options:
  - **Archive oldest entries** — move oldest N entries to `archive/` subdirectory to make room
  - **Force save** — save anyway, exceeding the budget
- Never silently truncate or block a save operation
- Warn at 80% of budget ("approaching limit"), warn at 90% ("near limit"), trigger archival prompt at 100%
<!-- END SECTION -->

<!-- SECTION: context-summarization -->
## Context Summarization

Compress a full session into a concise summary for `conversation-context.md`. Runs at session save time.

**Output structure (2K token limit):**

```markdown
## Session Summary — [YYYY-MM-DD]

### What Was Discussed
- {bullet list of topics discussed during the session}

### Decisions Made
- {bullet list of decisions, each with brief rationale}

### Artifacts Modified
- {bullet list of files created, modified, or deleted with change summary}

### Pending / Next Steps
- {bullet list of unresolved items, open questions, follow-up work}
```

**Constraints:**
- Total summary must not exceed 2K tokens (~8,000 characters)
- Prioritize decisions and pending items over discussion topics when space is tight
- Each bullet should be one concise sentence
- Artifacts list includes file paths for traceability
- If the session had no decisions, omit that section rather than writing "None"
<!-- END SECTION -->

<!-- SECTION: stale-detection -->
## Stale Detection

Scan a decision log to identify entries that are stale, contradicted, or orphaned.

**Detection categories:**

1. **Stale entries** — decision references an artifact path that no longer exists on the filesystem
   - Check each path in the `Related` field against the filesystem
   - If the artifact is not found: flag as stale
   - Reason: "Referenced artifact not found: {path}"
   - Suggested action: `review` (may need update or removal)

2. **Contradicted entries** — two active decisions in the same sidecar that conflict
   - Compare active entries that reference the same artifact or topic
   - If decisions conflict (e.g., "use PostgreSQL" vs. "use MongoDB" for the same component): flag both
   - Reason: "Contradicts entry [{date}] {title}"
   - Suggested action: `review` (resolve which decision is current)

3. **Orphaned entries** — decision references a story or epic that has been removed from epics-and-stories.md
   - Extract story/epic keys from `Related` field
   - Check each key against `docs/planning-artifacts/epics-and-stories.md`
   - If the key is not found: flag as orphaned
   - Reason: "Referenced story/epic {key} not found in epics-and-stories.md"
   - Suggested action: `archive` (decision is likely outdated)

**Output format:**

| # | Entry | Category | Reason | Suggested Action |
|---|-------|----------|--------|-----------------|
| 1 | [2026-03-01] Use PostgreSQL | stale | Referenced artifact not found: docs/old-schema.md | review |
| 2 | [2026-03-05] Use MongoDB | contradicted | Contradicts entry [2026-03-01] Use PostgreSQL | review |
| 3 | [2026-02-15] E99-S1 auth flow | orphaned | Referenced story/epic E99-S1 not found in epics-and-stories.md | archive |
<!-- END SECTION -->

<!-- SECTION: deduplication -->
## Deduplication

Detect and merge duplicate decision entries within a decision log.

**Duplicate detection:**

1. **Exact duplicates** — entries with the same artifact and same topic that address the same decision
   - Match on: same artifact path in `Related` + same topic keywords in title
   - If both are `active`: the newer entry supersedes the older

2. **Near-duplicates** — entries with different wording but identical decision substance
   - Match on: same artifact path + overlapping topic (>70% keyword overlap in title and body)
   - Near-duplicates require confirmation before merging — flag for review

**Merge protocol:**
- Newer entry is kept with status `active`
- Older entry is archived: set status to `superseded`, add note "Superseded by [{date}] {title}"
- Move archived entry to the `archive/` subdirectory if one exists
- If supersession is ambiguous (e.g., entries are from the same date, or address subtly different aspects): flag both for manual review rather than auto-merging

**Output:** List of duplicate pairs with recommended action (auto-archive or review).
<!-- END SECTION -->
