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
echo "Windows validation complete."
