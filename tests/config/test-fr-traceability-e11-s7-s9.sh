#!/usr/bin/env bash
# File: tests/config/test-fr-traceability-e11-s7-s9.sh
# ATDD — E11-S13: Fix FR Traceability Misalignment in E11-S7 through E11-S9
# Run: bash tests/config/test-fr-traceability-e11-s7-s9.sh

set -euo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
EPICS_FILE="${PROJECT_ROOT}/docs/planning-artifacts/epics-and-stories.md"
ARCH_FILE="${PROJECT_ROOT}/docs/planning-artifacts/architecture.md"
S7_STORY="${PROJECT_ROOT}/docs/implementation-artifacts/E11-S7-implement-doc-vs-code-verifier.md"
S8_STORY="${PROJECT_ROOT}/docs/implementation-artifacts/E11-S8-implement-integration-seam-analyzer.md"
S9_STORY="${PROJECT_ROOT}/docs/implementation-artifacts/E11-S9-implement-test-execution-during-discovery.md"

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
    echo "  FAIL: $desc (pattern '$pattern' not found in $file)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local desc="$1" file="$2" pattern="$3"
  TOTAL=$((TOTAL + 1))
  if ! grep -q "$pattern" "$file"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (pattern '$pattern' should NOT be in $file but was found)"
    FAIL=$((FAIL + 1))
  fi
}

assert_section_contains() {
  local desc="$1" file="$2" section_start="$3" section_end="$4" pattern="$5"
  TOTAL=$((TOTAL + 1))
  local section_text
  section_text=$(sed -n "/${section_start}/,/${section_end}/p" "$file")
  if echo "$section_text" | grep -q "$pattern"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (pattern '$pattern' not found in section '$section_start')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== E11-S13: FR Traceability Verification ==="
echo ""

# --- AC1: E11-S7 in epics-and-stories.md should reference FR-113 (not FR-108) ---
echo "AC1: E11-S7 traces to FR-113 in epics-and-stories.md"
assert_section_contains \
  "E11-S7 Dev Notes references FR-113" \
  "$EPICS_FILE" \
  "### Story E11-S7" \
  "### Story E11-S8" \
  "FR-113"

# Verify FR-108 is NOT in E11-S7 Dev Notes (the old wrong reference)
# We check that within E11-S7's section, the Traces to line does NOT have FR-108
S7_TRACES=$(sed -n '/### Story E11-S7/,/### Story E11-S8/p' "$EPICS_FILE" | grep "Traces to:")
TOTAL=$((TOTAL + 1))
if echo "$S7_TRACES" | grep -q "FR-108"; then
  echo "  FAIL: AC1 — E11-S7 still references FR-108 (should be FR-113)"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: AC1 — E11-S7 does NOT reference old FR-108"
  PASS=$((PASS + 1))
fi

# --- AC2: E11-S8 in epics-and-stories.md should reference FR-114 (not FR-109) ---
echo ""
echo "AC2: E11-S8 traces to FR-114 in epics-and-stories.md"
assert_section_contains \
  "E11-S8 Dev Notes references FR-114" \
  "$EPICS_FILE" \
  "### Story E11-S8" \
  "### Story E11-S9" \
  "FR-114"

# Verify FR-109 is NOT in E11-S8 Dev Notes
S8_TRACES=$(sed -n '/### Story E11-S8/,/### Story E11-S9/p' "$EPICS_FILE" | grep "Traces to:")
TOTAL=$((TOTAL + 1))
if echo "$S8_TRACES" | grep -q "FR-109"; then
  echo "  FAIL: AC2 — E11-S8 still references FR-109 (should be FR-114)"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: AC2 — E11-S8 does NOT reference old FR-109"
  PASS=$((PASS + 1))
fi

# --- AC3: E11-S9 FR conflict investigated and documented ---
echo ""
echo "AC3: E11-S9 FR-110 conflict documented"
assert_section_contains \
  "E11-S9 Dev Notes has FR-110 conflict note" \
  "$EPICS_FILE" \
  "### Story E11-S9" \
  "### Story E11-S10" \
  "FR-110.*reconcil\|reconcil.*FR-110\|PRD.*architecture.*FR-110\|FR-110.*PRD"

# --- AC4: E11-S7 story file and epics are consistent (both FR-113) ---
echo ""
echo "AC4: E11-S7 consistency between story file and epics"
assert_contains \
  "E11-S7 story file has FR-113 in traces_to" \
  "$S7_STORY" \
  "FR-113"

# --- AC5: E11-S8 story file and epics are consistent (both FR-114) ---
echo ""
echo "AC5: E11-S8 consistency between story file and epics"
assert_contains \
  "E11-S8 story file has FR-114 in traces_to" \
  "$S8_STORY" \
  "FR-114"

# --- AC6: E11-S9 story file and epics are consistent ---
echo ""
echo "AC6: E11-S9 consistency between story file and epics"
# Both should reference FR-110
assert_contains \
  "E11-S9 story file has FR-110" \
  "$S9_STORY" \
  "FR-110"
assert_section_contains \
  "E11-S9 epics has FR-110" \
  "$EPICS_FILE" \
  "### Story E11-S9" \
  "### Story E11-S10" \
  "FR-110"

# --- AC7: No FR misalignment — E11-S7/S8/S9 traces_to in epics match architecture ---
echo ""
echo "AC7: Architecture alignment verification"
# E11-S7 should reference FR-113 (Doc-code mismatch) — verify it exists in architecture
assert_contains \
  "Architecture FR table has FR-113 (Doc-code mismatch)" \
  "$ARCH_FILE" \
  "FR-113.*Documentation-code mismatch"

# E11-S8 should reference FR-114 (Integration seam) — verify it exists in architecture
assert_contains \
  "Architecture FR table has FR-114 (Integration seam)" \
  "$ARCH_FILE" \
  "FR-114.*Integration seam"

# --- Regression: Verify other E11 stories not affected ---
echo ""
echo "Regression: Other E11 stories unchanged"
# E11-S1 through E11-S6 and E11-S10 through E11-S12 should not be modified
# We just verify they still exist and have Traces to lines
for story_num in 1 2 3 4 5 6 10; do
  TOTAL=$((TOTAL + 1))
  if sed -n "/### Story E11-S${story_num}[^0-9]/,/### Story E11-S/p" "$EPICS_FILE" | grep -q "Traces to:"; then
    echo "  PASS: E11-S${story_num} still has Traces to line"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: E11-S${story_num} Traces to line missing or story not found"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
