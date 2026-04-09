#!/usr/bin/env bash
# backfill-review-summaries.sh — E17-S15 / A-050
#
# Idempotent backfill of {story_key}-review-summary.md files for sprint-14,
# sprint-15, and sprint-16 stories that have 6 individual review reports but
# no consolidated summary. Stories already carrying a summary are skipped.
#
# Usage:
#   scripts/backfill-review-summaries.sh              # write missing summaries
#   scripts/backfill-review-summaries.sh --dry-run    # report only, no writes
#   scripts/backfill-review-summaries.sh --sprint N   # restrict to sprint-N
#
# Exit codes:
#   0 — success (including "nothing to do")
#   1 — unexpected error (e.g., project root not found)

set -euo pipefail

DRY_RUN=0
SPRINT_FILTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --sprint)
      SPRINT_FILTER="sprint-$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Resolve project root — the parent of the scripts directory that contains
# this script. Fall back to PWD if the symlink resolution fails.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_PATH="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${PROJECT_PATH}/.." && pwd)"

IMPL_DIR="${PROJECT_ROOT}/docs/implementation-artifacts"
TEST_DIR="${PROJECT_ROOT}/docs/test-artifacts"

if [[ ! -d "${IMPL_DIR}" ]]; then
  echo "ERROR: implementation-artifacts directory not found at ${IMPL_DIR}" >&2
  exit 1
fi

# Target sprints
SPRINTS=("sprint-14" "sprint-15" "sprint-16")
if [[ -n "${SPRINT_FILTER}" ]]; then
  SPRINTS=("${SPRINT_FILTER}")
fi

processed=0
written=0
skipped_existing=0
skipped_no_reports=0

extract_frontmatter_field() {
  # $1 = file, $2 = field
  awk -v field="$2" '
    BEGIN { in_fm = 0 }
    /^---[[:space:]]*$/ {
      if (in_fm == 0) { in_fm = 1; next }
      else { exit }
    }
    in_fm == 1 {
      if ($0 ~ "^" field ":") {
        sub("^" field ":[[:space:]]*", "")
        gsub(/"/, "")
        print
        exit
      }
    }
  ' "$1"
}

extract_review_gate_row() {
  # $1 = story file, $2 = review name (e.g., "Code Review")
  awk -v name="$2" '
    $0 ~ "\\| " name " " {
      # Parse the row: | Review | Status | Report |
      n = split($0, cells, "|")
      # cells[2] is review name, cells[3] is status, cells[4] is report
      if (n >= 4) {
        status = cells[3]
        report = cells[4]
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", status)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", report)
        if (status == "") status = "UNVERIFIED"
        print status "|" report
        exit
      }
    }
  ' "$1"
}

