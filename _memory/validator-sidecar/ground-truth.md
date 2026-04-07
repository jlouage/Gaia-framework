---
agent: validator
tier: 1
token_budget: 200000
last_refresh: "2026-03-25"
entry_count: 7
estimated_tokens: 4500
---

# Ground Truth — Validator Agent

Verified facts about the GAIA Framework filesystem structure. Seeded by `/gaia-refresh-ground-truth` and maintained by Val across validation sessions.

## Location Corrections (Path Verification)

- Agent memory moved from `_gaia/_memory/` to `_memory/` at project root (ADR-013)
- Path mismatch resolved: all references updated to `_memory/` post-migration
- `{project-root}/_memory/` is the canonical memory location

## Variable Inventories

- `{project-root}` — root directory where `_gaia/` lives
- `{project-path}` — application source code directory (resolved from global.yaml project_path)
- `{installed_path}` — resolved from workflow.yaml location
- `{memory_path}` — `{project-root}/_memory`
- `{checkpoint_path}` — `{project-root}/_memory/checkpoints`

## Skill System Patterns

- 8 shared skills in `_gaia/dev/skills/`: git-workflow, api-design, database-design, docker-workflow, testing-patterns, code-review-standards, documentation-standards, security-basics
- Skills use sectioned loading via `<!-- SECTION: xxx -->` markers
- Override resolution: agent-specific customize.yaml > all-dev.customize.yaml > default skill-registry path

## Command Structure (Slash Commands)

- Slash commands live in `.claude/commands/gaia-*.md`
- Total slash command count: 118 verified
- Commands reference workflows via `{project-root}/_gaia/.../workflow.yaml` pattern
- Agent commands follow `gaia-agent-{stack}.md` naming

## Manifest Coverage

- 6 manifest CSV files in `_gaia/_config/`: workflow-manifest.csv, agent-manifest.csv, skill-manifest.csv, task-manifest.csv, files-manifest.csv, gaia-help.csv
- Coverage gap: workflow-manifest.csv must be kept in sync with workflow.yaml files on disk

### Workflows (73)

- _gaia/core/workflows/brainstorming/workflow.yaml
- _gaia/core/workflows/party-mode/workflow.yaml
- _gaia/creative/workflows/creative-sprint/workflow.yaml
- _gaia/creative/workflows/design-thinking/workflow.yaml
- _gaia/creative/workflows/innovation-strategy/workflow.yaml
- _gaia/creative/workflows/pitch-deck/workflow.yaml
- _gaia/creative/workflows/problem-solving/workflow.yaml
- _gaia/creative/workflows/slide-deck/workflow.yaml
- _gaia/creative/workflows/storytelling/workflow.yaml
- _gaia/lifecycle/workflows/1-analysis/advanced-elicitation/workflow.yaml
- _gaia/lifecycle/workflows/1-analysis/brainstorm-project/workflow.yaml
- _gaia/lifecycle/workflows/1-analysis/create-product-brief/workflow.yaml
- _gaia/lifecycle/workflows/1-analysis/domain-research/workflow.yaml
- _gaia/lifecycle/workflows/1-analysis/market-research/workflow.yaml
- _gaia/lifecycle/workflows/1-analysis/technical-research/workflow.yaml
- _gaia/lifecycle/workflows/2-planning/create-prd/workflow.yaml
- _gaia/lifecycle/workflows/2-planning/create-ux-design/workflow.yaml
- _gaia/lifecycle/workflows/2-planning/edit-prd/workflow.yaml
- _gaia/lifecycle/workflows/2-planning/validate-prd/workflow.yaml
- _gaia/lifecycle/workflows/3-solutioning/create-architecture/workflow.yaml
- _gaia/lifecycle/workflows/3-solutioning/create-epics-stories/workflow.yaml
- _gaia/lifecycle/workflows/3-solutioning/edit-architecture/workflow.yaml
- _gaia/lifecycle/workflows/3-solutioning/implementation-readiness/workflow.yaml
- _gaia/lifecycle/workflows/3-solutioning/infrastructure-design/workflow.yaml
- _gaia/lifecycle/workflows/3-solutioning/security-threat-model/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/action-items/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/add-stories/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/change-request/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/check-dod/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/check-review-gate/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/code-review/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/correct-course/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/create-story/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/dev-story/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/epic-status/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/fix-story/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/qa-generate-tests/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/retrospective/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/run-all-reviews/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/security-review/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/sprint-planning/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/sprint-status/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/tech-debt-review/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/triage-findings/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/val-refresh-ground-truth/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/val-validate-artifact/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/val-validate-plan/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/validate-story/workflow.yaml
- _gaia/lifecycle/workflows/5-deployment/deployment-checklist/workflow.yaml
- _gaia/lifecycle/workflows/5-deployment/post-deploy-verify/workflow.yaml
- _gaia/lifecycle/workflows/5-deployment/release-plan/workflow.yaml
- _gaia/lifecycle/workflows/5-deployment/rollback-plan/workflow.yaml
- _gaia/lifecycle/workflows/anytime/brownfield-onboarding/workflow.yaml
- _gaia/lifecycle/workflows/anytime/document-project/workflow.yaml
- _gaia/lifecycle/workflows/anytime/generate-project-context/workflow.yaml
- _gaia/lifecycle/workflows/anytime/memory-hygiene/workflow.yaml
- _gaia/lifecycle/workflows/anytime/performance-review/workflow.yaml
- _gaia/lifecycle/workflows/4-implementation/add-feature/workflow.yaml
- _gaia/lifecycle/workflows/quick-flow/quick-dev/workflow.yaml
- _gaia/lifecycle/workflows/quick-flow/quick-spec/workflow.yaml
- _gaia/testing/workflows/accessibility-testing/workflow.yaml
- _gaia/testing/workflows/atdd/workflow.yaml
- _gaia/testing/workflows/ci-setup/workflow.yaml
- _gaia/testing/workflows/edit-test-plan/workflow.yaml
- _gaia/testing/workflows/mobile-testing/workflow.yaml
- _gaia/testing/workflows/nfr-assessment/workflow.yaml
- _gaia/testing/workflows/performance-testing/workflow.yaml
- _gaia/testing/workflows/teach-me-testing/workflow.yaml
- _gaia/testing/workflows/test-automation/workflow.yaml
- _gaia/testing/workflows/test-design/workflow.yaml
- _gaia/testing/workflows/test-framework/workflow.yaml
- _gaia/testing/workflows/test-review/workflow.yaml
- _gaia/testing/workflows/traceability/workflow.yaml

