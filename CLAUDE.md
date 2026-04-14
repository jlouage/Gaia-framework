
# GAIA Framework

> Version: see `package.json` or `_gaia/_config/global.yaml`

This project uses the **GAIA** (Generative Agile Intelligence Architecture) framework — an AI agent framework for Claude Code that orchestrates software product development through 26 specialized agents, 65 workflows, and 8 shared skills.

## How to Start

The primary entry point is `/gaia` — this activates the orchestrator (Gaia) who routes you to the right agent or workflow. You do not need to memorize all commands.

**5 essential commands:**
- `/gaia` — Start here. Gaia shows categories and routes you.
- `/gaia-dev-story` — Implement a user story
- `/gaia-quick-spec` — Rapid spec for small changes
- `/gaia-quick-dev` — Rapid implementation of a quick spec
- `/gaia-help` — Context-sensitive help

## Responding to `/gaia-*` Commands

When any `/gaia-*` command is invoked:
1. Load `{project-root}/_gaia/core/engine/workflow.xml` — this is the execution engine
2. The command file specifies a workflow.yaml or agent.md to process
3. If a workflow: load the pre-resolved config from `{installed_path}/.resolved/` first; fall back to runtime resolution
4. Follow the engine instructions EXACTLY — execute steps in order, save outputs at checkpoints
5. Write a checkpoint to `_memory/checkpoints/` after each significant step

## Framework Location

```
_gaia/                    # Framework root
├── core/                 # Engine, protocols, shared tasks
├── lifecycle/            # Product lifecycle (5 phases: analysis → deployment)
├── dev/                  # Developer agents (6 stacks) + shared skills (8)
├── creative/             # Creative intelligence workflows
├── testing/              # Test architecture + knowledge base
├── _config/              # Global config, manifests
│   └── global.yaml       # Shared settings — single source of truth
└── _memory/              # Persistent agent memory + checkpoints
```

**Artifact outputs:**
- `docs/planning-artifacts/` — PRDs, UX, architecture, epics
- `docs/implementation-artifacts/` — Sprint status, stories, changelogs
- `docs/test-artifacts/` — Test plans, traceability
- `docs/creative-artifacts/` — Design thinking, innovation outputs

## Project Path

GAIA supports separating the framework from the application source code. The `project_path` setting in `global.yaml` controls where application code lives:

- `project_path: "."` (default) — project code lives at the root alongside `_gaia/`. This is backward compatible.
- `project_path: "my-app"` — project code lives in a subdirectory. GAIA framework stays at root, code goes in `my-app/`.

**Resolved variables:**
- `{project-root}` — always the root directory where `_gaia/` lives. Used for framework paths, docs, and artifacts.
- `{project-path}` — where application source code lives. Equals `{project-root}` if project_path is `"."`, otherwise `{project-root}/{project_path}`.

**Rules:**
- NEVER replace `{project-path}/_gaia/` with symlinks to `{project-root}/_gaia/` — they are different things
- NEVER delete files from `{project-path}/_gaia/` thinking they are "stale copies" — they are the product
- Dev agents MUST write application code to `{project-path}`, not `{project-root}`
- Brownfield onboarding scans `{project-path}` for codebase discovery
- Framework artifacts (docs/, _gaia/) always stay at `{project-root}`
- Commands like `npm install`, `git`, test runners use `{project-path}` as working directory

## Global Rules (apply to ALL agents and workflows)

### Config Resolution
1. Check for pre-resolved config in `{installed_path}/.resolved/{workflow}.yaml`
2. If not found: load `workflow.yaml` → module `config.yaml` (which inherits `global.yaml`)
3. Resolve `{project-root}`, `{project-path}`, `{installed_path}`, system-generated values
4. After any config change, run `/gaia-build-configs` to regenerate resolved configs

### Context Budget
- **40K token max** for framework content per activation
- Never pre-load skills or knowledge fragments — load JIT when a step references them
- Use sectioned skill loading when only a subset of a skill is needed
- Release prior step content before loading the next step
- Agent persona files: max 400 lines
- Instruction step files: max 150 lines each
- Skill files: max 500 lines (or load individual sections at ~50 lines each)

