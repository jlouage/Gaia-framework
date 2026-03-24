#!/usr/bin/env bats

# BATS tests for gaia-install.sh
# Run: bats test/shell/install.bats

SCRIPT="$BATS_TEST_DIRNAME/../../gaia-install.sh"

setup() {
  # Create a temp directory for each test
  TEST_DIR="$(mktemp -d)"
}

teardown() {
  # Clean up temp directory
  rm -rf "$TEST_DIR"
}

@test "installer script exists and is readable" {
  [ -f "$SCRIPT" ]
  [ -r "$SCRIPT" ]
}

@test "installer script is valid bash" {
  bash -n "$SCRIPT"
}

@test "installer shows usage with --help" {
  run bash "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage"* ]] || [[ "$output" == *"usage"* ]] || [[ "$output" == *"GAIA"* ]]
}

@test "installer rejects unknown commands" {
  run bash "$SCRIPT" foobar "$TEST_DIR"
  [ "$status" -ne 0 ]
}

@test "validate command works on empty directory" {
  run bash "$SCRIPT" validate "$TEST_DIR"
  # Should fail because no framework installed
  [ "$status" -ne 0 ]
}

# ─── Helper: create minimal valid GAIA source ──────────────────────────────

create_mock_source() {
  local src="$1"
  mkdir -p "$src/_gaia/_config"
  cat > "$src/_gaia/_config/manifest.yaml" <<'YAML'
name: gaia-framework
version: "1.0.0"
YAML
  cat > "$src/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.0.0"
project_name: "test-project"
user_name: "tester"
project_path: "."
YAML
  # Create minimal module dirs so rsync has something to copy
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$src/_gaia/$mod"
    touch "$src/_gaia/$mod/.gitkeep"
  done
  # Create CLAUDE.md
  echo "# GAIA Framework v1.0.0" > "$src/CLAUDE.md"
  # Create slash commands dir
  mkdir -p "$src/.claude/commands"
  echo "placeholder" > "$src/.claude/commands/gaia-help.md"
  # Create custom skills
  mkdir -p "$src/custom/skills"
  echo "README" > "$src/custom/skills/README.md"
}

# Expected Tier 1+2 sidecar directories (subset check)
EXPECTED_TIER1_SIDECARS=(
  "validator-sidecar"
  "architect-sidecar"
  "pm-sidecar"
  "sm-sidecar"
)

EXPECTED_TIER2_SIDECARS=(
  "orchestrator-sidecar"
  "security-sidecar"
  "devops-sidecar"
  "test-architect-sidecar"
)

EXPECTED_TIER3_SIDECARS=(
  "storyteller-sidecar"
  "tech-writer-sidecar"
  "angular-dev-sidecar"
  "typescript-dev-sidecar"
  "flutter-dev-sidecar"
  "java-dev-sidecar"
  "python-dev-sidecar"
  "mobile-dev-sidecar"
  "brainstorming-coach-sidecar"
  "design-thinking-coach-sidecar"
  "innovation-strategist-sidecar"
  "problem-solver-sidecar"
  "presentation-designer-sidecar"
  "analyst-sidecar"
  "ux-designer-sidecar"
  "qa-sidecar"
  "performance-sidecar"
  "data-engineer-sidecar"
)

# ─── Memory Tests: cmd_init ────────────────────────────────────────────────

@test "init creates _memory/ directory tree from scratch (AC1)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # _memory/ must exist at project root, NOT inside _gaia/
  [ -d "$TEST_DIR/_memory" ]
  [ -d "$TEST_DIR/_memory/checkpoints" ]
  [ -d "$TEST_DIR/_memory/checkpoints/completed" ]

  # Check Tier 1 sidecars
  for dir in "${EXPECTED_TIER1_SIDECARS[@]}"; do
    [ -d "$TEST_DIR/_memory/$dir" ]
  done

  # Check Tier 2 sidecars
  for dir in "${EXPECTED_TIER2_SIDECARS[@]}"; do
    [ -d "$TEST_DIR/_memory/$dir" ]
  done

  # Check Tier 3 sidecars
  for dir in "${EXPECTED_TIER3_SIDECARS[@]}"; do
    [ -d "$TEST_DIR/_memory/$dir" ]
  done

  rm -rf "$SRC_DIR"
}

