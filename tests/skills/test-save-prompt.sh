#!/usr/bin/env bash
# Test script for E9-S8: Explicit Save Prompt at Workflow Completion
# Validates all acceptance criteria structurally against workflow.xml Step 7.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
WORKFLOW_XML="$PROJECT_PATH/_gaia/core/engine/workflow.xml"
SKILL_FILE="$PROJECT_PATH/_gaia/lifecycle/skills/memory-management.md"

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

# Extract Step 7 content from workflow.xml
STEP7=""
if [ -f "$WORKFLOW_XML" ]; then
  STEP7=$(sed -n '/<step n="7" title="Completion">/,/<\/step>/p' "$WORKFLOW_XML" 2>/dev/null)
fi

echo "=== E9-S8 Explicit Save Prompt at Workflow Completion Tests ==="
echo ""

# --- AC1: Save prompt triggered after completion for Tier 1/Tier 2 agents ---
echo "AC1: Save prompt actions exist in Step 7, after completion summary"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "save prompt\|session save\|memory save"; then
    assert "Step 7 contains save prompt actions" "true"
  else
    assert "Step 7 contains save prompt actions" "false"
  fi
  if echo "$STEP7" | grep -qi "_memory/config.yaml\|memory.*config"; then
    assert "Step 7 reads _memory/config.yaml for tier resolution" "true"
  else
    assert "Step 7 reads _memory/config.yaml for tier resolution" "false"
  fi
  if echo "$STEP7" | grep -qi "tier_1\|tier_2\|tier 1\|tier 2"; then
    assert "Step 7 references Tier 1 and Tier 2 agents" "true"
  else
    assert "Step 7 references Tier 1 and Tier 2 agents" "false"
  fi
else
  assert "Step 7 contains save prompt actions" "false"
  assert "Step 7 reads _memory/config.yaml for tier resolution" "false"
  assert "Step 7 references Tier 1 and Tier 2 agents" "false"
fi

# --- AC2a: Tier 1 summary includes decisions + context + ground truth ---
echo ""
echo "AC2a: Tier 1 agents generate summary with decisions, context, ground truth"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "ground.truth\|ground truth"; then
    assert "Step 7 mentions ground truth for Tier 1" "true"
  else
    assert "Step 7 mentions ground truth for Tier 1" "false"
  fi
fi

# --- AC2b: Tier 2 summary excludes ground truth ---
echo ""
echo "AC2b: Tier 2 agents generate summary without ground truth"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "tier.2.*no.*ground\|tier 2.*without.*ground\|no ground truth"; then
    assert "Step 7 differentiates Tier 2 (no ground truth)" "true"
  else
    assert "Step 7 differentiates Tier 2 (no ground truth)" "false"
  fi
fi

# --- AC2c: Empty session detection ---
echo ""
echo "AC2c: Empty session detection with skip option"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "no persistable\|empty session\|no decisions"; then
    assert "Step 7 detects empty sessions" "true"
  else
    assert "Step 7 detects empty sessions" "false"
  fi
fi

# --- AC3a: User confirmation prompt with [y]/[n]/[e] ---
echo ""
echo "AC3a: Save prompt offers [y] Save | [n] Skip | [e] Edit"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "\[y\].*Save\|Save.*\[y\]"; then
    assert "Step 7 offers [y] Save option" "true"
  else
    assert "Step 7 offers [y] Save option" "false"
  fi
  if echo "$STEP7" | grep -qi "\[n\].*Skip\|Skip.*\[n\]"; then
    assert "Step 7 offers [n] Skip option" "true"
  else
    assert "Step 7 offers [n] Skip option" "false"
  fi
  if echo "$STEP7" | grep -qi "\[e\].*Edit\|Edit.*\[e\]"; then
    assert "Step 7 offers [e] Edit option" "true"
  else
    assert "Step 7 offers [e] Edit option" "false"
  fi
fi

# --- AC3b: Skip path proceeds without writing ---
echo ""
echo "AC3b: User decline [n] proceeds without writing"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "skip.*save\|proceed.*without.*writ\|no.*files.*written\|decline"; then
    assert "Step 7 handles skip without writing memory files" "true"
  else
    assert "Step 7 handles skip without writing memory files" "false"
  fi
fi

# --- AC3c: YOLO mode pauses at save prompt ---
echo ""
echo "AC3c: YOLO mode pauses at save prompt (open-question classification)"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "yolo.*pause\|open.question\|YOLO.*explicit\|never.*auto.*approv"; then
    assert "Step 7 pauses YOLO mode at save prompt" "true"
  else
    assert "Step 7 pauses YOLO mode at save prompt" "false"
  fi
fi

# --- AC4: JIT-load session-save skill ---
echo ""
echo "AC4: Engine JIT-loads session-save skill from memory-management.md"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "session-save\|session.save"; then
    assert "Step 7 references session-save skill" "true"
  else
    assert "Step 7 references session-save skill" "false"
  fi
  if echo "$STEP7" | grep -qi "memory-management.md\|memory.management"; then
    assert "Step 7 references memory-management.md skill file" "true"
  else
    assert "Step 7 references memory-management.md skill file" "false"
  fi
  if echo "$STEP7" | grep -qi "JIT.*load\|JIT-load\|load.*JIT"; then
    assert "Step 7 uses JIT loading for skills" "true"
  else
    assert "Step 7 uses JIT loading for skills" "false"
  fi
fi

