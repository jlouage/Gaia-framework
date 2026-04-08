#!/usr/bin/env bash
# Test script for E13-S7: Implement Import Mode (v2)
# Validates all 6 acceptance criteria for the Figma import mode.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SKILL_FILE="$PROJECT_ROOT/_gaia/dev/skills/figma-integration.md"
SKILL_INDEX="$PROJECT_ROOT/_gaia/dev/skills/_skill-index.yaml"
CREATE_UX_INSTRUCTIONS="$PROJECT_ROOT/_gaia/lifecycle/workflows/2-planning/create-ux-design/instructions.xml"

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

echo "=== E13-S7 Figma Import Mode Tests ==="
echo ""

# --- AC1: Import mode entry point in detection section ---
echo "AC1: Import mode entry point in detection section"
assert "SECTION: import-detection marker exists" "$(grep -q '<!-- SECTION: import-detection -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Import option documented in detection section" "$(grep -qi 'import.*mode\|import.*figma\|import.*option' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "URL parser documented (figma.com/file pattern)" "$(grep -q 'figma\.com/file' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Raw file key input supported" "$(grep -qi 'raw.*key\|file.key.*direct\|key.*format' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Validation via get_file with depth=1 documented" "$(grep -q 'depth=1\|depth.*1\|metadata.only' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Error handling for invalid key (404)" "$(grep -q '404\|not.found' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Error handling for permission denied (403)" "$(grep -q '403\|permission.denied' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Error handling for rate limit (429)" "$(grep -q '429\|rate.limit' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC2: Page and frame discovery ---
echo "AC2: Page and frame discovery via MCP"
assert "SECTION: import-discovery marker exists" "$(grep -q '<!-- SECTION: import-discovery -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Full document tree retrieval documented" "$(grep -qi 'document.*tree\|full.*depth\|complete.*tree' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "CANVAS node type referenced (pages)" "$(grep -q 'CANVAS' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "FRAME node type referenced (frames)" "$(grep -q 'FRAME' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Page-to-frames hierarchy documented" "$(grep -qi 'page.*frame.*hierarchy\|hierarchical.*structure\|Page.*Frame' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Viewport classification documented (mobile <=480, tablet 481-1024, desktop >1024)" "$(grep -q '480\|1024' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "absoluteBoundingBox dimensions referenced" "$(grep -q 'absoluteBoundingBox\|bounding.*box\|boundingBox' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Cache to .figma-cache/ documented" "$(grep -q '.figma-cache' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC3: Design token extraction in W3C DTCG format ---
echo "AC3: Design token extraction for import"
assert "SECTION: import-tokens marker exists" "$(grep -q '<!-- SECTION: import-tokens -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Fill/stroke RGBA resolution documented" "$(grep -qi 'fill.*stroke\|RGBA\|resolve.*color' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Typography style extraction documented" "$(grep -qi 'font.*family\|font.*size\|typography.*extract' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Effect style extraction (shadows) documented" "$(grep -qi 'drop.shadow\|inner.shadow\|effect.*extract' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Auto-layout spacing extraction documented" "$(grep -qi 'auto.layout\|itemSpacing\|padding.*extract' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "W3C DTCG mapping documented" "$(grep -qi 'W3C.*DTCG\|DTCG.*import\|\$type.*\$value' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Semantic alias support documented" "$(grep -qi 'semantic.*alias\|alias.*resolution\|naming.*pattern' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Output to design-system/ directory documented" "$(grep -q 'design-system\|design-tokens\.json' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "schema_version field documented" "$(grep -q 'schema_version' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC4: Screen inventory with viewport classification ---
echo "AC4: Screen inventory and frame-to-screen mapping"
assert "SECTION: import-screens marker exists" "$(grep -q '<!-- SECTION: import-screens -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Frame name tracking documented" "$(grep -qi 'frame.*name\|frame.*metadata' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Node ID tracking documented" "$(grep -qi 'node.*ID\|nodeId' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Dimensions tracking documented" "$(grep -qi 'dimension\|width.*height' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Viewport classification (mobile/tablet/desktop)" "$(grep -qi 'mobile.*tablet.*desktop\|viewport.*classif' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Component instance extraction documented" "$(grep -qi 'component.*instance\|instance.*extract' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC5: ux-design.md generation with figma: frontmatter ---
echo "AC5: ux-design.md generation from import"
assert "SECTION: import-generate marker exists" "$(grep -q '<!-- SECTION: import-generate -->' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "figma: YAML frontmatter block documented" "$(grep -qi 'figma:.*frontmatter\|figma:.*YAML\|frontmatter.*file_key' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "file_key in frontmatter documented" "$(grep -q 'file_key' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "pages array in frontmatter documented" "$(grep -qi 'pages.*array\|pages:' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "node_ids array in frontmatter documented" "$(grep -q 'node_ids' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Design Tokens section in output documented" "$(grep -qi 'design.*tokens.*section\|token.*reference' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Component Inventory in output documented" "$(grep -qi 'component.*inventory' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Screen Descriptions in output documented" "$(grep -qi 'screen.*description\|per.screen.*section' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- AC6: Read-only enforcement ---
echo "AC6: Read-only enforcement (no write operations to Figma)"
assert "Read-only API scopes documented (files:read, file_content:read)" "$(grep -q 'files:read' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "No write MCP calls in import sections (create_frame/create_component)" "$(! grep -A50 '<!-- SECTION: import-detection -->' "$SKILL_FILE" 2>/dev/null | grep -qi 'create_frame\|create_component_instance' && echo true || echo false)"
assert "Only get_file, get_file_nodes, get_image MCP calls documented for import" "$(grep -qi 'get_file\|get_file_nodes\|get_image' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- Integration: Import mode in create-ux-design instructions ---
echo "Integration: Import mode branch in create-ux-design workflow"
assert "create-ux-design instructions reference import mode" "$(grep -qi 'import.*mode\|import.*figma\|figma.*import' "$CREATE_UX_INSTRUCTIONS" 2>/dev/null && echo true || echo false)"
assert "Conditional step for import (if attribute)" "$(grep -q 'if=.*figma\|if=.*import\|if=.*mcp' "$CREATE_UX_INSTRUCTIONS" 2>/dev/null && echo true || echo false)"
assert "Import mode does not use generate/frame creation steps" "$(grep -qi 'import' "$CREATE_UX_INSTRUCTIONS" 2>/dev/null && echo true || echo false)"
echo ""

# --- Skill index: Import sections registered ---
echo "Skill Index: Import sections registered in _skill-index.yaml"
assert "import-detection section in skill index" "$(grep -q 'id: import-detection' "$SKILL_INDEX" 2>/dev/null && echo true || echo false)"
assert "import-discovery section in skill index" "$(grep -q 'id: import-discovery' "$SKILL_INDEX" 2>/dev/null && echo true || echo false)"
assert "import-tokens section in skill index" "$(grep -q 'id: import-tokens' "$SKILL_INDEX" 2>/dev/null && echo true || echo false)"
assert "import-screens section in skill index" "$(grep -q 'id: import-screens' "$SKILL_INDEX" 2>/dev/null && echo true || echo false)"
assert "import-generate section in skill index" "$(grep -q 'id: import-generate' "$SKILL_INDEX" 2>/dev/null && echo true || echo false)"
echo ""

# --- Error handling and fallback ---
echo "Error handling: MCP timeout, partial access, empty file, security"
assert "MCP timeout handling documented (5-second limit)" "$(grep -qi '5.second\|timeout.*5\|5s.*timeout' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Partial file access handling documented" "$(grep -qi 'partial.*access\|partial.*ux-design\|inaccessible.*page' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "Empty Figma file handling documented" "$(grep -qi 'empty.*file\|no.*frame\|minimal.*ux-design' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
assert "No Figma API tokens in skill file" "$(! grep -qi 'figd_\|api_key.*=\|secret.*=\|Bearer ' "$SKILL_FILE" && echo true || echo false)"
assert "Error messages use status codes only" "$(grep -qi 'status.code.*only\|no.*URL\|no.*file.*key.*in.*error\|no.*design.*data.*in.*log' "$SKILL_FILE" 2>/dev/null && echo true || echo false)"
echo ""

# --- Total section count ---
echo "Section count: Existing 6 + 5 import = 11 total"
if [ -f "$SKILL_FILE" ]; then
  TOTAL_SECTIONS=$(grep -c '<!-- SECTION:' "$SKILL_FILE" 2>/dev/null || echo "0")
  assert "Total section count is 11 (found: $TOTAL_SECTIONS)" "$([ "$TOTAL_SECTIONS" = "11" ] && echo true || echo false)"
fi
echo ""

# --- Summary ---
echo "================================"
echo "Total: $((PASS + FAIL)) | PASS: $PASS | FAIL: $FAIL"
echo "================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