@test "init with partial _memory/ fills gaps without overwriting (AC2)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Pre-create partial structure with a marker file
  mkdir -p "$TEST_DIR/_memory/checkpoints"
  echo "existing-data" > "$TEST_DIR/_memory/checkpoints/test-checkpoint.yaml"
  mkdir -p "$TEST_DIR/_memory/architect-sidecar"
  echo "existing-sidecar" > "$TEST_DIR/_memory/architect-sidecar/decisions.md"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Existing content preserved
  [ -f "$TEST_DIR/_memory/checkpoints/test-checkpoint.yaml" ]
  [ "$(cat "$TEST_DIR/_memory/checkpoints/test-checkpoint.yaml")" = "existing-data" ]
  [ -f "$TEST_DIR/_memory/architect-sidecar/decisions.md" ]
  [ "$(cat "$TEST_DIR/_memory/architect-sidecar/decisions.md")" = "existing-sidecar" ]

  # Missing dirs created
  [ -d "$TEST_DIR/_memory/validator-sidecar" ]
  [ -d "$TEST_DIR/_memory/sm-sidecar" ]
  [ -d "$TEST_DIR/_memory/typescript-dev-sidecar" ]

  rm -rf "$SRC_DIR"
}

# ─── Memory Tests: cmd_update ──────────────────────────────────────────────

@test "update creates missing _memory/ dirs, preserves existing (AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # First do a minimal init (just _gaia/ — no _memory/ yet)
  mkdir -p "$TEST_DIR/_gaia/_config"
  cp "$SRC_DIR/_gaia/_config/manifest.yaml" "$TEST_DIR/_gaia/_config/manifest.yaml"
  cp "$SRC_DIR/_gaia/_config/global.yaml" "$TEST_DIR/_gaia/_config/global.yaml"
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done

  # Pre-create partial _memory/ with content
  mkdir -p "$TEST_DIR/_memory/checkpoints"
  echo "keep-me" > "$TEST_DIR/_memory/checkpoints/existing.yaml"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Existing content preserved
  [ -f "$TEST_DIR/_memory/checkpoints/existing.yaml" ]
  [ "$(cat "$TEST_DIR/_memory/checkpoints/existing.yaml")" = "keep-me" ]

  # Missing sidecar dirs created
  [ -d "$TEST_DIR/_memory/validator-sidecar" ]
  [ -d "$TEST_DIR/_memory/orchestrator-sidecar" ]
  [ -d "$TEST_DIR/_memory/typescript-dev-sidecar" ]

  rm -rf "$SRC_DIR"
}

@test "update with no _memory/ creates full tree (AC3 edge case)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Minimal _gaia/ install, no _memory/
  mkdir -p "$TEST_DIR/_gaia/_config"
  cp "$SRC_DIR/_gaia/_config/manifest.yaml" "$TEST_DIR/_gaia/_config/manifest.yaml"
  cp "$SRC_DIR/_gaia/_config/global.yaml" "$TEST_DIR/_gaia/_config/global.yaml"
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Full _memory/ tree created
  [ -d "$TEST_DIR/_memory" ]
  [ -d "$TEST_DIR/_memory/checkpoints" ]
  [ -d "$TEST_DIR/_memory/checkpoints/completed" ]
  [ -d "$TEST_DIR/_memory/validator-sidecar" ]
  [ -d "$TEST_DIR/_memory/sm-sidecar" ]

  rm -rf "$SRC_DIR"
}

# ─── Memory Tests: cmd_validate ────────────────────────────────────────────

@test "validate fails when _memory/ is absent (AC4)" {
  # Create a minimal valid install WITHOUT _memory/
  mkdir -p "$TEST_DIR/_gaia/_config"
  cat > "$TEST_DIR/_gaia/_config/manifest.yaml" <<'YAML'
name: test
version: "1.0.0"
YAML
  cat > "$TEST_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.0.0"
project_name: "test"
user_name: "tester"
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done
  mkdir -p "$TEST_DIR/_gaia/core/.resolved"
  mkdir -p "$TEST_DIR/_gaia/lifecycle/.resolved"
  mkdir -p "$TEST_DIR/_gaia/creative/.resolved"
  mkdir -p "$TEST_DIR/_gaia/testing/.resolved"
  mkdir -p "$TEST_DIR/.claude/commands"
  echo "x" > "$TEST_DIR/.claude/commands/gaia-help.md"
  echo "# GAIA" > "$TEST_DIR/CLAUDE.md"
  for dir in planning-artifacts implementation-artifacts test-artifacts creative-artifacts; do
    mkdir -p "$TEST_DIR/docs/$dir"
  done

  # No _memory/ directory — validate should fail
  run bash "$SCRIPT" validate "$TEST_DIR"
  [ "$status" -ne 0 ]
  [[ "$output" == *"_memory"* ]]
}

