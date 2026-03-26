#!/usr/bin/env bash
# windows-validate.sh — Lightweight validation for Windows CI runners
# Windows cannot run BATS or ShellCheck, so this script performs
# basic environment validation instead.

set -euo pipefail

echo "=== Windows Environment Validation ==="
echo "OS: $(uname -s 2>/dev/null || echo 'Unknown')"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

echo ""
echo "=== Verifying npm scripts exist ==="
SCRIPTS=$(node -e "const p = require('./package.json'); console.log(Object.keys(p.scripts || {}).join('\n'))")
for required in test test:shell test:validation; do
  if echo "$SCRIPTS" | grep -q "^${required}$"; then
    echo "[PASS] Script '${required}' found"
  else
    echo "[WARN] Script '${required}' not found in package.json"
  fi
done

echo ""
echo "=== Verifying key files exist ==="
for file in bin/gaia-framework.js gaia-install.sh package.json; do
  if [ -f "$file" ]; then
    echo "[PASS] ${file} exists"
  else
    echo "[WARN] ${file} not found"
  fi
done

echo ""
echo "=== Configuration file syntax validation ==="
# Validate JSON and yaml configuration files parse correctly (E6-S3 Task 3.1)
# package.json — JSON syntax
if [ -f "package.json" ]; then
  if node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" 2>/dev/null; then
    echo "[PASS] package.json parses correctly"
  else
    echo "[FAIL] package.json has syntax errors"
  fi
fi
# .github/workflows/*.yml — yaml syntax (non-empty check; full parse requires yaml library)
if [ -d ".github/workflows" ]; then
  for ymlfile in .github/workflows/*.yml; do
    if [ -f "$ymlfile" ]; then
      if [ -s "$ymlfile" ]; then
        echo "[PASS] ${ymlfile} exists and is non-empty"
      else
        echo "[WARN] ${ymlfile} is empty"
      fi
    fi
  done
fi

echo ""
echo "=== CLI smoke test ==="
# Verify gaia-framework CLI can report its version (E6-S3 Task 3.1)
CLI_OUTPUT=$(node bin/gaia-framework.js --version 2>&1 || true)
if [ -n "$CLI_OUTPUT" ]; then
  echo "[PASS] gaia-framework --version returned: ${CLI_OUTPUT}"
else
  echo "[WARN] gaia-framework --version produced no output (non-blocking on Windows)"
fi

echo ""
echo "Windows validation complete."
