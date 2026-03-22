#!/usr/bin/env bash
# Test script for E9-S3: Standardized Decision-Log Entry Format
# Validates all 6 acceptance criteria.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
SKILL_FILE="$PROJECT_PATH/_gaia/lifecycle/skills/memory-management.md"
MEMORY_PATH="$PROJECT_PATH/_memory"
ARCH_FILE="$PROJECT_ROOT/docs/planning-artifacts/architecture.md"

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

echo "=== E9-S3 Standardized Decision-Log Entry Format Tests ==="
echo ""

# --- AC1: Canonical entry format in decision-formatting section ---
echo "AC1: decision-formatting section contains canonical format"
DF_SECTION=$(sed -n '/<!-- SECTION: decision-formatting -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)

# Check header format
if echo "$DF_SECTION" | grep -q '### \[YYYY-MM-DD\]'; then
  assert "Header format ### [YYYY-MM-DD] {Title} present" "true"
else
  assert "Header format ### [YYYY-MM-DD] {Title} present" "false"
fi

# Check required metadata fields
for field in "Agent" "Workflow" "Sprint" "Type" "Status" "Related"; do
  if echo "$DF_SECTION" | grep -q "\*\*$field:\*\*"; then
    assert "Required field '$field' in template" "true"
  else
    assert "Required field '$field' in template" "false"
  fi
done

# Check status enum uses 'archived' (not 'revoked') — ADR-014 resolution
if echo "$DF_SECTION" | grep -q 'active | superseded | archived'; then
  assert "Status enum uses 'archived' (ADR-014 aligned)" "true"
else
  assert "Status enum uses 'archived' (ADR-014 aligned)" "false"
fi

# Check 'revoked' is NOT in the status enum
if echo "$DF_SECTION" | grep -qi 'revoked'; then
  assert "Status enum does NOT contain 'revoked'" "false"
else
  assert "Status enum does NOT contain 'revoked'" "true"
fi

# Check ISO 8601 date constraint
if echo "$DF_SECTION" | grep -qi 'ISO 8601'; then
  assert "ISO 8601 date constraint documented" "true"
else
  assert "ISO 8601 date constraint documented" "false"
fi

# Check type enum values
for dtype in "architectural" "implementation" "validation" "process"; do
  if echo "$DF_SECTION" | grep -qi "$dtype"; then
    assert "Type enum includes '$dtype'" "true"
  else
    assert "Type enum includes '$dtype'" "false"
  fi
done

echo ""

# --- AC2: Free-form body with no structural constraints ---
echo "AC2: Free-form body section documented"
if echo "$DF_SECTION" | grep -qi "free.form\|free form\|no.*structural.*constraint"; then
  assert "Body section described as free-form markdown" "true"
else
  assert "Body section described as free-form markdown" "false"
fi

echo ""

# --- AC3: Canonical field list, archived status, ADR-016 reference ---
echo "AC3: Section reflects canonical format with ADR-016 reference"
if echo "$DF_SECTION" | grep -qi "ADR-016"; then
  assert "ADR-016 reference present in section" "true"
else
  assert "ADR-016 reference present in section" "false"
fi

# Verify 'archived' description says "no longer applies, retained for history"
if echo "$DF_SECTION" | grep -qi "no longer applies.*retained\|retained.*history"; then
  assert "'archived' description: no longer applies, retained for history" "true"
else
  assert "'archived' description: no longer applies, retained for history" "false"
fi

echo ""

# --- AC4: Existing decision-log entries migrated to standardized format ---
echo "AC4: Existing decision-log entries use standardized format"

# Check architect-sidecar/decision-log.md
ARCH_DL="$MEMORY_PATH/architect-sidecar/decision-log.md"
if [ -f "$ARCH_DL" ]; then
  # Should NOT have informal bullet format (- 2026-03-20 [edit-arch]:)
  if grep -q '^- [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} \[' "$ARCH_DL"; then
    assert "architect decision-log: no informal bullet entries remain" "false"
  else
    assert "architect decision-log: no informal bullet entries remain" "true"
  fi

  # Should have standardized headers
  if grep -q '^### \[' "$ARCH_DL"; then
    assert "architect decision-log: has standardized ### [date] headers" "true"
  else
    assert "architect decision-log: has standardized ### [date] headers" "false"
  fi
else
  assert "architect decision-log file exists" "false"
fi

# Check validator-sidecar/decision-log.md — no 'Status: recorded'
VAL_DL="$MEMORY_PATH/validator-sidecar/decision-log.md"
if [ -f "$VAL_DL" ]; then
  if grep -q 'recorded' "$VAL_DL"; then
    assert "validator decision-log: no 'Status: recorded' entries" "false"
  else
    assert "validator decision-log: no 'Status: recorded' entries" "true"
  fi
else
  assert "validator decision-log file exists" "false"
fi

# Check architect-sidecar/architecture-decisions.md has Workflow and Type fields
ARCH_AD="$MEMORY_PATH/architect-sidecar/architecture-decisions.md"
if [ -f "$ARCH_AD" ]; then
  if grep -q '\*\*Workflow:\*\*' "$ARCH_AD"; then
    assert "architecture-decisions.md: has Workflow field" "true"
  else
    assert "architecture-decisions.md: has Workflow field" "false"
  fi
  if grep -q '\*\*Type:\*\*' "$ARCH_AD"; then
    assert "architecture-decisions.md: has Type field" "true"
  else
    assert "architecture-decisions.md: has Type field" "false"
  fi
else
  assert "architecture-decisions.md file exists" "false"
fi

# Check security-sidecar/decision-log.md — no D-01: format
SEC_DL="$MEMORY_PATH/security-sidecar/decision-log.md"
if [ -f "$SEC_DL" ]; then
  if grep -q '^### D-[0-9]\{2\}:' "$SEC_DL"; then
    assert "security decision-log: no D-XX: format entries remain" "false"
  else
    assert "security decision-log: no D-XX: format entries remain" "true"
  fi
  if grep -q '^### \[' "$SEC_DL"; then
    assert "security decision-log: has standardized ### [date] headers" "true"
  else
    assert "security decision-log: has standardized ### [date] headers" "false"
  fi
else
  assert "security decision-log file exists" "false"
fi

# Check devops-sidecar/decision-log.md — no D-01: format
DEVOPS_DL="$MEMORY_PATH/devops-sidecar/decision-log.md"
if [ -f "$DEVOPS_DL" ]; then
  if grep -q '^### D-[0-9]\{2\}:' "$DEVOPS_DL"; then
    assert "devops decision-log: no D-XX: format entries remain" "false"
  else
    assert "devops decision-log: no D-XX: format entries remain" "true"
  fi
  if grep -q '^### \[' "$DEVOPS_DL"; then
    assert "devops decision-log: has standardized ### [date] headers" "true"
  else
    assert "devops decision-log: has standardized ### [date] headers" "false"
  fi
else
  assert "devops decision-log file exists" "false"
fi

echo ""

# --- AC5: Required vs optional field guidance ---
echo "AC5: Required vs optional field documentation"
if echo "$DF_SECTION" | grep -qi "required.*field\|required.*:.*Agent\|Agent.*required"; then
  assert "Agent documented as required field" "true"
else
  assert "Agent documented as required field" "false"
fi
if echo "$DF_SECTION" | grep -qi "required.*Status\|Status.*required"; then
  assert "Status documented as required field" "true"
else
  assert "Status documented as required field" "false"
fi
if echo "$DF_SECTION" | grep -qi "optional.*Workflow\|Workflow.*optional"; then
  assert "Workflow documented as optional field" "true"
else
  assert "Workflow documented as optional field" "false"
fi

echo ""

# --- AC6: Malformed date handling ---
echo "AC6: Malformed date handling documented"
if echo "$DF_SECTION" | grep -qi "malformed.*date\|best.effort.*pars\|warning.*date"; then
  assert "Malformed date handling guidance present" "true"
else
  assert "Malformed date handling guidance present" "false"
fi

echo ""

# --- Cross-check: architecture.md section 10.10 status enum alignment ---
echo "CROSS-CHECK: architecture.md status enum matches skill"
if grep -A15 'Memory Format Standardization' "$ARCH_FILE" | grep -q 'active | superseded | archived'; then
  assert "architecture.md uses 'archived' in status enum" "true"
else
  assert "architecture.md uses 'archived' in status enum" "false"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
