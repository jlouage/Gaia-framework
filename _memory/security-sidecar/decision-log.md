# Threat Model Decisions — GAIA Framework

### [2026-03-14] Eval Removal is Highest Priority Security Fix

- **Agent:** security
- **Workflow:** threat-model
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** SR-1, SR-2, T-01

`eval` on user-controlled `$TARGET` in `cmd_validate` is the only code injection vector. Must be replaced with direct command execution using quoted variables. Maps to SR-1, SR-2; threat T-01 (DREAD 7.2).

### [2026-03-14] CI/CD Pipeline Must Isolate Publish from PR Context

- **Agent:** security
- **Workflow:** threat-model
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** SR-3, SR-4, SR-5, T-02, T-03

`publish.yml` must ONLY use `on: release` trigger. npm token must not be available in PR-triggered workflows. GitHub Environment with approval required for publish. Maps to SR-3, SR-4, SR-5; threats T-02, T-03.

### [2026-03-14] npm Provenance is Mandatory for All Publishes

- **Agent:** security
- **Workflow:** threat-model
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** SR-6, SR-7, T-04, T-13

`npm publish --provenance` provides verifiable publisher identity. Combined with checksums.txt for integrity verification. Maps to SR-6, SR-7; threats T-04, T-13.

### [2026-03-14] Template-Output Path Validation Needed in Workflow Engine

- **Agent:** security
- **Workflow:** threat-model
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** SR-8, SR-9, T-05

Engine should validate output paths resolve within {project-root}. instruction-validator should flag paths with `..` or absolute paths. Maps to SR-8, SR-9; threat T-05.

### [2026-03-14] Plaintext State Files are Acceptable Risk

- **Agent:** security
- **Workflow:** threat-model
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:**

Framework is local-only; OS permissions are the access control layer. Encrypting state would add complexity without security benefit. Checkpoint sha256 checksums detect accidental modification.

### [2026-03-14] CODEOWNERS Required for CI Workflow Files

- **Agent:** security
- **Workflow:** threat-model
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:** SR-10, SR-11, T-08, T-09

`.github/workflows/` changes require designated reviewer approval. All workflows use explicit `permissions:` blocks. Maps to SR-10, SR-11; threats T-08, T-09.

### [2026-03-14] Risk Acceptance Decisions

- **Agent:** security
- **Workflow:** threat-model
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** active
- **Related:**

Risk acceptances:
- Plaintext state (accepted): local tool, OS permissions sufficient
- Checkpoint forgery (accepted with monitoring): sha256 detects drift, user warned
- Slash command modification (accepted): git review is appropriate control