# --- AC5: Pass tier_budget to session-save ---
echo ""
echo "AC5: Engine passes tier_budget from _memory/config.yaml to session-save"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "tier_budget\|session_budget"; then
    assert "Step 7 passes tier_budget parameter" "true"
  else
    assert "Step 7 passes tier_budget parameter" "false"
  fi
fi

# --- AC6: Tier 3 and no-agent workflows skip silently ---
echo ""
echo "AC6: Tier 3 / no-agent workflows skip save prompt silently"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "tier.3\|tier 3\|not.*tier.*1.*tier.*2\|not.*found.*tier"; then
    assert "Step 7 skips for Tier 3 agents" "true"
  else
    assert "Step 7 skips for Tier 3 agents" "false"
  fi
  if echo "$STEP7" | grep -qi "no.*agent\|agent.*missing\|agent.*absent\|without.*agent"; then
    assert "Step 7 skips when no agent field" "true"
  else
    assert "Step 7 skips when no agent field" "false"
  fi
fi

# --- AC7: Missing _memory/config.yaml graceful skip ---
echo ""
echo "AC7: Missing _memory/config.yaml skips with console note"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "Memory config not found\|config.*not.*exist\|missing.*config"; then
    assert "Step 7 handles missing _memory/config.yaml gracefully" "true"
  else
    assert "Step 7 handles missing _memory/config.yaml gracefully" "false"
  fi
fi

# --- Structural: skill sections referenced ---
echo ""
echo "STRUCTURAL: All three skill sections referenced in Step 7"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "context-summarization\|context.summarization"; then
    assert "Step 7 references context-summarization section" "true"
  else
    assert "Step 7 references context-summarization section" "false"
  fi
  if echo "$STEP7" | grep -qi "decision-formatting\|decision.formatting"; then
    assert "Step 7 references decision-formatting section" "true"
  else
    assert "Step 7 references decision-formatting section" "false"
  fi
fi

# --- Structural: sidecar_path resolved from config ---
echo ""
echo "STRUCTURAL: sidecar_path resolved from _memory/config.yaml"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "sidecar_path\|sidecar.*path"; then
    assert "Step 7 resolves sidecar_path from config" "true"
  else
    assert "Step 7 resolves sidecar_path from config" "false"
  fi
fi

# --- Structural: No hardcoded agent IDs ---
echo ""
echo "STRUCTURAL: No hardcoded agent IDs in save prompt logic"
if [ -n "$STEP7" ]; then
  # Save prompt logic should not hardcode specific agent names like "architect", "pm", etc.
  # It should dynamically look up from config.yaml tier lists
  HARDCODED_AGENTS=$(echo "$STEP7" | grep -ci "agent.*==.*\"architect\"\|agent.*==.*\"pm\"\|agent.*==.*\"validator\"" || true)
  if [ "$HARDCODED_AGENTS" -eq 0 ]; then
    assert "No hardcoded agent IDs in save prompt logic" "true"
  else
    assert "No hardcoded agent IDs in save prompt logic" "false"
  fi
fi

# --- Structural: Save prompt placement ---
echo ""
echo "STRUCTURAL: Save prompt placed between completion summary and next-step suggestions"
if [ -f "$WORKFLOW_XML" ]; then
  # Check that save prompt actions appear after "Report workflow complete" and before "lifecycle-sequence" within Step 7
  REPORT_LINE=$(grep -n "Report workflow complete" "$WORKFLOW_XML" | head -1 | cut -d: -f1)
  LIFECYCLE_LINE=$(sed -n '/<step n="7"/,/<\/step>/{ /lifecycle-sequence/=; }' "$WORKFLOW_XML" | head -1)
  SAVE_LINE=$(grep -n "save prompt\|session save\|memory save" "$WORKFLOW_XML" | head -1 | cut -d: -f1)
  if [ -n "$REPORT_LINE" ] && [ -n "$LIFECYCLE_LINE" ] && [ -n "$SAVE_LINE" ]; then
    if [ "$SAVE_LINE" -gt "$REPORT_LINE" ] && [ "$SAVE_LINE" -lt "$LIFECYCLE_LINE" ]; then
      assert "Save prompt placed after completion summary and before next-step suggestions" "true"
    else
      assert "Save prompt placed after completion summary and before next-step suggestions" "false"
    fi
  else
    assert "Save prompt placed after completion summary and before next-step suggestions" "false"
  fi
else
  assert "Save prompt placed after completion summary and before next-step suggestions" "false"
fi

# --- Structural: Existing Step 7 actions preserved ---
echo ""
echo "STRUCTURAL: Existing Step 7 actions are preserved"
if [ -n "$STEP7" ]; then
  if echo "$STEP7" | grep -qi "quality_gates.post_complete\|post_complete"; then
    assert "Quality gates check preserved" "true"
  else
    assert "Quality gates check preserved" "false"
  fi
  if echo "$STEP7" | grep -qi "checklist"; then
    assert "Checklist evaluation preserved" "true"
  else
    assert "Checklist evaluation preserved" "false"
  fi
  if echo "$STEP7" | grep -qi "Archive checkpoint\|checkpoint.*completed"; then
    assert "Checkpoint archival preserved" "true"
  else
    assert "Checkpoint archival preserved" "false"
  fi
  if echo "$STEP7" | grep -qi "lifecycle-sequence"; then
    assert "Next-step suggestions preserved" "true"
  else
    assert "Next-step suggestions preserved" "false"
  fi
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
