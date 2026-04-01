#!/usr/bin/env bash
# File: tests/config/test-prd-template-gap-categories.sh
# E11-S12: Enhance PRD Template with Gap Categories
# Run: bash tests/config/test-prd-template-gap-categories.sh

set -euo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"

# Both copies of the PRD template
RUNNING_TEMPLATE="$PROJECT_ROOT/_gaia/lifecycle/templates/prd-template.md"
PRODUCT_TEMPLATE="$PROJECT_PATH/_gaia/lifecycle/templates/prd-template.md"

PASS=0
FAIL=0
TOTAL=0

assert_contains() {
  local desc="$1" file="$2" pattern="$3"
  TOTAL=$((TOTAL + 1))
  if grep -q "$pattern" "$file"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (pattern not found: $pattern)"
    FAIL=$((FAIL + 1))
  fi
}

assert_count() {
  local desc="$1" file="$2" pattern="$3" expected="$4"
  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(grep -c "$pattern" "$file" || true)
  if [[ "$actual" -eq "$expected" ]]; then
    echo "  PASS: $desc (count: $actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local desc="$1" file="$2" pattern="$3"
  TOTAL=$((TOTAL + 1))
  if grep -q "$pattern" "$file"; then
    echo "  FAIL: $desc (pattern should NOT be present: $pattern)"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  fi
}

echo ""
echo "=== E11-S12: PRD Template Gap Categories ==="
echo ""

# --- AC1: 7 gap category sections with schema enum values ---
echo "--- AC1: 7 gap category sections ---"
assert_contains "Config Contradictions section exists" "$RUNNING_TEMPLATE" "### Config Contradictions"
assert_contains "Dead Code & Dead State section exists" "$RUNNING_TEMPLATE" "### Dead Code & Dead State"
assert_contains "Hard-Coded Business Logic section exists" "$RUNNING_TEMPLATE" "### Hard-Coded Business Logic"
assert_contains "Security Endpoints section exists" "$RUNNING_TEMPLATE" "### Security Endpoints"
assert_contains "Runtime Behaviors section exists" "$RUNNING_TEMPLATE" "### Runtime Behaviors"
assert_contains "Documentation Drift section exists" "$RUNNING_TEMPLATE" "### Documentation Drift"
assert_contains "Integration Seams section exists" "$RUNNING_TEMPLATE" "### Integration Seams"

# Schema enum values in headers
assert_contains "Config Contradictions has 'configuration' enum" "$RUNNING_TEMPLATE" "configuration"
assert_contains "Dead Code has 'functional' enum" "$RUNNING_TEMPLATE" "functional"
assert_contains "Security Endpoints has 'security' enum" "$RUNNING_TEMPLATE" "security"
assert_contains "Runtime Behaviors has 'behavioral' enum" "$RUNNING_TEMPLATE" "behavioral"
assert_contains "Runtime Behaviors has 'operational' enum" "$RUNNING_TEMPLATE" "operational"
assert_contains "Documentation Drift has 'documentation' enum" "$RUNNING_TEMPLATE" "documentation"
assert_contains "Integration Seams has 'data-integrity' enum" "$RUNNING_TEMPLATE" "data-integrity"

# --- AC2: Each section has 8-column table ---
echo ""
echo "--- AC2: 8-column gap tables ---"
assert_contains "Table header with ID column" "$RUNNING_TEMPLATE" "| ID | Severity | Title | Description | Evidence | Recommendation | Verified By | Confidence |"
assert_count "8-column table header appears 7 times" "$RUNNING_TEMPLATE" "| ID | Severity | Title | Description | Evidence | Recommendation | Verified By | Confidence |" 7

# --- AC3: Verified By enum values ---
echo ""
echo "--- AC3: Verified By enum values ---"
assert_contains "machine-detected in legend" "$RUNNING_TEMPLATE" "machine-detected"
assert_contains "adversarial-review-detected in legend" "$RUNNING_TEMPLATE" "adversarial-review-detected"
assert_contains "code-verified in legend" "$RUNNING_TEMPLATE" "code-verified"
assert_contains "human-reported in legend" "$RUNNING_TEMPLATE" "human-reported"

# --- AC4: Gap Summary table ---
echo ""
echo "--- AC4: Gap Summary table ---"
assert_contains "Gap Analysis Summary section" "$RUNNING_TEMPLATE" "## Gap Analysis Summary"
assert_contains "Summary table has Category column" "$RUNNING_TEMPLATE" "| Category | Critical | High | Medium | Low | Total |"
assert_contains "Summary table has Overall total row" "$RUNNING_TEMPLATE" "Overall"

# --- AC5: Backward compatibility (existing sections still present) ---
echo ""
echo "--- AC5: Backward compatibility ---"
assert_contains "Section 1 Overview still exists" "$RUNNING_TEMPLATE" "## 1. Overview"
assert_contains "Section 12 Open Questions still exists" "$RUNNING_TEMPLATE" "## 12. Open Questions"
assert_contains "Frontmatter template marker preserved" "$RUNNING_TEMPLATE" "template: 'prd'"

# --- AC6: Empty category placeholder ---
echo ""
echo "--- AC6: Empty category placeholder ---"
assert_contains "Empty category placeholder row" "$RUNNING_TEMPLATE" "No gaps detected in this category"
assert_count "Placeholder row appears 7 times" "$RUNNING_TEMPLATE" "No gaps detected in this category" 7

# --- AC7: Brownfield-only conditional markers ---
echo ""
echo "--- AC7: Brownfield-only markers ---"
assert_contains "BROWNFIELD-ONLY-START marker" "$RUNNING_TEMPLATE" "<!-- BROWNFIELD-ONLY-START -->"
assert_contains "BROWNFIELD-ONLY-END marker" "$RUNNING_TEMPLATE" "<!-- BROWNFIELD-ONLY-END -->"

# --- AC8 (Test 9): Both copies are identical ---
echo ""
echo "--- Both copies identical ---"
TOTAL=$((TOTAL + 1))
if diff -q "$RUNNING_TEMPLATE" "$PRODUCT_TEMPLATE" > /dev/null 2>&1; then
  echo "  PASS: Running framework and product source templates are identical"
  PASS=$((PASS + 1))
else
  echo "  FAIL: Templates differ between running framework and product source"
  FAIL=$((FAIL + 1))
fi

# --- Summary ---
echo ""
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
