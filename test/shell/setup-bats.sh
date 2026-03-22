#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# BATS Setup Script
# Downloads bats-core, bats-support, and bats-assert with SHA-pinned commits
# into test/shell/test_helper/. Idempotent — safe to re-run.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER_DIR="$SCRIPT_DIR/test_helper"

# SHA-pinned commits for reproducibility
BATS_SUPPORT_REPO="https://github.com/bats-core/bats-support.git"
BATS_SUPPORT_SHA="e363b640d8017cf787e488308ceb7489e76b8b0c"  # v0.3.0

BATS_ASSERT_REPO="https://github.com/bats-core/bats-assert.git"
BATS_ASSERT_SHA="e2d855bc06f43193d5ce5b85e07da3a2e89eab09"  # v2.1.0

install_lib() {
  local name="$1" repo="$2" sha="$3"
  local target="$HELPER_DIR/$name"

  if [[ -d "$target" ]]; then
    echo "Already installed: $name"
    return 0
  fi

  echo "Installing $name..."
  git clone --quiet "$repo" "$target"
  (cd "$target" && git checkout --quiet "$sha")
  echo "Installed $name at $sha"
}

mkdir -p "$HELPER_DIR"

install_lib "bats-support" "$BATS_SUPPORT_REPO" "$BATS_SUPPORT_SHA"
install_lib "bats-assert" "$BATS_ASSERT_REPO" "$BATS_ASSERT_SHA"

echo "BATS test helpers ready in $HELPER_DIR"
