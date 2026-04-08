#!/usr/bin/env bash
# Test script for E13-S2: Shared Figma Integration Skill File
# Validates all 5 acceptance criteria structurally.

set -uo pipefail

# Resolve PROJECT_ROOT relative to script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SKILL_FILE="$PROJECT_ROOT/_gaia/dev/skills/figma-integration.md"
SKILL_INDEX="$PROJECT_ROOT/_gaia/dev/skills/_skill-index.yaml"
MANIFEST="$PROJECT_ROOT/_gaia/_config/manifest.yaml"

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

echo "=== E13-S2 Shared Figma Integration Skill Tests ==="
echo ""

# --- AC1: Skill file exists with correct frontmatter ---
echo "AC1: Skill file exists at correct path with correct frontmatter"
assert "File exists at _gaia/dev/skills/figma-integration.md" "$([ -f "$SKILL_FILE" ] && echo true || echo false)"
assert "Frontmatter contains requires_mcp: design-tool" "$(grep -q 'requires_mcp:.*design-tool' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Lists typescript-dev in applicable_agents" "$(grep -q 'typescript-dev' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Lists angular-dev in applicable_agents" "$(grep -q 'angular-dev' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Lists flutter-dev in applicable_agents" "$(grep -q 'flutter-dev' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Lists java-dev in applicable_agents" "$(grep -q 'java-dev' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Lists python-dev in applicable_agents" "$(grep -q 'python-dev' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Lists mobile-dev in applicable_agents" "$(grep -q 'mobile-dev' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC2: All 6 section markers present ---
echo "AC2: Exactly 6 SECTION markers present"
assert "Has SECTION: detection marker" "$(grep -q '<!-- SECTION: detection -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Has SECTION: tokens marker" "$(grep -q '<!-- SECTION: tokens -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Has SECTION: components marker" "$(grep -q '<!-- SECTION: components -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Has SECTION: frames marker" "$(grep -q '<!-- SECTION: frames -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Has SECTION: assets marker" "$(grep -q '<!-- SECTION: assets -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Has SECTION: export marker" "$(grep -q '<!-- SECTION: export -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
SECTION_COUNT=$(grep -c '<!-- SECTION:' "$SKILL_FILE" 2>/dev/null || echo "0")
assert "At least 6 SECTION markers (found: $SECTION_COUNT)" "$([ "$SECTION_COUNT" -ge 6 ] && echo true || echo false)"
echo ""

# --- AC3: Line count within budget (500-line max per product CLAUDE.md) ---
echo "AC3: File line count is 500 or fewer"
if [ -f "$SKILL_FILE" ]; then
  LINE_COUNT=$(wc -l < "$SKILL_FILE" | tr -d ' ')
  assert "Line count ($LINE_COUNT) <= 500" "$([ "$LINE_COUNT" -le 500 ] && echo true || echo false)"
else
  assert "Line count <= 500 (file missing)" "false"
fi
echo ""

# --- AC4: Skill registered in _skill-index.yaml ---
echo "AC4: Skill registered in _skill-index.yaml with 6 sections"
assert "figma-integration.md entry exists in _skill-index.yaml" "$(grep -q 'figma-integration.md' "$SKILL_INDEX" 2>/dev/null && echo true || echo false)"
assert "Index has detection section for figma-integration" "$(sed -n '/figma-integration\.md/,$ p' "$SKILL_INDEX" 2>/dev/null | grep -q 'id: detection' && echo true || echo false)"

# Count figma-integration section entries in the index
if grep -q 'figma-integration.md' "$SKILL_INDEX" 2>/dev/null; then
  # Extract the figma-integration block and count section IDs
  FIGMA_SECTIONS=$(awk '/figma-integration\.md/{found=1} found && /^  - file:/ && !/figma-integration/{found=0} found && /id:/{count++} END{print count+0}' "$SKILL_INDEX" 2>/dev/null)
  assert "Index has at least 6 sections for figma-integration (found: $FIGMA_SECTIONS)" "$([ "$FIGMA_SECTIONS" -ge 6 ] && echo true || echo false)"
