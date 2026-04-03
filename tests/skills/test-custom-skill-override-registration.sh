#!/usr/bin/env bash
# Test script for E14-S10: Register Custom Git-Workflow Skill Override
# Validates all 5 acceptance criteria structurally.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
CUSTOM_FILE="$PROJECT_ROOT/custom/skills/all-dev.customize.yaml"
FRAMEWORK_FILE="$PROJECT_ROOT/_gaia/_config/agents/all-dev.customize.yaml"
GIT_WORKFLOW_FILE="$PROJECT_ROOT/custom/skills/git-workflow.md"

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

echo "=== E14-S10 Custom Skill Override Registration Tests ==="
echo ""

# --- AC1: File exists with valid YAML containing git-workflow override ---
echo "AC1: custom/skills/all-dev.customize.yaml exists with git-workflow override"
assert "File exists" "$([ -f "$CUSTOM_FILE" ] && echo true || echo false)"
# Validate YAML syntax: top-level key exists, proper indentation (spaces not tabs), no syntax errors
YAML_VALID="true"
# Check file is non-empty
[ -s "$CUSTOM_FILE" ] || YAML_VALID="false"
# Check no tabs (YAML requires spaces)
grep -qP '\t' "$CUSTOM_FILE" 2>/dev/null && YAML_VALID="false"
# Check has a top-level mapping key
grep -qE '^[a-z_]+:' "$CUSTOM_FILE" 2>/dev/null || YAML_VALID="false"
assert "Valid YAML syntax (structural check)" "$YAML_VALID"
assert "Contains skill_overrides key" "$(grep -q 'skill_overrides' "$CUSTOM_FILE" 2>/dev/null && echo true || echo false)"
assert "Contains git-workflow override entry" "$(grep -q 'git-workflow' "$CUSTOM_FILE" 2>/dev/null && echo true || echo false)"
assert "git-workflow source points to custom/skills/git-workflow.md" "$(grep -q 'custom/skills/git-workflow.md' "$CUSTOM_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC2: Engine discovery — custom path checked before framework path ---
echo "AC2: workflow.xml engine checks custom/skills/ before _gaia/_config/agents/"
ENGINE_FILE="$PROJECT_ROOT/_gaia/core/engine/workflow.xml"
# The engine step 3 must reference custom/skills/ lookup path
assert "Engine references custom/skills/ lookup path" "$(grep -q 'custom/skills/' "$ENGINE_FILE" 2>/dev/null && echo true || echo false)"
# The engine's numbered lookup order must list custom/skills/ as step 1 (primary) and _gaia/_config/agents/ as step 2 (fallback)
assert "Engine lists custom/skills/ as step 1 (primary location)" "$(grep -q '1\. Check.*custom/skills/' "$ENGINE_FILE" 2>/dev/null && echo true || echo false)"
assert "Engine lists _gaia/_config/agents/ as step 2 (fallback)" "$(grep -q '2\. Fall back.*_gaia/_config/agents/' "$ENGINE_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC3: custom/skills/git-workflow.md is NOT modified ---
echo "AC3: git-workflow.md content unchanged"
EXPECTED_SHA="07a5f7e543449c907c0639bbaedcad6cbfb095c0415698fbe6fd083e87d26649"
ACTUAL_SHA=$(shasum -a 256 "$GIT_WORKFLOW_FILE" 2>/dev/null | awk '{print $1}')
assert "git-workflow.md sha256 matches pre-change checksum" "$([ "$ACTUAL_SHA" = "$EXPECTED_SHA" ] && echo true || echo false)"
echo ""

# --- AC4: custom/skills/ takes precedence (file-level replacement) ---
echo "AC4: custom file takes precedence over framework file"
assert "Both custom and framework files exist" "$([ -f "$CUSTOM_FILE" ] && [ -f "$FRAMEWORK_FILE" ] && echo true || echo false)"
# The engine's lookup order is verified in AC2 — custom/skills/ is checked first
# Per ADR-020 file-level replacement: if custom/skills/ file exists, _gaia/_config/agents/ is skipped entirely
assert "Engine uses file-level replacement semantics" "$(grep -q 'file-level replacement' "$ENGINE_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC5: code-review-standards override preserved ---
echo "AC5: Existing overrides preserved in custom file"
assert "Contains code-review-standards override" "$(grep -q 'code-review-standards' "$CUSTOM_FILE" 2>/dev/null && echo true || echo false)"
assert "code-review-standards source points to custom/skills/code-review-standards.md" "$(grep -q 'custom/skills/code-review-standards.md' "$CUSTOM_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- Summary ---
echo "==================================="
echo "Results: $PASS passed, $FAIL failed"
echo "==================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
