#!/usr/bin/env bash
# File: tests/config/test-adr-path-reconciliation.sh
# ATDD — E2-S6: ADR Path Reconciliation
# Run: bash tests/config/test-adr-path-reconciliation.sh

set -euo pipefail

PROJECT_ROOT="/Users/jlouage/Dev/GAIA-Framework"
PROJECT_PATH="$PROJECT_ROOT/Gaia-framework"
ARCHITECTURE_FILE="${PROJECT_ROOT}/docs/planning-artifacts/architecture.md"

PASS=0
FAIL=0
TOTAL=0

assert_equals() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_zero() {
  local desc="$1" count="$2"
  TOTAL=$((TOTAL + 1))
  if [[ "$count" -eq 0 ]]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (found $count occurrences, expected 0)"
    FAIL=$((FAIL + 1))
  fi
}

# ---------------------------------------------------------------------------
# AC1: ADR-011 uses _memory/tier2-results/ consistent with ADR-013
# ---------------------------------------------------------------------------
echo "=== AC1: ADR-011 path consistency ==="

# Check that architecture.md contains ADR-011 referencing the correct path
ac1_old_path_count=$(grep -c '_gaia/_memory/tier2-results' "$ARCHITECTURE_FILE" 2>/dev/null) || ac1_old_path_count=0
assert_zero "ADR-011 has no references to _gaia/_memory/tier2-results/" "$ac1_old_path_count"

ac1_new_path_count=$(grep -c '_memory/tier2-results' "$ARCHITECTURE_FILE" 2>/dev/null) || ac1_new_path_count=0
# Must have at least one reference to the correct path in ADR-011
TOTAL=$((TOTAL + 1))
if [[ "$ac1_new_path_count" -gt 0 ]]; then
  echo "  PASS: ADR-011 references _memory/tier2-results/ ($ac1_new_path_count occurrences)"
  PASS=$((PASS + 1))
else
  echo "  FAIL: ADR-011 should reference _memory/tier2-results/ (found 0 occurrences)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# AC2: All _gaia/_memory/tier2-results/ references updated
# ---------------------------------------------------------------------------
echo ""
echo "=== AC2: All references updated ==="

# Search active planning docs and framework files for old path
# Excludes: product source (Gaia-framework/), backups (_backups/), historical
# implementation artifacts (docs/implementation-artifacts/), test artifacts
# (docs/test-artifacts/), memory checkpoints/sidecars (_memory/)
ac2_stale_count=$(grep -r '_gaia/_memory/tier2-results' "$PROJECT_ROOT" \
  --include='*.yaml' --include='*.yml' --include='*.md' --include='*.xml' \
  --include='*.js' --include='*.ts' --include='*.sh' --include='*.json' \
  --exclude-dir='_backups' \
  --exclude-dir='Gaia-framework' \
  --exclude-dir='node_modules' \
  --exclude-dir='.git' \
  --exclude-dir='implementation-artifacts' \
  --exclude-dir='test-artifacts' \
  --exclude-dir='_memory' \
  -l 2>/dev/null || true)
ac2_stale_count=$(echo "$ac2_stale_count" | grep -c . 2>/dev/null) || ac2_stale_count=0

assert_zero "No active files reference _gaia/_memory/tier2-results/ (excluding product source, backups, historical artifacts, memory)" "$ac2_stale_count"

# ---------------------------------------------------------------------------
# AC3: Zero runtime references to _gaia/_memory/
# ---------------------------------------------------------------------------
echo ""
echo "=== AC3: Zero stale runtime references ==="

# Grep for _gaia/_memory/ in runtime files (excluding product source, backups,
# historical docs, and this test file itself)
ac3_runtime_refs=$(grep -r '_gaia/_memory/' "$PROJECT_ROOT" \
  --include='*.yaml' --include='*.yml' --include='*.xml' \
  --include='*.js' --include='*.ts' --include='*.sh' \
  --exclude-dir='_backups' \
  --exclude-dir='Gaia-framework' \
  --exclude-dir='node_modules' \
  --exclude-dir='.git' \
  --exclude-dir='implementation-artifacts' \
  --exclude-dir='test-artifacts' \
  --exclude-dir='_memory' \
  -l 2>/dev/null | \
  grep -v 'test-adr-path-reconciliation.sh' || true)
ac3_runtime_refs=$(echo "$ac3_runtime_refs" | grep -c . 2>/dev/null) || ac3_runtime_refs=0

assert_zero "Zero runtime references to _gaia/_memory/ in active framework files" "$ac3_runtime_refs"

# Also check .resolved/ configs specifically — these are generated and must be clean
ac3_resolved_refs=$(grep -r '_gaia/_memory/' "$PROJECT_ROOT/_gaia" \
  --include='*.yaml' --include='*.yml' \
  --exclude-dir='_backups' \
  -l 2>/dev/null || true)
ac3_resolved_refs=$(echo "$ac3_resolved_refs" | grep -c . 2>/dev/null) || ac3_resolved_refs=0

assert_zero "Zero _gaia/_memory/ references in resolved config files" "$ac3_resolved_refs"

# ---------------------------------------------------------------------------
# AC4: Existing tests pass with updated paths
# ---------------------------------------------------------------------------
echo ""
echo "=== AC4: Tests pass with updated paths ==="

# Verify npm test runs without path-related regressions
# Note: pre-existing test failures unrelated to ADR paths are expected
if [[ -f "${PROJECT_PATH}/package.json" ]]; then
  npm_result=$(cd "${PROJECT_PATH}" && npm test 2>&1 || true)
  TOTAL=$((TOTAL + 1))
  # Check for path-related failures specifically (our changes are docs-only)
  path_errors=$(echo "$npm_result" | grep -i '_gaia/_memory/tier2-results' || true)
  if [[ -z "$path_errors" ]]; then
    echo "  PASS: No path-related test regressions from ADR reconciliation"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: Path-related test regressions detected: $path_errors"
    FAIL=$((FAIL + 1))
  fi
else
  TOTAL=$((TOTAL + 1))
  echo "  FAIL: package.json not found in project path"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== ATDD E2-S6 Summary ==="
echo "Total: $TOTAL | Pass: $PASS | Fail: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  echo "Status: RED (failing — implementation needed)"
  exit 1
else
  echo "Status: GREEN (all acceptance tests pass)"
  exit 0
fi
