#!/usr/bin/env bash
# test-sidecar-templates.sh
#
# Verifies that all agent memory sidecar .md files in Gaia-framework/_memory/
# contain only their empty template state (header + optional frontmatter),
# with no accumulated development session data.
#
# Guards E9-S22 acceptance criteria:
#   AC1: each .md file contains only its template header
#   AC2: Tier 1 files have entry_count:0 and estimated_tokens:0 in frontmatter
#   AC3: _memory/config.yaml is present (structural file)
#   AC4: _memory/README.md is present (structural file)
#   AC5: checkpoints/.gitkeep files are present
#   AC6: {project-root}/_memory/ is NOT scanned — running framework untouched
#
# Discovery is automatic: every sidecar directory under Gaia-framework/_memory/
# is walked, and every .md file it contains is classified as either Tier 1
# (has frontmatter) or Tier 3 (no frontmatter). This means new agents added
# later are automatically covered without script changes.
#
# Exit codes:
#   0 — all checks pass (sidecars are empty templates)
#   1 — one or more sidecar files contain data beyond the template header
#   2 — setup error (memory dir missing, etc)

set -euo pipefail

# ---------------------------------------------------------------------------
# Locate Gaia-framework/_memory/ (product source — NOT the running framework)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MEMORY_DIR="${PRODUCT_ROOT}/_memory"

if [[ ! -d "${MEMORY_DIR}" ]]; then
  echo "ERROR: Product memory directory not found at ${MEMORY_DIR}" >&2
  exit 2
fi

FAILURES=0
CHECKED=0

fail() {
  FAILURES=$((FAILURES + 1))
  echo "FAIL: $*" >&2
}

pass() {
  CHECKED=$((CHECKED + 1))
}

# ---------------------------------------------------------------------------
# assert_body_empty FILE FIRST_BODY_LINE
#
# Scans every line from FIRST_BODY_LINE onward and flags any line that looks
# like accumulated data. Allowed lines in an empty template body:
#   - blank lines
#   - a single `# Title` line
#   - `> description` blockquote lines
#   - `---` separator lines
# Anything else — sub-headers (##, ###), list items (-, *), table rows (|),
# or plain text paragraphs — indicates the file still contains session data.
# ---------------------------------------------------------------------------
assert_body_empty() {
  local file="$1"
  local start_line="$2"
  local bad
  bad=$(tail -n +"${start_line}" "${file}" | \
        grep -nE '^(##|###|- |\*|\||[A-Za-z0-9])' || true)
  if [[ -n "${bad}" ]]; then
    fail "${file}: body contains data beyond template header:"
    echo "${bad}" | head -5 >&2
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# assert_frontmatter_zero FILE
#
# If the file has entry_count or estimated_tokens frontmatter fields, assert
# both are 0. Used only on Tier 1 files that have frontmatter.
# ---------------------------------------------------------------------------
assert_frontmatter_zero() {
  local file="$1"

  if grep -q '^entry_count:' "${file}"; then
    local ec
    ec=$(grep '^entry_count:' "${file}" | head -1 | awk '{print $2}')
    if [[ "${ec}" != "0" ]]; then
      fail "${file}: entry_count is ${ec}, expected 0"
      return 1
    fi
  fi

  if grep -q '^estimated_tokens:' "${file}"; then
    local et
    et=$(grep '^estimated_tokens:' "${file}" | head -1 | awk '{print $2}')
    if [[ "${et}" != "0" ]]; then
      fail "${file}: estimated_tokens is ${et}, expected 0"
      return 1
    fi
  fi

  return 0
}

# ---------------------------------------------------------------------------
# check_sidecar_file FILE
#
# Classifies the file by shape (frontmatter or not) and runs the appropriate
# assertions:
#   - If line 1 is `---`: Tier 1 with frontmatter → assert closing `---`,
#     assert entry_count/estimated_tokens are 0, assert body empty.
#   - Otherwise: no frontmatter → assert line 1 is a `#` header, assert body
#     empty from line 2 onward. Applies to both Tier 3 files (all dev agents,
#     etc.) and the handful of Tier 1 files that have no frontmatter
#     (architect, pm, sm decision-log.md).
# ---------------------------------------------------------------------------
check_sidecar_file() {
  local file="$1"
  [[ -f "${file}" ]] || { fail "Sidecar file missing: ${file}"; return; }

  local first
  first=$(head -1 "${file}")

  if [[ "${first}" == "---" ]]; then
    # Tier 1 with frontmatter
    local fm_end
    fm_end=$(awk 'NR>1 && /^---$/ {print NR; exit}' "${file}")
    if [[ -z "${fm_end}" ]]; then
      fail "${file}: frontmatter not closed"
      return
    fi
    assert_frontmatter_zero "${file}" || return
    assert_body_empty "${file}" $((fm_end + 1)) || return
  else
    # No frontmatter — first line must be a markdown header
    if [[ ! "${first}" =~ ^\# ]]; then
      fail "${file}: first line is not a # header: '${first}'"
      return
    fi
    assert_body_empty "${file}" 2 || return
  fi

  pass
}

# ---------------------------------------------------------------------------
# Run checks — auto-discover every sidecar .md file
# ---------------------------------------------------------------------------
echo "Checking sidecar files in ${MEMORY_DIR}..."

# shellcheck disable=SC2044  # find output is newline-safe here (no spaces in sidecar paths)
for f in $(find "${MEMORY_DIR}" -type f -name "*.md" \
             -not -path "*/checkpoints/*" \
             -not -name "README.md" | sort); do
  check_sidecar_file "${f}"
done

# Structural files must exist untouched (AC3-AC5)
for f in "${MEMORY_DIR}/config.yaml" \
         "${MEMORY_DIR}/README.md" \
         "${MEMORY_DIR}/checkpoints/.gitkeep" \
         "${MEMORY_DIR}/checkpoints/completed/.gitkeep"; do
  if [[ ! -f "${f}" ]]; then
    fail "Structural file missing: ${f}"
  else
    pass
  fi
done

echo ""
echo "Checked: ${CHECKED}"
echo "Failures: ${FAILURES}"

if [[ ${FAILURES} -gt 0 ]]; then
  echo "RESULT: FAIL — ${FAILURES} sidecar file(s) contain data beyond the empty template state."
  exit 1
fi

echo "RESULT: PASS — all sidecar files are empty templates."
exit 0
