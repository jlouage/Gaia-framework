# Architecture Decision Log — Theo (System Architect)

### [2026-03-20] Architecture v1.1.1 → v1.2.1 Document Accuracy Update

- **Agent:** architect
- **Workflow:** edit-arch
- **Sprint:** sprint-2
- **Type:** architectural
- **Status:** active
- **Related:** docs/planning-artifacts/architecture.md, ADR-012, ADR-013, ADR-014, ADR-015, ADR-016

Resolved 13 Val validation findings: updated counts (26 agents, 73 workflows, 117 commands, 11 skills, 897 LOC installer), reclassified Val (ADR-012) and memory system (ADR-013–016) from Proposed/Gap to Active/Implemented. Adversarial review identified 7 additional corrections (sidecar count 27→26, 9 untiered agents, module version drift, file count 343→457, manifest count 18→9). No new ADRs — document accuracy only, zero cascade impact.

### [2026-03-20] Dual _gaia/ Directory Pattern Causes Friction

- **Agent:** architect
- **Workflow:** retro
- **Sprint:** sprint-2
- **Type:** process
- **Status:** active
- **Related:** E9-S1

Every framework file change requires manual copy between {project-root}/_gaia/ and {project-path}/_gaia/. Recommendation: Resolve in E9-S1 — either symlink or test path resolution change.

### [2026-03-20] Val Workflows Built Before JIT Skills Exist

- **Agent:** architect
- **Workflow:** retro
- **Sprint:** sprint-2
- **Type:** process
- **Status:** archived
- **Related:** E8-S10, E8-S11, E8-S12

~~Val workflows built before their JIT skills exist.~~ **ARCHIVED 2026-03-22:** Resolved — E8-S10, E8-S11, E8-S12 all implemented and done. Val lifecycle skills fully operational.

### [2026-03-20] Version String Duplication Across 6+ Files

- **Agent:** architect
- **Workflow:** retro
- **Sprint:** sprint-2
- **Type:** process
- **Status:** active
- **Related:** package.json, global.yaml, gaia-install.sh, CLAUDE.md, README.md, manifest.yaml

Version string duplication across 6+ files is error-prone. package.json, global.yaml, gaia-install.sh, CLAUDE.md (x2), README.md, manifest.yaml, module config.yaml all carry version numbers. Multiple stories showed version drift. Recommendation: Consider a single VERSION file or automated sync script.

### [2026-03-22] Dual Directory Problem — 3-Sprint Systemic Issue

- **Agent:** architect
- **Workflow:** retro
- **Sprint:** sprint-3
- **Type:** process
- **Status:** active
- **Related:** E9-S1, E8-S17, E8-S18

Dual directory problem now 3-sprint systemic issue. E8-S17 required "both source and running copies kept in sync." E8-S18 modified files across both trees. E9-S1 was sprint-2 A1 High priority but not included in sprint-3. Recommendation: E9-S1 must be sprint-4 priority #1 — this is the longest-standing unresolved systemic issue.

### [2026-03-22] Version Drift Confirmed in Sprint-3 Code Review

- **Agent:** architect
- **Workflow:** retro
- **Sprint:** sprint-3
- **Type:** process
- **Status:** active
- **Related:** E8-S17, manifest.yaml, lifecycle/config.yaml

Version drift confirmed in sprint-3 code review. E8-S17 review found manifest.yaml lifecycle version (1.27.0) differs from lifecycle/config.yaml module_version (1.25.0). Sprint-2 A3 action item still unaddressed. Recommendation: Include version sync mechanism in sprint-4 scope alongside E9-S1.