### Step Execution
- Execute ALL steps in exact order — no skipping, no reordering
- Read the ENTIRE step file before acting on it
- Save output at every `<template-output>` checkpoint
- In normal mode: WAIT for user confirmation at template-outputs
- In YOLO mode: auto-proceed (user can toggle back to normal with "switch to normal mode")
- In planning mode: present execution plan BEFORE processing steps; wait for user approval; user selects normal or yolo for runtime

### Checkpoint Discipline
- Write a checkpoint to `_memory/checkpoints/` after each step completes
- Include: workflow name, step number, key variables, output file path
- Include `files_touched` with sha256 checksums (`shasum -a 256`) for every file created/modified during the workflow
- On resume: validate checksums — warn user of changed files, offer Proceed / Start fresh / Review
- If context is lost, `/gaia-resume` recovers from the last checkpoint

### Quality Gates
- Gates are **enforced**, not advisory — workflow HALTS on gate failure
- Pre-start gates must pass before workflow execution begins
- Post-complete gates must pass before marking a workflow done
- Never mark a task complete without all tests passing

**Testing integration gates (enforced):**
- `create-epics-stories` requires `test-plan.md` — run `/gaia-test-design` after architecture
- `implementation-readiness` requires `traceability-matrix.md` + `ci-setup.md` — run `/gaia-trace` + `/gaia-ci-setup`
- `dev-story` requires `atdd-{story_key}.md` for high-risk stories — run `/gaia-atdd`
- `deployment-checklist` requires traceability + CI + readiness report PASS
- `brownfield-onboarding` requires NFR assessment + performance test plan (output to `test-artifacts/`)

### Sprint-Status Write Safety
- **Story file is source of truth** — sprint-status.yaml is a derived/cached view
- **All status transitions** MUST use the `status-sync` protocol (`_gaia/core/protocols/status-sync.xml`) — this updates both the story file and sprint-status.yaml atomically
- **Review workflows (6)** update only the Review Gate table — the `review-gate-check` protocol handles the `review → done` transition via status-sync
- Running `/gaia-sprint-status` reconciles sprint-status.yaml with story files (catches any remaining drift)

## Naming Conventions

- Slash commands: `gaia-{action}` for workflows, `gaia-agent-{name}` for agents
- Workflow dirs: `{phase}/{workflow-name}/`
- Workflow files: `workflow.yaml` + `instructions.xml` + `checklist.md` + optional `template.md`
- Agent files: `{agent-id}.md` with XML `<agent>` block
- Skill files: `{skill-name}.md` in `_gaia/dev/skills/`
- Knowledge fragments: `{topic}.md` in `_gaia/{module}/knowledge/{category}/`
- Story files: `{story_key}-{story_title_slug}.md` (e.g., `E1-S1-user-login.md`) — canonical name set by `/gaia-create-story`
- Story file lookups use glob `{story_key}-*.md` to match regardless of slug

## Developer Agent System

- 6 specialized developers extend `_gaia/dev/agents/_base-dev.md`
- Stack agents: angular (Lena), typescript (Cleo), flutter (Freya), java (Hugo), python (Ravi), mobile (Talia)
- 8 shared skills: git-workflow, api-design, database-design, docker-workflow, testing-patterns, code-review-standards, documentation-standards, security-basics
- Skills use sectioned loading — only the sections needed by the current step are loaded

## Sprint State Machine

```
backlog → validating → ready-for-dev → in-progress → invalid → review → done
```

**Review Gate:** A story in `review` requires ALL six reviews to pass before moving to `done`:
- `/gaia-code-review` — PASSED or FAILED
- `/gaia-qa-tests` — PASSED or FAILED
- `/gaia-security-review` — PASSED or FAILED
- `/gaia-test-automate` — PASSED or FAILED
- `/gaia-test-review` — PASSED or FAILED
- `/gaia-review-perf` — PASSED or FAILED

