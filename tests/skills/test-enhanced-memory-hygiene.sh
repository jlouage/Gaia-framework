#!/usr/bin/env bash
# Test script for E9-S10: Enhanced Memory-Hygiene Workflow
# Validates all 8 acceptance criteria structurally.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
INSTRUCTIONS="$PROJECT_PATH/_gaia/lifecycle/workflows/anytime/memory-hygiene/instructions.xml"
CHECKLIST="$PROJECT_PATH/_gaia/lifecycle/workflows/anytime/memory-hygiene/checklist.md"
MEMORY_CONFIG="$PROJECT_ROOT/_memory/config.yaml"

PASS=0
FAIL=0

assert() {
  local desc="$1" result="$2"
  if [ "$result" = "true" ]; then
    echo "  PASS: $desc"
    ((PASS++))
  else
    echo "  FAIL: $desc"
    ((FAIL++))
  fi
}

echo "=== E9-S10 Enhanced Memory-Hygiene Workflow Tests ==="
echo ""

# --- AC1: Multi-file scanning across all tiers ---
echo "AC1: Multi-file scanning across all tiers"
assert "Instructions file exists" "$([ -f "$INSTRUCTIONS" ] && echo true || echo false)"

# Must NOT hardcode "9 sidecars" — should use dynamic discovery
if [ -f "$INSTRUCTIONS" ]; then
  if grep -q "9 \*-sidecar" "$INSTRUCTIONS" || grep -q "all 9" "$INSTRUCTIONS" || grep -q "Enumerate all 9" "$INSTRUCTIONS"; then
    assert "No hardcoded 9 sidecar count" "false"
  else
    assert "No hardcoded 9 sidecar count" "true"
  fi
else
  assert "No hardcoded 9 sidecar count" "false"
fi

# Must reference _memory/config.yaml for tier assignments
if [ -f "$INSTRUCTIONS" ] && grep -q "config.yaml" "$INSTRUCTIONS" && grep -q "tier" "$INSTRUCTIONS"; then
  assert "References config.yaml for tier assignments" "true"
else
  assert "References config.yaml for tier assignments" "false"
fi

# Must scan different file counts per tier
if [ -f "$INSTRUCTIONS" ] && grep -q "ground-truth" "$INSTRUCTIONS" && grep -q "decision-log" "$INSTRUCTIONS" && grep -q "conversation-context" "$INSTRUCTIONS"; then
  assert "References all three memory file types (ground-truth, decision-log, conversation-context)" "true"
else
  assert "References all three memory file types (ground-truth, decision-log, conversation-context)" "false"
fi

# Must exclude archive/ subdirectories
if [ -f "$INSTRUCTIONS" ] && grep -q "archive" "$INSTRUCTIONS"; then
  assert "References archive/ exclusion" "true"
else
  assert "References archive/ exclusion" "false"
fi

# --- AC2: Cross-reference validation of decision status ---
echo ""
echo "AC2: Cross-reference validation of decision status"

# Must reference standardized format with Status field
if [ -f "$INSTRUCTIONS" ] && grep -q "Status:" "$INSTRUCTIONS" || grep -q "Status: active" "$INSTRUCTIONS"; then
  assert "References Status field (active/superseded/archived)" "true"
else
  assert "References Status field (active/superseded/archived)" "false"
fi

# Must flag STALE for references to superseded/archived
if [ -f "$INSTRUCTIONS" ] && grep -q "STALE" "$INSTRUCTIONS" && grep -q "superseded" "$INSTRUCTIONS"; then
  assert "Flags STALE for references to superseded/archived decisions" "true"
else
  assert "Flags STALE for references to superseded/archived decisions" "false"
fi

# Must flag UNVERIFIABLE-FORMAT for pre-standard entries
if [ -f "$INSTRUCTIONS" ] && grep -q "UNVERIFIABLE-FORMAT" "$INSTRUCTIONS"; then
  assert "Includes UNVERIFIABLE-FORMAT classification" "true"
else
  assert "Includes UNVERIFIABLE-FORMAT classification" "false"
fi

