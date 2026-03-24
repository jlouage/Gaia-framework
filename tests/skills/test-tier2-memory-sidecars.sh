#!/usr/bin/env bash
# Test script for E9-S4: Tier 2 Memory — Gaia, Zara, Soren, Sable
# Validates all 7 acceptance criteria.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
MEMORY_PATH="$PROJECT_ROOT/_memory"

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

echo "=== E9-S4 Tier 2 Memory Sidecar Tests ==="
echo ""

# --- AC1: Orchestrator sidecar ---
echo "AC1: Orchestrator sidecar contains decision-log.md and conversation-context.md"

if [ -f "$MEMORY_PATH/orchestrator-sidecar/decision-log.md" ]; then
  assert "orchestrator decision-log.md exists" "true"
else
  assert "orchestrator decision-log.md exists" "false"
fi

if [ -f "$MEMORY_PATH/orchestrator-sidecar/conversation-context.md" ]; then
  assert "orchestrator conversation-context.md exists" "true"
else
  assert "orchestrator conversation-context.md exists" "false"
fi

# Check standard headers
if grep -q "# Decision Log" "$MEMORY_PATH/orchestrator-sidecar/decision-log.md" 2>/dev/null; then
  assert "orchestrator decision-log has standard header" "true"
else
  assert "orchestrator decision-log has standard header" "false"
fi

if grep -q "# Conversation Context" "$MEMORY_PATH/orchestrator-sidecar/conversation-context.md" 2>/dev/null; then
  assert "orchestrator conversation-context has standard header" "true"
else
  assert "orchestrator conversation-context has standard header" "false"
fi

# Check frontmatter tier
if grep -q "tier: 2" "$MEMORY_PATH/orchestrator-sidecar/decision-log.md" 2>/dev/null; then
  assert "orchestrator decision-log declares tier 2" "true"
else
  assert "orchestrator decision-log declares tier 2" "false"
fi

echo ""

# --- AC2: Security sidecar ---
echo "AC2: Security sidecar with migrated content"

if [ -f "$MEMORY_PATH/security-sidecar/decision-log.md" ]; then
  assert "security decision-log.md exists" "true"
else
  assert "security decision-log.md exists" "false"
fi

if [ -f "$MEMORY_PATH/security-sidecar/conversation-context.md" ]; then
  assert "security conversation-context.md exists" "true"
else
  assert "security conversation-context.md exists" "false"
fi

# Check migrated entries (6 entries from threat-model-decisions.md)
SECURITY_ENTRY_COUNT=$(grep -c '### \[' "$MEMORY_PATH/security-sidecar/decision-log.md" 2>/dev/null || echo "0")
if [ "$SECURITY_ENTRY_COUNT" -ge 6 ]; then
  assert "security decision-log has >= 6 migrated entries (found $SECURITY_ENTRY_COUNT)" "true"
else
  assert "security decision-log has >= 6 migrated entries (found $SECURITY_ENTRY_COUNT)" "false"
fi

echo ""

# --- AC3: DevOps sidecar ---
echo "AC3: DevOps sidecar with migrated content"

if [ -f "$MEMORY_PATH/devops-sidecar/decision-log.md" ]; then
  assert "devops decision-log.md exists" "true"
else
  assert "devops decision-log.md exists" "false"
fi

if [ -f "$MEMORY_PATH/devops-sidecar/conversation-context.md" ]; then
  assert "devops conversation-context.md exists" "true"
else
  assert "devops conversation-context.md exists" "false"
fi

# Check migrated entries (8 entries from infrastructure-decisions.md)
DEVOPS_ENTRY_COUNT=$(grep -c '### \[' "$MEMORY_PATH/devops-sidecar/decision-log.md" 2>/dev/null || echo "0")
if [ "$DEVOPS_ENTRY_COUNT" -ge 8 ]; then
  assert "devops decision-log has >= 8 migrated entries (found $DEVOPS_ENTRY_COUNT)" "true"
else
  assert "devops decision-log has >= 8 migrated entries (found $DEVOPS_ENTRY_COUNT)" "false"
fi

echo ""

# --- AC4: Test Architect sidecar ---
echo "AC4: Test Architect sidecar contains decision-log.md and conversation-context.md"

if [ -f "$MEMORY_PATH/test-architect-sidecar/decision-log.md" ]; then
  assert "test-architect decision-log.md exists" "true"
else
  assert "test-architect decision-log.md exists" "false"
fi

if [ -f "$MEMORY_PATH/test-architect-sidecar/conversation-context.md" ]; then
  assert "test-architect conversation-context.md exists" "true"
else
  assert "test-architect conversation-context.md exists" "false"
fi

if grep -q "# Decision Log" "$MEMORY_PATH/test-architect-sidecar/decision-log.md" 2>/dev/null; then
  assert "test-architect decision-log has standard header" "true"
else
  assert "test-architect decision-log has standard header" "false"
fi

if grep -q "tier: 2" "$MEMORY_PATH/test-architect-sidecar/decision-log.md" 2>/dev/null; then
  assert "test-architect decision-log declares tier 2" "true"
else
  assert "test-architect decision-log declares tier 2" "false"
fi

echo ""

# --- AC5: Persona declarations ---
echo "AC5: Agent persona files have correct memory sidecar declarations"

