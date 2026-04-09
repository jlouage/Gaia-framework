# Test Gap Analysis Checklist

## Coverage Mode
- [ ] Execution mode determined (coverage or verification)
- [ ] Test plan scanned for test case IDs and story links
- [ ] Story files scanned for acceptance criteria
- [ ] Cross-reference completed — gaps identified
- [ ] Output follows FR-223 schema (summary count, per-story table, coverage %)
- [ ] Zero-gap case handled with "No coverage gaps detected" message
- [ ] Workflow completed within NFR-040 performance constraint (< 60 seconds)

## Verification Mode (FR-222, FR-226)
- [ ] Generated test cases scanned from docs/test-artifacts/
- [ ] Execution results detected: JUnit XML, LCOV, or E17 evidence JSON
- [ ] Cross-reference generated vs executed test cases completed
- [ ] Per-story generated-vs-executed count included in output
- [ ] Aggregate generated-vs-executed count included in output
- [ ] Stories with zero executed tests flagged as HIGH priority gaps
- [ ] Graceful degradation when no execution results — warning logged, fallback to coverage mode
- [ ] Workflow completed within NFR-040 performance constraint (< 60 seconds)