# Must reference cross-reference matrix from config
if [ -f "$INSTRUCTIONS" ] && grep -q "cross_references\|cross-reference matrix\|cross.reference" "$INSTRUCTIONS"; then
  assert "References cross-reference matrix from config" "true"
else
  assert "References cross-reference matrix from config" "false"
fi

# --- AC3: Token budget reporting per agent ---
echo ""
echo "AC3: Token budget reporting per agent"

# Must include token budget table concept
if [ -f "$INSTRUCTIONS" ] && grep -q "Token Budget\|token budget\|budget.*table\|Budget Table" "$INSTRUCTIONS"; then
  assert "Includes Token Budget Table section" "true"
else
  assert "Includes Token Budget Table section" "false"
fi

# Must reference budget thresholds (80/90/100%)
if [ -f "$INSTRUCTIONS" ] && grep -q "80%\|90%\|100%" "$INSTRUCTIONS"; then
  assert "References budget threshold percentages (80/90/100%)" "true"
else
  assert "References budget threshold percentages (80/90/100%)" "false"
fi

# Must reference chars-per-token approximation
if [ -f "$INSTRUCTIONS" ] && grep -q "4 char\|chars.per.token\|token_approximation\|file.size.*4\|bytes.*4" "$INSTRUCTIONS"; then
  assert "References 4 chars-per-token approximation" "true"
else
  assert "References 4 chars-per-token approximation" "false"
fi

# --- AC4: Archival recommendations ---
echo ""
echo "AC4: Archival recommendations based on staleness, age, and budget pressure"

# Must include archival recommendations section
if [ -f "$INSTRUCTIONS" ] && grep -qi "archival recommendation" "$INSTRUCTIONS"; then
  assert "Includes archival recommendations" "true"
else
  assert "Includes archival recommendations" "false"
fi

# Must reference age-based detection (3 sprints / 42 days)
if [ -f "$INSTRUCTIONS" ] && grep -q "3 sprint\|42.*day\|42 calendar" "$INSTRUCTIONS"; then
  assert "References age-based staleness (3 sprints / 42 days)" "true"
else
  assert "References age-based staleness (3 sprints / 42 days)" "false"
fi

# Must never auto-execute archival
if [ -f "$INSTRUCTIONS" ] && grep -qi "user confirmation\|never auto-execute\|requires.*confirmation" "$INSTRUCTIONS"; then
  assert "Archival requires user confirmation" "true"
else
  assert "Archival requires user confirmation" "false"
fi

# --- AC5: Ground truth refresh trigger ---
echo ""
echo "AC5: Ground truth refresh trigger for stale Tier 1 agents"

# Must reference /gaia-refresh-ground-truth
if [ -f "$INSTRUCTIONS" ] && grep -q "gaia-refresh-ground-truth" "$INSTRUCTIONS"; then
  assert "References /gaia-refresh-ground-truth command" "true"
else
  assert "References /gaia-refresh-ground-truth command" "false"
fi

# Must check Sprint field gap > 1 sprint
if [ -f "$INSTRUCTIONS" ] && grep -q "Sprint.*field\|sprint.*gap\|more than 1 sprint" "$INSTRUCTIONS"; then
  assert "Checks Sprint field gap for staleness" "true"
else
  assert "Checks Sprint field gap for staleness" "false"
fi

# Must limit to Tier 1 agents only
if [ -f "$INSTRUCTIONS" ] && grep -q "Tier 1.*ground.truth\|ground.truth.*Tier 1\|tier_1.*ground" "$INSTRUCTIONS"; then
  assert "Ground truth refresh limited to Tier 1 agents" "true"
else
  assert "Ground truth refresh limited to Tier 1 agents" "false"
fi

# --- AC6: Stale detection uses memory-management skill ---
echo ""
echo "AC6: Stale detection uses memory-management skill section"

# Must reference the stale-detection skill section
if [ -f "$INSTRUCTIONS" ] && grep -q "stale-detection" "$INSTRUCTIONS" && grep -q "memory-management" "$INSTRUCTIONS"; then
  assert "References stale-detection section from memory-management skill" "true"
