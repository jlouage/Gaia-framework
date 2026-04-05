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

### Problem Framing
- [ ] Problem clearly articulated (not a symptom)
- [ ] Symptoms separated from root causes using artifact evidence
- [ ] Success criteria defined (grounded in existing acceptance criteria)

### Root Cause Analysis
- [ ] Methodology applied (5 Whys, Fishbone, TRIZ)
- [ ] Root cause identified with artifact evidence
- [ ] Causal chain documented
- [ ] Root cause validated — fixing it fixes the symptoms
- [ ] Test gap identified (what test should have caught this)

### Constraints
- [ ] Real constraints verified against ADRs and decision logs
- [ ] Assumed constraints challenged with evidence
- [ ] Contradictions identified

### Solutions
- [ ] At least 5 candidate solutions generated
- [ ] Solutions address root cause, not symptoms
- [ ] Solutions cross-checked against architecture constraints
- [ ] Feasibility/impact/effort assessed (grounded in codebase context)
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
- [ ] Test gap carried into story Dev Notes (if story created)
- [ ] Completion summary presented with next steps
