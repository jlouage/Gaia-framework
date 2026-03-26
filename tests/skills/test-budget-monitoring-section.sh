#!/usr/bin/env bash
# Test script for E9-S18: Budget-Monitoring Skill Section
# Validates all 3 acceptance criteria structurally.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
SKILL_FILE="$PROJECT_PATH/_gaia/lifecycle/skills/memory-management.md"
MANIFEST="$PROJECT_PATH/_gaia/_config/skill-manifest.csv"
INSTRUCTIONS="$PROJECT_PATH/_gaia/lifecycle/workflows/anytime/memory-hygiene/instructions.xml"
ARCHITECTURE="$PROJECT_ROOT/docs/planning-artifacts/architecture.md"

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

echo "=== E9-S18 Budget-Monitoring Skill Section Tests ==="
echo ""

# --- AC1: budget-monitoring section exists in memory-management.md ---
echo "AC1: budget-monitoring section exists in memory-management.md"

if [ -f "$SKILL_FILE" ]; then
  assert "Skill file exists" "true"
else
  assert "Skill file exists" "false"
fi

# Check for section start marker
if [ -f "$SKILL_FILE" ] && grep -q "<!-- SECTION: budget-monitoring -->" "$SKILL_FILE"; then
  assert "Section start marker present: budget-monitoring" "true"
else
  assert "Section start marker present: budget-monitoring" "false"
fi

