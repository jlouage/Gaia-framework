#!/usr/bin/env bash
# Test script for E8-S12: Memory Management Skill
# Validates all 11 acceptance criteria structurally.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
SKILL_FILE="$PROJECT_PATH/_gaia/lifecycle/skills/memory-management.md"
MANIFEST="$PROJECT_PATH/_gaia/_config/skill-manifest.csv"

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

echo "=== E8-S12 Memory Management Skill Tests ==="
echo ""

# --- AC1: Skill file exists with 6 sections ---
echo "AC1: Skill file exists at correct path with 6 sections"
if [ -f "$SKILL_FILE" ]; then
  assert "File exists at _gaia/lifecycle/skills/memory-management.md" "true"
else
  assert "File exists at _gaia/lifecycle/skills/memory-management.md" "false"
fi

EXPECTED_SECTIONS=("session-load" "session-save" "decision-formatting" "context-summarization" "stale-detection" "deduplication")
for section in "${EXPECTED_SECTIONS[@]}"; do
  if [ -f "$SKILL_FILE" ] && grep -q "<!-- SECTION: $section -->" "$SKILL_FILE"; then
    assert "Section marker present: $section" "true"
  else
    assert "Section marker present: $section" "false"
  fi
done

# --- AC2: Each section independently loadable (self-contained) ---
echo ""
echo "AC2: Each section is self-contained and independently loadable"
for section in "${EXPECTED_SECTIONS[@]}"; do
  if [ -f "$SKILL_FILE" ]; then
    CONTENT=$(sed -n "/<!-- SECTION: $section -->/,/<!-- END SECTION -->/p" "$SKILL_FILE" 2>/dev/null | wc -l)
    if [ "$CONTENT" -gt 2 ]; then
      assert "Section '$section' has content between markers" "true"
    else
      assert "Section '$section' has content between markers" "false"
    fi
    # Verify no cross-section references (should not say "see SECTION:" or "load section:")
    CROSS_REFS=$(sed -n "/<!-- SECTION: $section -->/,/<!-- END SECTION -->/p" "$SKILL_FILE" 2>/dev/null | grep -ci "see.*SECTION:\|load.*section:" || true)
    if [ "$CROSS_REFS" -eq 0 ]; then
      assert "Section '$section' has no cross-section references" "true"
    else
      assert "Section '$section' has no cross-section references" "false"
    fi
  else
    assert "Section '$section' has content between markers" "false"
    assert "Section '$section' has no cross-section references" "false"
  fi
done

# --- AC3: File is ≤300 lines ---
echo ""
echo "AC3: File is at or under 300 lines"
if [ -f "$SKILL_FILE" ]; then
  LINES=$(wc -l < "$SKILL_FILE")
  if [ "$LINES" -le 300 ]; then
    assert "Line count ($LINES) ≤ 300" "true"
  else
    assert "Line count ($LINES) ≤ 300" "false"
  fi
else
  assert "Line count check (file missing)" "false"
fi

# --- AC4: Manifest registration ---
echo ""
echo "AC4: skill-manifest.csv has memory-management row"
if grep -q "memory-management" "$MANIFEST"; then
  assert "Manifest row exists" "true"
  if grep "memory-management" "$MANIFEST" | grep -q "_gaia/lifecycle/skills/memory-management.md"; then
    assert "Manifest row has correct path" "true"
  else
    assert "Manifest row has correct path" "false"
  fi
  if grep "memory-management" "$MANIFEST" | grep -q "all"; then
    assert "Manifest row has applicable_agents including all" "true"
  else
    assert "Manifest row has applicable_agents including all" "false"
  fi
else
  assert "Manifest row exists" "false"
  assert "Manifest row has correct path" "false"
  assert "Manifest row has applicable_agents including all" "false"
fi

