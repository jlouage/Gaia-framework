#!/usr/bin/env bash
# Test script for E9-S19: Fix Brownfield invoke-workflow Ref Mismatch
# Validates all 2 acceptance criteria.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"

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

echo "=== E9-S19 invoke-workflow Ref Mismatch Tests ==="
echo ""

# --- AC1: brownfield-onboarding invoke-workflow ref matches val-refresh-ground-truth ---
echo "AC1: brownfield-onboarding invoke-workflow ref"

BROWNFIELD_PRODUCT="$PROJECT_PATH/_gaia/lifecycle/workflows/anytime/brownfield-onboarding/instructions.xml"
BROWNFIELD_RUNNING="$PROJECT_ROOT/_gaia/lifecycle/workflows/anytime/brownfield-onboarding/instructions.xml"

# 1.1 Product source has correct ref
assert "Product source instructions.xml exists" "$([ -f "$BROWNFIELD_PRODUCT" ] && echo true || echo false)"
REF_VALUE_PRODUCT=$(grep -o 'invoke-workflow ref="[^"]*"' "$BROWNFIELD_PRODUCT" 2>/dev/null | head -1 | sed 's/invoke-workflow ref="//;s/"//')
assert "Product source ref is val-refresh-ground-truth" "$([ "$REF_VALUE_PRODUCT" = "val-refresh-ground-truth" ] && echo true || echo false)"

# 1.2 Running framework has correct ref
assert "Running framework instructions.xml exists" "$([ -f "$BROWNFIELD_RUNNING" ] && echo true || echo false)"
REF_VALUE_RUNNING=$(grep -o 'invoke-workflow ref="[^"]*"' "$BROWNFIELD_RUNNING" 2>/dev/null | head -1 | sed 's/invoke-workflow ref="//;s/"//')
assert "Running framework ref is val-refresh-ground-truth" "$([ "$REF_VALUE_RUNNING" = "val-refresh-ground-truth" ] && echo true || echo false)"

echo ""

# --- AC2: No stale invoke-workflow refs across product source ---
echo "AC2: No stale invoke-workflow refs in product source"

# Collect all invoke-workflow ref= values from product source
STALE_REFS=""
while IFS= read -r line; do
  FILE=$(echo "$line" | cut -d: -f1)
  REF=$(echo "$line" | grep -o 'ref="[^"]*"' | sed 's/ref="//;s/"//')
  if [ -n "$REF" ]; then
    # Check if a workflow.yaml with matching name exists anywhere under _gaia
    FOUND=$(find "$PROJECT_PATH/_gaia" -name "workflow.yaml" -exec grep -l "^name: $REF$" {} \; 2>/dev/null | head -1)
    if [ -z "$FOUND" ]; then
      STALE_REFS="$STALE_REFS\n  Stale ref=$REF in $FILE"
    fi
  fi
done < <(grep -rn 'invoke-workflow.*ref=' "$PROJECT_PATH/_gaia/" --include="*.xml" 2>/dev/null)

if [ -n "$STALE_REFS" ]; then
  echo "  Found stale refs:$STALE_REFS"
  assert "No stale invoke-workflow refs in product source" "false"
else
  assert "No stale invoke-workflow refs in product source" "true"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
