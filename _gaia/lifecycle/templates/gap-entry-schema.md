# Gap Entry Schema

> **Version:** 1.0.0
> **Story:** E11-S1
> **Traces to:** FR-111, US-38, ADR-021
>
> Standardized output schema for brownfield scan subagents (E11).
> All scan agents MUST format gap entries using this schema.
> Location: `_gaia/lifecycle/templates/gap-entry-schema.md`

## Schema Definition

Each gap entry is a YAML object with the following fields:

```yaml
id: "GAP-{scan_type}-{seq}"
category: "<enum>"
severity: "<enum>"
title: "<string>"
description: "<string>"
evidence:
  file: "<relative-path>"
  line: <number-or-range>
recommendation: "<string>"
verified_by: "<agent-id>"
confidence: "<enum>"
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier. Format: `GAP-{scan_type}-{seq}` where `scan_type` maps to the category and `seq` is a zero-padded 3-digit sequence (e.g., `GAP-dead-code-001`) |
| `category` | enum | yes | Gap classification — must be one of the 7 allowed values (see Category Enum) |
| `severity` | enum | yes | Impact level — must be one of the 5 allowed values (see Severity Enum) |
| `title` | string | yes | Short summary of the gap (max 80 characters) |
| `description` | string | yes | Detailed explanation of the gap, what it means, and why it matters |
| `evidence` | object | yes | Source code evidence (see Evidence Object) |
| `recommendation` | string | yes | Actionable fix or remediation guidance |
| `verified_by` | string | yes | ID of the scan agent that produced this finding (e.g., `dead-code-analyzer`, `config-scanner`) |
| `confidence` | enum | yes | Agent's confidence in the finding accuracy (see Confidence Enum) |

## Enums

### Severity Enum

| Value | Description |
|-------|-------------|
| `critical` | Blocks deployment or causes data loss |
| `high` | Significant risk requiring prompt attention |
| `medium` | Moderate risk, should be addressed in current sprint |
| `low` | Minor issue, can be deferred |
| `info` | Informational finding, no immediate action needed |

### Category Enum

The 7 categories map 1:1 to the brownfield scan subagents:

| Value | Scan Agent | Description |
|-------|------------|-------------|
| `config-contradiction` | E11-S2 | Configuration files contradict each other or runtime behavior |
| `dead-code` | E11-S3 | Unreachable code, unused exports, orphaned files |
| `hard-coded-logic` | E11-S4 | Magic numbers, embedded URLs, environment-specific constants |
| `security-endpoint` | E11-S5 | Unprotected routes, missing auth, exposed secrets |
| `runtime-behavior` | E11-S6 | Behavior that only manifests at runtime (race conditions, memory leaks) |
| `doc-code-drift` | E11-S7 | Documentation does not match actual code behavior |
| `integration-seam` | E11-S8 | Fragile integration points, tight coupling, missing contracts |

### Confidence Enum

| Value | Description |
|-------|-------------|
| `high` | Strong evidence, verified through multiple signals |
| `medium` | Reasonable evidence, single signal source |
| `low` | Weak evidence, needs human verification |

## Evidence Object

The `evidence` field is a composite object grouping source location data:

```yaml
evidence:
  file: "src/services/auth.ts"    # Relative path from project root (non-empty string)
  line: 42                        # Single line number
```

Or with a line range:

```yaml
evidence:
  file: "config/database.yml"
  line: "15-28"                   # Line range (start-end)
```

| Sub-field | Type | Required | Constraints |
|-----------|------|----------|-------------|
| `file` | string | yes | Relative path from project root. Must be non-empty. |
| `line` | number or string | yes | Single line number (integer) or range as `"start-end"` string |

## ID Format

Pattern: `GAP-{scan_type}-{seq}`

- `scan_type` is the category value (e.g., `dead-code`, `config-contradiction`)
- `seq` is a zero-padded 3-digit sequence number starting at 001
- Regex: `^GAP-(config-contradiction|dead-code|hard-coded-logic|security-endpoint|runtime-behavior|doc-code-drift|integration-seam)-\d{3}$`

The `scan_type` component in the ID maps directly to the `category` value. See the Category Enum table for the full list of valid scan types and their corresponding agents.

## Validation Rules

All fields listed in the Field Reference are **required** — a gap entry with any missing field is invalid.

### Enum Validation

- `severity` must be exactly one of: `critical`, `high`, `medium`, `low`, `info`
- `category` must be exactly one of: `config-contradiction`, `dead-code`, `hard-coded-logic`, `security-endpoint`, `runtime-behavior`, `doc-code-drift`, `integration-seam`
- `confidence` must be exactly one of: `high`, `medium`, `low`
- Any value not in the enum set must be rejected

### Format Validation

- `id` must match the regex `^GAP-(config-contradiction|dead-code|hard-coded-logic|security-endpoint|runtime-behavior|doc-code-drift|integration-seam)-\d{3}$`
- `evidence.file` must be a non-empty string containing a relative path (no leading `/`)
- `evidence.line` must be a positive integer or a range string matching `^\d+-\d+$`
- `title` should not exceed 80 characters
- `verified_by` must be a non-empty string identifying the scan agent

### Required vs Optional

All 9 fields (`id`, `category`, `severity`, `title`, `description`, `evidence`, `recommendation`, `verified_by`, `confidence`) are **required**. There are no optional fields in the base schema.

## Budget Control

Each gap entry should average approximately **100 tokens** in structured YAML format (per NFR-024).

Guidelines:
- Use structured YAML, not prose paragraphs
- Keep `title` under 80 characters
- Keep `description` to 1-2 sentences
- Keep `recommendation` to 1-2 sentences
- Avoid embedding full code snippets in descriptions — reference via `evidence` instead

With 7 scan subagents producing up to ~70 gaps each, total token usage across all scan output files is approximately 50K tokens. After consolidation and deduplication (E11-S10), the single `consolidated-gaps.md` must stay within the 40K framework context budget.

## Examples

### Example 1: Dead Code Gap

```yaml
id: "GAP-dead-code-001"
category: "dead-code"
severity: "medium"
title: "Unused export in auth utilities"
description: "Function validateLegacyToken is exported but has zero import references across the codebase."
evidence:
  file: "src/utils/auth-helpers.ts"
  line: "45-62"
recommendation: "Remove validateLegacyToken and its associated tests. Verify no dynamic imports reference it."
verified_by: "dead-code-analyzer"
confidence: "high"
```

### Example 2: Config Contradiction Gap

```yaml
id: "GAP-config-contradiction-001"
category: "config-contradiction"
severity: "high"
title: "Database timeout mismatch between config files"
description: "production.yaml sets db.timeout to 30s while docker-compose.yml sets POSTGRES_TIMEOUT to 10s, causing silent connection drops."
evidence:
  file: "config/production.yaml"
  line: 18
recommendation: "Align timeout values. Set both to 30s or extract to a shared environment variable."
verified_by: "config-scanner"
confidence: "high"
```

### Example 3: Security Endpoint Gap

```yaml
id: "GAP-security-endpoint-001"
category: "security-endpoint"
severity: "critical"
title: "Admin route missing authentication middleware"
description: "The /api/admin/users endpoint lacks auth middleware, allowing unauthenticated access to user management."
evidence:
  file: "src/routes/admin.ts"
  line: 12
recommendation: "Add requireAuth and requireRole('admin') middleware to the route definition."
verified_by: "security-auditor"
confidence: "high"
```
