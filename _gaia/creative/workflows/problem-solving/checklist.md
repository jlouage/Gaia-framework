# Problem Solving Checklist

## Phase 1: Intake

### Problem Intake
- [ ] Problem statement captured from user
- [ ] Urgency level classified (critical / high / medium / low)
- [ ] Domain keywords extracted and semantically expanded

### Context Gathering
- [ ] Tier 1 artifact scan completed:
  - [ ] Story files searched for keyword matches
  - [ ] Architecture doc scanned for affected components
  - [ ] PRD scanned for relevant requirements
  - [ ] Agent decision logs checked (PM, architect, SM sidecars)
  - [ ] Test artifacts checked for coverage and gaps
- [ ] Tier 2 codebase scan completed (if technical problem):
  - [ ] Source code grepped for affected routes/services/components
  - [ ] Recent git history checked for affected area
  - [ ] Related test files identified
- [ ] Context Brief synthesized within 30K token budget
- [ ] Context Brief presented to user for validation
- [ ] User confirmed or added missing context

## Phase 2: Context-Informed Analysis

### Context-Informed vs Fallback Behavior
- [ ] context_brief_available flag correctly determined from Step 2 checkpoint
- [ ] When Context Brief available: steps read context from checkpoint (not user interrogation)
- [ ] When Context Brief available: user only asked for information NOT in the Context Brief
- [ ] When Context Brief unavailable (Step 0 skipped or empty): steps fall back to interrogation-based behavior
- [ ] Fallback mode operates with no errors and no degraded experience

### Problem Framing
- [ ] Problem clearly articulated (not a symptom)
- [ ] Symptoms separated from root causes using artifact evidence (or user input in fallback mode)
- [ ] Success criteria defined (grounded in existing acceptance criteria, or user goals in fallback mode)

### Root Cause Analysis
- [ ] Methodology applied (5 Whys, Fishbone, TRIZ)
- [ ] Root cause identified with artifact evidence (or user-provided evidence in fallback mode)
- [ ] Causal chain documented
- [ ] Root cause validated — fixing it fixes the symptoms
- [ ] Test gap identified (what test should have caught this)
- [ ] `test_gaps` array populated (AC4): each entry has file_path, gap_description, suggested_test_type, severity
- [ ] `test_gaps` uses correct schema: file_path (string), gap_description (string), suggested_test_type (unit/integration/e2e), severity (critical/high/medium/low)
- [ ] `test_gaps` is empty array (not absent) when no gaps found
- [ ] `test_gaps` persisted to workflow checkpoint for downstream steps

### Constraints
- [ ] Real constraints verified against ADRs and decision logs (or user input in fallback mode)
- [ ] Assumed constraints challenged with evidence
- [ ] Contradictions identified

### Solutions
- [ ] At least 5 candidate solutions generated
- [ ] Solutions address root cause, not symptoms
- [ ] Solutions cross-checked against architecture constraints (from Context Brief or user input)
- [ ] Feasibility/impact/effort assessed (grounded in codebase context or user estimates in fallback mode)
- [ ] Rejected solutions documented with clear reasoning

## Phase 3: Resolution Routing

### Classification
- [ ] Resolution classified (quick fix / bug / critical / enhancement / systemic)
- [ ] Classification confirmed by user

### Resolution Execution
- [ ] Problem-solving artifact saved to {creative_artifacts}/
- [ ] Resolution path executed:
  - [ ] Quick fix / Bug / Critical: /gaia-create-story invoked with pre-populated context
  - [ ] Enhancement: /gaia-add-feature invoked with problem-solving artifact
  - [ ] Systemic: Problem Brief generated and escalation target identified
- [ ] Story includes origin: problem-solving and origin_ref fields (if story created)
- [ ] `test_gaps` array carried into story Dev Notes (if story created)
- [ ] Completion summary presented with next steps
