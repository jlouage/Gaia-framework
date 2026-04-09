# CI Test Execution Detection — Brownfield Knowledge Fragment

> **Version:** 1.0.0
> **Story:** E19-S21 (documents implementation from E19-S13)
> **Traces to:** FR-232, NFR-041
> **Category:** runtime-behavior
> **Source of truth:** `Gaia-framework/src/brownfield/ci-test-detector.js`

## Purpose

Detect whether a brownfield project actually executes tests in CI by scanning
its CI configuration files for real test execution steps. This fragment
documents the detection patterns, the output schema, and the zero-false-positive
rules that the programmatic module enforces.

This knowledge fragment is the companion to `test-execution-scan.md`:

- `test-execution-scan.md` covers **local test runner** detection and execution
  (Jest, Vitest, pytest, JUnit, Go test, Flutter, BATS, etc.)
- `ci-test-detection.md` (this file) covers **CI pipeline** test execution
  detection — whether the project's pipelines actually run those runners on
  every commit.

## Scope

The CI test execution detector identifies the **first** CI provider found that
runs tests. It scans supported providers in priority order and stops on the
first match. Detection is strictly pattern-based against configuration file
contents — file presence alone is never sufficient.

### Supported CI providers

The implementation in `ci-test-detector.js` (E19-S13) supports **6 providers**:

| # | Provider       | Enum value       | Config file(s)                     | Field scanned            |
|---|----------------|------------------|------------------------------------|--------------------------|
| 1 | GitHub Actions | `github-actions` | `.github/workflows/*.yml` / `*.yaml` | `run:`                 |
| 2 | GitLab CI      | `gitlab`         | `.gitlab-ci.yml`                   | `script:` list items     |
| 3 | CircleCI       | `circleci`       | `.circleci/config.yml`             | `run:`                   |
| 4 | Azure Pipelines| `azure`          | `azure-pipelines.yml`              | `script:` / `bash:`      |
| 5 | Jenkins        | `jenkins`        | `Jenkinsfile`                      | `sh '...'` / `sh "..."`  |
| 6 | Bitbucket      | `bitbucket`      | `bitbucket-pipelines.yml`          | `script:` list items     |

> **Note — Travis CI is intentionally NOT supported.** The original E19-S13
> story text mentioned `.travis.yml`, but Travis CI is deprecated and the
> implementation replaced it with `.gitlab-ci.yml` and `bitbucket-pipelines.yml`.
> This fragment reflects the actual shipped implementation, not the original
> story wording.

## Test Command Patterns

A CI step qualifies as "test execution" only when its command value matches
one of the following canonical patterns (from `TEST_COMMAND_PATTERNS` in the
module):

- `npm test`
- `npm run test`
- `pytest`
- `./gradlew test` / `./gradlew.bat test`
- `go test`
- `bats`
- `mvn test`
- `vitest`
- `npx vitest`

Patterns use word-boundary regexes so `pytest-cov` still matches via `pytest`
but embedded mentions inside unrelated tokens do not.

## Detection Algorithm by Provider

All YAML scanners share the same pipeline: split the file into lines, skip
comments, extract the command value from the recognized field, apply the
false-positive guard, then apply the test command patterns.

### GitHub Actions

- **Glob:** `.github/workflows/*.yml` and `*.yaml`
- **Line pattern:** `/^\s*-?\s*run:\s*(.+)$/`
- **Behavior:** iterate every workflow file in the directory; collect any `run:`
  field whose value matches a test command pattern.
- **Stops on first provider with ≥ 1 matching command.**

### GitLab CI

- **File:** `.gitlab-ci.yml`
- **Line pattern:** `/^\s+-\s+(.+)$/` (YAML list items under `script:`)
- **Behavior:** treat `script:` arrays as the authoritative source. Bare list
  items whose value matches a test command pattern count as test execution.

### CircleCI

- **File:** `.circleci/config.yml`
- **Line pattern:** `/^\s*-?\s*run:\s*(.+)$/`
- **Behavior:** mirrors the GitHub Actions scanner — `steps[].run.command`
  fields are matched via the `run:` prefix.

### Azure Pipelines

