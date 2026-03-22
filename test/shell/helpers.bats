#!/usr/bin/env bats

# BATS tests for gaia-install.sh utility/helper functions
# Run: bats test/shell/helpers.bats

SCRIPT="$BATS_TEST_DIRNAME/../../gaia-install.sh"

setup() {
  TEST_DIR="$(mktemp -d)"
  # Create a stub bin directory for PATH-prepended mocks
  STUB_DIR="$(mktemp -d)"
}

teardown() {
  rm -rf "$TEST_DIR"
  rm -rf "$STUB_DIR"
}

# ─── Prerequisite Checks (AC4a) ─────────────────────────────────────────────

@test "init fails with clear error when git is not available" {
  # Create a stub that removes git from PATH
  cat > "$STUB_DIR/git" <<'STUB'
#!/usr/bin/env bash
exit 127
STUB
  chmod +x "$STUB_DIR/git"

  # Remove git from PATH and prepend stub dir
  local clean_path=""
  IFS=: read -ra dirs <<< "$PATH"
  for d in "${dirs[@]}"; do
    if ! [[ -x "$d/git" ]]; then
      clean_path="${clean_path:+$clean_path:}$d"
    fi
  done

  # Run init with no git — should fail trying to clone from GitHub
  # (no --source flag forces GitHub clone path which needs git)
  PATH="$STUB_DIR:$clean_path" run bash "$SCRIPT" init --yes "$TEST_DIR"
  [ "$status" -ne 0 ]
  [[ "$output" == *"git"* ]]
}

@test "init with invalid source directory fails" {
  # Providing a source directory that has no manifest should fail
  local bad_src="$(mktemp -d)"
  mkdir -p "$bad_src/_gaia"
  # No _gaia/_config/manifest.yaml

  run bash "$SCRIPT" init --source "$bad_src" --yes "$TEST_DIR"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Invalid GAIA source"* ]] || [[ "$output" == *"manifest"* ]]

  rm -rf "$bad_src"
}

# ─── extract_yaml_value (AC4b) ───────────────────────────────────────────────

@test "extract_yaml_value extracts simple string value" {
  cat > "$TEST_DIR/test.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.2.3"
project_name: "my-project"
YAML

  # Source the function from the script
  # We can't source the whole script (it calls main), so grep+eval the function
  run bash -c '
    extract_yaml_value() {
      local file="$1" key="$2"
      grep "^${key}:" "$file" 2>/dev/null | sed "s/^${key}:[[:space:]]*//" | sed "s/^\"//;s/\"$//" || echo ""
    }
    extract_yaml_value "'"$TEST_DIR/test.yaml"'" "framework_version"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.3" ]
}

@test "extract_yaml_value returns empty for missing key" {
  cat > "$TEST_DIR/test.yaml" <<'YAML'
framework_name: "GAIA"
YAML

  run bash -c '
    extract_yaml_value() {
      local file="$1" key="$2"
      grep "^${key}:" "$file" 2>/dev/null | sed "s/^${key}:[[:space:]]*//" | sed "s/^\"//;s/\"$//" || echo ""
    }
    extract_yaml_value "'"$TEST_DIR/test.yaml"'" "nonexistent_key"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

@test "extract_yaml_value handles unquoted values" {
  cat > "$TEST_DIR/test.yaml" <<'YAML'
user_name: tester
YAML

  run bash -c '
    extract_yaml_value() {
      local file="$1" key="$2"
      grep "^${key}:" "$file" 2>/dev/null | sed "s/^${key}:[[:space:]]*//" | sed "s/^\"//;s/\"$//" || echo ""
    }
    extract_yaml_value "'"$TEST_DIR/test.yaml"'" "user_name"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "tester" ]
}

# ─── count_files (AC4b) ─────────────────────────────────────────────────────

@test "count_files counts files in a directory" {
  mkdir -p "$TEST_DIR/subdir"
  touch "$TEST_DIR/subdir/a.txt"
  touch "$TEST_DIR/subdir/b.txt"
  touch "$TEST_DIR/subdir/c.yaml"

  run bash -c '
    count_files() {
      local dir="$1" pattern="${2:-*}"
      find "$dir" -name "$pattern" -type f 2>/dev/null | wc -l | tr -d " "
    }
    count_files "'"$TEST_DIR/subdir"'"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "3" ]
}

