---
name: document-rulesets
version: '1.1'
applicable_agents: [validator]
description: 'Document-specific validation rulesets for artifact type detection (path and frontmatter), structural quality checks per artifact type (application, infrastructure, platform PRDs), and two-pass validation logic.'
sections: [type-detection, prd-rules, infra-prd-rules, platform-prd-rules, arch-rules, ux-rules, test-plan-rules, epics-rules, two-pass-logic]
---

<!-- SECTION: type-detection -->
## Artifact Type Detection

### Frontmatter-Based Detection (Higher Priority)

Check frontmatter first before falling back to filename detection. If the artifact has YAML frontmatter with a `template` field, use the frontmatter mapping table below. Frontmatter detection takes higher priority than filename detection because it is explicit and unambiguous.

| Frontmatter `template` Value | Ruleset ID(s) | Description |
|------------------------------|---------------|-------------|
| `'prd'` | prd-rules | Application Product Requirements Document |
| `'infra-prd'` | infra-prd-rules | Infrastructure PRD |
| `'platform-prd'` | prd-rules + infra-prd-rules | Platform PRD (both rulesets applied) |

### Frontmatter Detection Algorithm

1. Parse the artifact's YAML frontmatter (content between opening `---` and closing `---`)
2. Check for a `template` field in the frontmatter
3. If `template` field exists, match against the frontmatter mapping table above
4. If a match is found, return the corresponding ruleset ID(s). For `'platform-prd'`, return both `prd-rules` and `infra-prd-rules` — both rulesets are applied sequentially
5. If `template` field is absent or does not match, fall through to path-based detection below

### Path-to-Ruleset Mapping (Fallback)

If no frontmatter match is found, detect the artifact type from the file path basename. Match against these patterns:

| File Pattern | Ruleset ID | Description |
|-------------|------------|-------------|
| `prd.md` | prd-rules | Product Requirements Document |
| `architecture.md` | arch-rules | Architecture Document |
| `ux-design.md` | ux-rules | UX Design Specification |
| `test-plan.md` | test-plan-rules | Test Plan |
| `epics-and-stories.md` | epics-rules | Epics and Stories |

### Path-Based Detection Algorithm

1. Extract the basename from the artifact path (e.g., `docs/planning-artifacts/prd.md` -> `prd.md`)
2. Match basename against the mapping table above (case-insensitive)
3. If a match is found, return the corresponding ruleset ID
4. If no match is found, return `unknown` — skip document-specific rules, run factual claim verification only

### Edge Cases and Fallback

- **Frontmatter takes priority**: If both frontmatter and filename match, frontmatter wins
- **Nested directories**: Only the basename matters — `any/nested/path/prd.md` still matches prd-rules
- **Custom paths**: Files with non-standard names (e.g., `custom-doc.md`) fall back to unknown/unrecognized type
- **Case sensitivity**: Match is case-insensitive (`PRD.md` and `prd.md` both match prd-rules)
- **Fallback**: When no ruleset matches, skip structural pass entirely and proceed to factual claims only
<!-- END SECTION -->

<!-- SECTION: prd-rules -->
## PRD Validation Rules

Structural quality checks for Product Requirements Documents. This ruleset absorbs and supersedes all checks from the standalone validate-prd workflow, enabling its deprecation.

### Section Completeness Check

Verify all required PRD sections exist: overview, personas, functional requirements, non-functional requirements, user journeys, data model, integrations, constraints, success criteria. Flag missing sections as CRITICAL.

### FR/NFR Sequential Numbering

Verify functional requirements use sequential numbering (FR-001, FR-002, ...). Verify non-functional requirements use sequential numbering (NFR-001, NFR-002, ...). Flag gaps or duplicates as WARNING.

### Acceptance Criteria Quality

For each requirement, verify acceptance criteria exist, are specific (not blank or generic), are testable, unambiguous, and measurable. Flag vague criteria (e.g., "fast", "easy to use" without quantification) as WARNING.

