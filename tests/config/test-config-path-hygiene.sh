#!/usr/bin/env bash
# Test script for E8-S18: Framework Config & Path Hygiene
# Validates all 3 acceptance criteria.

set -uo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
ROOT_MANIFEST="$PROJECT_ROOT/_gaia/_config/skill-manifest.csv"
PATH_MANIFEST="$PROJECT_PATH/_gaia/_config/skill-manifest.csv"
ROOT_GITIGNORE="$PROJECT_ROOT/.gitignore"
PATH_GITIGNORE="$PROJECT_PATH/.gitignore"
BUILD_CONFIGS="$PROJECT_ROOT/.claude/commands/gaia-build-configs.md"
ORPHAN_DIR="$PROJECT_ROOT/_gaia/lifecycle/skills"

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

echo "=== E8-S18 Framework Config & Path Hygiene Tests ==="
echo ""

# --- AC1: Manifest sync in build-configs ---
echo "AC1: skill-manifest.csv sync"

# 1.1 Both manifests exist
assert "Root manifest exists" "$([ -f "$ROOT_MANIFEST" ] && echo true || echo false)"
assert "Project-path manifest exists" "$([ -f "$PATH_MANIFEST" ] && echo true || echo false)"

# 1.2 Both manifests are identical (union merge applied)
assert "Manifests are identical" "$(diff -q "$ROOT_MANIFEST" "$PATH_MANIFEST" > /dev/null 2>&1 && echo true || echo false)"

# 1.3 Both manifests contain ground-truth-management (the known divergent entry)
assert "Root manifest has ground-truth-management" "$(grep -q 'ground-truth-management' "$ROOT_MANIFEST" && echo true || echo false)"
assert "Path manifest has ground-truth-management" "$(grep -q 'ground-truth-management' "$PATH_MANIFEST" && echo true || echo false)"

# 1.4 build-configs includes manifest sync step
assert "build-configs has manifest sync step" "$(grep -qi 'skill-manifest' "$BUILD_CONFIGS" && echo true || echo false)"


# 1.5 Both manifests have identical line counts
ROOT_LINES=$(wc -l < "$ROOT_MANIFEST" | tr -d ' ')
PATH_LINES=$(wc -l < "$PATH_MANIFEST" | tr -d ' ')
assert "Manifest line counts match ($ROOT_LINES vs $PATH_LINES)" "$([ "$ROOT_LINES" = "$PATH_LINES" ] && echo true || echo false)"

# 1.6 CSV header row is intact in both manifests
assert "Root manifest has CSV header" "$(head -1 "$ROOT_MANIFEST" | grep -q '^name,displayName,description,path,applicable_agents' && echo true || echo false)"
assert "Path manifest has CSV header" "$(head -1 "$PATH_MANIFEST" | grep -q '^name,displayName,description,path,applicable_agents' && echo true || echo false)"

# 1.7 build-configs has union merge logic steps
assert "build-configs has compare step" "$(grep -qi 'compare\|diverge' "$BUILD_CONFIGS" && echo true || echo false)"
assert "build-configs has union strategy" "$(grep -qi 'union' "$BUILD_CONFIGS" && echo true || echo false)"
assert "build-configs has write-both step" "$(grep -qi 'both locations\|BOTH locations' "$BUILD_CONFIGS" && echo true || echo false)"

echo ""

# --- AC2: Gitignore consolidation ---
echo "AC2: .gitignore pattern consolidation"

# 2.1 Root gitignore has _memory/ patterns
assert "Root .gitignore has _memory/ patterns" "$(grep -q '_memory/' "$ROOT_GITIGNORE" && echo true || echo false)"

# 2.2 Nested gitignore does NOT have _memory/ patterns
assert "Nested .gitignore has NO _memory/ patterns" "$(! grep -q '_memory/' "$PATH_GITIGNORE" && echo true || echo false)"

# 2.3 Nested gitignore still has project-specific patterns
assert "Nested .gitignore has node_modules/" "$(grep -q 'node_modules/' "$PATH_GITIGNORE" && echo true || echo false)"

# 2.4 Root gitignore has no duplicate _memory/ lines
MEMORY_COUNT=$(grep -c '_memory/' "$ROOT_GITIGNORE" || true)
assert "Root .gitignore has no duplicate _memory/ patterns ($MEMORY_COUNT occurrences)" "$([ "$MEMORY_COUNT" -le 2 ] && echo true || echo false)"

echo ""

# --- AC3: Orphaned empty directory removed ---
echo "AC3: Empty directory cleanup"

# 3.1 Orphaned directory does not exist
assert "Orphaned _gaia/lifecycle/skills/ removed" "$([ ! -d "$ORPHAN_DIR" ] && echo true || echo false)"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