backfill_one() {
  local story_file="$1"
  local story_key
  story_key="$(extract_frontmatter_field "${story_file}" "key")"
  if [[ -z "${story_key}" ]]; then
    return 0
  fi

  processed=$((processed + 1))

  local summary_file="${IMPL_DIR}/${story_key}-review-summary.md"

  # Idempotency: if the summary file (${story_key}-review-summary.md) already
  # exists on disk, skip this story. Check is -f "${summary_file}" where
  # summary_file matches *-review-summary.md.
  if [[ -f "${summary_file}" ]] && [[ "${summary_file}" == *review-summary.md ]]; then
    skipped_existing=$((skipped_existing + 1))
    return 0
  fi

  # Count how many individual review reports exist. If zero, skip (never reviewed).
  local report_paths=(
    "${IMPL_DIR}/${story_key}-review.md"
    "${IMPL_DIR}/${story_key}-security-review.md"
    "${TEST_DIR}/${story_key}-qa-tests.md"
    "${TEST_DIR}/${story_key}-test-automation.md"
    "${TEST_DIR}/${story_key}-test-review.md"
    "${IMPL_DIR}/${story_key}-performance-review.md"
  )
  local report_count=0
  for p in "${report_paths[@]}"; do
    if [[ -f "${p}" ]]; then
      report_count=$((report_count + 1))
    fi
  done

  if [[ ${report_count} -eq 0 ]]; then
    skipped_no_reports=$((skipped_no_reports + 1))
    return 0
  fi

  # Extract the 6 Review Gate rows from the story file
  local code_review qa_tests security_review test_automation test_review performance_review
  code_review="$(extract_review_gate_row "${story_file}" "Code Review")"
  qa_tests="$(extract_review_gate_row "${story_file}" "QA Tests")"
  security_review="$(extract_review_gate_row "${story_file}" "Security Review")"
  test_automation="$(extract_review_gate_row "${story_file}" "Test Automation")"
  test_review="$(extract_review_gate_row "${story_file}" "Test Review")"
  performance_review="$(extract_review_gate_row "${story_file}" "Performance Review")"

  # Split into status + report for each
  local cr_s cr_r qa_s qa_r sr_s sr_r ta_s ta_r tr_s tr_r pr_s pr_r
  cr_s="${code_review%%|*}"; cr_r="${code_review#*|}"
  qa_s="${qa_tests%%|*}"; qa_r="${qa_tests#*|}"
  sr_s="${security_review%%|*}"; sr_r="${security_review#*|}"
  ta_s="${test_automation%%|*}"; ta_r="${test_automation#*|}"
  tr_s="${test_review%%|*}"; tr_r="${test_review#*|}"
  pr_s="${performance_review%%|*}"; pr_r="${performance_review#*|}"

  [[ -z "${cr_s}" ]] && cr_s="UNVERIFIED"
  [[ -z "${qa_s}" ]] && qa_s="UNVERIFIED"
  [[ -z "${sr_s}" ]] && sr_s="UNVERIFIED"
  [[ -z "${ta_s}" ]] && ta_s="UNVERIFIED"
  [[ -z "${tr_s}" ]] && tr_s="UNVERIFIED"
  [[ -z "${pr_s}" ]] && pr_s="UNVERIFIED"

  # Compute overall_status
  local overall_status
  if [[ "${cr_s}" == "PASSED" && "${qa_s}" == "PASSED" && "${sr_s}" == "PASSED" \
     && "${ta_s}" == "PASSED" && "${tr_s}" == "PASSED" && "${pr_s}" == "PASSED" ]]; then
    overall_status="PASSED"
  elif [[ "${cr_s}" == "FAILED" || "${qa_s}" == "FAILED" || "${sr_s}" == "FAILED" \
       || "${ta_s}" == "FAILED" || "${tr_s}" == "FAILED" || "${pr_s}" == "FAILED" ]]; then
    overall_status="FAILED"
  else
    overall_status="INCOMPLETE"
  fi

  local date_stamp
  date_stamp="$(date +%Y-%m-%d)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "[dry-run] Would write ${summary_file} (overall_status=${overall_status}, reports=${report_count}/6)"
    return 0
  fi

  cat > "${summary_file}" <<EOF
---
story_key: ${story_key}
date: ${date_stamp}
overall_status: ${overall_status}
reviewers: [code-review, qa-tests, security-review, test-automate, test-review, review-perf]
backfilled: true
---

# Review Summary: ${story_key}

> Backfilled by \`scripts/backfill-review-summaries.sh\` (E17-S15 / A-050).
> Aggregate of the 6-review gate for ${story_key}. This file does NOT regenerate reviews — it consolidates existing verdicts from the 6 individual review reports found on disk at backfill time.

## Code Review
**Verdict:** ${cr_s}
**Report:** docs/implementation-artifacts/${story_key}-review.md
**Synopsis:** See report for details.

## QA Tests
**Verdict:** ${qa_s}
**Report:** docs/test-artifacts/${story_key}-qa-tests.md
**Synopsis:** See report for details.

## Security Review
**Verdict:** ${sr_s}
**Report:** docs/implementation-artifacts/${story_key}-security-review.md
**Synopsis:** See report for details.

## Test Automation
**Verdict:** ${ta_s}
**Report:** docs/test-artifacts/${story_key}-test-automation.md
**Synopsis:** See report for details.

## Test Review
**Verdict:** ${tr_s}
**Report:** docs/test-artifacts/${story_key}-test-review.md
**Synopsis:** See report for details.

## Performance Review
**Verdict:** ${pr_s}
**Report:** docs/implementation-artifacts/${story_key}-performance-review.md
**Synopsis:** See report for details.

## Aggregate Gate Status

| Review | Verdict | Report |
|---|---|---|
| Code Review | ${cr_s} | [link](${story_key}-review.md) |
| QA Tests | ${qa_s} | [link](../test-artifacts/${story_key}-qa-tests.md) |
| Security Review | ${sr_s} | [link](${story_key}-security-review.md) |
| Test Automation | ${ta_s} | [link](../test-artifacts/${story_key}-test-automation.md) |
| Test Review | ${tr_s} | [link](../test-artifacts/${story_key}-test-review.md) |
| Performance Review | ${pr_s} | [link](${story_key}-performance-review.md) |

**Overall Status:** ${overall_status}
EOF

  written=$((written + 1))
  echo "[written] ${summary_file} (overall_status=${overall_status})"
}

for sprint in "${SPRINTS[@]}"; do
  # Find story files tagged with this sprint_id
  while IFS= read -r story_file; do
    backfill_one "${story_file}"
  done < <(grep -lE "^sprint_id: \"?${sprint}\"?\$" "${IMPL_DIR}"/*.md 2>/dev/null || true)
done

echo ""
echo "=== Backfill Summary ==="
echo "Processed:        ${processed}"
echo "Written:          ${written}"
echo "Skipped (exists): ${skipped_existing}"
echo "Skipped (no reports / never reviewed): ${skipped_no_reports}"
if [[ ${DRY_RUN} -eq 1 ]]; then
  echo "(dry-run mode — no files written)"
fi
