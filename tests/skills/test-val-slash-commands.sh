#!/usr/bin/env bash
# Test script for E8-S5: Val Slash Commands
# Validates all 8 acceptance criteria structurally.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
COMMANDS_DIR="$PROJECT_ROOT/.claude/commands"
MANIFEST="$PROJECT_ROOT/_gaia/_config/workflow-manifest.csv"
HELP_CSV="$PROJECT_ROOT/_gaia/_config/gaia-help.csv"

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

echo "=== E8-S5 Val Slash Commands Tests ==="
echo ""

# --- AC1: Agent activation command ---
echo "AC1: gaia-agent-validator.md exists with correct structure"
FILE="$COMMANDS_DIR/gaia-agent-validator.md"
assert "File exists" "$([ -f "$FILE" ] && echo true || echo false)"
assert "Has model: opus frontmatter" "$(grep -q 'model: opus' "$FILE" 2>/dev/null && echo true || echo false)"
assert "References validator.md agent path" "$(grep -q '_gaia/lifecycle/agents/validator.md' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Follows agent activation pattern (activation block reference)" "$(grep -q 'activation' "$FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC2: val-validate command ---
echo "AC2: gaia-val-validate.md exists with correct structure"
FILE="$COMMANDS_DIR/gaia-val-validate.md"
assert "File exists" "$([ -f "$FILE" ] && echo true || echo false)"
assert "Has model: opus frontmatter" "$(grep -q 'model: opus' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Loads workflow engine" "$(grep -q 'workflow.xml' "$FILE" 2>/dev/null && echo true || echo false)"
assert "References val-validate-artifact/workflow.yaml" "$(grep -q 'val-validate-artifact/workflow.yaml' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Includes \$ARGUMENTS" "$(grep -q '\$ARGUMENTS' "$FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC3: val-validate-plan command ---
echo "AC3: gaia-val-validate-plan.md exists with correct structure"
FILE="$COMMANDS_DIR/gaia-val-validate-plan.md"
assert "File exists" "$([ -f "$FILE" ] && echo true || echo false)"
assert "Has model: opus frontmatter" "$(grep -q 'model: opus' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Loads workflow engine" "$(grep -q 'workflow.xml' "$FILE" 2>/dev/null && echo true || echo false)"
assert "References val-validate-plan/workflow.yaml" "$(grep -q 'val-validate-plan/workflow.yaml' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Includes \$ARGUMENTS" "$(grep -q '\$ARGUMENTS' "$FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC4: val-save command ---
echo "AC4: gaia-val-save.md exists with correct structure"
FILE="$COMMANDS_DIR/gaia-val-save.md"
assert "File exists" "$([ -f "$FILE" ] && echo true || echo false)"
assert "Has model: opus frontmatter" "$(grep -q 'model: opus' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Loads workflow engine" "$(grep -q 'workflow.xml' "$FILE" 2>/dev/null && echo true || echo false)"
assert "References val-save-session/workflow.yaml" "$(grep -q 'val-save-session/workflow.yaml' "$FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC5: refresh-ground-truth command ---
echo "AC5: gaia-refresh-ground-truth.md exists with correct structure"
FILE="$COMMANDS_DIR/gaia-refresh-ground-truth.md"
assert "File exists" "$([ -f "$FILE" ] && echo true || echo false)"
assert "Has model: opus frontmatter" "$(grep -q 'model: opus' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Loads workflow engine" "$(grep -q 'workflow.xml' "$FILE" 2>/dev/null && echo true || echo false)"
assert "References val-refresh-ground-truth/workflow.yaml" "$(grep -q 'val-refresh-ground-truth/workflow.yaml' "$FILE" 2>/dev/null && echo true || echo false)"
assert "Includes \$ARGUMENTS" "$(grep -q '\$ARGUMENTS' "$FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC6: Path consistency with architecture ---
echo "AC6: All paths match architecture.md section 10.9"
assert "Agent path uses lifecycle/agents/" "$(grep -q 'lifecycle/agents/validator.md' "$COMMANDS_DIR/gaia-agent-validator.md" 2>/dev/null && echo true || echo false)"
assert "Validate path uses 4-implementation/val-validate-artifact/" "$(grep -q '4-implementation/val-validate-artifact/' "$COMMANDS_DIR/gaia-val-validate.md" 2>/dev/null && echo true || echo false)"
assert "Validate-plan path uses 4-implementation/val-validate-plan/" "$(grep -q '4-implementation/val-validate-plan/' "$COMMANDS_DIR/gaia-val-validate-plan.md" 2>/dev/null && echo true || echo false)"
assert "Save path uses 4-implementation/val-save-session/" "$(grep -q '4-implementation/val-save-session/' "$COMMANDS_DIR/gaia-val-save.md" 2>/dev/null && echo true || echo false)"
assert "Refresh path uses 4-implementation/val-refresh-ground-truth/" "$(grep -q '4-implementation/val-refresh-ground-truth/' "$COMMANDS_DIR/gaia-refresh-ground-truth.md" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC7: workflow-manifest.csv entries ---
echo "AC7: workflow-manifest.csv has 4 Val workflow rows"
VAL_MANIFEST_COUNT=$(grep -c '"validator"' "$MANIFEST" 2>/dev/null || echo "0")
VAL_MANIFEST_COUNT=$(echo "$VAL_MANIFEST_COUNT" | tr -d '[:space:]')
assert "4 Val rows in workflow-manifest.csv" "$([ "$VAL_MANIFEST_COUNT" -ge 4 ] && echo true || echo false)"
assert "val-validate-artifact row exists" "$(grep -q '"val-validate-artifact"' "$MANIFEST" 2>/dev/null && echo true || echo false)"
assert "val-validate-plan row exists" "$(grep -q '"val-validate-plan"' "$MANIFEST" 2>/dev/null && echo true || echo false)"
assert "val-save-session row exists" "$(grep -q '"val-save-session"' "$MANIFEST" 2>/dev/null && echo true || echo false)"
assert "val-refresh-ground-truth row exists" "$(grep -q '"val-refresh-ground-truth"' "$MANIFEST" 2>/dev/null && echo true || echo false)"
assert "val-validate command field is gaia-val-validate" "$(grep '"val-validate-artifact"' "$MANIFEST" 2>/dev/null | grep -q '"gaia-val-validate"' && echo true || echo false)"
assert "val-validate-plan command field is gaia-val-validate-plan" "$(grep '"val-validate-plan"' "$MANIFEST" 2>/dev/null | grep -q '"gaia-val-validate-plan"' && echo true || echo false)"
assert "val-save command field is gaia-val-save" "$(grep '"val-save-session"' "$MANIFEST" 2>/dev/null | grep -q '"gaia-val-save"' && echo true || echo false)"
assert "val-refresh command field is gaia-refresh-ground-truth" "$(grep '"val-refresh-ground-truth"' "$MANIFEST" 2>/dev/null | grep -q '"gaia-refresh-ground-truth"' && echo true || echo false)"
echo ""

