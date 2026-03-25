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
- **Status:** active | superseded | archived
- **Related:** {artifact paths, story keys}

{Decision body — free-form markdown with no structural constraints}
```

**Required vs optional fields:**
- **Required:** Agent, Status — a warning should be logged if these are absent
- **Optional:** Workflow, Sprint, Type, Related — these default gracefully (empty/null) when missing; the entry remains parseable

**Decision types:**
- `architectural` — system structure, technology choices, ADR-level decisions
- `implementation` — coding patterns, library usage, algorithm choices
- `validation` — test strategies, quality thresholds, coverage decisions
- `process` — workflow changes, ceremony adjustments, team agreements

**Status values:**
- `active` — current, in effect
- `superseded` — replaced by a newer decision (link to replacement)
- `archived` — no longer applies, retained for history

**Field constraints:**
- Date: ISO 8601 strict (YYYY-MM-DD). Malformed dates (e.g., `[2026-3-5]`) should trigger a warning and best-effort parsing rather than silently dropping the entry. Entries with unrecoverable dates use `[YYYY-MM-DD-UNKNOWN]` as placeholder.
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

<!-- SECTION: cross-ref-loading -->
## Cross-Reference Loading (ADR-015)

Load another agent's sidecar files as read-only cross-references. All cross-ref loading is JIT (just-in-time) — never preloaded at session start.

### Schema: `<memory-reads>` Tag

Agent persona files declare cross-references using this XML schema inside the `<agent>` block:

```xml
<memory-reads>
  <cross-ref agent="{agent-id}" file="{file-name}" mode="{recent|full|summary}" required="{true|false}" />
  <!-- Additional cross-ref entries -->
</memory-reads>
```

**Attributes:**
- `agent` (required) — the agent ID whose sidecar to read (e.g., "architect", "validator")
- `file` (required) — the sidecar file to read (e.g., "decision-log", "ground-truth", "conversation-context")
- `mode` (required) — loading mode: `recent`, `full`, or `summary`
- `required` (optional, default: "true") — if "false", skip gracefully when the sidecar is absent

### Read-Only Access: `load_cross_ref()`

Cross-references are loaded through `load_cross_ref()`, which is a **read-only** path — separate from `load_own()` (the agent's own sidecar, which supports read/write).

**Parameters:**
- `sidecar_path` — absolute path to the **target** agent's sidecar directory (e.g., `_memory/architect-sidecar/`)
- `file_name` — which file to read (e.g., "decision-log.md", "ground-truth.md")
- `mode` — loading mode: `recent`, `full`, or `summary`
- `budget_remaining` — remaining token budget for cross-references

**Write-Guard:**
Any attempt to write to a sidecar that is not the current agent's own sidecar MUST raise a **hard error** (not a warning). The write-guard blocks all write operations through `load_cross_ref()`. Only `load_own()` permits writes, and only to the agent's own sidecar directory.

**Procedure:**
1. Validate the target sidecar path is NOT the current agent's own sidecar (self-reference guard — see Validation section below)
2. Check budget_remaining BEFORE loading — if insufficient, apply progressive downgrade
3. Read the target file from disk (read-only — no file creation, no modification)
4. Apply mode filtering (see Loading Modes below)
5. Return filtered content as read-only data

### Loading Modes

**`recent` mode** — Load entries from the last 2 sprints only:
- Parse decision-log entries using ADR-016 format
- Filter by Sprint field: keep entries where sprint matches current sprint or previous sprint
- If sprint metadata is absent from entries, fall back to date-based filtering (last 30 days)
- Approximate token cost: character count / 4

**`full` mode** — Load the entire file content:
- Read full file, respect budget cap
- If file exceeds budget_remaining: truncate oldest entries first (keep most recent)
- Approximate token cost: character count / 4

**`summary` mode** — Load section headers only:
- Parse the file for markdown headers (lines starting with `#`, `##`, `###`)
- Stop at section boundaries — do not load body content
- Minimal token cost

### JIT Loading

Cross-references are loaded **just-in-time** during workflow step execution — NOT at agent activation or session start. Loading is triggered only when a workflow step explicitly requires cross-agent context.

**Trigger:** The workflow engine checks `<memory-reads>` declarations and loads cross-references only when the current step's execution context requires cross-agent data. No cross-references are preloaded eagerly.

### Budget Enforcement

**Pre-load budget check:** Before each cross-reference load, calculate:
- Tokens already consumed by own sidecar
- Tokens already consumed by previously loaded cross-references
- Estimated tokens for the next cross-reference (based on mode and file size)

**Progressive downgrade chain:** When budget is insufficient for the requested mode:
1. `full` → downgrade to `recent`
2. `recent` → downgrade to `summary`
3. `summary` → downgrade to `skip` (do not load, log warning)

Log every downgrade as a warning in the session checkpoint:
`"Cross-ref downgraded: {agent}/{file} from {original_mode} to {new_mode} — budget {used}/{total}"`

**Val's 50% cross-ref budget cap:**
Val (validator) has a `cross_ref_budget_cap` of 0.5 in `_memory/config.yaml`, meaning cross-references may consume at most 50% of Val's 300K session budget (= 150K tokens max for cross-refs). Val's load priority order: architect → pm → sm. If the 150K cap is hit mid-load, remaining cross-references are downgraded progressively.

**Tier budget ceilings:**
- Tier 1 agents: 300K session budget (own sidecar + cross-refs combined)
- Tier 2 agents: 100K session budget (own sidecar + cross-refs combined)
- Tier 3 agents: no explicit budget enforcement

### Graceful Error Handling

**Missing sidecar directory or file:**
- If the target sidecar directory does not exist: log a warning ("Cross-ref skipped: {agent} sidecar directory not found"), skip this cross-reference, and continue workflow execution
- If the target file within the sidecar does not exist: log a warning ("Cross-ref skipped: {agent}/{file} not found"), skip, continue

**Malformed or corrupt sidecar files:**
- If the target file exists but cannot be parsed (malformed markdown, corrupt content, unparseable entries): log a warning ("Cross-ref skipped: {agent}/{file} is malformed"), skip this cross-reference, and continue
- Never halt the workflow due to a cross-reference loading failure

**Absent optional cross-references:**
- If `<cross-ref required="false">` and the target is absent: skip silently (no warning)
- If `<cross-ref required="true">` (default) and the target is absent: log warning but still continue

### Consistency Validation

At session start, validate that agent persona `<memory-reads>` declarations are consistent with `_memory/config.yaml` cross_references matrix:

1. Parse the agent's `<memory-reads>` block from the persona file
2. Load the agent's entry from `_memory/config.yaml` → `cross_references.{agent_id}.reads_from`
3. Compare: every entry in config.yaml should have a matching `<cross-ref>` in the persona file
4. If mismatch found: produce a **warning** (not an error) — `_memory/config.yaml` is the authoritative source. The persona file declaration should mirror it.

**Self-reference guard:**
If an agent's `<memory-reads>` declares a `<cross-ref>` where the `agent` attribute matches the current agent's own ID, reject it with a validation error at session start. An agent must not reference its own sidecar as a cross-reference — own-sidecar access is through `load_own()`.

### Checkpoint Provenance

After loading cross-references, record in the session checkpoint:
- Which cross-references were loaded (agent, file, mode)
- File checksums (`shasum -a 256`) of each loaded cross-reference file
- Any downgrades or skips that occurred
- Total tokens consumed by cross-references

This enables `/gaia-resume` to detect stale cross-references when resuming a session.
<!-- END SECTION -->
