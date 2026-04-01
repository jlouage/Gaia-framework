#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GAIA Framework — Windows Path Validation Script
# For manual testing in Git Bash (Git for Windows 2.x).
# Not part of the BATS CI suite (BATS is unreliable on Windows per ADR-007).
#
# Usage: bash tests/windows-validate.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$SCRIPT_DIR/gaia-install.sh"

pass_count=0
fail_count=0

check() {
  local description="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS: $description"
    pass_count=$((pass_count + 1))
  else
    echo "  FAIL: $description"
    echo "    Expected: $expected"
    echo "    Actual:   $actual"
    fail_count=$((fail_count + 1))
  fi
}

echo "=== GAIA Windows Path Validation ==="
echo ""

# ─── Test 1: normalize_path function exists ─────────────────────────────────
echo "Test 1: normalize_path function exists in installer"
if grep -q "normalize_path()" "$SCRIPT"; then
  echo "  PASS: normalize_path() found"
  pass_count=$((pass_count + 1))
else
  echo "  FAIL: normalize_path() not found in $SCRIPT"
  fail_count=$((fail_count + 1))
fi

# ─── Test 2: Backslash normalization ────────────────────────────────────────
echo "Test 2: Backslash path normalization"
# Extract and test normalize_path
result=$(bash -c "eval \"\$(sed -n '/^normalize_path()/,/^}/p' '$SCRIPT')\"; normalize_path 'C:\Users\foo\project'")
check "Backslashes converted" "C:/Users/foo/project" "$result"

# ─── Test 3: Forward slash passthrough ──────────────────────────────────────
echo "Test 3: Forward slash passthrough"
result=$(bash -c "eval \"\$(sed -n '/^normalize_path()/,/^}/p' '$SCRIPT')\"; normalize_path '/home/user/project'")
check "Forward slashes preserved" "/home/user/project" "$result"

# ─── Test 4: Mixed slashes ─────────────────────────────────────────────────
echo "Test 4: Mixed slashes"
result=$(bash -c "eval \"\$(sed -n '/^normalize_path()/,/^}/p' '$SCRIPT')\"; normalize_path 'C:\Users/foo\project'")
check "Mixed slashes normalized" "C:/Users/foo/project" "$result"

# ─── Test 5: Path with spaces ──────────────────────────────────────────────
echo "Test 5: Path with spaces"
result=$(bash -c "eval \"\$(sed -n '/^normalize_path()/,/^}/p' '$SCRIPT')\"; normalize_path 'C:\Users\John Doe\project'")
check "Spaces preserved" "C:/Users/John Doe/project" "$result"

# ─── Test 6: realpath guard ────────────────────────────────────────────────
echo "Test 6: realpath is guarded with command -v"
if grep -q 'command -v realpath' "$SCRIPT"; then
  echo "  PASS: realpath guard found"
  pass_count=$((pass_count + 1))
else
  echo "  FAIL: realpath not guarded"
  fail_count=$((fail_count + 1))
fi

# ─── Test 7: cd+pwd fallback exists ────────────────────────────────────────
echo "Test 7: cd+pwd fallback in resolve_source"
if sed -n '/^resolve_source()/,/^}/p' "$SCRIPT" | grep -q 'cd.*pwd'; then
  echo "  PASS: cd+pwd fallback found"
  pass_count=$((pass_count + 1))
else
  echo "  FAIL: cd+pwd fallback not found in resolve_source"
  fail_count=$((fail_count + 1))
fi

# ─── Test 8: uname branching documented ────────────────────────────────────
echo "Test 8: sed -i uname branching has MINGW/Git Bash documentation"
if grep -B5 -A5 'uname.*Darwin' "$SCRIPT" | grep -qi 'MINGW\|Git Bash\|Git for Windows'; then
  echo "  PASS: MINGW/Git Bash documentation found"
  pass_count=$((pass_count + 1))
else
  echo "  FAIL: No MINGW/Git Bash documentation near uname check"
  fail_count=$((fail_count + 1))
fi

# ─── Test 9: No _gaia/_gaia/ nesting (E6-S15) ─────────────────────────────
echo "Test 9: cp fallback does not produce _gaia/_gaia/ nesting (E6-S15)"
if grep -q 'cp -rp.*_gaia/\.' "$SCRIPT"; then
  echo "  PASS: cp command uses /. idiom to prevent nesting"
  pass_count=$((pass_count + 1))
else
  echo "  FAIL: cp command does not use /. idiom — risk of _gaia/_gaia/ nesting on Windows"
  fail_count=$((fail_count + 1))
fi

# ─── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $pass_count passed, $fail_count failed ==="
if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