# --- AC8: gaia-help.csv entries ---
echo "AC8: gaia-help.csv has 5 Val command rows"
VAL_HELP_ROWS=$(grep -c '"Val"' "$HELP_CSV" 2>/dev/null || echo "0")
VAL_HELP_ROWS=$(echo "$VAL_HELP_ROWS" | tr -d '[:space:]')
assert "5 Val rows in gaia-help.csv" "$([ "$VAL_HELP_ROWS" -ge 5 ] && echo true || echo false)"
assert "agent-validator row exists" "$(grep -q '"agent-validator","agent-validator"' "$HELP_CSV" 2>/dev/null && echo true || echo false)"
assert "val-validate row exists" "$(grep -q '"val-validate","val-validate"' "$HELP_CSV" 2>/dev/null && echo true || echo false)"
assert "val-validate-plan row exists" "$(grep -q '"val-validate-plan","val-validate-plan"' "$HELP_CSV" 2>/dev/null && echo true || echo false)"
assert "val-save row exists" "$(grep -q '"val-save","val-save"' "$HELP_CSV" 2>/dev/null && echo true || echo false)"
assert "refresh-ground-truth row exists" "$(grep -q '"refresh-ground-truth","refresh-ground-truth"' "$HELP_CSV" 2>/dev/null && echo true || echo false)"
echo ""

# --- Filename validation ---
echo "Filename validation: all kebab-case, no underscores"
for cmd in gaia-agent-validator gaia-val-validate gaia-val-validate-plan gaia-val-save gaia-refresh-ground-truth; do
  assert "$cmd.md is kebab-case (no underscores)" "$(echo "$cmd" | grep -qv '_' && echo true || echo false)"
done
echo ""

# --- Frontmatter structure validation ---
echo "Frontmatter: YAML delimiters and required fields"
for cmd in gaia-agent-validator gaia-val-validate gaia-val-validate-plan gaia-val-save gaia-refresh-ground-truth; do
  FILE="$COMMANDS_DIR/$cmd.md"
  assert "$cmd has opening --- delimiter" "$(head -1 "$FILE" 2>/dev/null | grep -q '^---$' && echo true || echo false)"
  assert "$cmd has name field" "$(grep -q '^name:' "$FILE" 2>/dev/null && echo true || echo false)"
  assert "$cmd has description field" "$(grep -q '^description:' "$FILE" 2>/dev/null && echo true || echo false)"
done
echo ""