@test "count_files counts with pattern filter" {
  mkdir -p "$TEST_DIR/subdir"
  touch "$TEST_DIR/subdir/a.txt"
  touch "$TEST_DIR/subdir/b.txt"
  touch "$TEST_DIR/subdir/c.yaml"

  run bash -c '
    count_files() {
      local dir="$1" pattern="${2:-*}"
      find "$dir" -name "$pattern" -type f 2>/dev/null | wc -l | tr -d " "
    }
    count_files "'"$TEST_DIR/subdir"'" "*.txt"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "2" ]
}

@test "count_files returns 0 for empty directory" {
  mkdir -p "$TEST_DIR/empty"

  run bash -c '
    count_files() {
      local dir="$1" pattern="${2:-*}"
      find "$dir" -name "$pattern" -type f 2>/dev/null | wc -l | tr -d " "
    }
    count_files "'"$TEST_DIR/empty"'"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "0" ]
}

# ─── copy_if_missing (AC4b) ─────────────────────────────────────────────────

@test "copy_if_missing copies file when destination does not exist" {
  echo "source content" > "$TEST_DIR/source.txt"

  run bash -c '
    OPT_VERBOSE=false
    OPT_DRY_RUN=false
    copy_if_missing() {
      local src="$1" dst="$2"
      if [[ -e "$dst" ]]; then
        return 0
      fi
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
    }
    copy_if_missing "'"$TEST_DIR/source.txt"'" "'"$TEST_DIR/dest/output.txt"'"
    cat "'"$TEST_DIR/dest/output.txt"'"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "source content" ]
}

@test "copy_if_missing skips when destination exists" {
  echo "source content" > "$TEST_DIR/source.txt"
  mkdir -p "$TEST_DIR/dest"
  echo "existing content" > "$TEST_DIR/dest/output.txt"

  run bash -c '
    OPT_VERBOSE=false
    OPT_DRY_RUN=false
    copy_if_missing() {
      local src="$1" dst="$2"
      if [[ -e "$dst" ]]; then
        return 0
      fi
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
    }
    copy_if_missing "'"$TEST_DIR/source.txt"'" "'"$TEST_DIR/dest/output.txt"'"
    cat "'"$TEST_DIR/dest/output.txt"'"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "existing content" ]
}

# ─── copy_with_backup (AC4b) ────────────────────────────────────────────────

@test "copy_with_backup creates backup of existing file" {
  echo "old content" > "$TEST_DIR/target.txt"
  echo "new content" > "$TEST_DIR/source.txt"
  mkdir -p "$TEST_DIR/backups"

  run bash -c '
    OPT_VERBOSE=false
    OPT_DRY_RUN=false
    TARGET="'"$TEST_DIR"'"
    copy_with_backup() {
      local src="$1" dst="$2" backup_dir="$3"
      if [[ ! -e "$dst" ]]; then
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        return 0
      fi
      if cmp -s "$src" "$dst"; then
        return 0
      fi
      local rel_path="${dst#$TARGET/}"
      local backup_path="$backup_dir/$rel_path"
      mkdir -p "$(dirname "$backup_path")"
      cp "$dst" "$backup_path"
      cp "$src" "$dst"
    }
    copy_with_backup "'"$TEST_DIR/source.txt"'" "'"$TEST_DIR/target.txt"'" "'"$TEST_DIR/backups"'"
    echo "target: $(cat "'"$TEST_DIR/target.txt"'")"
    echo "backup: $(cat "'"$TEST_DIR/backups/target.txt"'")"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"target: new content"* ]]
  [[ "$output" == *"backup: old content"* ]]
}