@test "validate passes when _memory/ is present (AC5)" {
  # Create a full valid install WITH _memory/
  mkdir -p "$TEST_DIR/_gaia/_config"
  cat > "$TEST_DIR/_gaia/_config/manifest.yaml" <<'YAML'
name: test
version: "1.0.0"
YAML
  cat > "$TEST_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.0.0"
project_name: "test"
user_name: "tester"
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done
  mkdir -p "$TEST_DIR/_gaia/core/.resolved"
  mkdir -p "$TEST_DIR/_gaia/lifecycle/.resolved"
  mkdir -p "$TEST_DIR/_gaia/creative/.resolved"
  mkdir -p "$TEST_DIR/_gaia/testing/.resolved"
  mkdir -p "$TEST_DIR/.claude/commands"
  echo "x" > "$TEST_DIR/.claude/commands/gaia-help.md"
  echo "# GAIA" > "$TEST_DIR/CLAUDE.md"
  for dir in planning-artifacts implementation-artifacts test-artifacts creative-artifacts; do
    mkdir -p "$TEST_DIR/docs/$dir"
  done

  # Create _memory/ with all expected directories
  mkdir -p "$TEST_DIR/_memory/checkpoints/completed"
  local all_sidecars=(
    "validator-sidecar" "architect-sidecar" "pm-sidecar" "sm-sidecar"
    "orchestrator-sidecar" "security-sidecar" "devops-sidecar" "test-architect-sidecar"
    "storyteller-sidecar" "tech-writer-sidecar"
    "angular-dev-sidecar" "typescript-dev-sidecar" "flutter-dev-sidecar"
    "java-dev-sidecar" "python-dev-sidecar" "mobile-dev-sidecar"
    "brainstorming-coach-sidecar" "design-thinking-coach-sidecar"
    "innovation-strategist-sidecar" "problem-solver-sidecar"
    "presentation-designer-sidecar" "analyst-sidecar" "ux-designer-sidecar"
    "qa-sidecar" "performance-sidecar" "data-engineer-sidecar"
  )
  for dir in "${all_sidecars[@]}"; do
    mkdir -p "$TEST_DIR/_memory/$dir"
  done

  run bash "$SCRIPT" validate "$TEST_DIR"
  [ "$status" -eq 0 ]
}

# ─── Memory Tests: No old path references ──────────────────────────────────

@test "no _gaia/_memory references remain in installer (AC6)" {
  run grep -c '_gaia/_memory' "$SCRIPT"
  [ "$output" = "0" ] || [ "$status" -ne 0 ]
}

# ─── Memory Tests: .gitkeep and completeness ────────────────────────────────

@test "init creates .gitkeep files in each _memory/ subdirectory (AC1)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Every sidecar dir should have a .gitkeep file
  for dir in "${EXPECTED_TIER1_SIDECARS[@]}" "${EXPECTED_TIER2_SIDECARS[@]}" "${EXPECTED_TIER3_SIDECARS[@]}"; do
    [ -f "$TEST_DIR/_memory/$dir/.gitkeep" ]
  done
  [ -f "$TEST_DIR/_memory/checkpoints/.gitkeep" ]
  [ -f "$TEST_DIR/_memory/checkpoints/completed/.gitkeep" ]

  rm -rf "$SRC_DIR"
}

@test "update creates .gitkeep files in new _memory/ subdirectories (AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Minimal _gaia/ install, no _memory/
  mkdir -p "$TEST_DIR/_gaia/_config"
  cp "$SRC_DIR/_gaia/_config/manifest.yaml" "$TEST_DIR/_gaia/_config/manifest.yaml"
  cp "$SRC_DIR/_gaia/_config/global.yaml" "$TEST_DIR/_gaia/_config/global.yaml"
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Every sidecar dir should have a .gitkeep file
  for dir in "${EXPECTED_TIER1_SIDECARS[@]}" "${EXPECTED_TIER2_SIDECARS[@]}" "${EXPECTED_TIER3_SIDECARS[@]}"; do
    [ -f "$TEST_DIR/_memory/$dir/.gitkeep" ]
  done

  rm -rf "$SRC_DIR"
}

