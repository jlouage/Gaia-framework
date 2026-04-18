# GAIA Framework v1.128.0-rc.1

This project uses the **GAIA** (Generative Agile Intelligence Architecture) framework for Claude Code. Framework knowledge lives in SKILL.md / agent / workflow files under `_gaia/` — not in this file (per FR-327 / ADR-048).

## Environment

- **Project root:** the directory containing `_gaia/`, `docs/`, `_memory/`, and this `CLAUDE.md`.
- **Project path:** `.` — product source lives at the repo root alongside `_gaia/`.
- **Artifacts:** `docs/planning-artifacts/`, `docs/implementation-artifacts/`, `docs/test-artifacts/`, `docs/creative-artifacts/`.
- **Memory:** `_memory/` (agent sidecars + `_memory/checkpoints/`).
- **Scope:** this is the legacy `Gaia-framework/` installer repo. The native-plugin product source lives in the sibling `gaia-public/` repo; new contributions target that tree.

## How to Start

- `/gaia` — orchestrator; routes to the right agent or workflow.
- `/gaia-help` — context-sensitive help.
- `/gaia-dev-story` — implement a user story.
- `/gaia-quick-spec` / `/gaia-quick-dev` — rapid spec + implementation for small changes.

All other framework behavior is documented in the corresponding `_gaia/**/SKILL.md`, agent, and workflow files.

## Hard Rules

- No secrets, credentials, or `.env` files in commits.
- Feature branches only — never commit directly to `main` or `staging`.
- No Claude/AI attribution in commit messages or PR descriptions. Commits read as if a human developer wrote them.
- Version bumps happen only on `main` after sprint merge — never in feature branches.
- When implementing a GAIA story, follow the `/gaia-dev-story` workflow steps exactly; do not skip Steps 13–16 (push, PR, CI, merge) when `ci_cd.promotion_chain` is set.
- Story file is the source of truth for sprint state; never write to `sprint-status.yaml` directly except via `/gaia-sprint-status`.
