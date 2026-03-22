# Architect Sidecar — Architecture Decisions

### [2026-03-16] Architecture v1.1.0 → v1.1.1: Val Validator Agent + Enhanced Agent Memory

- **Agent:** architect
- **Workflow:** edit-arch
- **Sprint:** pre-sprint
- **Type:** architectural
- **Status:** archived
- **Related:** architecture.md v1.1.1, PRD v1.1.0/v1.2.0, adversarial-review-architecture-2026-03-16.md

Counts superseded by architecture.md v1.2.1 — 26 agents, 73 workflows, 3 lifecycle skills.

**Decisions recorded:**
- ADR-012: Independent validation agent (Val) for artifact verification — mandatory opus model, 3-file Tier 1 memory, workflow engine [v] integration
- ADR-013: Memory migration from `_gaia/_memory/` to `_memory/` at project root — prerequisite for Val and enhanced memory
- ADR-014: Tiered agent memory (3 tiers by role complexity) — Tier 1 Rich (Val/Theo/Derek/Nate), Tier 2 Standard (Gaia/Zara/Soren/Sable), Tier 3 Simple (dev agents/Iris/Elara/Vera)
- ADR-015: Read-only cross-agent memory access with defined matrix — JIT loaded, budget-counted, point-in-time snapshot semantics
- ADR-016: Version-controlled agent memory — sidecars committed to git, checkpoints and archives gitignored

**Adversarial corrections (v1.1.1):**
- As-is counts corrected: 25 agents (Val is target), 68 workflows
- Lifecycle skills marked as target-state (0 exist, 3 planned)
- Non-empty sidecars acknowledged in migration plan (devops, security have content)
- Sidecar migration mapping table added
- Val model enforcement via `model_override: opus` in workflow.yaml
- Cross-ref budget capped at 50% session budget

**Cascade impact:** SIGNIFICANT — epics/stories, test plan, and traceability matrix all need updates.

### [2026-03-19] 300-Line Skill Budget Tight for 7-Section Skills

- **Agent:** architect
- **Workflow:** retro
- **Sprint:** sprint-1
- **Type:** process
- **Status:** active
- **Related:** E8-S11, E8-S10, E8-S12

300-line skill budget is tight for 7-section skills. E8-S11 (ground-truth-management, 7 sections) hit 290 lines with compressed examples. E8-S10 (5 sections) and E8-S12 (6 sections) fit comfortably. Recommendation: Architecture should target 5-6 sections per skill maximum. If a skill needs 7+, consider splitting into two skills or revisiting the 300-line limit for complex lifecycle skills.