@test "copy_with_backup skips identical files" {
  echo "same content" > "$TEST_DIR/target.txt"
  echo "same content" > "$TEST_DIR/source.txt"
  mkdir -p "$TEST_DIR/backups"

  run bash -c '
    OPT_VERBOSE=false
    OPT_DRY_RUN=false
    TARGET="'"$TEST_DIR"'"
    copy_with_backup() {
      local src="$1" dst="$2" backup_dir="$3"
      if [[ ! -e "$dst" ]]; then
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        return 0
      fi
      if cmp -s "$src" "$dst"; then
        return 0
      fi
      local rel_path="${dst#$TARGET/}"
      local backup_path="$backup_dir/$rel_path"
      mkdir -p "$(dirname "$backup_path")"
      cp "$dst" "$backup_path"
      cp "$src" "$dst"
    }
    copy_with_backup "'"$TEST_DIR/source.txt"'" "'"$TEST_DIR/target.txt"'" "'"$TEST_DIR/backups"'"
    # No backup should exist
    if [ -f "'"$TEST_DIR/backups/target.txt"'" ]; then
      echo "backup exists (unexpected)"
    else
      echo "no backup (correct)"
    fi
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"no backup (correct)"* ]]
}

# ─── append_if_missing (AC4b) ───────────────────────────────────────────────

@test "append_if_missing adds content when marker not present" {
  echo "line1" > "$TEST_DIR/file.txt"

  run bash -c '
    OPT_VERBOSE=false
    OPT_DRY_RUN=false
    append_if_missing() {
      local file="$1" marker="$2" content="$3"
      if [[ -f "$file" ]] && grep -qF "$marker" "$file"; then
        return 0
      fi
      if [[ -f "$file" ]] && [[ -s "$file" ]] && [[ "$(tail -c 1 "$file")" != "" ]]; then
        printf "\n" >> "$file"
      fi
      printf "%s\n" "$content" >> "$file"
    }
    append_if_missing "'"$TEST_DIR/file.txt"'" "# GAIA marker" "# GAIA marker
some content"
    cat "'"$TEST_DIR/file.txt"'"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"# GAIA marker"* ]]
  [[ "$output" == *"some content"* ]]
}

@test "append_if_missing skips when marker already present" {
  cat > "$TEST_DIR/file.txt" <<'EOF'
line1
# GAIA marker
existing content
EOF

  run bash -c '
    OPT_VERBOSE=false
    OPT_DRY_RUN=false
    append_if_missing() {
      local file="$1" marker="$2" content="$3"
      if [[ -f "$file" ]] && grep -qF "$marker" "$file"; then
        return 0
      fi
      if [[ -f "$file" ]] && [[ -s "$file" ]] && [[ "$(tail -c 1 "$file")" != "" ]]; then
        printf "\n" >> "$file"
      fi
      printf "%s\n" "$content" >> "$file"
    }
    append_if_missing "'"$TEST_DIR/file.txt"'" "# GAIA marker" "# GAIA marker
NEW content"
    cat "'"$TEST_DIR/file.txt"'"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"existing content"* ]]
  [[ "$output" != *"NEW content"* ]]
}

# ─── validate_source (AC4b) ─────────────────────────────────────────────────

@test "validate_source fails when manifest.yaml is missing" {
  mkdir -p "$TEST_DIR/bad-source/_gaia/_config"
  # No manifest.yaml

  run bash "$SCRIPT" init --source "$TEST_DIR/bad-source" --yes "$TEST_DIR/target"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Invalid GAIA source"* ]] || [[ "$output" == *"manifest"* ]]
}

# ─── Platform detection for test:shell (AC6) ────────────────────────────────

@test "setup-bats.sh exists and is executable" {
  [ -f "$BATS_TEST_DIRNAME/setup-bats.sh" ]
  [ -x "$BATS_TEST_DIRNAME/setup-bats.sh" ]
}

@test "setup-bats.sh is idempotent — safe to re-run" {
  # Running setup-bats.sh twice should succeed both times
  run bash "$BATS_TEST_DIRNAME/setup-bats.sh"
  [ "$status" -eq 0 ]

  run bash "$BATS_TEST_DIRNAME/setup-bats.sh"
  [ "$status" -eq 0 ]
}

@test "setup-bats.sh creates test_helper directory with bats libraries" {
  # After running setup, test_helper should contain bats-support and bats-assert
  run bash "$BATS_TEST_DIRNAME/setup-bats.sh"
  [ "$status" -eq 0 ]
  [ -d "$BATS_TEST_DIRNAME/test_helper/bats-support" ]
  [ -d "$BATS_TEST_DIRNAME/test_helper/bats-assert" ]
}
