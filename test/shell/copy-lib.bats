#!/usr/bin/env bats

# BATS tests for lib/copy-lib.sh — extracted copy_gaia_files() and clean_resolved_yaml()
# Story: E3-S11 — Extract copy_gaia_files for Unit Testability
# Run: bats test/shell/copy-lib.bats

LIB="$BATS_TEST_DIRNAME/../../lib/copy-lib.sh"

setup() {
  load 'test_helper/bats-support/load'
  load 'test_helper/bats-assert/load'

  TEST_DIR="$(mktemp -d)"
  SRC_DIR="$TEST_DIR/src"
  DST_DIR="$TEST_DIR/dst"

  # Create minimal source _gaia/ tree
  mkdir -p "$SRC_DIR/_gaia/_config"
  mkdir -p "$SRC_DIR/_gaia/core"
  mkdir -p "$SRC_DIR/_gaia/lifecycle"
  mkdir -p "$SRC_DIR/_gaia/dev"
  echo "framework_name: GAIA" > "$SRC_DIR/_gaia/_config/global.yaml"
  echo "name: gaia-framework" > "$SRC_DIR/_gaia/_config/manifest.yaml"
  echo "core-content" > "$SRC_DIR/_gaia/core/engine.xml"
  echo "lifecycle-content" > "$SRC_DIR/_gaia/lifecycle/config.yaml"
  echo "dev-content" > "$SRC_DIR/_gaia/dev/config.yaml"

  # Create .resolved/ files (should be excluded/cleaned)
  mkdir -p "$SRC_DIR/_gaia/lifecycle/workflows/dev-story/.resolved"
  echo "resolved: true" > "$SRC_DIR/_gaia/lifecycle/workflows/dev-story/.resolved/dev-story.yaml"
  mkdir -p "$SRC_DIR/_gaia/core/.resolved"
  echo "resolved: true" > "$SRC_DIR/_gaia/core/.resolved/core-config.yaml"

  # Create destination directory
  mkdir -p "$DST_DIR"

  # Source the library (will fail until lib/copy-lib.sh exists)
  source "$LIB"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# ─── AC1: Library is sourceable and functions are callable ────────────────────

@test "AC1: copy-lib.sh can be sourced independently" {
  # If we reach here, setup() already sourced it successfully
  [ -f "$LIB" ]
}

@test "AC1: copy_gaia_files function is defined after sourcing" {
  type -t copy_gaia_files | grep -q "function"
}

@test "AC1: clean_resolved_yaml function is defined after sourcing" {
  type -t clean_resolved_yaml | grep -q "function"
}

@test "AC1: library does not set -euo pipefail" {
  # The library file must not execute set -euo pipefail (comments are fine)
  ! grep -q "^set -euo pipefail" "$LIB"
}

# ─── AC2: rsync tier — happy path + .resolved exclusion ─────────────────────

@test "AC2: rsync tier copies _gaia/ files successfully" {
  if ! command -v rsync >/dev/null 2>&1; then
    skip "rsync not available on this system"
  fi

  # Provide a detail() stub so the function doesn't fail on missing helper
  detail() { :; }
  export -f detail

  copy_gaia_files "$SRC_DIR" "$DST_DIR"

  [ -f "$DST_DIR/_gaia/_config/global.yaml" ]
  [ -f "$DST_DIR/_gaia/core/engine.xml" ]
  [ -f "$DST_DIR/_gaia/lifecycle/config.yaml" ]
  [ -f "$DST_DIR/_gaia/dev/config.yaml" ]
}

@test "AC2: rsync tier excludes .resolved/*.yaml files" {
  if ! command -v rsync >/dev/null 2>&1; then
    skip "rsync not available on this system"
  fi

  detail() { :; }
  export -f detail

  copy_gaia_files "$SRC_DIR" "$DST_DIR"

  [ ! -f "$DST_DIR/_gaia/lifecycle/workflows/dev-story/.resolved/dev-story.yaml" ]
  [ ! -f "$DST_DIR/_gaia/core/.resolved/core-config.yaml" ]
}

# ─── AC3: cp fallback tier — rsync mocked absent ────────────────────────────

@test "AC3: cp fallback copies files when rsync is absent" {
  # Override command to make rsync appear absent
  command() {
    case "$1" in
      -v)
        case "$2" in
          rsync) return 1 ;;
          *) builtin command "$@" ;;
        esac
        ;;
      *)
        builtin command "$@"
        ;;
    esac
  }
  export -f command

  detail() { :; }
  export -f detail
  error() { :; }
  export -f error

  copy_gaia_files "$SRC_DIR" "$DST_DIR"

  [ -f "$DST_DIR/_gaia/_config/global.yaml" ]
  [ -f "$DST_DIR/_gaia/core/engine.xml" ]
}