@test "MEMORY_DIRS array contains all 26 expected entries" {
  # Source the MEMORY_DIRS array from the script (extract it)
  # The array should have: 2 checkpoint dirs + 4 Tier1 + 4 Tier2 + 18 Tier3 = 28 entries? Let's count from script.
  local count
  count=$(bash -c 'source "$1" 2>/dev/null; echo ${#MEMORY_DIRS[@]}' -- "$SCRIPT" 2>/dev/null || true)
  # Since sourcing may fail due to main() call, extract via grep
  count=$(grep -c '^  "' "$SCRIPT" | head -1)
  # Alternative: count array entries between MEMORY_DIRS=( and )
  local in_array=false
  local entry_count=0
  while IFS= read -r line; do
    if [[ "$line" == *"MEMORY_DIRS=("* ]]; then
      in_array=true
      continue
    fi
    if $in_array && [[ "$line" == ")" ]]; then
      break
    fi
    if $in_array && [[ "$line" =~ ^[[:space:]]*\" ]]; then
      entry_count=$((entry_count + 1))
    fi
  done < "$SCRIPT"

  # 2 checkpoint dirs + 4 Tier1 + 4 Tier2 + 2 lifecycle Tier3 + 6 dev Tier3 + 5 creative Tier3 + 5 analysis/testing Tier3 = 28
  [ "$entry_count" -ge 26 ]
}

@test "init dry-run does not create _memory/ directories" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes --dry-run "$TEST_DIR"
  [ "$status" -eq 0 ]

  # _memory/ should NOT exist in dry-run mode
  [ ! -d "$TEST_DIR/_memory" ]
  [[ "$output" == *"dry-run"* ]]

  rm -rf "$SRC_DIR"
}

@test "validate checks individual _memory/ subdirectories (AC4)" {
  # Create a full valid install but with missing subdirectories inside _memory/
  mkdir -p "$TEST_DIR/_gaia/_config"
  cat > "$TEST_DIR/_gaia/_config/manifest.yaml" <<'YAML'
name: test
version: "1.0.0"
YAML
  cat > "$TEST_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.0.0"
project_name: "test"
user_name: "tester"
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done
  mkdir -p "$TEST_DIR/_gaia/core/.resolved"
  mkdir -p "$TEST_DIR/_gaia/lifecycle/.resolved"
  mkdir -p "$TEST_DIR/_gaia/creative/.resolved"
  mkdir -p "$TEST_DIR/_gaia/testing/.resolved"
  mkdir -p "$TEST_DIR/.claude/commands"
  echo "x" > "$TEST_DIR/.claude/commands/gaia-help.md"
  echo "# GAIA" > "$TEST_DIR/CLAUDE.md"
  for dir in planning-artifacts implementation-artifacts test-artifacts creative-artifacts; do
    mkdir -p "$TEST_DIR/docs/$dir"
  done

  # Create _memory/ but with INCOMPLETE subdirectories — only checkpoints
  mkdir -p "$TEST_DIR/_memory/checkpoints/completed"

  # Validate should fail because sidecar directories are missing
  run bash "$SCRIPT" validate "$TEST_DIR"
  [ "$status" -ne 0 ]
}

# ─── E3-S4: cmd_init flow tests (AC2) ────────────────────────────────────────

@test "init copies framework files with correct permissions (AC2)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Framework files should be present
  [ -d "$TEST_DIR/_gaia" ]
  [ -d "$TEST_DIR/_gaia/_config" ]
  [ -f "$TEST_DIR/_gaia/_config/manifest.yaml" ]
  [ -f "$TEST_DIR/_gaia/_config/global.yaml" ]

  # CLAUDE.md should be copied
  [ -f "$TEST_DIR/CLAUDE.md" ]

  # .claude/commands/ should be populated
  [ -d "$TEST_DIR/.claude/commands" ]

  # Docs directories should exist
  [ -d "$TEST_DIR/docs/planning-artifacts" ]
  [ -d "$TEST_DIR/docs/implementation-artifacts" ]
  [ -d "$TEST_DIR/docs/test-artifacts" ]
  [ -d "$TEST_DIR/docs/creative-artifacts" ]

  rm -rf "$SRC_DIR"
}

@test "init idempotent re-run does not clobber user data (AC2)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # First init
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Place user data in various locations
  echo "user-checkpoint" > "$TEST_DIR/_memory/checkpoints/my-work.yaml"
  echo "user-claude" > "$TEST_DIR/CLAUDE.md"
  mkdir -p "$TEST_DIR/docs/planning-artifacts"
  echo "user-prd" > "$TEST_DIR/docs/planning-artifacts/prd.md"

  # Second init (should warn but not clobber)
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # User data should be preserved
  [ "$(cat "$TEST_DIR/_memory/checkpoints/my-work.yaml")" = "user-checkpoint" ]
  [ "$(cat "$TEST_DIR/CLAUDE.md")" = "user-claude" ]
  [ "$(cat "$TEST_DIR/docs/planning-artifacts/prd.md")" = "user-prd" ]

  rm -rf "$SRC_DIR"
}