- **File:** `azure-pipelines.yml`
- **Line pattern:** `/^\s*-?\s*(?:script|bash):\s*(.+)$/`
- **Behavior:** matches both `script:` and `bash:` task values.

### Jenkins

- **File:** `Jenkinsfile` (Groovy, not YAML)
- **Comment skip:** lines starting with `//`
- **Line pattern:** `/\bsh\s+['"](.+?)['"]/`
- **Behavior:** matches `sh 'npm test'` and `sh "pytest"` style declarative
  and scripted pipeline steps.

### Bitbucket Pipelines

- **File:** `bitbucket-pipelines.yml`
- **Line pattern:** `/^\s+-\s+(.+)$/` (YAML list items under `script:`)
- **Behavior:** identical to the GitLab scanner — both providers express steps
  as YAML list items beneath `script:`.

## Output Schema

The detector resolves to a single object per project:

```json
{
  "ci_test_execution": "github-actions" | "gitlab" | "circleci" | "azure" | "jenkins" | "bitbucket" | null,
  "test_commands": ["<matched command line>", "..."]
}
```

- `ci_test_execution` — the enum value of the first provider whose config file
  contains at least one matching test command. `null` when no supported
  provider contains a matching command.
- `test_commands` — the raw command strings that matched the test patterns, in
  discovery order. Empty array when `ci_test_execution` is `null`.

Consumers should treat a `null` result as "no CI test execution detected" —
the project may still have local test runners (see `test-execution-scan.md`),
but no supported CI pipeline runs them on commit.

## Zero-False-Positive Rules (NFR-041)

The detector enforces NFR-041 (zero false positives) through three guards:

1. **Config file presence is not sufficient.** A repo may contain
   `.github/workflows/deploy.yml` that only runs `terraform apply` — it is not
   a test execution pipeline and will produce `null`.
2. **Comment skip.** YAML lines matching `/^\s*#/` and Groovy lines matching
   `/^\s*\/\//` are skipped before any command extraction. Test commands
   mentioned inside comments never qualify.
3. **False-positive guard.** Extracted command values starting with `echo` are
   rejected via `isFalsePositive`. This filters banners such as
   `- echo "running npm test now"` that look like test execution but are just
   log lines.

Pattern matches use word boundaries (`\b`) so `npm-test-utils` or
`pytestplugin` do not trigger a match against `npm test` / `pytest`. Only
actual command invocations count.

## Integration Notes

- **Companion to test-execution-scan.md.** The two fragments are designed to
  be read together during brownfield onboarding. Local test runner detection
  answers "does this project have tests?"; CI test detection answers "does
  the pipeline actually run them?". A gap exists when the runner detector
  finds a suite but the CI detector returns `null`.
- **Correlation with E19-S12 runner detection.** The test commands matched
  here (`npm test`, `pytest`, `./gradlew test`, etc.) deliberately mirror the
  runner commands produced by `test-runner-detector.js`. Brownfield workflows
  can cross-reference the two outputs to flag pipelines that run tests for
  only a subset of detected runners (e.g., a monorepo that runs `npm test`
  but skips `pytest`).
- **First-match semantics.** The detector iterates providers in the fixed
  order (GitHub Actions → GitLab → CircleCI → Azure → Jenkins → Bitbucket)
  and returns on the first match. Projects that use more than one CI provider
  will only surface the first match — callers that need multi-provider
  detection should invoke the individual scanners directly.

## Style and Format

This fragment follows the same conventions as its sibling knowledge files in
`_gaia/lifecycle/knowledge/brownfield/`:

- `test-execution-scan.md` — local test runner detection
- `config-contradiction-scan.md` — configuration contradiction scanning
- `dead-code-scan.md` — unused code detection

## See Also

- [`test-execution-scan.md`](./test-execution-scan.md) — local test runner
  detection and execution (the companion scan that runs tests, while this
  fragment identifies whether CI runs them)
- `Gaia-framework/src/brownfield/ci-test-detector.js` — the source of truth
  for every pattern and enum value in this fragment
- `Gaia-framework/src/brownfield/test-runner-detector.js` — the runner
  detector correlated with CI test command matching