### Agents (28)

- _gaia/core/agents/orchestrator.md
- _gaia/creative/agents/brainstorming-coach.md
- _gaia/creative/agents/design-thinking-coach.md
- _gaia/creative/agents/innovation-strategist.md
- _gaia/creative/agents/presentation-designer.md
- _gaia/creative/agents/problem-solver.md
- _gaia/creative/agents/storyteller.md
- _gaia/dev/agents/_base-dev.md
- _gaia/dev/agents/angular-dev.md
- _gaia/dev/agents/flutter-dev.md
- _gaia/dev/agents/go-dev.md
- _gaia/dev/agents/java-dev.md
- _gaia/dev/agents/mobile-dev.md
- _gaia/dev/agents/python-dev.md
- _gaia/dev/agents/typescript-dev.md
- _gaia/lifecycle/agents/analyst.md
- _gaia/lifecycle/agents/architect.md
- _gaia/lifecycle/agents/data-engineer.md
- _gaia/lifecycle/agents/devops.md
- _gaia/lifecycle/agents/performance.md
- _gaia/lifecycle/agents/pm.md
- _gaia/lifecycle/agents/qa.md
- _gaia/lifecycle/agents/security.md
- _gaia/lifecycle/agents/sm.md
- _gaia/lifecycle/agents/tech-writer.md
- _gaia/lifecycle/agents/ux-designer.md
- _gaia/lifecycle/agents/validator.md
- _gaia/testing/agents/test-architect.md

### Instructions (71)

- 71 instruction files (XML/MD) found across workflow directories

### Slash Commands (118)

- 118 command files in `.claude/commands/` verified

### Shared Skills (8)

- _gaia/dev/skills/git-workflow.md
- _gaia/dev/skills/api-design.md
- _gaia/dev/skills/database-design.md
- _gaia/dev/skills/docker-workflow.md
- _gaia/dev/skills/testing-patterns.md
- _gaia/dev/skills/code-review-standards.md
- _gaia/dev/skills/documentation-standards.md
- _gaia/dev/skills/security-basics.md

### Templates (1)

- 1 template file found

### Manifests (6)

- _gaia/_config/workflow-manifest.csv
- _gaia/_config/agent-manifest.csv
- _gaia/_config/skill-manifest.csv
- _gaia/_config/task-manifest.csv
- _gaia/_config/files-manifest.csv
- _gaia/_config/gaia-help.csv
