#!/usr/bin/env bash
# E8-S17 — Structural validation tests for Step 7 in brownfield instructions.xml
# RED phase: All tests should FAIL because Step 7 does not exist yet.

FILE="$(dirname "$0")/instructions.xml"
PASS=0
FAIL=0
ERRORS=()

count_matches() {
  local pattern="$1"
  local file="$2"
  grep -c "$pattern" "$file" 2>/dev/null || printf "0"
}

count_matches_after_line() {
  local pattern="$1"
  local file="$2"
  local start_line="$3"
  if [ "$start_line" -gt 0 ] 2>/dev/null; then
    tail -n +"$start_line" "$file" | grep -c "$pattern" 2>/dev/null || printf "0"
  else
    printf "0"
  fi
}

assert() {
  local desc="$1"
  local actual="$2"
  local expected="${3:-1}"
  if [ "$actual" -ge "$expected" ] 2>/dev/null; then
    PASS=$((PASS + 1))
    echo "  PASS: $desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc")
    echo "  FAIL: $desc"
  fi
}

echo "=== E8-S17 Structural Tests ==="
echo ""

# Locate step lines
step6_line=$(grep -n 'step n="6"' "$FILE" 2>/dev/null | head -1 | cut -d: -f1)
step6_line=${step6_line:-0}
step7_line=$(grep -n 'step n="7"' "$FILE" 2>/dev/null | head -1 | cut -d: -f1)
step7_line=${step7_line:-0}

# --- AC1: Step 7 exists after Step 6 ---
echo "[AC1] Step 7 exists and is positioned after Step 6"

assert "Step 7 XML block exists with n=\"7\"" "$(count_matches 'step n="7"' "$FILE")"
assert "Step 7 has title 'Bootstrap Val Ground Truth'" "$(count_matches 'title="Bootstrap Val Ground Truth"' "$FILE")"

if [ "$step7_line" -gt 0 ] && [ "$step6_line" -gt 0 ] && [ "$step7_line" -gt "$step6_line" ]; then
  assert "Step 7 appears after Step 6 in file" 1
else
  assert "Step 7 appears after Step 6 in file" 0
fi

step7_optional=$(grep 'step n="7"' "$FILE" 2>/dev/null | grep -c 'optional="true"' || printf "0")
assert "Step 7 is marked optional" "$step7_optional"

for i in 1 2 3 4 5 6; do
  assert "Step $i still exists" "$(count_matches "step n=\"$i\"" "$FILE")"
done

echo ""

# --- AC2: User prompt with correct text ---
echo "[AC2] User prompt for Step 7"
assert "Ask tag contains 'Bootstrap Val ground truth from brownfield assessment'" \
  "$(count_matches 'Bootstrap Val ground truth from brownfield assessment' "$FILE")"

echo ""

# --- AC3: Silent skip when Val not installed ---
echo "[AC3] Silent skip when Val not installed"
assert "Step 7 checks for validator.md existence" \
  "$(count_matches_after_line 'validator.md' "$FILE" "$step7_line")"
assert "Step 7 checks for validator-sidecar/ directory" \
  "$(count_matches_after_line 'validator-sidecar' "$FILE" "$step7_line")"

echo ""

# --- AC4: Graceful skip when refresh-ground-truth missing ---
echo "[AC4] Graceful skip when refresh-ground-truth workflow missing"
assert "Step 7 references refresh-ground-truth workflow" \
  "$(count_matches_after_line 'refresh-ground-truth' "$FILE" "$step7_line")"
assert "Step 7 has graceful skip message for missing refresh workflow" \
  "$(count_matches_after_line 'refresh-ground-truth workflow not available' "$FILE" "$step7_line")"

echo ""

# --- AC5: Invoke refresh-ground-truth ---
echo "[AC5] Invoke refresh-ground-truth sub-workflow"
assert "Step 7 has invoke-workflow for refresh-ground-truth" \
  "$(count_matches_after_line 'invoke-workflow' "$FILE" "$step7_line")"

echo ""

# --- AC6: Brownfield-specific artifact extraction ---
echo "[AC6] Brownfield-specific artifact extraction"
assert "Step 7 references brownfield-extraction skill section" \
  "$(count_matches_after_line 'brownfield-extraction' "$FILE" "$step7_line")"
assert "Step 7 reads brownfield-assessment.md" \
  "$(count_matches_after_line 'brownfield-assessment.md' "$FILE" "$step7_line")"
assert "Step 7 reads project-documentation.md" \
  "$(count_matches_after_line 'project-documentation.md' "$FILE" "$step7_line")"
assert "Step 7 reads nfr-assessment.md" \
  "$(count_matches_after_line 'nfr-assessment.md' "$FILE" "$step7_line")"

echo ""

# --- AC7: Handle missing artifacts gracefully ---
echo "[AC7] Handle missing artifacts gracefully"
assert "Step 7 has conditional checks for artifact existence" \
  "$(count_matches_after_line 'if.*exists\|if.*available\|if.*present\|skip.*missing' "$FILE" "$step7_line")"

echo ""

# --- AC8: Merge with existing ground truth ---
echo "[AC8] Merge with existing ground truth (no destructive overwrite)"
assert "Step 7 references merge semantics (not overwrite)" \
  "$(count_matches_after_line 'merge\|never.*overwrite\|additive\|flag.*removed' "$FILE" "$step7_line")"
assert "Step 7 references ground-truth.md output" \
  "$(count_matches_after_line 'ground-truth.md' "$FILE" "$step7_line")"

echo ""

# --- XML well-formedness ---
echo "[Structure] XML integrity"
close_tags=$(count_matches '</step>' "$FILE")
assert "XML has balanced step tags (7 closing tags for 7 steps)" "$close_tags" 7

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi

exit 0