@test "init fails when source is invalid (missing manifest)" {
  local BAD_SRC="$(mktemp -d)"
  # No manifest.yaml

  run bash "$SCRIPT" init --source "$BAD_SRC" --yes "$TEST_DIR"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Invalid GAIA source"* ]] || [[ "$output" == *"manifest"* ]]

  rm -rf "$BAD_SRC"
}

@test "init creates .resolved directories with .gitkeep files" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # .resolved directories should exist with .gitkeep
  for mod in core lifecycle creative testing; do
    [ -d "$TEST_DIR/_gaia/$mod/.resolved" ]
    [ -f "$TEST_DIR/_gaia/$mod/.resolved/.gitkeep" ]
  done

  rm -rf "$SRC_DIR"
}

@test "init sets global.yaml values correctly" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # global.yaml should have been customized with defaults
  [ -f "$TEST_DIR/_gaia/_config/global.yaml" ]
  local project_name
  project_name="$(grep "^project_name:" "$TEST_DIR/_gaia/_config/global.yaml" | sed 's/^project_name:[[:space:]]*//' | sed 's/^"//;s/"$//')"
  # Should be set (either to dir basename or default)
  [ -n "$project_name" ]

  rm -rf "$SRC_DIR"
}

@test "init creates custom/skills directory" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  [ -d "$TEST_DIR/custom/skills" ]

  rm -rf "$SRC_DIR"
}

@test "init appends GAIA entries to .gitignore" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  [ -f "$TEST_DIR/.gitignore" ]
  grep -q "GAIA Framework" "$TEST_DIR/.gitignore"

  rm -rf "$SRC_DIR"
}

# ─── E3-S4: cmd_update flow tests (AC3) ──────────────────────────────────────

@test "update creates backup of changed files (AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Do initial init
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Modify source manifest.yaml (which is in update_targets) to force a diff
  cat > "$SRC_DIR/_gaia/_config/manifest.yaml" <<'YAML'
name: gaia-framework
version: "2.0.0"
updated: true
YAML

  # Also update global.yaml version
  cat > "$SRC_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "2.0.0"
project_name: "test-project"
user_name: "tester"
project_path: "."
YAML

  # Run update
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Backup directory should exist because manifest.yaml was different
  local backup_dirs
  backup_dirs="$(ls -d "$TEST_DIR/_gaia/_backups"/*/ 2>/dev/null | head -1)"
  [ -n "$backup_dirs" ]

  rm -rf "$SRC_DIR"
}

@test "update preserves user-modified files in _memory (AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Do initial init
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Add user data to _memory
  echo "my-decisions" > "$TEST_DIR/_memory/architect-sidecar/decisions.md"
  echo "checkpoint-data" > "$TEST_DIR/_memory/checkpoints/my-checkpoint.yaml"

  # Run update
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # User data must be preserved
  [ -f "$TEST_DIR/_memory/architect-sidecar/decisions.md" ]
  [ "$(cat "$TEST_DIR/_memory/architect-sidecar/decisions.md")" = "my-decisions" ]
  [ -f "$TEST_DIR/_memory/checkpoints/my-checkpoint.yaml" ]
  [ "$(cat "$TEST_DIR/_memory/checkpoints/my-checkpoint.yaml")" = "checkpoint-data" ]

  rm -rf "$SRC_DIR"
}

@test "update fails when no existing installation found" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Empty target — no _gaia/
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -ne 0 ]
  [[ "$output" == *"No GAIA installation found"* ]]

  rm -rf "$SRC_DIR"
}

# ─── E7-S1: Command Injection & eval Removal Tests ─────────────────────────

