# Hard-Coded Business Logic Scanner — Subagent Prompt

> Brownfield deep analysis scan subagent. Detects hard-coded business logic values that should be externalized to configuration.
> Reference: Architecture ADR-021, Section 10.15.2, Section 10.15.5

## Objective

Scan the codebase at `{project-path}` to identify hard-coded business logic values embedded in source code. These are values that represent business rules, configuration, or environment-specific settings and should be externalized to configuration files, environment variables, or feature flags.

**Output format:** Follow the gap entry schema at `{project-root}/_gaia/lifecycle/templates/gap-entry-schema.md` exactly.

## Detection Categories

Scan for the following 6 categories of hard-coded values:

### 1. Magic Numbers in Business Calculations

Values used in business logic that represent thresholds, limits, rates, or quantities — NOT standard programming constants.

**Flag these:**
- Numeric thresholds in business conditions: `if (amount > 10000)`, `if (quantity >= 500)`
- Hard-coded retry counts in business logic: `maxRetries = 3` (in service layer, not infra)
- Hard-coded pagination limits that represent business policy: `const PAGE_SIZE = 50`
- Timeout values embedded in business logic: `setTimeout(callback, 30000)`

**Example patterns:**
```
if (amount > 10000)           // Approval threshold
if (age >= 18)                // Legal age requirement
const TAX_RATE = 0.21         // Tax percentage
const MAX_ITEMS = 100         // Cart limit
```

### 2. Hard-coded URLs and Endpoints

URLs, API endpoints, and service addresses embedded directly in source code instead of configuration.

**Flag these:**
- Production/staging URLs: `fetch("https://api.prod.example.com/v2")`
- Hard-coded service endpoints: `const API_BASE = "https://internal.service.com"`
- Database connection strings with hostnames: `mongodb://prod-db:27017`
- Webhook URLs: `post("https://hooks.slack.com/...")`

**Example patterns:**
```
fetch("https://api.prod.example.com/v2/users")
const WEBHOOK = "https://hooks.slack.com/services/T00/B00/xxxx"
axios.get("http://payment-service:8080/charge")
```

### 3. Embedded SQL Queries with Business Rules

SQL queries containing hard-coded business logic values — role names, status values, tier names, or business-specific filter criteria.

**Flag these:**
- Hard-coded role/status values in WHERE clauses: `WHERE role = 'ADMIN'`
- Business tier filtering: `WHERE tier = 'PREMIUM' AND status = 'ACTIVE'`
- Hard-coded date boundaries: `WHERE created_at > '2025-01-01'`

**Example patterns:**
```
WHERE role = 'ADMIN'
WHERE status = 'ACTIVE' AND tier = 'PREMIUM'
WHERE created_at > '2025-01-01'
HAVING count(*) > 5
```

### 4. Date/Time Thresholds

Hard-coded dates, times, or durations that represent business policy — effective dates, expiration periods, or scheduling boundaries.

**Flag these:**
- Policy effective dates: `if (date > "2025-01-01")`
- Hard-coded durations: `const SESSION_TIMEOUT = 3600` (1 hour in seconds)
- Expiration periods: `const TOKEN_EXPIRY = "30d"`
- Hard-coded cron schedules in business logic: `schedule("0 9 * * MON")`

**Example patterns:**
```
if (date > "2025-01-01")
const TRIAL_DAYS = 14
const TOKEN_EXPIRY_MS = 86400000
```

### 5. Pricing and Rate Values

Monetary values, percentages, rates, or financial thresholds embedded in code.

**Flag these:**
- Tax rates: `const tax = 0.21`
- Pricing tiers: `if (plan === "pro") price = 29.99`
- Discount percentages: `const DISCOUNT = 0.15`
- Currency conversion rates: `const USD_TO_EUR = 0.85`
- Fee amounts: `const SHIPPING_FEE = 5.99`

**Example patterns:**
```
const TAX_RATE = 0.21
const MONTHLY_PRICE = 29.99
if (subtotal > 100) applyDiscount(0.1)
```