# --- AC5: session-load handles missing sidecar gracefully ---
echo ""
echo "AC5: session-load defines graceful empty-state handling"
if [ -f "$SKILL_FILE" ]; then
  SL_SECTION=$(sed -n '/<!-- SECTION: session-load -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  if echo "$SL_SECTION" | grep -qi "empty.*structure\|empty.*data\|graceful"; then
    assert "session-load mentions empty data structures / graceful handling" "true"
  else
    assert "session-load mentions empty data structures / graceful handling" "false"
  fi
  if echo "$SL_SECTION" | grep -qi "no.*error\|no error\|without.*error"; then
    assert "session-load specifies no errors on missing directory" "true"
  else
    assert "session-load specifies no errors on missing directory" "false"
  fi
  if echo "$SL_SECTION" | grep -qi "no.*file.*creat\|never.*creat\|do not.*creat"; then
    assert "session-load specifies no file creation on missing directory" "true"
  else
    assert "session-load specifies no file creation on missing directory" "false"
  fi
else
  assert "session-load mentions empty data structures / graceful handling" "false"
  assert "session-load specifies no errors on missing directory" "false"
  assert "session-load specifies no file creation on missing directory" "false"
fi

# --- AC6: session-save budget overflow warning ---
echo ""
echo "AC6: session-save warns on budget overflow with options"
if [ -f "$SKILL_FILE" ]; then
  SS_SECTION=$(sed -n '/<!-- SECTION: session-save -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  if echo "$SS_SECTION" | grep -qi "budget\|token.*budget"; then
    assert "session-save mentions token budget" "true"
  else
    assert "session-save mentions token budget" "false"
  fi
  if echo "$SS_SECTION" | grep -qi "warn\|warning"; then
    assert "session-save defines warning on overflow" "true"
  else
    assert "session-save defines warning on overflow" "false"
  fi
  if echo "$SS_SECTION" | grep -qi "archive.*oldest\|archive oldest"; then
    assert "session-save offers 'archive oldest' option" "true"
  else
    assert "session-save offers 'archive oldest' option" "false"
  fi
  if echo "$SS_SECTION" | grep -qi "force.*save\|force save"; then
    assert "session-save offers 'force save' option" "true"
  else
    assert "session-save offers 'force save' option" "false"
  fi
  if echo "$SS_SECTION" | grep -qi "never.*silent\|never.*truncat"; then
    assert "session-save never silently truncates" "true"
  else
    assert "session-save never silently truncates" "false"
  fi
else
  assert "session-save mentions token budget" "false"
  assert "session-save defines warning on overflow" "false"
  assert "session-save offers 'archive oldest' option" "false"
  assert "session-save offers 'force save' option" "false"
  assert "session-save never silently truncates" "false"
fi

# --- AC7: Concurrent write safety (full-file read/append/write) ---
echo ""
echo "AC7: session-save uses full-file read/append/write for concurrency safety"
if [ -f "$SKILL_FILE" ]; then
  SS_SECTION=$(sed -n '/<!-- SECTION: session-save -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  if echo "$SS_SECTION" | grep -qi "full.file.*read\|read.*entire\|read.*full"; then
    assert "session-save specifies full-file read" "true"
  else
    assert "session-save specifies full-file read" "false"
  fi
  if echo "$SS_SECTION" | grep -qi "append.*memory\|modify.*memory\|in.memory"; then
    assert "session-save specifies in-memory append" "true"
  else
    assert "session-save specifies in-memory append" "false"
  fi
  if echo "$SS_SECTION" | grep -qi "full.file.*write\|write.*full\|write.*entire\|last.*writer.*wins"; then
    assert "session-save specifies full-file write / last writer wins" "true"
  else
    assert "session-save specifies full-file write / last writer wins" "false"
  fi
else
  assert "session-save specifies full-file read" "false"
  assert "session-save specifies in-memory append" "false"
  assert "session-save specifies full-file write / last writer wins" "false"
fi

# --- AC8: decision-formatting follows ADR-016 format ---
echo ""
echo "AC8: decision-formatting uses ADR-016 standard format"
if [ -f "$SKILL_FILE" ]; then
  DF_SECTION=$(sed -n '/<!-- SECTION: decision-formatting -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  for field in "Agent" "Sprint" "Status" "Related"; do
    if echo "$DF_SECTION" | grep -q "$field"; then
      assert "decision-formatting includes field '$field'" "true"
    else
      assert "decision-formatting includes field '$field'" "false"
    fi
  done
  # Check for decision types
  for dtype in "architectural" "implementation" "validation" "process"; do
    if echo "$DF_SECTION" | grep -qi "$dtype"; then
      assert "decision-formatting defines type '$dtype'" "true"
    else
      assert "decision-formatting defines type '$dtype'" "false"
    fi
  done
  # Check for status values
  for sval in "active" "superseded" "revoked"; do
    if echo "$DF_SECTION" | grep -qi "$sval"; then
      assert "decision-formatting defines status '$sval'" "true"
    else
      assert "decision-formatting defines status '$sval'" "false"
    fi
  done
else
  for field in "Agent" "Sprint" "Status" "Related"; do
    assert "decision-formatting includes field '$field'" "false"
  done
  for dtype in "architectural" "implementation" "validation" "process"; do
    assert "decision-formatting defines type '$dtype'" "false"
  done
  for sval in "active" "superseded" "revoked"; do
    assert "decision-formatting defines status '$sval'" "false"
  done
fi

# --- AC9: context-summarization within 2K token limit ---
echo ""
echo "AC9: context-summarization captures key elements within 2K token limit"
if [ -f "$SKILL_FILE" ]; then
  CS_SECTION=$(sed -n '/<!-- SECTION: context-summarization -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  if echo "$CS_SECTION" | grep -qi "2K\|2,000\|2000.*token"; then
    assert "context-summarization defines 2K token limit" "true"
  else
    assert "context-summarization defines 2K token limit" "false"
  fi
  for element in "discussed" "decisions" "artifacts" "pending"; do
    if echo "$CS_SECTION" | grep -qi "$element"; then
      assert "context-summarization captures '$element'" "true"
    else
      assert "context-summarization captures '$element'" "false"
    fi
  done
else
  assert "context-summarization defines 2K token limit" "false"
  for element in "discussed" "decisions" "artifacts" "pending"; do
    assert "context-summarization captures '$element'" "false"
  done
fi

# --- AC10: stale-detection identifies stale, contradicted, orphaned ---
echo ""
echo "AC10: stale-detection identifies stale, contradicted, and orphaned entries"
if [ -f "$SKILL_FILE" ]; then
  SD_SECTION=$(sed -n '/<!-- SECTION: stale-detection -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  if echo "$SD_SECTION" | grep -qi "stale.*artifact\|non.exist\|not.*found\|no longer exist"; then
    assert "stale-detection identifies stale entries (missing artifacts)" "true"
  else
    assert "stale-detection identifies stale entries (missing artifacts)" "false"
  fi
  if echo "$SD_SECTION" | grep -qi "contradict"; then
    assert "stale-detection identifies contradicted entries" "true"
  else
    assert "stale-detection identifies contradicted entries" "false"
  fi
  if echo "$SD_SECTION" | grep -qi "orphan"; then
    assert "stale-detection identifies orphaned entries" "true"
  else
    assert "stale-detection identifies orphaned entries" "false"
  fi
  if echo "$SD_SECTION" | grep -qi "reason\|staleness reason"; then
    assert "stale-detection provides staleness reason" "true"
  else
    assert "stale-detection provides staleness reason" "false"
  fi
  if echo "$SD_SECTION" | grep -qi "archive\|remove\|review"; then
    assert "stale-detection suggests action (archive/remove/review)" "true"
  else
    assert "stale-detection suggests action (archive/remove/review)" "false"
  fi
else
  assert "stale-detection identifies stale entries (missing artifacts)" "false"
  assert "stale-detection identifies contradicted entries" "false"
  assert "stale-detection identifies orphaned entries" "false"
  assert "stale-detection provides staleness reason" "false"
  assert "stale-detection suggests action (archive/remove/review)" "false"
fi

# --- AC11: deduplication archives older superseded entries ---
echo ""
echo "AC11: deduplication detects duplicates and archives older entries"
if [ -f "$SKILL_FILE" ]; then
  DD_SECTION=$(sed -n '/<!-- SECTION: deduplication -->/,/<!-- END SECTION -->/p' "$SKILL_FILE" 2>/dev/null)
  if echo "$DD_SECTION" | grep -qi "same.*artifact.*same.*topic\|same.*topic.*same.*artifact"; then
    assert "deduplication detects same-artifact same-topic duplicates" "true"
  else
    assert "deduplication detects same-artifact same-topic duplicates" "false"
  fi
  if echo "$DD_SECTION" | grep -qi "near.duplicate\|near duplicate"; then
    assert "deduplication detects near-duplicates" "true"
  else
    assert "deduplication detects near-duplicates" "false"
  fi
  if echo "$DD_SECTION" | grep -qi "newer.*kept\|keep.*newer\|archive.*older"; then
    assert "deduplication keeps newer, archives older" "true"
  else
    assert "deduplication keeps newer, archives older" "false"
  fi
else
  assert "deduplication detects same-artifact same-topic duplicates" "false"
  assert "deduplication detects near-duplicates" "false"
  assert "deduplication keeps newer, archives older" "false"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