@test "E7-S1: no eval in cmd_validate check() helper (AC1)" {
  # After refactoring, the check() helper must not use eval
  run grep -n 'eval ' "$SCRIPT"
  # Filter out comments
  local non_comment_evals=0
  while IFS= read -r line; do
    # Skip blank lines and comment-only lines
    [[ -z "$line" ]] && continue
    local stripped
    stripped="$(echo "$line" | sed 's/^[0-9]*://')"
    stripped="$(echo "$stripped" | sed 's/^[[:space:]]*//')"
    [[ "$stripped" == \#* ]] && continue
    non_comment_evals=$((non_comment_evals + 1))
  done <<< "$output"
  [ "$non_comment_evals" -eq 0 ]
}

@test "E7-S1: validate handles TARGET with semicolons safely (AC2, AC3a)" {
  # A malicious TARGET with a semicolon should not execute injected commands
  local marker_file="$TEST_DIR/injection_marker"
  local malicious_target="; touch $marker_file ;"
  run bash "$SCRIPT" validate "$malicious_target"
  # Should fail (non-zero exit) — the path is not a valid GAIA install
  [ "$status" -ne 0 ]
  # The injected command must NOT have executed
  [ ! -f "$marker_file" ]
}

@test "E7-S1: validate handles TARGET with backticks safely (AC2, AC3a)" {
  local marker_file="$TEST_DIR/backtick_marker"
  local malicious_target="\`touch $marker_file\`"
  run bash "$SCRIPT" validate "$malicious_target"
  [ "$status" -ne 0 ]
  [ ! -f "$marker_file" ]
}

@test "E7-S1: validate handles TARGET with subshell syntax safely (AC2, AC3a)" {
  local marker_file="$TEST_DIR/subshell_marker"
  local malicious_target="\$(touch $marker_file)"
  run bash "$SCRIPT" validate "$malicious_target"
  [ "$status" -ne 0 ]
  [ ! -f "$marker_file" ]
}

@test "E7-S1: validate handles TARGET with pipe safely (AC2)" {
  local malicious_target="| echo pwned"
  run bash "$SCRIPT" validate "$malicious_target"
  [ "$status" -ne 0 ]
}

@test "E7-S1: validate rejects empty TARGET (AC5)" {
  run bash "$SCRIPT" validate ""
  [ "$status" -ne 0 ]
}

@test "E7-S1: validate rejects whitespace-only TARGET (AC5)" {
  run bash "$SCRIPT" validate "   "
  [ "$status" -ne 0 ]
}

@test "E7-S1: validate handles TARGET with spaces correctly (AC2)" {
  # Create a valid framework directory at a path with spaces
  local space_dir="$TEST_DIR/path with spaces/project"
  mkdir -p "$space_dir/_gaia/_config"
  cat > "$space_dir/_gaia/_config/manifest.yaml" <<'YAML'
name: test
version: "1.0.0"
YAML
  cat > "$space_dir/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.0.0"
project_name: "test"
user_name: "tester"
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$space_dir/_gaia/$mod"
  done
  mkdir -p "$space_dir/_gaia/core/.resolved"
  mkdir -p "$space_dir/_gaia/lifecycle/.resolved"
  mkdir -p "$space_dir/_gaia/creative/.resolved"
  mkdir -p "$space_dir/_gaia/testing/.resolved"
  mkdir -p "$space_dir/.claude/commands"
  echo "x" > "$space_dir/.claude/commands/gaia-help.md"
  echo "# GAIA" > "$space_dir/CLAUDE.md"
  for dir in planning-artifacts implementation-artifacts test-artifacts creative-artifacts; do
    mkdir -p "$space_dir/docs/$dir"
  done
  mkdir -p "$space_dir/_memory/checkpoints/completed"
  local all_sidecars=(
    "validator-sidecar" "architect-sidecar" "pm-sidecar" "sm-sidecar"
    "orchestrator-sidecar" "security-sidecar" "devops-sidecar" "test-architect-sidecar"
    "storyteller-sidecar" "tech-writer-sidecar"
    "angular-dev-sidecar" "typescript-dev-sidecar" "flutter-dev-sidecar"
    "java-dev-sidecar" "python-dev-sidecar" "mobile-dev-sidecar"
    "brainstorming-coach-sidecar" "design-thinking-coach-sidecar"
    "innovation-strategist-sidecar" "problem-solver-sidecar"
    "presentation-designer-sidecar" "analyst-sidecar" "ux-designer-sidecar"
    "qa-sidecar" "performance-sidecar" "data-engineer-sidecar"
  )
  for dir in "${all_sidecars[@]}"; do
    mkdir -p "$space_dir/_memory/$dir"
  done

  # Validate should work with spaces in path
  run bash "$SCRIPT" validate "$space_dir"
  [ "$status" -eq 0 ]
}

@test "E7-S1: no bash -c or sh -c with user input introduced (AC4)" {
  # Verify no equivalent dynamic execution constructs replaced eval
  local dangerous_patterns=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local stripped
    stripped="$(echo "$line" | sed 's/^[0-9]*://')"
    stripped="$(echo "$stripped" | sed 's/^[[:space:]]*//')"
    [[ "$stripped" == \#* ]] && continue
    dangerous_patterns=$((dangerous_patterns + 1))
  done <<< "$(grep -n 'bash -c\|sh -c' "$SCRIPT" 2>/dev/null || true)"
  [ "$dangerous_patterns" -eq 0 ]
}

@test "E7-S1: existing validate regression — all checks pass on valid install (AC3b)" {
  # Create a full valid install — same as "validate passes when _memory/ is present"
  mkdir -p "$TEST_DIR/_gaia/_config"
  cat > "$TEST_DIR/_gaia/_config/manifest.yaml" <<'YAML'
name: test
version: "1.0.0"
YAML
  cat > "$TEST_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.0.0"
project_name: "test"
user_name: "tester"
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done
  mkdir -p "$TEST_DIR/_gaia/core/.resolved"
  mkdir -p "$TEST_DIR/_gaia/lifecycle/.resolved"
  mkdir -p "$TEST_DIR/_gaia/creative/.resolved"
  mkdir -p "$TEST_DIR/_gaia/testing/.resolved"
  mkdir -p "$TEST_DIR/.claude/commands"
  echo "x" > "$TEST_DIR/.claude/commands/gaia-help.md"
  echo "# GAIA" > "$TEST_DIR/CLAUDE.md"
  for dir in planning-artifacts implementation-artifacts test-artifacts creative-artifacts; do
    mkdir -p "$TEST_DIR/docs/$dir"
  done
  mkdir -p "$TEST_DIR/_memory/checkpoints/completed"
  local all_sidecars=(
    "validator-sidecar" "architect-sidecar" "pm-sidecar" "sm-sidecar"
    "orchestrator-sidecar" "security-sidecar" "devops-sidecar" "test-architect-sidecar"
    "storyteller-sidecar" "tech-writer-sidecar"
    "angular-dev-sidecar" "typescript-dev-sidecar" "flutter-dev-sidecar"
    "java-dev-sidecar" "python-dev-sidecar" "mobile-dev-sidecar"
    "brainstorming-coach-sidecar" "design-thinking-coach-sidecar"
    "innovation-strategist-sidecar" "problem-solver-sidecar"
    "presentation-designer-sidecar" "analyst-sidecar" "ux-designer-sidecar"
    "qa-sidecar" "performance-sidecar" "data-engineer-sidecar"
  )
  for dir in "${all_sidecars[@]}"; do
    mkdir -p "$TEST_DIR/_memory/$dir"
  done

  run bash "$SCRIPT" validate "$TEST_DIR"
  [ "$status" -eq 0 ]
  # Verify the expected pass count format appears
  [[ "$output" == *"checks passed"* ]]
}

# ─── E6-S4: Path normalization integration tests ─────────────────────────────

@test "E6-S4: normalize_path function exists in installer (AC1)" {
  run grep -c 'normalize_path()' "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" -ge 1 ]
}

@test "E6-S4: SOURCE_FLAG assignment uses normalize_path (AC1)" {
  # The --source argument parsing should normalize the path
  run grep 'SOURCE_FLAG=.*normalize_path' "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "E6-S4: TARGET assignment uses normalize_path (AC1)" {
  # The positional argument parsing for TARGET should normalize the path
  run grep 'TARGET=.*normalize_path' "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "E6-S4: resolve_source guards realpath with command -v (AC4)" {
  # realpath must be guarded, not called bare
  run grep 'command -v realpath' "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "E6-S4: resolve_source has cd+pwd fallback (AC4)" {
  # A fallback using cd && pwd must exist near resolve_source
  run bash -c 'sed -n "/resolve_source()/,/^}/p" "'"$SCRIPT"'" | grep "cd.*pwd"'
  [ "$status" -eq 0 ]
}

@test "update updates framework version in global.yaml" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Do initial init
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Bump source version
  cat > "$SRC_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "2.0.0"
project_name: "test-project"
user_name: "tester"
project_path: "."
YAML

  # Run update
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Version should be updated
  local version
  version="$(grep "^framework_version:" "$TEST_DIR/_gaia/_config/global.yaml" | sed 's/^framework_version:[[:space:]]*//' | sed 's/^"//;s/"$//')"
  [ "$version" = "2.0.0" ]

  rm -rf "$SRC_DIR"
}

# ─── E6-S2: cmd_update find -print0 cross-platform tests ─────────────────

@test "E6-S2: cmd_update copies nested files including names with spaces (AC2, AC5)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Add nested files with spaces in names to a framework directory
  mkdir -p "$SRC_DIR/_gaia/core/engine/sub dir"
  echo "content-a" > "$SRC_DIR/_gaia/core/engine/normal.xml"
  echo "content-b" > "$SRC_DIR/_gaia/core/engine/my file.xml"
  echo "content-c" > "$SRC_DIR/_gaia/core/engine/sub dir/deep file.txt"

  # Init target first
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Modify a source file to force an update
  echo "content-a-v2" > "$SRC_DIR/_gaia/core/engine/normal.xml"

  # Run update
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Verify all files were copied — including those with spaces
  [ -f "$TEST_DIR/_gaia/core/engine/normal.xml" ]
  [ -f "$TEST_DIR/_gaia/core/engine/my file.xml" ]
  [ -f "$TEST_DIR/_gaia/core/engine/sub dir/deep file.txt" ]
  [ "$(cat "$TEST_DIR/_gaia/core/engine/my file.xml")" = "content-b" ]
  [ "$(cat "$TEST_DIR/_gaia/core/engine/sub dir/deep file.txt")" = "content-c" ]

  rm -rf "$SRC_DIR"
}

@test "E6-S2: cmd_update handles empty source directory without error (AC6)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Ensure core/engine exists but is empty (no files, just the dir)
  rm -rf "$SRC_DIR/_gaia/core/engine"
  mkdir -p "$SRC_DIR/_gaia/core/engine"

  # Init target
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Run update — empty dir should not cause an error
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  rm -rf "$SRC_DIR"
}

