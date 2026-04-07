# Infrastructure Decisions — GAIA Framework

### [2026-03-14] GitHub Actions is the Only Infrastructure-as-Code

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:**

No cloud resources → no Terraform/Pulumi/CloudFormation needed. `.github/workflows/ci.yml` and `publish.yml` are the complete IaC. Workflow files + branch protection + CODEOWNERS = full infrastructure definition.

### [2026-03-14] No Containerization

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:**

Framework is a CLI tool with no running services. CI uses ephemeral GitHub Actions runners (VMs, not containers). End-users run on their local machines.

### [2026-03-14] Two-Workflow CI/CD Design

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** .github/workflows/ci.yml, .github/workflows/publish.yml

`ci.yml`: PR + main branch validation (lint, test, audit, validate). `publish.yml`: Release-triggered publish (isolated from PR context). Publish uses protected GitHub Environment with required reviewers.

### [2026-03-14] npm ci with Committed Lockfile

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** package-lock.json

`package-lock.json` committed to repository. CI uses `npm ci` for exact reproducibility. Prevents dependency drift between environments.

### [2026-03-14] Dependency Budget Enforced in CI

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** ADR-003

Transitive dependency count checked in CI (max 400). Budget: Vitest ~180, ESLint ~100, Prettier ~30, Husky ~20, parsers ~3. New dependencies must be evaluated against budget.

### [2026-03-14] Rollback Strategy is Version-Based

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:**

npm unpublish (within 72 hours) or deprecate for bad versions. git revert for CI/config/content changes. No blue/green, canary, or feature flags — simple linear versioning.

### [2026-03-14] Observability is CI-Scoped

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:**

No runtime monitoring (no runtime services). CI pipeline metrics: build time, coverage, dependency count, validation coverage. SLO: PR feedback < 5 minutes, main branch green >= 95%.

### [2026-03-14] Dependabot for Automated Updates

- **Agent:** devops
- **Workflow:** infra-design
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:**

Weekly checks for npm + GitHub Actions version updates. Grouped PRs for dev dependencies. Budget check prevents over-limit merges.
