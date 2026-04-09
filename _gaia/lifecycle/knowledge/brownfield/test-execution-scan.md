# Test Execution Scan — Brownfield Subagent Prompt

> **Version:** 1.0.0
> **Story:** E11-S9
> **Traces to:** FR-110, US-37, ADR-021
> **Category:** runtime-behavior (test failures map to runtime-behavior per gap-entry-schema.md)
> **Output format:** Standardized gap entry schema (`_gaia/lifecycle/templates/gap-entry-schema.md`)

## Objective

Run the existing test suite at `{project-path}` during brownfield discovery. Capture test failures as gap entries conforming to the gap schema. This scan is **non-blocking** — failures do not halt the brownfield workflow.

## Test Runner Auto-Detection

Detect the test runner by checking for the following files at `{project-path}`. For monorepo/polyglot projects, detect **all** matching runners and execute them sequentially. Use the `detectTestRunners()` function from `src/brownfield/test-runner-detector.js` when available as a programmatic alternative.

### Detection Priority Order

#### JavaScript/TypeScript — Granular Runner Detection (FR-231)

Check `package.json` `devDependencies` for known runners: `jest`, `vitest`, `mocha`, `jasmine`. Also check `scripts.test` for runner name references. Additionally check for config files:

| Runner | devDependencies Key | Config Files | Runner Command |
|--------|-------------------|--------------|----------------|
| Jest | `jest` | `jest.config.js`, `jest.config.ts`, `jest.config.json` | `npx jest` or `npm test` |
| Vitest | `vitest` | `vitest.config.js`, `vitest.config.ts` | `npx vitest run` or `npm test` |
| Mocha | `mocha` | `.mocharc.js`, `.mocharc.yml`, `.mocharc.json` | `npx mocha` or `npm test` |
| Jasmine | `jasmine` | — | `npx jasmine` or `npm test` |

If `package.json` has `scripts.test` defined (and value is not the npm default `"echo \"Error: no test specified\""`), fall back to `npm test` as the runner command.

#### Python

| File Check | Condition | Runner Command |
|-----------|-----------|----------------|
| `pytest.ini` / `pyproject.toml` / `setup.cfg` | `pytest.ini` exists, OR `pyproject.toml` contains `[tool.pytest]`, OR `setup.cfg` contains `[tool:pytest]` | `pytest` |

#### Java — JUnit via Maven or Gradle

| File Check | Condition | Runner Command |
|-----------|-----------|----------------|
| `pom.xml` | File exists (Maven convention implies JUnit/Surefire) | `mvn test` |
| `build.gradle` / `build.gradle.kts` | Either file exists AND contains `test {` block | `gradle test` |

#### Go

| File Check | Condition | Runner Command |
|-----------|-----------|----------------|
| `go.mod` | File exists | `go test ./...` |

#### Flutter/Dart

| File Check | Condition | Runner Command |
|-----------|-----------|----------------|
| `pubspec.yaml` | File exists | `flutter test` |

#### BATS (Bash Automated Testing System)

| File Check | Condition | Runner Command |
|-----------|-----------|----------------|
| `*.bats` files | Any `.bats` file found in project root or test directories (max 2 levels deep) | `bats test/` |

### Monorepo Support (AC5, AC6)

For monorepo projects, detect workspace packages from:
- `package.json` `workspaces` field (npm/yarn workspaces)
- `pnpm-workspace.yaml` `packages` list

Scan each workspace package directory independently. All detected runners are collected into an array — no overwriting. Duplicates are deduplicated.

### Zero False Positives (NFR-041)

Only report a detected runner when a config file OR a package.json dependency is explicitly found. Never guess based on file contents, comments, or heuristics alone. If no runner is detected, result is `null` (or empty array), not a guess.

### No Test Suite Detected (AC6)

If no test runner is detected at `{project-path}`, produce a single info-level gap entry:

```yaml
id: "GAP-TEST-INFO-001"
category: "runtime-behavior"
severity: "info"
title: "No test suite detected"
description: "No recognized test runner configuration found at {project-path}. The project has no automated tests or uses an unsupported test framework."
evidence:
  file: "{project-path}"
  line: 0
recommendation: "Add a test framework (Jest, pytest, JUnit, etc.) and write initial unit tests for critical paths."
verified_by: "machine-detected"
confidence: "high"
```

Proceed without error after logging this gap.

## Test Execution with Timeout (AC3)

Execute each detected runner with a configurable timeout (default **5 minutes** / 300 seconds).

```bash
timeout 300 npm test 2>&1
```

### Timeout Behavior

- If the timeout is exceeded, terminate the process gracefully
- Capture partial results from stdout/stderr up to the timeout point
- Log a warning-level gap entry noting the timeout:

```yaml
id: "GAP-TEST-{seq}"
category: "runtime-behavior"
severity: "medium"
title: "Test suite timed out after 5 minutes"
description: "Test execution exceeded the 300s timeout. Partial results captured: {N} tests ran before timeout."
evidence:
  file: "{test-config-file}"
  line: 0
recommendation: "Investigate slow tests. Consider splitting the test suite or increasing the timeout for CI."
verified_by: "machine-detected"
confidence: "medium"
```

### Sequential Execution for Multiple Runners (AC9)

