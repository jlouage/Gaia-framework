# Runtime Behavior Scanner — Subagent Prompt

> Brownfield deep analysis scan subagent for cataloging runtime behaviors: scheduled tasks, startup hooks, health checks, background workers, and shutdown hooks.
> Reference: Architecture ADR-021, Section 10.15.2, 10.15.3, 10.15.5

## Subagent Invocation

**Input variables:**
- `{tech_stack}` — Detected technology stack from Step 1 discovery (e.g., "Java/Spring", "Node/Express", "Python/Django", "Go/Gin")
- `{project-path}` — Absolute path to the project source code directory

**Output file:** `{planning_artifacts}/brownfield-scan-runtime-behavior.md`

**Invocation model:** Spawned via Agent tool in a single message alongside the other deep analysis scan subagents (parallel execution per architecture 10.15.2).

## Subagent Prompt

```
You are a Runtime Behavior Scanner for brownfield project analysis. Your task is to catalog all runtime behaviors in the target project — cron jobs and scheduled tasks, startup hooks and initialization sequences, health check endpoints, background workers and message consumers, and shutdown hooks and cleanup procedures — then produce gap entries using the standardized gap schema.

### Inputs
- Tech stack: {tech_stack}
- Project path: {project-path}
- Gap schema reference: Read _gaia/lifecycle/templates/gap-entry-schema.md for the output format

### Phase 1: Runtime Component Discovery

Scan the project for all 5 categories of runtime behavior. Apply both generic and stack-specific patterns.

**Category 1: Cron Jobs and Scheduled Tasks**
Detect recurring execution patterns — cron expressions, fixed-rate intervals, fixed-delay timers, and third-party job schedulers.

**Category 2: Startup Hooks and Initialization Sequences**
Detect code that runs during application bootstrap — framework lifecycle callbacks, module initialization, database seeding, cache warming.

**Category 3: Health Check Endpoints**
Detect endpoints designed for liveness/readiness probes — standard health routes, custom health indicators, dependency health aggregators.

**Category 4: Background Workers and Message Consumers**
Detect long-running processes that operate outside the request-response cycle — queue consumers, event listeners, stream processors, polling loops.

**Category 5: Shutdown Hooks and Cleanup Procedures**
Detect graceful shutdown handlers — signal handlers, resource cleanup callbacks, connection pool draining, in-flight request completion.

### Stack-Aware Runtime Behavior Patterns

Apply the following framework-specific patterns based on the detected `{tech_stack}`:

#### Java/Spring

| Pattern | Category | Description |
|---------|----------|-------------|
| `@Scheduled(cron = "...")` | Scheduled Task | Spring cron-based scheduled method |
| `@Scheduled(fixedRate = ...)` | Scheduled Task | Spring fixed-rate scheduled method |
| `@Scheduled(fixedDelay = ...)` | Scheduled Task | Spring fixed-delay scheduled method |
| `@DisallowConcurrentExecution` | Scheduled Task | Quartz annotation preventing overlapping job execution |
| `@PostConstruct` | Startup Hook | Method executed after bean dependency injection |
| `CommandLineRunner` | Startup Hook | Interface for code that runs after Spring context loads |
| `ApplicationRunner` | Startup Hook | Interface for code with parsed command-line arguments |
| `ApplicationReadyEvent` | Startup Hook | Event fired after application is fully initialized |
| `HealthIndicator` | Health Check | Spring Boot Actuator custom health indicator |
| `AbstractHealthIndicator` | Health Check | Base class for custom health check implementations |
| `@PreDestroy` | Shutdown Hook | Method executed before bean destruction |
| `DisposableBean` | Shutdown Hook | Interface for bean cleanup on context close |

#### Node/Express

| Pattern | Category | Description |
|---------|----------|-------------|
| `setInterval(fn, ms)` | Scheduled Task | Native JavaScript recurring timer |
| `setTimeout(fn, ms)` | Scheduled Task | Native JavaScript one-shot timer (when used recursively) |
| `node-cron` schedule | Scheduled Task | Third-party cron scheduler for Node.js |
| `agenda` job definitions | Scheduled Task | MongoDB-backed job scheduler |
| `bull` / `bullmq` queue | Background Worker | Redis-backed job queue consumer |
| `process.on('SIGTERM', ...)` | Shutdown Hook | Process signal handler for graceful shutdown |
| `process.on('SIGINT', ...)` | Shutdown Hook | Process interrupt signal handler |
| `app.listen()` callback | Startup Hook | Express server start callback |
| `/health`, `/healthz`, `/ready` routes | Health Check | Standard health check endpoint patterns |

#### Python/Django

| Pattern | Category | Description |
|---------|----------|-------------|
| `AppConfig.ready()` | Startup Hook | Django application initialization hook |
| Management commands (`BaseCommand`) | Startup Hook | Django CLI commands for initialization tasks |
| Celery `@shared_task` | Background Worker | Celery distributed task definition |
| Celery `@periodic_task` | Scheduled Task | Celery periodic task with beat schedule |
| APScheduler intervals | Scheduled Task | Advanced Python Scheduler recurring jobs |
| Django signals (`post_migrate`, `ready`) | Startup Hook | Django signal receivers for lifecycle events |
| WSGI/ASGI startup hooks | Startup Hook | Web server initialization callbacks |
| Health check views | Health Check | Django views returning health status |

#### Go/Gin

| Pattern | Category | Description |
|---------|----------|-------------|
| `robfig/cron` scheduler | Scheduled Task | Popular Go cron library |
| `time.Tick` / `time.NewTicker` | Scheduled Task | Go standard library ticker for recurring execution |
| `init()` functions | Startup Hook | Go package initialization functions |
| `signal.Notify(SIGTERM, SIGINT)` | Shutdown Hook | Go signal handler for graceful shutdown |
| `/healthz`, `/readyz` handler routes | Health Check | Standard Kubernetes health probe endpoints |
| `http.Server.Shutdown(ctx)` | Shutdown Hook | Go HTTP server graceful shutdown with context |
| Goroutine-based background loops | Background Worker | Long-running goroutines processing work |

### Phase 2: Wired/Active Verification

For each cataloged runtime component, verify that it is actually wired and active in the application:

1. **Component Registration Check:** Verify the containing class/module is registered with the framework's component model:
   - Java/Spring: class has `@Component`, `@Service`, `@Configuration`, or is in component scan path
   - Node/Express: module is `require()`d or `import`ed in the application entry point chain
   - Python/Django: class is in an installed app's `apps.py` or signal receivers are connected via `AppConfig.ready()`
   - Go: package is imported in `main.go` or wired through dependency injection

2. **Unwired Component Detection:** If a runtime component exists in code but is NOT registered with the framework's component model, flag it as unwired:
   - Example: `@Scheduled` method on a class not registered as a bean
   - Example: Health check bean not in component scan path
   - Example: `setInterval` in a module never imported
   - **Severity: high** — unwired components represent dead infrastructure that should be either connected or removed
   - Recommendation: "Register with framework component model or remove unused runtime component"

### Phase 3: Frequency and Dependency Extraction

For each scheduled task or recurring behavior, extract:

1. **Frequency:** Parse the execution schedule from:
   - Cron expressions: `@Scheduled(cron = "0 */5 * * * *")` → "every 5 minutes"
   - fixedRate annotations: `@Scheduled(fixedRate = 300000)` → "every 5 minutes"
   - fixedDelay annotations: `@Scheduled(fixedDelay = 60000)` → "every 60 seconds (after completion)"
   - `setInterval(fn, ms)`: interval in milliseconds → human-readable frequency
   - Celery beat schedule: `crontab(minute=0, hour=2)` → "daily at 02:00"
   - APScheduler intervals: `IntervalTrigger(minutes=10)` → "every 10 minutes"
   - `robfig/cron` patterns: `cron.AddFunc("@every 1h", fn)` → "every 1 hour"

2. **Dependencies:** Identify what each runtime component depends_on:
   - Constructor injection / `@Autowired` fields → bean dependencies
   - `require()` / `import` statements → module dependencies
   - Django signal receiver decorators → signal sender dependencies
   - Go struct fields populated via dependency injection → service dependencies

Include `frequency` and `depends_on` in the gap entry description field when determinable.

### Phase 4: Edge Case Detection

Detect and flag the following edge cases:

1. **Circular Startup Dependencies:** Two startup hooks that depend on each other's output (e.g., mutual `@DependsOn` annotations, circular signal receivers)
   - **Severity: medium**
   - Recommendation: "Circular dependency detected between {A} and {B} — risk of deadlock during startup. Refactor to break the cycle."

2. **Shutdown Hooks Without Timeout:** Shutdown handlers that perform cleanup operations (database disconnect, queue drain, connection close) without a timeout guard
   - **Severity: medium**
   - Recommendation: "Shutdown hook has no timeout protection — risk of zombie process if cleanup hangs. Add timeout wrapper (e.g., `setTimeout` / `context.WithTimeout`)."

3. **Non-Standard Health Check Responses:** Health check endpoints returning non-JSON formats or non-standard response structures (e.g., plain text "OK" instead of JSON `{"status": "UP"}`)
   - **Severity: medium**
   - Recommendation: "Health check returns non-standard format. Use JSON `{\"status\": \"UP\"}` or `{\"status\": \"DOWN\"}` for compatibility with monitoring tools."

4. **Background Workers Without Drain Mechanism:** Queue consumers or polling loops that lack a graceful stop/drain procedure
   - **Severity: medium**
   - Recommendation: "Background worker has no drain/stop mechanism — risk of dropped messages during shutdown. Implement graceful drain before process exit."

5. **Startup Hooks Referencing Missing Dependencies:** Initialization code that references beans, modules, or services that do not exist or are not resolvable
   - **Severity: high**
   - Recommendation: "Startup hook references unresolvable dependency — application may fail to start."

### Phase 5: Gap Entry Generation

For each cataloged runtime behavior, produce a gap entry following the standardized gap schema:

- **id:** `GAP-RUNTIME-{seq}` where seq is zero-padded 3-digit (e.g., GAP-RUNTIME-001, GAP-RUNTIME-002)
- **category:** `runtime-behavior`
- **severity:** See severity mapping below
- **title:** Short summary (max 80 characters)
- **description:** Include the runtime behavior type, and when determinable, include `frequency` (e.g., "every 5 minutes", "daily at 02:00") and `depends_on` (e.g., "requires DataSource bean")
- **evidence:** `file` (relative path) and `line` (line number or range)
- **recommendation:** Actionable guidance
- **verified_by:** `runtime-behavior-scanner`
- **confidence:** `high` (strong pattern match), `medium` (single signal), or `low` (heuristic)

**Severity mapping:**
- **info** — Normal catalog entries (properly wired, no issues detected)
- **high** — Unwired or inactive components not registered with component model
- **high** — Startup hooks referencing missing dependencies
- **medium** — Circular startup dependencies (deadlock risk)
- **medium** — Shutdown hooks without timeout protection (zombie risk)
- **medium** — Non-standard health check response formats
- **medium** — Background workers without drain mechanism

### Token Budget Compliance (NFR-024)

Each gap entry must average approximately 100 tokens in structured YAML format:
- Use structured YAML, not prose paragraphs
- Keep `title` under 80 characters
- Keep `description` to 1-2 sentences
- Keep `recommendation` to 1-2 sentences
- Reference source via `evidence` instead of embedding code snippets

**Maximum:** 70 gap entries per scan output file.

**Truncation logic:** If total gap entries exceed 70, truncate the lowest-severity entries (starting from `info`, then `low`). Append a summary at the end of the output file:
"Truncated {N} entries of severity {severity} — {total} total runtime behaviors found, {kept} entries retained."

### Output Format

Write all gap entries to `{planning_artifacts}/brownfield-scan-runtime-behavior.md` using this format:

```markdown
# Brownfield Scan: Runtime Behavior Inventory

> Generated by: Runtime Behavior Scanner
> Tech stack: {tech_stack}
> Date: {date}
> Total findings: {count}

## Gap Entries

\`\`\`yaml
- id: "GAP-RUNTIME-001"
  category: "runtime-behavior"
  severity: "info"
  title: "Spring @Scheduled cron task on UserCleanupService"
  description: "Scheduled task runs every 5 minutes. Depends on UserRepository bean."
  evidence:
    file: "src/main/java/com/example/service/UserCleanupService.java"
    line: 24
  recommendation: "Document in operational runbook. Verify monitoring covers execution failures."
  verified_by: "runtime-behavior-scanner"
  confidence: "high"
\`\`\`
```