ORCH_FILE="$PROJECT_ROOT/_gaia/core/agents/orchestrator.md"
SEC_FILE="$PROJECT_ROOT/_gaia/lifecycle/agents/security.md"
DEVOPS_FILE="$PROJECT_ROOT/_gaia/lifecycle/agents/devops.md"
TA_FILE="$PROJECT_ROOT/_gaia/testing/agents/test-architect.md"

if grep -q 'sidecar="_memory/orchestrator-sidecar/decision-log.md"' "$ORCH_FILE" 2>/dev/null && \
   grep -q 'sidecar="_memory/orchestrator-sidecar/conversation-context.md"' "$ORCH_FILE" 2>/dev/null; then
  assert "orchestrator.md has correct sidecar declarations" "true"
else
  assert "orchestrator.md has correct sidecar declarations" "false"
fi

if grep -q 'sidecar="_memory/security-sidecar/decision-log.md"' "$SEC_FILE" 2>/dev/null && \
   grep -q 'sidecar="_memory/security-sidecar/conversation-context.md"' "$SEC_FILE" 2>/dev/null; then
  assert "security.md has correct sidecar declarations" "true"
else
  assert "security.md has correct sidecar declarations" "false"
fi

if grep -q 'sidecar="_memory/devops-sidecar/decision-log.md"' "$DEVOPS_FILE" 2>/dev/null && \
   grep -q 'sidecar="_memory/devops-sidecar/conversation-context.md"' "$DEVOPS_FILE" 2>/dev/null; then
  assert "devops.md has correct sidecar declarations" "true"
else
  assert "devops.md has correct sidecar declarations" "false"
fi

if grep -q 'sidecar="_memory/test-architect-sidecar/decision-log.md"' "$TA_FILE" 2>/dev/null && \
   grep -q 'sidecar="_memory/test-architect-sidecar/conversation-context.md"' "$TA_FILE" 2>/dev/null; then
  assert "test-architect.md has correct sidecar declarations" "true"
else
  assert "test-architect.md has correct sidecar declarations" "false"
fi

echo ""

# --- AC6: Legacy files removed, entries in E9-S3 format ---
echo "AC6: Legacy files removed and entries in E9-S3 format"

if [ ! -f "$MEMORY_PATH/security-sidecar/threat-model-decisions.md" ]; then
  assert "threat-model-decisions.md removed" "true"
else
  assert "threat-model-decisions.md removed" "false"
fi

if [ ! -f "$MEMORY_PATH/devops-sidecar/infrastructure-decisions.md" ]; then
  assert "infrastructure-decisions.md removed" "true"
else
  assert "infrastructure-decisions.md removed" "false"
fi

# Verify E9-S3 format: entries must have Agent, Sprint, Status, Related fields
for agent_dir in security-sidecar devops-sidecar; do
  DL="$MEMORY_PATH/$agent_dir/decision-log.md"
  if [ -f "$DL" ]; then
    MISSING_FIELDS=""
    for field in "Agent" "Sprint" "Status" "Related"; do
      if ! grep -q "\*\*$field:\*\*" "$DL" 2>/dev/null; then
        MISSING_FIELDS="$MISSING_FIELDS $field"
      fi
    done
    if [ -z "$MISSING_FIELDS" ]; then
      assert "$agent_dir decision-log uses E9-S3 format" "true"
    else
      assert "$agent_dir decision-log uses E9-S3 format (missing:$MISSING_FIELDS)" "false"
    fi
  else
    assert "$agent_dir decision-log uses E9-S3 format (file missing)" "false"
  fi
done

echo ""

# --- AC7: Archive directories and gitignore ---
echo "AC7: Archive directories and gitignore coverage"

for agent_dir in orchestrator-sidecar security-sidecar devops-sidecar test-architect-sidecar; do
  if [ -d "$MEMORY_PATH/$agent_dir/archive" ]; then
    assert "$agent_dir/archive/ directory exists" "true"
  else
    assert "$agent_dir/archive/ directory exists" "false"
  fi
done

# Check gitignore covers archive pattern
if grep -q '_memory/\*.*archive' "$PROJECT_ROOT/.gitignore" 2>/dev/null || \
   grep -q '_memory/\*/archive' "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
  assert ".gitignore covers _memory/*/archive/ pattern" "true"
else
  assert ".gitignore covers _memory/*/archive/ pattern" "false"
fi

echo ""

# --- Budget compliance ---
echo "Budget: Sidecar file sizes under 50K token budget (~200KB)"

for agent_dir in orchestrator-sidecar security-sidecar devops-sidecar test-architect-sidecar; do
  TOTAL_SIZE=0
  for f in "$MEMORY_PATH/$agent_dir"/*.md; do
    if [ -f "$f" ]; then
      FILE_SIZE=$(wc -c < "$f" 2>/dev/null || echo "0")
      TOTAL_SIZE=$((TOTAL_SIZE + FILE_SIZE))
    fi
  done
  if [ "$TOTAL_SIZE" -lt 200000 ]; then
    assert "$agent_dir total size ${TOTAL_SIZE}B < 200KB budget" "true"
  else
    assert "$agent_dir total size ${TOTAL_SIZE}B < 200KB budget" "false"
  fi
done

echo ""
echo "=== Results ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
echo "TOTAL: $((PASS + FAIL))"

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