# --- Agent vs workflow command differentiation ---
echo "Agent/workflow command differentiation"
FILE="$COMMANDS_DIR/gaia-agent-validator.md"
assert "Agent command does NOT reference workflow.xml" "$(grep -q 'workflow.xml' "$FILE" 2>/dev/null && echo false || echo true)"
assert "Agent command does NOT include \$ARGUMENTS" "$(grep -q '\$ARGUMENTS' "$FILE" 2>/dev/null && echo false || echo true)"
assert "Agent command has WAIT for user input step" "$(grep -q 'WAIT for user input' "$FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- Workflow command body structure ---
echo "Workflow command body: CRITICAL steps block and CORE OS reference"
for cmd in gaia-val-validate gaia-val-validate-plan gaia-val-save gaia-refresh-ground-truth; do
  FILE="$COMMANDS_DIR/$cmd.md"
  assert "$cmd has CRITICAL steps block" "$(grep -q 'CRITICAL' "$FILE" 2>/dev/null && echo true || echo false)"
  assert "$cmd references CORE OS" "$(grep -q 'CORE OS' "$FILE" 2>/dev/null && echo true || echo false)"
  assert "$cmd has Save outputs step" "$(grep -q 'Save outputs' "$FILE" 2>/dev/null && echo true || echo false)"
done
echo ""

# --- Manifest field completeness ---
echo "Manifest field completeness: module, phase, path verification"
assert "val-validate-artifact has lifecycle module" "$(grep '"val-validate-artifact"' "$MANIFEST" 2>/dev/null | grep -q '"lifecycle"' && echo true || echo false)"
assert "val-validate-artifact has 4-implementation phase" "$(grep '"val-validate-artifact"' "$MANIFEST" 2>/dev/null | grep -q '"4-implementation"' && echo true || echo false)"
assert "val-validate-artifact has correct workflow path" "$(grep '"val-validate-artifact"' "$MANIFEST" 2>/dev/null | grep -q 'val-validate-artifact/workflow.yaml' && echo true || echo false)"
assert "val-save-session has lifecycle module" "$(grep '"val-save-session"' "$MANIFEST" 2>/dev/null | grep -q '"lifecycle"' && echo true || echo false)"
assert "val-refresh-ground-truth has lifecycle module" "$(grep '"val-refresh-ground-truth"' "$MANIFEST" 2>/dev/null | grep -q '"lifecycle"' && echo true || echo false)"
echo ""

# --- Help CSV field validation ---
echo "Help CSV: module, phase, and command field per row"
assert "agent-validator has lifecycle module" "$(grep '"agent-validator","agent-validator"' "$HELP_CSV" 2>/dev/null | grep -q '"lifecycle"' && echo true || echo false)"
assert "agent-validator has 4-implementation phase" "$(grep '"agent-validator","agent-validator"' "$HELP_CSV" 2>/dev/null | grep -q '"4-implementation"' && echo true || echo false)"
assert "agent-validator has gaia-agent-validator command" "$(grep '"agent-validator","agent-validator"' "$HELP_CSV" 2>/dev/null | grep -q '"gaia-agent-validator"' && echo true || echo false)"
assert "val-validate has gaia-val-validate command" "$(grep '"val-validate","val-validate"' "$HELP_CSV" 2>/dev/null | grep -q '"gaia-val-validate"' && echo true || echo false)"
assert "val-save has gaia-val-save command" "$(grep '"val-save","val-save"' "$HELP_CSV" 2>/dev/null | grep -q '"gaia-val-save"' && echo true || echo false)"
assert "refresh-ground-truth has gaia-refresh-ground-truth command" "$(grep '"refresh-ground-truth","refresh-ground-truth"' "$HELP_CSV" 2>/dev/null | grep -q '"gaia-refresh-ground-truth"' && echo true || echo false)"
echo ""

# --- Negative tests: no cross-contamination ---
echo "Negative tests: no cross-contamination between commands"
assert "val-validate does NOT reference val-save-session" "$(grep -q 'val-save-session' "$COMMANDS_DIR/gaia-val-validate.md" 2>/dev/null && echo false || echo true)"
assert "val-save does NOT reference val-validate-artifact" "$(grep -q 'val-validate-artifact' "$COMMANDS_DIR/gaia-val-save.md" 2>/dev/null && echo false || echo true)"
assert "refresh-ground-truth does NOT reference val-validate" "$(grep -q 'val-validate-artifact' "$COMMANDS_DIR/gaia-refresh-ground-truth.md" 2>/dev/null && echo false || echo true)"
assert "Agent command does NOT reference any workflow.yaml" "$(grep -q 'workflow.yaml' "$COMMANDS_DIR/gaia-agent-validator.md" 2>/dev/null && echo false || echo true)"
echo ""

# --- Summary ---
echo "================================"
echo "TOTAL: $((PASS + FAIL)) | PASS: $PASS | FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "STATUS: FAILED"
  exit 1
else
  echo "STATUS: ALL PASSED"
  exit 0
fi