else
  assert "References stale-detection section from memory-management skill" "false"
fi

# Must NOT have inline reimplementation of stale detection categories
# Check that the old inline logic (from original step 3/4 with hardcoded sidecar-specific rules) is gone
if [ -f "$INSTRUCTIONS" ] && grep -q "architect-sidecar:.*Compare each entry against architecture.md ADR" "$INSTRUCTIONS"; then
  assert "No inline reimplementation of stale detection (old sidecar-specific rules removed)" "false"
else
  assert "No inline reimplementation of stale detection (old sidecar-specific rules removed)" "true"
fi

# --- AC7: Untiered agent handling ---
echo ""
echo "AC7: Untiered agent handling"

# Must reference untiered agents
if [ -f "$INSTRUCTIONS" ] && grep -qi "untiered" "$INSTRUCTIONS"; then
  assert "References untiered agents" "true"
else
  assert "References untiered agents" "false"
fi

# Must recommend adding untiered agents to config
if [ -f "$INSTRUCTIONS" ] && grep -qi "untiered.*config\|add.*tier\|recommend.*config" "$INSTRUCTIONS"; then
  assert "Recommends adding untiered agents to config" "true"
else
  assert "Recommends adding untiered agents to config" "false"
fi

# --- AC8: Enhanced report output structure ---
echo ""
echo "AC8: Enhanced report output structure"

# Must include all 7 report sections
REPORT_SECTIONS=("Summary" "Token Budget Table" "Detailed Findings" "Archival Recommendations" "Ground Truth Refresh" "Untiered Agent" "Skipped Sidecars")
for section in "${REPORT_SECTIONS[@]}"; do
  if [ -f "$INSTRUCTIONS" ] && grep -qi "$section" "$INSTRUCTIONS"; then
    assert "Report includes section: $section" "true"
  else
    assert "Report includes section: $section" "false"
  fi
done

# --- Checklist validation ---
echo ""
echo "Checklist: Updated for new ACs"

assert "Checklist file exists" "$([ -f "$CHECKLIST" ] && echo true || echo false)"

# Checklist should NOT reference "9 sidecars"
if [ -f "$CHECKLIST" ] && grep -q "All 9 sidecar\|all 9 sidecar" "$CHECKLIST"; then
  assert "Checklist does not reference 9 sidecars" "false"
else
  assert "Checklist does not reference 9 sidecars" "true"
fi

# Checklist should reference token budget
if [ -f "$CHECKLIST" ] && grep -qi "token budget" "$CHECKLIST"; then
  assert "Checklist includes token budget validation" "true"
else
  assert "Checklist includes token budget validation" "false"
fi

# Checklist should reference archival recommendations
if [ -f "$CHECKLIST" ] && grep -qi "archival" "$CHECKLIST"; then
  assert "Checklist includes archival recommendation validation" "true"
else
  assert "Checklist includes archival recommendation validation" "false"
fi

# Checklist should reference ground truth refresh
if [ -f "$CHECKLIST" ] && grep -qi "ground truth" "$CHECKLIST"; then
  assert "Checklist includes ground truth refresh validation" "true"
else
  assert "Checklist includes ground truth refresh validation" "false"
fi

# Checklist should reference untiered agents
if [ -f "$CHECKLIST" ] && grep -qi "untiered" "$CHECKLIST"; then
  assert "Checklist includes untiered agent validation" "true"
else
  assert "Checklist includes untiered agent validation" "false"
fi

# Checklist should reference cross-reference validation
if [ -f "$CHECKLIST" ] && grep -qi "cross-reference\|cross reference" "$CHECKLIST"; then
  assert "Checklist includes cross-reference validation" "true"
else
  assert "Checklist includes cross-reference validation" "false"
fi

# Checklist should reference stale-detection skill usage
if [ -f "$CHECKLIST" ] && grep -qi "stale-detection\|memory-management skill" "$CHECKLIST"; then
  assert "Checklist includes stale-detection skill validation" "true"
else
  assert "Checklist includes stale-detection skill validation" "false"
fi

# --- Summary ---
echo ""
echo "========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================="

exit $FAIL