### 6. Role and Permission Strings

Hard-coded role names, permission identifiers, or authorization strings used in access control logic.

**Flag these:**
- Role checks: `if (user.role === "manager")`
- Permission gates: `hasPermission("admin:write")`
- Hard-coded group names: `if (group === "enterprise")`
- Authorization scopes: `requiredScope = "read:users"`

**Example patterns:**
```
if (user.role === "manager")
if (user.role === "admin" || user.role === "superadmin")
hasPermission("admin:write")
@PreAuthorize("hasRole('ADMIN')")
```

## Acceptable Constant Allowlist

Do NOT flag the following categories — these are legitimate programming constants, not business logic:

### HTTP Status Codes
Standard HTTP response codes: `200`, `201`, `204`, `301`, `302`, `400`, `401`, `403`, `404`, `405`, `409`, `422`, `429`, `500`, `502`, `503`, `504`. These are protocol constants, not business values.

### Math Constants
Mathematical constants: `PI`, `Math.PI`, `Math.E`, `Math.SQRT2`, `Math.LN2`, `Math.LN10`, `Number.MAX_SAFE_INTEGER`, `Number.EPSILON`. Also zero (`0`), one (`1`), and negative one (`-1`) when used as mathematical identities.

### Array Indices and Loop Bounds
- Array access with literal indices: `arr[0]`, `arr[1]`, `list.get(0)`
- Loop bounds: `for (i = 0; i < length; i++)`, `while (count > 0)`
- Slice/substring with literal positions: `str.substring(0, 5)`

### Standard Library Constants
- Exit codes: `process.exit(0)`, `process.exit(1)`, `os.Exit(1)`
- Buffer sizes: powers of 2 used for byte buffers (`1024`, `4096`, `8192`)
- Bit operations: `0xFF`, `0x00`, `1 << n`

### Test Fixture Data
Any hard-coded values inside test files are legitimate test fixtures. See the test file exclusion rules below.

## Stack-Aware Detection Patterns

Apply the following framework-specific patterns based on the detected `{tech_stack}`:

### Java/Spring

| Pattern | Flag? | Reason |
|---------|-------|--------|
| `@Value("literal")` — `@Value` with a literal string, no `${}` placeholder | YES | Missing property placeholder — should be `@Value("${property.name:default}")` |
| `@Value("${property.name}")` or `@Value("${property.name:default}")` | NO | Correctly externalized via Spring property resolution |
| `@Scheduled(fixedRate = 60000)` with hard-coded milliseconds | YES | Schedule interval should come from configuration |
| Hard-coded values in `application.yml` / `application.properties` | NO | Already externalized to config files |
| `@RequestMapping("/api/v1/hardcoded-path")` | NO | Route paths are structural, not business logic |

### Node/Express

| Pattern | Flag? | Reason |
|---------|-------|--------|
| `app.listen(3000)` or `server.listen(8080)` with literal port | YES | Port should come from `process.env.PORT` or config |
| Route handlers with inline business config: `if (req.body.type === "premium")` | YES | Business tier check should reference config |
| `process.env.PORT \|\| 3000` | NO | Has env fallback — correctly externalized |
| Values in `.env` files | NO | Already externalized to environment config |
| `express.json({ limit: "10mb" })` | YES (medium) | Request size limit is operational config |

### Python/Django

| Pattern | Flag? | Reason |
|---------|-------|--------|
| `User.objects.filter(role="admin")` — ORM filter with hard-coded string | YES | Business role should come from constants or config |
| `Model.objects.filter(status="active")` | YES | Status value should be a defined constant or enum |
| Values in `settings.py` | NO | Already externalized to Django settings |
| `@login_required` decorator | NO | Structural access control decorator |
| `DEFAULT_AUTO_FIELD` in settings | NO | Framework configuration |

### Go/Gin