For monorepo or polyglot projects with multiple test runners detected:
1. Execute each detected runner sequentially (not in parallel)
2. Aggregate results across all runners
3. Include the runner name in the `description` field of each gap entry (e.g., "npm test: ...")
4. Use a shared sequence counter across all runners for gap entry IDs

## Output Parsing (AC4)

After each test run completes (or times out), parse the output to extract metrics:
- **Total** test count
- **Passing** count
- **Failing** count
- **Skipped** count
- **Error messages** for each failing test

### Parsing Patterns by Runner

**Jest/Mocha/Vitest:**
- Summary line: `Tests: N passed, N failed, N total` (Jest) or `Tests N passed | N failed` (Vitest)
- Individual: `FAIL src/path/to/test.js` / `PASS src/path/to/test.js`
- Exit code 1 = failures present

**pytest:**
- Summary line: `N passed, N failed, N error`
- Individual: `FAILED test_file.py::test_name`

**Maven Surefire:**
- Summary in `target/surefire-reports/` XML files
- Console: `Tests run: N, Failures: N, Errors: N, Skipped: N`

**Go test:**
- Per-test: `--- FAIL: TestName` / `--- PASS: TestName`
- Summary: `FAIL` or `ok` per package

**Flutter test:**
- Summary: `All tests passed!` or `N tests failed`
- Per-test: `FAILED: test description`

## Infrastructure Error Detection (AC8)

Before converting failures to gap entries, check if the error is an infrastructure dependency failure rather than an actual test failure.

**Infrastructure error heuristics:**
- Pattern match stderr/stdout for: `ECONNREFUSED`, `connection refused`, `missing environment variable`, `ENOENT`, `docker`, `database connection`, `redis`, `ETIMEDOUT`, `EHOSTUNREACH`
- Exit codes indicating non-test errors (e.g., process crash, missing binary)

If an infrastructure error is detected:
- Do NOT convert to test failure gap entries
- Instead, log a **warning-level** gap entry:

```yaml
id: "GAP-TEST-{seq}"
category: "runtime-behavior"
severity: "medium"
title: "Test infrastructure dependency unavailable"
description: "Test execution failed due to infrastructure dependency: {detected_pattern}. This is not a test logic failure."
evidence:
  file: "{test-config-file}"
  line: 0
recommendation: "Ensure required infrastructure (databases, caches, external services) is available before running tests. Consider using test doubles for external dependencies."
verified_by: "machine-detected"
confidence: "medium"
```

## Gap Entry Conversion (AC5)

For each failing test, produce a gap entry conforming to the standardized gap schema:

### ID Format

- `GAP-TEST-{seq}` where `{seq}` is a zero-padded 3-digit sequence (001, 002, ...)
- Example: `GAP-TEST-001`, `GAP-TEST-002`

### Severity Mapping by Test Type

Infer test type from file path patterns:

| File Path Pattern | Test Type | Severity |
|-------------------|-----------|----------|
| `test/unit/`, `tests/unit/`, `__tests__/`, `*.unit.test.*` | unit | medium |
| `test/integration/`, `tests/integration/`, `*.integration.test.*` | integration | high |
| `test/e2e/`, `tests/e2e/`, `test/end-to-end/`, `*.e2e.test.*` | e2e | critical |
| Cannot be determined | default | medium |

### Gap Entry Template

```yaml
id: "GAP-TEST-{seq}"
category: "runtime-behavior"
severity: "{severity_from_test_type}"
title: "{test_name} — failing"
description: "{runner_name}: {error_message}"
evidence:
  file: "{test_file_path}"
  line: "{line_number_if_available}"
recommendation: "Fix the failing test or update the test to match current behavior."
verified_by: "machine-detected"
confidence: "high"
```

## Token Budget Control (AC7)

Per NFR-024, the total output must stay within the 40K token framework budget.

- Each gap entry averages ~100 tokens
- If test output produces more than 70 gap entries, truncate:
  - Keep the first 70 gap entries (prioritized by severity: critical > high > medium > low)
  - Add a summary line: `<!-- TRUNCATED: {N} additional test failures omitted to stay within NFR-024 token budget -->`
- If raw test output exceeds budget before parsing, truncate the raw output and parse what is available

## Output File

Write all gap entries to: `{planning_artifacts}/brownfield-scan-test-execution.md`

Format:
```markdown
# Brownfield Scan: Test Execution

> Scan type: test-execution
> Runner(s): {detected_runners}
> Date: {date}

## Test Metrics

| Runner | Total | Passed | Failed | Skipped |
|--------|-------|--------|--------|---------|
| {runner} | {n} | {n} | {n} | {n} |

## Gap Entries

{YAML gap entries here}
```

## See Also

- [`ci-test-detection.md`](./ci-test-detection.md) — CI pipeline test execution
  detection. This scan covers **local test runner** detection and execution
  (Jest, Vitest, pytest, JUnit, Go test, Flutter, BATS); `ci-test-detection.md`
  is the companion fragment that covers **CI pipeline** test execution
  detection across GitHub Actions, GitLab CI, CircleCI, Azure Pipelines,
  Jenkins, and Bitbucket Pipelines. Read both together during brownfield
  onboarding: the runner scan answers "does this project have tests?" and the
  CI scan answers "does the pipeline actually run them?".
- `config-contradiction-scan.md` — configuration contradiction scanning
- `dead-code-scan.md` — unused code detection