# Check for section end marker after start marker
if [ -f "$SKILL_FILE" ]; then
  SECTION_CONTENT=$(sed -n '/<!-- SECTION: budget-monitoring -->/,/<!-- \/SECTION: budget-monitoring -->/p' "$SKILL_FILE" 2>/dev/null)
  if [ -n "$SECTION_CONTENT" ]; then
    assert "Section end marker present: /SECTION: budget-monitoring" "true"
  else
    # Try END SECTION marker as fallback
    SECTION_CONTENT=$(sed -n '/<!-- SECTION: budget-monitoring -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
    if [ -n "$SECTION_CONTENT" ]; then
      assert "Section end marker present (END SECTION style)" "true"
    else
      assert "Section end marker present" "false"
    fi
  fi
else
  assert "Section end marker present" "false"
fi

# Check section contains budget calculation logic
if [ -f "$SKILL_FILE" ]; then
  BM_SECTION=$(sed -n '/<!-- SECTION: budget-monitoring -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  if echo "$BM_SECTION" | grep -qi "token.*budget\|budget.*token\|token.*usage"; then
    assert "Section contains token budget logic" "true"
  else
    assert "Section contains token budget logic" "false"
  fi
  if echo "$BM_SECTION" | grep -qi "bytes.*4\|bytes / 4\|file.*size.*bytes"; then
    assert "Section contains bytes-to-token calculation (bytes / 4)" "true"
  else
    assert "Section contains bytes-to-token calculation (bytes / 4)" "false"
  fi
  if echo "$BM_SECTION" | grep -qi "80%"; then
    assert "Section defines 80% warning threshold" "true"
  else
    assert "Section defines 80% warning threshold" "false"
  fi
  if echo "$BM_SECTION" | grep -qi "90%"; then
    assert "Section defines 90% critical threshold" "true"
  else
    assert "Section defines 90% critical threshold" "false"
  fi
  if echo "$BM_SECTION" | grep -qi "100%"; then
    assert "Section defines 100% archival trigger threshold" "true"
  else
    assert "Section defines 100% archival trigger threshold" "false"
  fi
  if echo "$BM_SECTION" | grep -qi "config.yaml\|_memory/config"; then
    assert "Section references _memory/config.yaml for tier budgets" "true"
  else
    assert "Section references _memory/config.yaml for tier budgets" "false"
  fi
  if echo "$BM_SECTION" | grep -qi "no.*budget.*enforced\|no budget\|Tier 3\|untiered"; then
    assert "Section handles Tier 3/untiered agents (no budget enforced)" "true"
  else
    assert "Section handles Tier 3/untiered agents (no budget enforced)" "false"
  fi
else
  assert "Section contains token budget logic" "false"
  assert "Section contains bytes-to-token calculation (bytes / 4)" "false"
  assert "Section defines 80% warning threshold" "false"
  assert "Section defines 90% critical threshold" "false"
  assert "Section defines 100% archival trigger threshold" "false"
  assert "Section references _memory/config.yaml for tier budgets" "false"
  assert "Section handles Tier 3/untiered agents (no budget enforced)" "false"
fi

# --- AC2: Memory-hygiene workflow references the new section ---
echo ""
echo "AC2: Memory-hygiene workflow references budget-monitoring section via JIT skill loading"

if [ -f "$INSTRUCTIONS" ]; then
  assert "Memory-hygiene instructions.xml exists" "true"
else
  assert "Memory-hygiene instructions.xml exists" "false"
fi

# Check that instructions.xml references budget-monitoring skill section
if [ -f "$INSTRUCTIONS" ] && grep -qi "budget-monitoring" "$INSTRUCTIONS"; then
  assert "Instructions reference budget-monitoring section" "true"
else
  assert "Instructions reference budget-monitoring section" "false"
fi

# Check for JIT skill loading pattern (memory-management skill reference)
if [ -f "$INSTRUCTIONS" ] && grep -qi "memory-management.*budget-monitoring\|budget-monitoring.*memory-management\|SKILL.*budget-monitoring\|skill.*budget-monitoring" "$INSTRUCTIONS"; then
  assert "Instructions use JIT skill loading for budget-monitoring" "true"
else
  assert "Instructions use JIT skill loading for budget-monitoring" "false"
fi

# Check that inline budget calculation is replaced (no raw bytes/4 logic in Step 7)
if [ -f "$INSTRUCTIONS" ]; then
  STEP7=$(sed -n '/<step n="7"/,/<\/step>/p' "$INSTRUCTIONS" 2>/dev/null)
  # Step 7 should reference skill section, not have inline calculation details
  if echo "$STEP7" | grep -qi "file size in bytes / 4"; then
    assert "Step 7 does NOT have inline bytes/4 calculation (should use skill)" "false"
  else
    assert "Step 7 does NOT have inline bytes/4 calculation (should use skill)" "true"
  fi
fi

# --- AC3: Section follows skill sectioning conventions ---
echo ""
echo "AC3: Section follows skill sectioning conventions"

# Check section line count (must be <= 50)
if [ -f "$SKILL_FILE" ]; then
  BM_LINES=$(sed -n '/<!-- SECTION: budget-monitoring -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$BM_LINES" -gt 0 ] && [ "$BM_LINES" -le 50 ]; then
    assert "Section line count ($BM_LINES) <= 50" "true"
  elif [ "$BM_LINES" -gt 50 ]; then
    assert "Section line count ($BM_LINES) <= 50" "false"
  else
    assert "Section line count (section not found)" "false"
  fi
else
  assert "Section line count check (file missing)" "false"
fi

# Check skill-manifest.csv registration
if [ -f "$MANIFEST" ]; then
  MM_ROW=$(grep "memory-management" "$MANIFEST" 2>/dev/null || true)
  if [ -n "$MM_ROW" ]; then
    assert "memory-management registered in skill-manifest.csv" "true"
    # Description should mention budget-monitoring or updated section count
    if echo "$MM_ROW" | grep -qi "budget"; then
      assert "Manifest description includes budget-monitoring reference" "true"
    else
      assert "Manifest description includes budget-monitoring reference" "false"
    fi
  else
    assert "memory-management registered in skill-manifest.csv" "false"
    assert "Manifest description includes budget-monitoring reference" "false"
  fi
else
  assert "memory-management registered in skill-manifest.csv" "false"
  assert "Manifest description includes budget-monitoring reference" "false"
fi

# Check total skill file stays within 500-line limit (updated from 300 per product CLAUDE.md)
if [ -f "$SKILL_FILE" ]; then
  TOTAL_LINES=$(wc -l < "$SKILL_FILE" | tr -d ' ')
  if [ "$TOTAL_LINES" -le 500 ]; then
    assert "Total skill file line count ($TOTAL_LINES) <= 500" "true"
  else
    assert "Total skill file line count ($TOTAL_LINES) <= 500" "false"
  fi
else
  assert "Total skill file line count (file missing)" "false"
fi

# Check section is self-contained (no cross-section references)
if [ -f "$SKILL_FILE" ]; then
  BM_SECTION=$(sed -n '/<!-- SECTION: budget-monitoring -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  CROSS_REFS=$(echo "$BM_SECTION" | grep -ci "see.*SECTION:\|load.*section:" 2>/dev/null || true)
  if [ "$CROSS_REFS" -eq 0 ]; then
    assert "Section has no cross-section references (self-contained)" "true"
  else
    assert "Section has no cross-section references (self-contained)" "false"
  fi
fi

# Check section marker pairing in full file (now 7 sections)
if [ -f "$SKILL_FILE" ]; then
  START_COUNT=$(grep -c "<!-- SECTION:" "$SKILL_FILE" 2>/dev/null || true)
  END_COUNT=$(grep -c "<!-- END SECTION -->" "$SKILL_FILE" 2>/dev/null || true)
  if [ "$START_COUNT" -eq "$END_COUNT" ] && [ "$START_COUNT" -ge 7 ]; then
    assert "Section marker pairing correct (${START_COUNT} start, ${END_COUNT} end, >= 7)" "true"
  else
    assert "Section marker pairing correct (${START_COUNT} start, ${END_COUNT} end, need >= 7)" "false"
  fi
fi

# --- Architecture documentation update ---
echo ""
echo "Documentation: architecture.md section count updated"

if [ -f "$ARCHITECTURE" ]; then
  # Check that architecture.md references 7+ sections for memory-management (was 6)
  if grep -q "memory-management" "$ARCHITECTURE" && grep -A2 "memory-management" "$ARCHITECTURE" | grep -qE "[7-9] section|budget-monitoring"; then
    assert "architecture.md updated with new section count" "true"
  else
    assert "architecture.md updated with new section count" "false"
  fi
else
  assert "architecture.md updated with new section count" "false"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