| Pattern | Flag? | Reason |
|---------|-------|--------|
| Struct tags with hard-coded defaults: `` `default:"admin"` `` | YES | Default values should come from config |
| `gin.Default()` port binding: `r.Run(":8080")` | YES | Port should come from config/env |
| `os.Getenv("PORT")` | NO | Correctly reading from environment |
| Values in `config.yaml` | NO | Already externalized to config files |
| `http.StatusOK`, `http.StatusNotFound` | NO | Standard library constants |

## False Positive Suppression Rules

### Configuration File Exclusion
Files with these extensions contain externalized configuration and should NOT be scanned for hard-coded values:
- `.yml`, `.yaml` — YAML config files
- `.properties` — Java/Spring property files
- `.env`, `.env.example`, `.env.local`, `.env.development`, `.env.production` — Environment files
- `.json` files in config directories (e.g., `config/`, `settings/`)
- `Dockerfile`, `docker-compose.yml` — Container config
- `Makefile`, `Rakefile`, `Taskfile.yml` — Build configuration

### Test File Exclusion
Hard-coded values in test files are legitimate test fixtures and assertions. Skip files matching:
- `*test*`, `*spec*`, `*Test*`, `*Spec*`
- `__tests__/` directory and all contents
- `test/`, `tests/`, `spec/`, `specs/` directories and all contents
- `fixtures/`, `__fixtures__/` directories and all contents
- `*_test.go`, `*_test.py` (language-specific test file patterns)
- `*.test.js`, `*.test.ts`, `*.spec.js`, `*.spec.ts`

### Framework-Specific Suppression
- Spring `@Value("${...}")` with property placeholder syntax — correctly externalized
- Django `settings.py` values — already in configuration layer
- Node.js `process.env.X || default` — has environment variable fallback
- Go `os.Getenv("X")` — reads from environment

## Output Format

### Gap Entry Structure

Each finding MUST use the standardized gap schema from `gap-entry-schema.md`:

```yaml
gap:
  id: "GAP-HARDCODED-{seq}"
  category: "hard-coded-logic"
  severity: "{critical|high|medium|low}"
  title: "Short description (max 80 chars)"
  description: "What was found, why it matters, what business logic it represents"
  evidence:
    file: "relative/path/to/file"
    line: 42
  recommendation: "Externalize to {config file | env variable | feature flag}"
  verified_by: "machine-detected"
  confidence: "{high|medium|low}"
```

### Field Values

- **id:** `GAP-HARDCODED-{seq}` — sequential numbering starting at 001 (e.g., `GAP-HARDCODED-001`, `GAP-HARDCODED-002`)
- **category:** Always `hard-coded-logic`
- **severity:** Based on impact:
  - `critical` — hard-coded secrets, credentials, or API keys (escalate to security)
  - `high` — hard-coded production URLs, database connection strings, pricing values
  - `medium` — magic numbers in business logic, role strings, date thresholds
  - `low` — hard-coded UI strings, log messages with business terms
- **verified_by:** Always `machine-detected`
- **confidence:** Based on detection certainty:
  - `high` — exact pattern match (e.g., `@Value("literal")` without `${}`, production URL with domain)
  - `medium` — heuristic match (e.g., magic numbers in business logic context, role string in conditional)
  - `low` — ambiguous case (e.g., numeric value that could be either business logic or programming constant)

## Budget Enforcement

- Each gap entry should average approximately 100 tokens in the structured YAML format
- Maximum output: 70 gap entries per scan
- If more than 70 gaps are detected:
  1. Sort all findings by severity (critical > high > medium > low)
  2. Keep the top 70 entries
  3. Truncate remaining low-severity entries
  4. Append a budget summary section:

```markdown
## Budget Summary
Total gaps detected: {N}. Showing top 70 by severity. Omitted: {N-70} entries ({low_count} low, {medium_count} medium).
```

## Output File

Write all findings to: `{planning_artifacts}/brownfield-scan-hardcoded.md`

Include a header:
```markdown
# Brownfield Scan: Hard-Coded Business Logic

> Scanner: Hard-Coded Logic Scanner
> Tech Stack: {tech_stack}
> Scan Date: {date}
> Total Findings: {count}
```