### Priority Consistency

Verify every requirement has a priority assigned (P0/P1/P2/P3 or Must/Should/Could/Won't). Check that priorities do not contradict across related requirements. Flag missing or contradictory priorities as WARNING.

### Persona Cross-Reference

Verify user personas referenced in requirements match personas defined in the personas section. Flag orphaned persona references (used but not defined) as WARNING.

### Quality and Consistency

Verify terminology is used consistently across sections. Cross-reference all sections for contradictions. Flag inconsistencies as WARNING.
<!-- END SECTION -->

<!-- SECTION: infra-prd-rules -->
## Infra PRD Validation Rules

Structural quality checks for Infrastructure Product Requirements Documents. This ruleset validates infra PRDs per ADR-022 section 10.16.7 (FR-126).

### Section Presence Check

Verify all 13 required infrastructure PRD sections exist and are non-empty. Flag missing sections as CRITICAL.

Required sections:
1. Overview & Scope
2. Goals and Non-Goals
3. Platform Capabilities
4. Resource Specifications
5. Operational SLOs
6. Security Posture
7. Environment Strategy & Developer Experience
8. Dependencies & Provider Constraints
9. Cost Model
10. Verification Strategy
11. Operational Runbooks
12. Requirements Summary
13. Open Questions

### IR/OR/SR ID Uniqueness

Verify requirement IDs use the infrastructure ID scheme (IR-###, OR-###, SR-###). Check ID uniqueness within each prefix family — no duplicate IR-001 entries, no duplicate OR-001 entries, no duplicate SR-001 entries. Flag duplicate IDs as WARNING.

### Security Posture Non-Empty

The Security Posture section is mandatory and must be non-empty for all infrastructure PRDs. An empty or placeholder-only Security Posture section is a CRITICAL finding. This section must contain substantive content covering IAM/RBAC, network segmentation, secrets management, or compliance mapping.

### Cost Model Per-Environment Estimates

The Cost Model section must include per-environment cost estimates. At minimum, dev, staging, and prod environments must have cost projections. Flag missing per-environment estimates as WARNING.

### Verification Strategy Policy-as-Code Reference

The Verification Strategy section must reference at least one policy-as-code tool. Recognized tools include: OPA, Rego, Checkov, tfsec, Sentinel, or equivalent. Flag missing policy-as-code references as WARNING.

### Platform Capabilities Format Validation

Each entry in the Platform Capabilities section must follow the format: "Enable {team/service} to {capability} with {SLO}". Entries that do not match this pattern should be flagged as WARNING with a suggestion to reformat.
<!-- END SECTION -->

<!-- SECTION: platform-prd-rules -->
## Platform PRD Validation Rules

Platform PRDs represent hybrid projects that combine application and infrastructure concerns. A platform PRD must pass both the `prd-rules` (application) and `infra-prd-rules` (infrastructure) validation rulesets.

### Composite Validation

When validating a platform PRD (detected via `template: 'platform-prd'` in frontmatter):
1. Run all checks from `prd-rules` — application structural rules apply
2. Run all checks from `infra-prd-rules` — infrastructure structural rules apply
3. Merge findings from both rulesets into a single report

### Dual ID Scheme Validation

Platform PRDs use both application and infrastructure requirement ID schemes:
- Application requirements: FR-### (functional) and NFR-### (non-functional)
- Infrastructure requirements: IR-### (infrastructure), OR-### (operational), SR-### (security)

Both ID namespaces must be validated for uniqueness within their respective prefix families. No collisions between FR-001 and IR-001 because the prefix disambiguates.
<!-- END SECTION -->

<!-- SECTION: arch-rules -->
## Architecture Validation Rules

Structural quality checks for Architecture Documents.

### Component Coverage

Verify all system components mentioned in the system overview are covered in the detailed component descriptions. Check that the C4 diagrams (context, container, component) reference all declared components. Flag undocumented components as WARNING.

### ADR Consistency

Verify each ADR has: ID, Decision, Rationale, Status. Check ADR IDs are sequential (ADR-001, ADR-002, ...). Verify ADR status values are valid (Proposed, Active, Deprecated, Superseded). Check cross-references between ADRs and component descriptions are bidirectional. Flag inconsistencies as WARNING.

### API Completeness

Verify each declared API endpoint has: method, path, request/response schema, error codes. Check that APIs referenced in component descriptions exist in the API specification section. Flag incomplete API definitions as WARNING.
<!-- END SECTION -->

<!-- SECTION: ux-rules -->
## UX Design Validation Rules

Structural quality checks for UX Design Specifications.

### Required Sections

Verify presence of: design principles, user flows, wireframes/mockups, component library, accessibility requirements, responsive breakpoints. Flag missing sections as WARNING.

### Flow Completeness

Verify each user flow has: entry point, steps, decision points, exit conditions. Check that flows reference defined screens/components. Flag incomplete flows as WARNING.

### Accessibility

Verify WCAG compliance requirements are stated. Check color contrast ratios are specified. Verify keyboard navigation patterns are defined. Flag missing accessibility considerations as WARNING.
<!-- END SECTION -->

<!-- SECTION: test-plan-rules -->
## Test Plan Validation Rules

Structural quality checks for Test Plans.

### Required Sections

Verify presence of: test strategy, test scope, test types (unit, integration, e2e), entry/exit criteria, test environment, risk assessment. Flag missing sections as WARNING.

### Coverage Mapping

Verify each functional requirement has at least one mapped test case. Check that test case IDs are unique and sequential. Verify traceability links between requirements and test cases. Flag unmapped requirements as WARNING.

### Environment Specification

Verify test environments are fully specified (OS, browser, device matrix). Check that CI/CD integration is described. Flag underspecified environments as WARNING.
<!-- END SECTION -->

<!-- SECTION: epics-rules -->
## Epics and Stories Validation Rules

Structural quality checks for Epics and Stories documents.

### Epic Structure

Verify each epic has: ID, title, description, acceptance criteria, priority, stories list. Check epic IDs are sequential (E1, E2, ...). Flag incomplete epics as WARNING.

### Story Structure

Verify each story has: key, title, user story (As a/I want/So that), acceptance criteria, tasks, size estimate. Check story keys follow convention ({epic}-S{n}). Flag incomplete stories as WARNING.

### Dependency Consistency

Verify all `depends_on` and `blocks` references point to existing stories. Check for circular dependencies. Verify priority ordering respects dependency chains. Flag broken references as WARNING.
<!-- END SECTION -->

<!-- SECTION: two-pass-logic -->
## Two-Pass Validation Logic

### Pass Ordering

Document-specific validation uses a two-pass approach:

1. **Pass 1 — Structural Rules**: Run the document-specific ruleset matched by type detection. This checks internal document quality: section completeness, numbering, cross-references within the document itself. Produces structural findings.

2. **Pass 2 — Factual Claims**: Run the standard factual claim extraction and filesystem verification (from validation-patterns skill). This checks external accuracy: file paths exist, counts match reality, references resolve. Produces factual findings.

### Merge Strategy

After both passes complete, merge findings into a single report:
- Structural findings are tagged with source `[STRUCTURAL]`
- Factual findings are tagged with source `[FACTUAL]`
- Both use the same severity classification (CRITICAL/WARNING/INFO)
- Findings are grouped by severity, then by source (structural first within each group)

### Unknown Type Handling

When the artifact type is unknown (no matching ruleset):
- Skip Pass 1 entirely — no structural rules to apply
- Run Pass 2 only — factual claim verification
- Report notes: "No document-specific ruleset for this artifact type — factual verification only"
<!-- END SECTION -->