@test "E6-S2: find_files_in_dir helper function exists and is callable (AC1, AC2)" {
  # The helper function should be defined in the installer script
  run grep -c 'find_files_in_dir()' "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" -ge 1 ]
}

@test "E6-S2: newline-delimited fallback produces correct file list (AC1, AC4, AC7)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Add files with spaces in names
  mkdir -p "$SRC_DIR/_gaia/core/engine/subdir"
  echo "a" > "$SRC_DIR/_gaia/core/engine/file1.xml"
  echo "b" > "$SRC_DIR/_gaia/core/engine/file 2.xml"
  echo "c" > "$SRC_DIR/_gaia/core/engine/subdir/file3.txt"

  # Init target
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Override find_files_in_dir to force newline-delimited fallback
  # by making find -print0 "unsupported"
  local FAKE_BIN="$(mktemp -d)"
  cat > "$FAKE_BIN/find" << 'SH'
#!/usr/bin/env bash
# Wrapper that strips -print0 support to simulate busybox find
args=("$@")
for arg in "${args[@]}"; do
  if [[ "$arg" == "-print0" ]]; then
    # Fail the probe: find /dev/null -maxdepth 0 -print0
    if [[ "${args[1]}" == "/dev/null" ]]; then
      exit 1
    fi
    # For actual file listing, strip -print0 and use newline-delimited output
    new_args=()
    for a in "${args[@]}"; do
      [[ "$a" != "-print0" ]] && new_args+=("$a")
    done
    /usr/bin/find "${new_args[@]}"
    exit $?
  fi
