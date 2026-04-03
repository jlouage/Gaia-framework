#!/usr/bin/env bash
# File: tests/config/test-stakeholder-discoverability-hint.sh
# Tier 2 — E15-S5: Discoverability Hint (STK-30, STK-31, STK-32)
# Verifies that the Party Mode Step 1 file contains the correct
# conditional discoverability hint for stakeholder personas (FR-162).
# Run: bash tests/config/test-stakeholder-discoverability-hint.sh

set -euo pipefail

STEP_FILE="$(cd "$(dirname "$0")/../.." && pwd)/_gaia/core/workflows/party-mode/steps/step-01-agent-loading.md"
ARCH_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/docs/planning-artifacts/architecture.md"

PASS=0
FAIL=0
TOTAL=0

assert_contains() {
  local desc="$1" file="$2" pattern="$3"
  TOTAL=$((TOTAL + 1))
  if grep -q "$pattern" "$file"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (pattern not found in $(basename "$file"))"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== E15-S5: Discoverability Hint Verification (STK-30, STK-31, STK-32) ==="
echo ""

# --- STK-30: No custom/stakeholders/ directory — hint must be present ---
echo "STK-30: Step file contains hint for missing stakeholders directory"

assert_contains \
  "Hint text references missing or empty directory condition" \
  "$STEP_FILE" \
  'If `custom/stakeholders/` does not exist or is empty'

assert_contains \
  "Hint text matches FR-162 specification exactly" \
  "$STEP_FILE" \
  'Tip: Create stakeholder personas with `/gaia-create-stakeholder` to invite domain experts to discussions.'

assert_contains \
  "Hint references FR-162" \
  "$STEP_FILE" \
  'FR-162'

# --- STK-31: Empty custom/stakeholders/ directory — same hint ---
echo ""
echo "STK-31: Hint covers both missing AND empty directory cases"

# The single conditional covers both cases: "does not exist or is empty"
TOTAL=$((TOTAL + 1))
CONDITION_LINE=$(grep -n 'does not exist or is empty' "$STEP_FILE" || true)
if [[ -n "$CONDITION_LINE" ]]; then
  echo "  PASS: Condition covers both missing and empty directory in a single check"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Expected combined condition for missing/empty directory"
  FAIL=$((FAIL + 1))
fi

# --- STK-32: Hint is conditional — only shown when zero stakeholders ---
echo ""
echo "STK-32: Hint is conditional (not unconditionally displayed)"

# Verify the hint is inside Source 2 (Stakeholder Discovery) section,
# meaning it fires only during stakeholder discovery, not globally
TOTAL=$((TOTAL + 1))
IN_SOURCE2=$(sed -n '/## Source 2: Stakeholder Discovery/,/## /p' "$STEP_FILE" | grep -c 'Tip: Create stakeholder personas' || true)
if [[ "$IN_SOURCE2" -ge 1 ]]; then
  echo "  PASS: Hint is scoped to Source 2 (Stakeholder Discovery) section"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Hint not found within Source 2 section"
  FAIL=$((FAIL + 1))
fi

# Verify hint does NOT appear in the Invitation Options section
# (it should not block the flow — AC4)
TOTAL=$((TOTAL + 1))
IN_INVITE=$(sed -n '/## Invitation Options/,/## /p' "$STEP_FILE" | grep -c 'Tip: Create stakeholder personas' || true)
if [[ "$IN_INVITE" -eq 0 ]]; then
  echo "  PASS: Hint does NOT appear in Invitation Options (non-blocking)"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Hint found in Invitation Options section — should only be in discovery"
  FAIL=$((FAIL + 1))
fi

# --- Architecture alignment ---
echo ""
echo "Architecture alignment: FR-162 hint text matches architecture spec"

assert_contains \
  "Architecture section 10.18.2 defines FR-162 discoverability hint" \
  "$ARCH_FILE" \
  'Discoverability hint (FR-162)'

# Verify architecture hint text matches step file hint text
TOTAL=$((TOTAL + 1))
ARCH_HINT=$(grep 'FR-162' "$ARCH_FILE" | grep -o 'Tip: Create stakeholder personas.*discussions\.' || true)
STEP_HINT=$(grep 'FR-162' "$STEP_FILE" | grep -o 'Tip: Create stakeholder personas.*discussions\.' || true)
if [[ -n "$ARCH_HINT" && "$ARCH_HINT" == "$STEP_HINT" ]]; then
  echo "  PASS: Hint text in step file matches architecture specification exactly"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Hint text mismatch between step file and architecture"
  echo "    Architecture: $ARCH_HINT"
  echo "    Step file:    $STEP_HINT"
  FAIL=$((FAIL + 1))
fi

# --- Regression: Invitation options still present ---
echo ""
echo "Regression: All invitation options preserved"

for option in "Option A" "Option B" "Option C" "Option D" "Option E"; do
  assert_contains \
    "$option still present in Invitation Options" \
    "$STEP_FILE" \
    "$option"
done

echo ""
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