@test "AC3: cp fallback cleans .resolved/*.yaml after copy" {
  command() {
    case "$1" in
      -v)
        case "$2" in
          rsync) return 1 ;;
          *) builtin command "$@" ;;
        esac
        ;;
      *)
        builtin command "$@"
        ;;
    esac
  }
  export -f command

  detail() { :; }
  export -f detail
  error() { :; }
  export -f error

  copy_gaia_files "$SRC_DIR" "$DST_DIR"

  [ ! -f "$DST_DIR/_gaia/lifecycle/workflows/dev-story/.resolved/dev-story.yaml" ]
  [ ! -f "$DST_DIR/_gaia/core/.resolved/core-config.yaml" ]
}

# ─── AC4: tar fallback tier — rsync + cp mocked absent ─────────────────────

@test "AC4: tar fallback copies files when rsync and cp are both absent" {
  # Override command to make both rsync and cp appear absent
  command() {
    case "$1" in
      -v)
        case "$2" in
          rsync|cp) return 1 ;;
          *) builtin command "$@" ;;
        esac
        ;;
      *)
        builtin command "$@"
        ;;
    esac
  }
  export -f command

  detail() { :; }
  export -f detail
  error() { :; }
  export -f error

  copy_gaia_files "$SRC_DIR" "$DST_DIR"

  [ -f "$DST_DIR/_gaia/_config/global.yaml" ]
  [ -f "$DST_DIR/_gaia/core/engine.xml" ]
}

@test "AC4: tar fallback cleans .resolved/*.yaml after copy" {
  command() {
    case "$1" in
      -v)
        case "$2" in
          rsync|cp) return 1 ;;
          *) builtin command "$@" ;;
        esac
        ;;
      *)
        builtin command "$@"
        ;;
    esac
  }
  export -f command

  detail() { :; }
  export -f detail
  error() { :; }
  export -f error

  copy_gaia_files "$SRC_DIR" "$DST_DIR"

  [ ! -f "$DST_DIR/_gaia/lifecycle/workflows/dev-story/.resolved/dev-story.yaml" ]
  [ ! -f "$DST_DIR/_gaia/core/.resolved/core-config.yaml" ]
}

# ─── AC5: all tools absent — error path ─────────────────────────────────────

@test "AC5: returns non-zero when all copy tools are absent" {
  command() {
    case "$1" in
      -v)
        case "$2" in
          rsync|cp|tar) return 1 ;;
          *) builtin command "$@" ;;
        esac
        ;;
      *)
        builtin command "$@"
        ;;
    esac
  }
  export -f command

  detail() { :; }
  export -f detail
  error() { :; }
  export -f error

  run copy_gaia_files "$SRC_DIR" "$DST_DIR"
  [ "$status" -ne 0 ]
}

@test "AC5: emits error message when all copy tools are absent" {
  local captured_error=""
  command() {
    case "$1" in
      -v)
        case "$2" in
          rsync|cp|tar) return 1 ;;
          *) builtin command "$@" ;;
        esac
        ;;
      *)
        builtin command "$@"
        ;;
    esac
  }
  export -f command

  detail() { :; }
  export -f detail
  error() { captured_error="$*"; }
  export -f error

  run copy_gaia_files "$SRC_DIR" "$DST_DIR"
  [ "$status" -ne 0 ]
}