else
  assert "Index has at least 6 sections for figma-integration (entry missing)" "false"
fi

# Validate line ranges match actual section marker positions
if [ -f "$SKILL_FILE" ] && grep -q 'figma-integration.md' "$SKILL_INDEX" 2>/dev/null; then
  for SECTION_ID in detection tokens components frames assets export; do
    # Get the expected start line from _skill-index.yaml
    EXPECTED_START=$(grep -A1 "id: $SECTION_ID" "$SKILL_INDEX" 2>/dev/null | grep 'line_range' | head -1 | sed 's/.*\[//;s/,.*//')
    if [ -n "$EXPECTED_START" ]; then
      # Get the actual line of the SECTION marker in the skill file
      ACTUAL_LINE=$(grep -n "<!-- SECTION: $SECTION_ID -->" "$SKILL_FILE" 2>/dev/null | cut -d: -f1)
      assert "Section '$SECTION_ID' line range start ($EXPECTED_START) matches actual marker position ($ACTUAL_LINE)" "$([ "$EXPECTED_START" = "$ACTUAL_LINE" ] && echo true || echo false)"
    else
      assert "Section '$SECTION_ID' has line_range in index" "false"
    fi
  done
else
  for SECTION_ID in detection tokens components frames assets export; do
    assert "Section '$SECTION_ID' line range validation (prerequisites missing)" "false"
  done
fi
echo ""

# --- AC5: DesignToolProvider interface with 5 operations ---
echo "AC5: DesignToolProvider interface with adapter pattern"
assert "DesignToolProvider interface defined" "$(grep -q 'DesignToolProvider' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "detect() operation documented" "$(grep -q 'detect()' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "getTokens() operation documented" "$(grep -q 'getTokens()' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "getComponents() operation documented" "$(grep -q 'getComponents()' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "getFrames() operation documented" "$(grep -q 'getFrames()' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "exportAssets() operation documented" "$(grep -q 'exportAssets()' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "FigmaAdapter documented as concrete implementation" "$(grep -q 'FigmaAdapter' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "FigmaAdapter uses figma_ MCP prefix" "$(grep -q 'figma_\|figma/' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "PenpotAdapter placeholder documented" "$(grep -q 'PenpotAdapter' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "SketchAdapter placeholder documented" "$(grep -q 'SketchAdapter' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "penpot_ prefix referenced" "$(grep -q 'penpot_' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "sketch_ prefix referenced" "$(grep -q 'sketch_' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- Additional: Per-stack resolution table ---
echo "Additional: Per-stack resolution table in export section"
assert "CSS custom properties for Cleo/typescript" "$(grep -qi 'css custom properties\|CSS variables\|--var' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "SCSS variables for Lena/angular" "$(grep -qi 'scss\|SCSS' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Dart ThemeData for Freya/flutter" "$(grep -qi 'ThemeData\|dart' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Spring properties for Hugo/java" "$(grep -qi 'spring\|\.properties' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Python dict for Ravi/python" "$(grep -qi 'python.*dict\|dict(' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "RN StyleSheet/Swift/Compose for Talia/mobile" "$(grep -qi 'StyleSheet\|swift\|compose' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- Additional: No secrets in skill file ---
echo "Additional: Security — no hardcoded secrets"
if [ -f "$SKILL_FILE" ]; then
  assert "No API keys or tokens in file" "$(grep -qi 'figd_\|api_key\|secret\|password\|Bearer ' "$SKILL_FILE" 2>/dev/null && echo false || echo true)"
else
  assert "No API keys or tokens (file missing)" "true"
fi
echo ""

# --- Summary ---
echo "================================"
echo "Total: $((PASS + FAIL)) | PASS: $PASS | FAIL: $FAIL"
echo "================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