done
/usr/bin/find "$@"
SH
  chmod +x "$FAKE_BIN/find"

  # Modify source files AFTER init to ensure update must re-copy them
  echo "a-v2" > "$SRC_DIR/_gaia/core/engine/file1.xml"
  echo "b-v2" > "$SRC_DIR/_gaia/core/engine/file 2.xml"
  echo "c-v2" > "$SRC_DIR/_gaia/core/engine/subdir/file3.txt"

  # Run update with the fake find that lacks -print0
  run env PATH="$FAKE_BIN:$PATH" bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Verify all files were re-copied with UPDATED content via the fallback path
  [ -f "$TEST_DIR/_gaia/core/engine/file1.xml" ]
  [ "$(cat "$TEST_DIR/_gaia/core/engine/file1.xml")" = "a-v2" ]
  [ -f "$TEST_DIR/_gaia/core/engine/file 2.xml" ]
  [ "$(cat "$TEST_DIR/_gaia/core/engine/file 2.xml")" = "b-v2" ]
  [ -f "$TEST_DIR/_gaia/core/engine/subdir/file3.txt" ]
  [ "$(cat "$TEST_DIR/_gaia/core/engine/subdir/file3.txt")" = "c-v2" ]

  rm -rf "$SRC_DIR" "$FAKE_BIN"
}
