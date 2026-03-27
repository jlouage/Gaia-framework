---
name: document-rulesets
version: '1.0'
applicable_agents: [validator]
description: 'Document-specific validation rulesets for artifact type detection, structural quality checks per artifact type, and two-pass validation logic.'
sections: [type-detection, prd-rules, arch-rules, ux-rules, test-plan-rules, epics-rules, two-pass-logic]
---

<!-- SECTION: type-detection -->
## Artifact Type Detection

### Path-to-Ruleset Mapping

Detect the artifact type from the file path basename. Match against these patterns:

| File Pattern | Ruleset ID | Description |
|-------------|------------|-------------|
| `prd.md` | prd-rules | Product Requirements Document |
| `architecture.md` | arch-rules | Architecture Document |
| `ux-design.md` | ux-rules | UX Design Specification |
| `test-plan.md` | test-plan-rules | Test Plan |
| `epics-and-stories.md` | epics-rules | Epics and Stories |

### Detection Algorithm

1. Extract the basename from the artifact path (e.g., `docs/planning-artifacts/prd.md` -> `prd.md`)
2. Match basename against the mapping table above (case-insensitive)
3. If a match is found, return the corresponding ruleset ID
4. If no match is found, return `unknown` — skip document-specific rules, run factual claim verification only

### Edge Cases and Fallback

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
