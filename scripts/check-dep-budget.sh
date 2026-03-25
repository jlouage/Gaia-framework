#!/usr/bin/env bash
# check-dep-budget.sh — Transitive dependency budget check
# Part of E4-S4: Dev Dependency Supply Chain Management
#
# Three-tier thresholds:
#   <= BUDGET_LIMIT (400): PASS — silent
#   BUDGET_LIMIT+1 to BUDGET_WARN (401-420): WARNING — annotation
#   > BUDGET_WARN (420): FAIL — annotation + non-zero exit
#
# Uses npm ls --all --parseable for recursive unique package count.
# Designed for GitHub Actions CI — outputs ::warning:: and ::error:: annotations.

set -euo pipefail

BUDGET_LIMIT="${BUDGET_LIMIT:-400}"
BUDGET_WARN="${BUDGET_WARN:-420}"

# Count transitive dependencies using npm ls --all --parseable
# Redirect stderr to /dev/null to suppress peer dep warnings
# Subtract 1 to exclude the root package itself
DEP_COUNT=$(npm ls --all --parseable 2>/dev/null | wc -l | tr -d ' ')
DEP_COUNT=$((DEP_COUNT - 1))  # exclude root package

echo "Transitive dependency count: ${DEP_COUNT}"
echo "Budget: ${BUDGET_LIMIT} (warn at ${BUDGET_WARN})"

if [ "${DEP_COUNT}" -le "${BUDGET_LIMIT}" ]; then
  echo "PASS: ${DEP_COUNT} dependencies (within budget of ${BUDGET_LIMIT})"
  exit 0
elif [ "${DEP_COUNT}" -le "${BUDGET_WARN}" ]; then
  echo "::warning::Transitive dependency count (${DEP_COUNT}) is in warning range (${BUDGET_LIMIT}-${BUDGET_WARN})"
  exit 0
else
  echo "::error::Transitive dependency count (${DEP_COUNT}) exceeds budget of ${BUDGET_WARN}"
  exit 1
fi