**Gate status vocabulary** (canonical, enforced by `/gaia-validate-story`): `UNVERIFIED` (default, not yet run) | `PASSED` (review passed) | `FAILED` (review failed). No other values are permitted in the Review Gate table. Code Review uses `APPROVE`/`REQUEST_CHANGES` as its internal verdict keyword in the report body, but writes `PASSED`/`FAILED` to the Review Gate row.

Run `/gaia-run-all-reviews` to execute all six reviews sequentially via subagents — one command instead of six.

If any review fails, the story returns to `in-progress`. The Review Gate table in the story file tracks progress.

### Review Gate-to-Tier Mapping (E17-S12, FR-195)

When the Test Execution Bridge (ADR-028) is enabled, each review gate is linked to a set of test tiers (from the E17-S11 three-tier model) whose evidence is required to produce a PASSED verdict. The canonical mapping lives in `Gaia-framework/_gaia/core/bridge/review-gate-tier-mapping.js` (`DEFAULT_GATE_TIER_MAPPING`) and can be overridden per-project via the `tiers.gate_mapping` block in `test-environment.yaml`.

| Review Gate | Required Tiers |
|---|---|
| `/gaia-qa-tests` | Tier 1 + Tier 2 (unit + integration) |
| `/gaia-test-automate` | Tier 1 (unit) |
| `/gaia-test-review` | Tier 2 (integration) |
| `/gaia-review-perf` | Tier 3 (e2e) |
| `/gaia-security-review` | Tier 2 + Tier 3 (integration + e2e) |
| `/gaia-code-review` | no tier (static analysis only) |

When a gate is UNVERIFIED, the Nudge Block surfaces the required tiers (e.g., "run Tier 1 + Tier 2 tests") via `formatNudgeSuggestion(gate, mapping)`. Full rationale and override semantics live in architecture §10.20.4.

### Infra Review Gate Substitutions

For infrastructure stories (those whose `traces_to` field contains `IR-###`, `OR-###`, or `SR-###` requirement IDs), 4 of the 6 review gates use adapted criteria. Code Review and Security Review remain unchanged for all story types.

| Standard Gate | Infra Equivalent | Change |
|---|---|---|
| Code Review | IaC Code Review | Unchanged — same workflow, IaC expertise expected |
| QA Tests | Policy-as-Code Validation | Checkov/tfsec/OPA pass replaces unit/integration test pass |
| Security Review | Security Review | Unchanged — critical for infrastructure |
| Test Automation | Plan Validation + Drift Checks | terraform plan assertions replace automated test coverage |
| Test Review | Policy Review | OPA/Rego coverage replaces test quality review |
| Performance Review | Cost Review + Scaling Validation | Cost analysis and autoscaling validation replace load testing |

**Detection mechanism:** The `review-gate-check` protocol reads the story's `traces_to` field and checks the requirement ID prefix. Each story is evaluated independently — platform projects with mixed stories get per-story gate selection based on their own requirement prefix.

## Bridge Scope

The Test Execution Bridge (ADR-028, architecture §10.20) orchestrates test runs ONLY. The bridge does not deploy services, does not modify databases, and does not alter any infrastructure. This is a hard scope constraint enforced in code (FR-203) and must be preserved in every future change.

**Supported stacks (built-in adapters, architecture §10.20.11):**

The bridge ships with five static-import stack adapters, selected automatically by `getAdapter()` in `Gaia-framework/_gaia/core/bridge/adapters/index.js`. Priority order is deterministic: `javascript → python → java → go → flutter`.

| Stack | Representative runner command | Detection pattern |
|---|---|---|
| JavaScript / TypeScript | `npx vitest run` (also `npm test`, Jest, Mocha, TAP) | `package.json` |
| Python | `pytest` | `pyproject.toml` / `pytest.ini` / `setup.cfg` / `setup.py` |
| Java | `mvn test` (also `gradle test`) | `pom.xml` / `build.gradle` |
| Go | `go test ./...` | `go.mod` |
| Flutter / Dart | `flutter test` | `pubspec.yaml` |

