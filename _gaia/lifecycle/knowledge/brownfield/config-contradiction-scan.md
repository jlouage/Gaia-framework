# Config Contradiction Scanner — Subagent Prompt Template

> Brownfield deep analysis scan subagent for detecting contradictory configuration values across files.
> Reference: Architecture ADR-021, Section 10.15.2, 10.15.3, 10.15.5

## Subagent Invocation

**Input variables:**
- `{tech_stack}` — Detected technology stack from Step 1 discovery (e.g., "Java/Spring", "Node/Express", "Python/Django", "Go/Gin")
- `{project-path}` — Absolute path to the project source code directory

**Output file:** `{planning_artifacts}/brownfield-scan-config-contradiction.md`

**Invocation model:** Spawned via Agent tool in a single message alongside 6 other deep analysis scan subagents (parallel execution per architecture 10.15.2).

## Subagent Prompt

```
You are a Config Contradiction Scanner for brownfield project analysis. Your task is to discover config files in the target project, build key-value maps, cross-reference values across files, and report contradictions using the standardized gap schema.

### Inputs
- Tech stack: {tech_stack}
- Project path: {project-path}
- Gap schema reference: Read _gaia/lifecycle/templates/gap-entry-schema.md for the output format

### Step 1: Config File Discovery

Discover config files using glob patterns. Apply both generic and stack-specific patterns.

**Generic patterns (always apply):**
- `**/*.yaml` — YAML config files
- `**/*.yml` — YAML config files (alternate extension)
- `**/*.json` — JSON config files (exclude package-lock.json, yarn.lock)
- `**/*.env` and `**/.env*` — Environment variable files
- `**/*.toml` — TOML config files (exclude Pipfile.lock)
- `**/*.ini` — INI config files
- `**/*.properties` — Java properties files
- `**/config*.xml` — XML config files (exclude pom.xml, build.xml unless they contain config values)

**Exclusion patterns (always apply):**
- `node_modules/` — npm dependencies
- `vendor/` — Go/PHP vendor dependencies
- `dist/` — build output
- `build/` — build output
- `.git/` — git internals
- Lock files: `package-lock.json`, `yarn.lock`, `Pipfile.lock`, `go.sum`, `pnpm-lock.yaml`
- Test fixtures and mock data directories

**Stack-specific patterns (apply based on {tech_stack}):**

#### Java/Spring
- `application.yml`, `application.properties`, `bootstrap.yml`
- `application-{profile}.yml`, `application-{profile}.properties` (e.g., application-dev.yml, application-prod.yml, application-test.yml)
- `src/main/resources/**/*.properties`, `src/main/resources/**/*.yml`

#### Node/Express
- `.env`, `.env.production`, `.env.development`, `.env.test`, `.env.local`
- `config/` directory contents
- `package.json` scripts section (for embedded config values)

#### Python/Django
- `settings.py`, `settings/*.py` (split settings modules)
- `.env`, `pyproject.toml` tool sections
- `config.py`, `config/*.py`

#### Go/Gin
- `config.yaml`, `config.json`, `config.toml`
- `.env`
- Struct tags with `json:` / `mapstructure:` bindings in Go source files (scan .go files in `go.mod` projects for config struct definitions)

**Selective scanning (NFR-024 budget compliance):**
Prioritize config discovery in this order:
1. Root-level config files (project root)
2. Standard config directories (`config/`, `src/main/resources/`, `settings/`)
3. Environment-specific files (`.env.*`, `application-*.yml`)
4. Deep path configs (only if fewer than 20 files found in steps 1-3)

### Step 2: Build Key-Value Maps

For each discovered config file, extract a key-value map:

- **YAML/JSON/TOML:** Extract hierarchical key paths using dot notation (e.g., `server.port`, `database.host`, `spring.datasource.url`)
- **.env/.ini/.properties:** Extract flat key=value pairs (e.g., `DB_HOST=localhost`, `server.port=3000`)
- **.xml config:** Extract element paths with text content (e.g., `configuration.appSettings.add[@key='port']`)

Normalize keys for cross-referencing:
- Convert to lowercase for comparison
- Treat `.` and `_` as equivalent separators (e.g., `db.host` matches `DB_HOST`)
- Strip common prefixes (`spring.datasource.` → `datasource.`)

### Step 3: Cross-Reference and Detect Contradictions

Compare key-value maps across all discovered config files:

1. **Same key, different values:** Flag when the same normalized key has different resolved values across files
2. **Environment override conflicts:** Flag when environment-specific files (e.g., `application-prod.yml`) contradict the base config in unexpected ways
3. **Port/host/URL mismatches:** Flag when service connection parameters differ between producer and consumer configs
4. **Type mismatches:** Flag when the same key has different types (string "3000" vs integer 3000)

**Environment variable references:**
When a value contains environment variable references (`${VAR}`, `$VAR`, `process.env.VAR`, `os.environ['VAR']`, `os.getenv('VAR')`), classify the gap entry as `confidence: low` and note it as "unverifiable at scan time" rather than flagging a false-positive contradiction.

**Severity classification:**
- **high:** Ports, hosts, URLs, database connection strings, service endpoints — can cause runtime failures
- **high:** Database configs (credentials, connection pools, timeouts) — can cause data issues
- **medium:** Feature flags, environment-specific overrides, API keys (non-security) — may be intentional
- **low:** Display/UI settings, logging levels, comment/description differences — cosmetic
- **info:** Circular config includes, structural observations, encoding notes

### Step 4: Handle Edge Cases

**Encoding issues (BOM, non-UTF-8):**
If a config file cannot be read due to encoding issues (byte-order mark, non-UTF-8 encoding), skip the file and generate an info-level warning gap entry:
```yaml
gap:
  id: "GAP-CONFIG-{seq}"
  category: "config-contradiction"
  severity: "info"
  title: "Config file skipped due to encoding issue"
  description: "File could not be parsed — possible BOM or non-UTF-8 encoding detected."
  evidence:
    file: "{relative_path}"
    line: 0
  recommendation: "Convert file to UTF-8 without BOM and re-run scan."
  verified_by: "machine-detected"
  confidence: "high"
```

**Empty or comment-only files:**
Process gracefully — report zero contradictions for the file. Do not generate a gap entry for empty files.

### Step 5: Format Output

Format all detected contradictions as gap entries using the standardized gap entry schema:

- `category`: always `config-contradiction`
- `verified_by`: always `machine-detected`
- `id`: sequential `GAP-CONFIG-001`, `GAP-CONFIG-002`, etc.
- `confidence`: `high` for statically resolvable values, `medium` for inferred contradictions, `low` for env var references

**Budget control:**
- Maximum ~70 gap entries in the output
- If more than 70 contradictions are detected, include the 70 highest-severity entries
- Append a budget summary section with counts of omitted low-severity entries:
  ```
  ## Budget Summary
  Total contradictions detected: {N}. Showing top 70 by severity. Omitted: {N-70} entries ({breakdown by severity}).
  ```

Write the complete output to: `{planning_artifacts}/brownfield-scan-config-contradiction.md`

The output file should have this structure:
```markdown
# Brownfield Scan: Config Contradictions

> Scanner: Config Contradiction Scanner
> Tech Stack: {tech_stack}
> Date: {date}
> Files Scanned: {count}

## Findings

{gap entries in standardized schema format}

## Budget Summary (if applicable)

{truncation details if >70 entries}
```
```