Adding a new stack adapter is documented in `docs/architecture/bridge-adapter-contract.md`. External / dynamic adapter loading is explicitly out of scope (architecture §10.20.11.4, threat T37).

**The bridge DOES:**
- Invoke project-owned test runners via standard CLI commands — one adapter per stack, one representative runner shown per row above
- Trigger a single CI workflow declared in `test-environment.yaml` via `gh workflow run`
- Poll the CI run until terminal state and fetch the run log
- Parse runner/CI output into the `test-results/{story_key}-execution.json` evidence schema
- Reject commands containing shell chaining operators (`;`, `&&`, `||`, `|`, `>`, `<`) outside of quoted arguments
- Reject any command not explicitly allowlisted from `test-environment.yaml` runners or the `package.json` test script

**The bridge DOES NOT:**
- Deploy services, applications, or container images
- Provision, modify, or tear down infrastructure (no `terraform apply`, no `kubectl apply`, no `docker run -d`)
- Alter databases (no migrations, no seed scripts, no schema changes)
- Commit code, push branches, or mutate the git repository
- Execute arbitrary shell commands or shell substitution (`` ` `` and `$()` are always rejected)
- Trigger any GitHub Actions workflow other than the `ci_workflow` declared in `test-environment.yaml`

**Enforcement points:**
- `Gaia-framework/_gaia/core/bridge/bridge-scope-guard.js` — shared scope guard module exporting `assertInScope`, `assertCommandAllowed`, `assertCiWorkflowAllowed`
- Layer 2 local execution (`layer-2-local-execution.js`) calls all three guards before `spawn`
- Layer 2 CI execution (`layer-2-ci-execution.js`) calls the shell-operator guard on the runner command and the CI workflow allowlist guard before `gh workflow run`

**Threat model:** Architecture §10.20.10 enumerates the five bridge threats:
- **T20** — Environment misconfiguration (runner declared in `test-environment.yaml` does not match project stack). Mitigated by Layer 0 readiness checks and `assertCommandAllowed`.
- **T21** — Runner discovery failure (Layer 1 cannot match story key to test files). Mitigated by structured Layer 1 failure + `bridge_status: runner_not_found` evidence fallback.
- **T22** — Execution timeout (subprocess or CI workflow hangs). Mitigated by NFR-033 configurable timeout + SIGTERM/SIGKILL escalation.
- **T23** — Subprocess runaway via shell injection (chaining/substitution/redirection operators). Mitigated by `assertInScope` scope guard.
- **T24** — CI API unavailability (`gh` missing, auth expired, network failure). Mitigated by `defaultGhCheck` probe and local fallback + `assertCiWorkflowAllowed` on the fallback workflow.

## Memory Hygiene

Agent memory sidecars accumulate decisions across sessions. Run `/gaia-memory-hygiene` periodically (recommended before each sprint) to detect stale, contradicted, or orphaned entries by cross-referencing sidecar decisions against current planning and architecture artifacts.

## Branching Model

This project uses a three-tier branch flow:

```
feature branches → staging → main
```

- **Feature branches** — all development happens on feature branches. Never commit directly to `staging` or `main`.
- **`staging`** — integration branch for release candidates. Merging a PR to `staging` triggers an automated version bump and produces an RC prerelease version (e.g., `1.66.0-rc.1`). Each subsequent merge increments the RC counter (e.g., `1.66.0-rc.2`).
- **`main`** — production branch. Merging a promotion PR from `staging` to `main` strips the `-rc.N` suffix and produces the release version (e.g., `1.66.0`).

**Example version flow:**
```
main 1.65.1 → PR bump:patch → staging 1.65.2-rc.1 → PR bump:none → staging 1.65.2-rc.2 → promote → main 1.65.2
```

## Version Bumping

**CRITICAL: Do NOT bump versions manually.** Version bumping is fully automated via GitHub Actions, triggered by PR merges.

### How it works

- When a PR is merged to `staging`, the `version-bump-staging.yml` workflow reads the PR's bump label and updates the version automatically.
- Version state lives in **2 files only**: `package.json` and `_gaia/_config/global.yaml`.
- `gaia-install.sh` reads version dynamically from `package.json` at runtime — it does not carry a hardcoded version.
- `manifest.yaml`, `CLAUDE.md`, and `README.md` do not carry version numbers.

### Bump labels

Every PR merged to `staging` must have exactly one `bump:*` label:

| Label | Effect | Example |
|-------|--------|---------|
| `bump:major` | Bump 1st number, reset 2nd+3rd, set RC=1 | `1.65.1` → `2.0.0-rc.1` |
| `bump:minor` | Bump 2nd number, reset 3rd, set RC=1 | `1.65.1` → `1.66.0-rc.1` |
| `bump:patch` | Bump 3rd number, set RC=1 | `1.65.1` → `1.65.2-rc.1` |
| `bump:none` | Keep version numbers, increment RC only | `1.65.2-rc.1` → `1.65.2-rc.2` |

### What NOT to do

- Do NOT run `npm run version:bump` — this command no longer exists
- Do NOT manually edit version numbers in `package.json` or `global.yaml`
- Do NOT bump versions in feature branches — version changes happen automatically on merge to `staging`

## Branch Protection

Both `staging` and `main` branches are protected in GitHub settings:

- **PR required** — no direct push allowed to either branch
- **Status checks required** — lint, security audit, and tests must pass before merge
- **Bump label enforcement** — PRs to `staging` are blocked without exactly one `bump:*` label (`bump:major`, `bump:minor`, `bump:patch`, or `bump:none`)

Branch protection is configured in GitHub repository settings, not in code.

## Git Discipline

- Always commit AND push after completing changes. Do not leave unpushed commits.
- Write clear, conventional commit messages focused on what changed and why.
- Always use feature branches — NEVER commit directly to `staging` or `main`.
- PR workflow: feature branch → `staging` (with bump label) → `main` (promotion PR).

## npm Publishing

Publishing is fully automated — no manual steps required beyond creating the promotion PR.

### Automated pipeline

1. **Feature development:** develop on a feature branch, create PR to `staging` with a `bump:*` label
2. **Staging merge:** `version-bump-staging.yml` bumps the version and commits the RC version to `staging`
3. **Promotion:** create a PR from `staging` to `main`
4. **Release:** `promote-to-main.yml` strips the `-rc.N` suffix, commits the release version, creates a git tag `vX.Y.Z`, and creates a GitHub Release
5. **Publish:** the GitHub Release triggers `publish.yml`, which runs tests, verifies the version matches the tag, and publishes to npm with provenance attestation

### What NOT to do

- Do NOT manually create git tags — tags are created automatically by `promote-to-main.yml`
- Do NOT manually run `gh release create` — releases are created automatically
- Do NOT manually run `npm publish` — publishing is triggered by the GitHub Release

### Verification

After a release, verify: `npm view gaia-framework version`

## Sprint Gate (Upgrade Protection)

The installer's `update` command includes a sprint gate that prevents framework upgrades while a sprint is active. Before any files are modified, the installer reads `docs/implementation-artifacts/sprint-status.yaml` and checks whether any story has status `in-progress`, `review`, or `ready-for-dev`.

- **Active sprint detected:** the upgrade halts with exit code 1 and a message identifying the sprint and the number of active stories.
- **No active sprint** (all stories `done` or `backlog`): the gate passes and the upgrade proceeds.
- **No sprint file:** the gate passes silently (fresh project or no sprint started).

To bypass the gate (not recommended): `gaia-install.sh update --skip-sprint-gate [target]`

## Do Not

- Pre-load files — load at runtime when needed
- Skip steps in a workflow — execute ALL steps in order
- Proceed past a template-output without user confirmation (unless YOLO mode)
- Modify files outside the workflow's declared output locations
- Commit secrets, credentials, or .env files
- Create agent files over 400 lines — delegate depth to skills and knowledge fragments
- Chase config inheritance chains at runtime — use pre-resolved configs
- Load more than 40K tokens of framework content in a single activation
