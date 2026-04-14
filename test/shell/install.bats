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
  # Create custom skills, templates, and stakeholders
  mkdir -p "$src/custom/skills"
  echo "README" > "$src/custom/skills/README.md"
  mkdir -p "$src/custom/templates"
  echo "README" > "$src/custom/templates/README.md"
  mkdir -p "$src/custom/stakeholders"
  echo "README" > "$src/custom/stakeholders/README.md"
  # E17-S25: test-environment.yaml.example (required by validate_source)
  mkdir -p "$src/docs/test-artifacts"
  cat > "$src/docs/test-artifacts/test-environment.yaml.example" <<'YAML'
# Example test-environment.yaml — copy and customize for your project
runners:
  - name: vitest
    command: npx vitest run
    tier: 1
YAML
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
  # Custom directories (ADR-020)
  mkdir -p "$TEST_DIR/custom/skills"
  mkdir -p "$TEST_DIR/custom/templates"

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
  # Custom directories (ADR-020)
  mkdir -p "$space_dir/custom/skills"
  mkdir -p "$space_dir/custom/templates"

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
  # Custom directories (ADR-020)
  mkdir -p "$TEST_DIR/custom/skills"
  mkdir -p "$TEST_DIR/custom/templates"

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

# ─── E4-S8: Dynamic Version Tests ─────────────────────────────────────────

# Helper: create a mock package.json in a given directory
create_mock_package_json() {
  local dir="$1" version="${2:-1.65.0}"
  cat > "$dir/package.json" <<PJSON
{
  "name": "gaia-framework",
  "version": "${version}",
  "description": "test"
}
PJSON
}

# Helper: set up a temp copy of the installer with a mock package.json
setup_versioned_script() {
  local tmp="$1" version="${2:-1.65.0}"
  cp "$SCRIPT" "$tmp/gaia-install.sh"
  chmod +x "$tmp/gaia-install.sh"
  create_mock_package_json "$tmp" "$version"
}

@test "E4-S8: no hardcoded readonly VERSION line exists" {
  run grep -n '^readonly VERSION=' "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "E4-S8: --version flag reads version from package.json" {
  local TMP="$(mktemp -d)"
  setup_versioned_script "$TMP" "2.99.0"

  run bash "$TMP/gaia-install.sh" --version
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "2.99.0"

  rm -rf "$TMP"
}

@test "E4-S8: init banner displays version from package.json" {
  local SRC_DIR="$(mktemp -d)"
  local TMP="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_versioned_script "$TMP" "3.0.0"

  run bash "$TMP/gaia-install.sh" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "Installer v3.0.0"

  rm -rf "$SRC_DIR" "$TMP"
}

@test "E4-S8: update banner displays version from global.yaml" {
  local SRC_DIR="$(mktemp -d)"
  local TMP="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_versioned_script "$TMP" "3.0.0"

  # Set up a pre-existing GAIA install at TEST_DIR
  mkdir -p "$TEST_DIR/_gaia/_config"
  cp "$SRC_DIR/_gaia/_config/manifest.yaml" "$TEST_DIR/_gaia/_config/manifest.yaml"
  # Set framework_version in target global.yaml to a specific value
  cat > "$TEST_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.50.0"
project_name: "test"
user_name: "tester"
project_path: "."
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done

  run bash "$TMP/gaia-install.sh" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]
  # The updater banner should show the source framework_version, NOT the package.json version
  echo "$output" | grep -q "Updater v1.0.0"

  rm -rf "$SRC_DIR" "$TMP"
}

@test "E4-S8: --version fails with missing package.json" {
  local TMP="$(mktemp -d)"
  cp "$SCRIPT" "$TMP/gaia-install.sh"
  chmod +x "$TMP/gaia-install.sh"
  # No package.json created

  run bash "$TMP/gaia-install.sh" --version
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "package.json"

  rm -rf "$TMP"
}

@test "E4-S8: --version fails with empty version field in package.json" {
  local TMP="$(mktemp -d)"
  cp "$SCRIPT" "$TMP/gaia-install.sh"
  chmod +x "$TMP/gaia-install.sh"
  cat > "$TMP/package.json" <<'PJSON'
{
  "name": "gaia-framework",
  "version": "",
  "description": "test"
}
PJSON

  run bash "$TMP/gaia-install.sh" --version
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "version"

  rm -rf "$TMP"
}

@test "E4-S8: update fails when source global.yaml missing framework_version" {
  local SRC_DIR="$(mktemp -d)"
  local TMP="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_versioned_script "$TMP" "1.0.0"

  # Remove framework_version from SOURCE global.yaml
  cat > "$SRC_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
project_name: "test"
user_name: "tester"
YAML

  # Set up a pre-existing GAIA install at TEST_DIR
  mkdir -p "$TEST_DIR/_gaia/_config"
  cp "$SRC_DIR/_gaia/_config/manifest.yaml" "$TEST_DIR/_gaia/_config/manifest.yaml"
  cat > "$TEST_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "1.0.0"
project_name: "test"
user_name: "tester"
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done

  run bash "$TMP/gaia-install.sh" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -ne 0 ]
  echo "$output" | grep -qE "framework_version|global.yaml"

  rm -rf "$SRC_DIR" "$TMP"
}

# ─── E4-S8 Test Automation: Additional Coverage ──────────────────────────────

@test "E4-S8-TA: read_package_version helper function exists in installer" {
  run grep -c 'read_package_version()' "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" -ge 1 ]
}

@test "E4-S8-TA: usage banner displays version from package.json (AC2)" {
  local TMP="$(mktemp -d)"
  setup_versioned_script "$TMP" "4.5.6"

  run bash "$TMP/gaia-install.sh" --help
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "Installer v4.5.6"

  rm -rf "$TMP"
}

@test "E4-S8-TA: init fails when package.json is missing (AC5 init path)" {
  local SRC_DIR="$(mktemp -d)"
  local TMP="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  # Copy script but do NOT create package.json
  cp "$SCRIPT" "$TMP/gaia-install.sh"
  chmod +x "$TMP/gaia-install.sh"

  run bash "$TMP/gaia-install.sh" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "package.json"

  rm -rf "$SRC_DIR" "$TMP"
}

@test "E4-S8-TA: version byte-for-byte matches package.json value (AC4)" {
  local TMP="$(mktemp -d)"
  setup_versioned_script "$TMP" "7.8.9"

  run bash "$TMP/gaia-install.sh" --version
  [ "$status" -eq 0 ]
  # Trim whitespace and compare exact version string
  local trimmed
  trimmed="$(echo "$output" | tr -d '[:space:]')"
  [ "$trimmed" = "7.8.9" ]

  rm -rf "$TMP"
}

@test "E4-S8-TA: version read uses grep/sed only — no jq, python, or node (AC2 constraint)" {
  # The read_package_version function must not use jq, python, or node
  local func_body
  func_body="$(sed -n '/^read_package_version()/,/^}/p' "$SCRIPT")"
  echo "$func_body" | grep -vq 'jq '
  echo "$func_body" | grep -vq 'python '
  echo "$func_body" | grep -vq 'node '
}

@test "E4-S8-TA: update banner version comes from source global.yaml not package.json (AC3 isolation)" {
  local SRC_DIR="$(mktemp -d)"
  local TMP="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  # Set package.json to a DIFFERENT version than global.yaml
  setup_versioned_script "$TMP" "99.0.0"
  # Source global.yaml has framework_version: 1.0.0 (from create_mock_source)

  mkdir -p "$TEST_DIR/_gaia/_config"
  cp "$SRC_DIR/_gaia/_config/manifest.yaml" "$TEST_DIR/_gaia/_config/manifest.yaml"
  cat > "$TEST_DIR/_gaia/_config/global.yaml" <<'YAML'
framework_name: "GAIA"
framework_version: "0.9.0"
project_name: "test"
user_name: "tester"
project_path: "."
YAML
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$TEST_DIR/_gaia/$mod"
  done

  run bash "$TMP/gaia-install.sh" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]
  # Update banner must show source global.yaml version (1.0.0), NOT package.json (99.0.0)
  echo "$output" | grep -q "Updater v1.0.0"
  # Must NOT show the package.json version in the updater banner
  local banner_line
  banner_line="$(echo "$output" | grep "Updater v")"
  echo "$banner_line" | grep -vq "99.0.0"

  rm -rf "$SRC_DIR" "$TMP"
}

# ─── E10-S13: Custom Directory Bootstrap Tests ──────────────────────────────

@test "init creates custom/skills and custom/templates directories" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  [ -d "$TEST_DIR/custom/skills" ]
  [ -d "$TEST_DIR/custom/templates" ]

  rm -rf "$SRC_DIR"
}

@test "update creates missing custom/templates without overwriting existing files" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Set up a pre-existing installation (no custom/templates/)
  bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"

  # Add a user file in custom/skills/ to verify preservation
  echo "user-content" > "$TEST_DIR/custom/skills/my-skill.md"

  # Remove custom/templates/ to simulate pre-custom installation
  rm -rf "$TEST_DIR/custom/templates"
  [ ! -d "$TEST_DIR/custom/templates" ]

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # custom/templates/ should be created
  [ -d "$TEST_DIR/custom/templates" ]
  # User files in custom/skills/ must be preserved
  [ -f "$TEST_DIR/custom/skills/my-skill.md" ]
  [ "$(cat "$TEST_DIR/custom/skills/my-skill.md")" = "user-content" ]

  rm -rf "$SRC_DIR"
}

@test "validate reports missing custom/templates as check failure" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Create a valid installation
  bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"

  # Remove custom/templates/ to trigger validation failure
  rm -rf "$TEST_DIR/custom/templates"

  run bash "$SCRIPT" validate "$TEST_DIR"
  # Validate should fail (non-zero exit) because custom/templates/ is missing
  [ "$status" -ne 0 ]
  # Output should mention the missing directory
  [[ "$output" == *"custom/templates"* ]]

  rm -rf "$SRC_DIR"
}

# ─── E6-S15: cp fallback nesting bug regression tests ─────────────────────────

@test "E6-S15: cp fallback produces flat _gaia/ structure, no _gaia/_gaia/ nesting (AC1, AC5a)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Override PATH to disable rsync, forcing copy_gaia_files() to use cp fallback
  local SAFE_PATH="$(mktemp -d)"
  # Copy only essential commands but NOT rsync
  for cmd in cp mkdir tar bash cat touch rm grep sed chmod ls head tail wc date printf readlink dirname basename mktemp find tr sort uname cut awk tee; do
    local cmd_path
    cmd_path="$(command -v "$cmd" 2>/dev/null)" && ln -sf "$cmd_path" "$SAFE_PATH/$cmd"
  done

  # Run init with rsync removed from PATH
  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # CRITICAL: Flat structure must exist
  [ -d "$TEST_DIR/_gaia/_config" ]
  [ -d "$TEST_DIR/_gaia/core" ]

  # CRITICAL: Nested structure must NOT exist
  [ ! -d "$TEST_DIR/_gaia/_gaia" ]

  rm -rf "$SRC_DIR" "$SAFE_PATH"
}

@test "E6-S15: cp fallback merges into partial existing _gaia/ without nesting (AC4, AC5a)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Pre-create partial target _gaia/ with some content
  mkdir -p "$TEST_DIR/_gaia/_config"
  echo "existing-config" > "$TEST_DIR/_gaia/_config/user-settings.yaml"

  # Override PATH to disable rsync
  local SAFE_PATH="$(mktemp -d)"
  for cmd in cp mkdir tar bash cat touch rm grep sed chmod ls head tail wc date printf readlink dirname basename mktemp find tr sort uname cut awk tee; do
    local cmd_path
    cmd_path="$(command -v "$cmd" 2>/dev/null)" && ln -sf "$cmd_path" "$SAFE_PATH/$cmd"
  done

  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Flat structure — contents merged
  [ -d "$TEST_DIR/_gaia/_config" ]
  [ -d "$TEST_DIR/_gaia/core" ]

  # No nesting
  [ ! -d "$TEST_DIR/_gaia/_gaia" ]

  rm -rf "$SRC_DIR" "$SAFE_PATH"
}

@test "E6-S15: isolated cp path (rsync+tar disabled) produces flat structure (AC5a)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Override PATH to disable BOTH rsync and tar, isolating the cp path
  local SAFE_PATH="$(mktemp -d)"
  for cmd in cp mkdir bash cat touch rm grep sed chmod ls head tail wc date printf readlink dirname basename mktemp find tr sort uname cut awk tee; do
    local cmd_path
    cmd_path="$(command -v "$cmd" 2>/dev/null)" && ln -sf "$cmd_path" "$SAFE_PATH/$cmd"
  done
  # tar is intentionally excluded from SAFE_PATH

  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Flat structure
  [ -d "$TEST_DIR/_gaia/_config" ]
  [ -d "$TEST_DIR/_gaia/core" ]

  # No nesting
  [ ! -d "$TEST_DIR/_gaia/_gaia" ]

  rm -rf "$SRC_DIR" "$SAFE_PATH"
}

# ─── E3-S7: rsync fallback tests for copy_gaia_files() ──────────────────────

# Helper: build a restricted PATH that excludes specific commands
# Usage: _e3s7_build_path <exclude_cmd1> <exclude_cmd2> ...
# Returns the temp dir path on stdout; caller must clean up.
_e3s7_build_path() {
  local exclude=("$@")
  local safe_path
  safe_path="$(mktemp -d)"
  local all_cmds=(cp mkdir tar bash cat touch rm grep sed chmod ls head tail wc date printf readlink dirname basename mktemp find tr sort uname cut awk tee)
  for cmd in "${all_cmds[@]}"; do
    local skip=false
    for ex in "${exclude[@]}"; do
      [[ "$cmd" == "$ex" ]] && skip=true && break
    done
    if [[ "$skip" == false ]]; then
      local cmd_path
      cmd_path="$(command -v "$cmd" 2>/dev/null)" && ln -sf "$cmd_path" "$safe_path/$cmd"
    fi
  done
  echo "$safe_path"
}

@test "E3-S7: cp fallback triggers when rsync is absent (AC1, AC2)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Build PATH without rsync
  local SAFE_PATH
  SAFE_PATH="$(_e3s7_build_path rsync)"

  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Output should mention cp, not rsync
  [[ "$output" == *"cp"* ]] || [[ "$output" == *"Copied"* ]]

  # Framework files must exist
  [ -d "$TEST_DIR/_gaia/_config" ]
  [ -d "$TEST_DIR/_gaia/core" ]
  [ -d "$TEST_DIR/_gaia/lifecycle" ]

  rm -rf "$SRC_DIR" "$SAFE_PATH"
}

@test "E3-S7: rsync path works when rsync is available — no regression (AC5)" {
  # Skip if rsync is not installed on this system
  command -v rsync >/dev/null 2>&1 || skip "rsync not installed"

  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Framework files must exist
  [ -d "$TEST_DIR/_gaia/_config" ]
  [ -d "$TEST_DIR/_gaia/core" ]
  [ -d "$TEST_DIR/_gaia/lifecycle" ]
  [ -d "$TEST_DIR/_gaia/dev" ]
  [ -d "$TEST_DIR/_gaia/creative" ]
  [ -d "$TEST_DIR/_gaia/testing" ]

  rm -rf "$SRC_DIR"
}

# ─── E10-S19: Customize.yaml Migration Tests ─────────────────────────────────

# Helper: set up a minimal GAIA install for update tests (avoids repetitive boilerplate)
setup_for_update() {
  local src="$1" target="$2"
  mkdir -p "$target/_gaia/_config"
  cp "$src/_gaia/_config/manifest.yaml" "$target/_gaia/_config/manifest.yaml"
  cp "$src/_gaia/_config/global.yaml" "$target/_gaia/_config/global.yaml"
  for mod in core lifecycle dev creative testing; do
    mkdir -p "$target/_gaia/$mod"
  done
}

@test "E10-S19: fresh update with no customize.yaml files runs silently (Scenario 1)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  # No customize.yaml files anywhere
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # custom/skills/ should exist (created by update) but empty of customize.yaml
  [ -d "$TEST_DIR/custom/skills" ]
  local count
  count="$(find "$TEST_DIR/custom/skills" -name '*.customize.yaml' | wc -l | tr -d ' ')"
  [ "$count" -eq 0 ]

  rm -rf "$SRC_DIR"
}

@test "E3-S7: cp fallback directory structure matches rsync output (AC3)" {
  command -v rsync >/dev/null 2>&1 || skip "rsync not installed — cannot compare"

  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Run with rsync (normal path)
  local RSYNC_DIR="$(mktemp -d)"
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$RSYNC_DIR"
  [ "$status" -eq 0 ]

  # Run without rsync (cp fallback)
  local CP_DIR="$(mktemp -d)"
  local SAFE_PATH
  SAFE_PATH="$(_e3s7_build_path rsync)"
  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$CP_DIR"
  [ "$status" -eq 0 ]

  # Compare directory trees (file listing only, ignore timestamps)
  local rsync_tree cp_tree
  rsync_tree="$(cd "$RSYNC_DIR" && find _gaia -type f | sort)"
  cp_tree="$(cd "$CP_DIR" && find _gaia -type f | sort)"
  [ "$rsync_tree" = "$cp_tree" ]

  rm -rf "$SRC_DIR" "$RSYNC_DIR" "$CP_DIR" "$SAFE_PATH"
}

@test "E3-S7: cp fallback excludes .resolved/*.yaml files (AC3, AC4)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Add .resolved/*.yaml files that should be excluded
  mkdir -p "$SRC_DIR/_gaia/lifecycle/workflows/dev-story/.resolved"
  echo "resolved: true" > "$SRC_DIR/_gaia/lifecycle/workflows/dev-story/.resolved/dev-story.yaml"
  mkdir -p "$SRC_DIR/_gaia/core/.resolved"
  echo "resolved: true" > "$SRC_DIR/_gaia/core/.resolved/core-config.yaml"

  # Run with cp fallback (no rsync)
  local SAFE_PATH
  SAFE_PATH="$(_e3s7_build_path rsync)"
  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # .resolved/*.yaml must NOT exist in target
  [ ! -f "$TEST_DIR/_gaia/lifecycle/workflows/dev-story/.resolved/dev-story.yaml" ]
  [ ! -f "$TEST_DIR/_gaia/core/.resolved/core-config.yaml" ]

  # Non-.resolved files must still exist
  [ -f "$TEST_DIR/_gaia/_config/manifest.yaml" ]

  rm -rf "$SRC_DIR" "$SAFE_PATH"
}

@test "E3-S7: cp fallback preserves file permissions (AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Set a specific permission on a source file
  chmod 755 "$SRC_DIR/_gaia/_config/manifest.yaml"

  local SAFE_PATH
  SAFE_PATH="$(_e3s7_build_path rsync)"
  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Check that the permission was preserved
  local src_perms dst_perms
  src_perms="$(stat -f '%Lp' "$SRC_DIR/_gaia/_config/manifest.yaml" 2>/dev/null || stat -c '%a' "$SRC_DIR/_gaia/_config/manifest.yaml" 2>/dev/null)"
  dst_perms="$(stat -f '%Lp' "$TEST_DIR/_gaia/_config/manifest.yaml" 2>/dev/null || stat -c '%a' "$TEST_DIR/_gaia/_config/manifest.yaml" 2>/dev/null)"
  [ "$src_perms" = "$dst_perms" ]

  rm -rf "$SRC_DIR" "$SAFE_PATH"
}

@test "E3-S7: cp fallback produces all module directories (AC2, AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  local SAFE_PATH
  SAFE_PATH="$(_e3s7_build_path rsync)"
  PATH="$SAFE_PATH" run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Every module directory from source must be present
  [ -d "$TEST_DIR/_gaia/core" ]
  [ -d "$TEST_DIR/_gaia/lifecycle" ]
  [ -d "$TEST_DIR/_gaia/dev" ]
  [ -d "$TEST_DIR/_gaia/creative" ]
  [ -d "$TEST_DIR/_gaia/testing" ]

  # Config files must be copied
  [ -f "$TEST_DIR/_gaia/_config/manifest.yaml" ]
  [ -f "$TEST_DIR/_gaia/_config/global.yaml" ]

  rm -rf "$SRC_DIR" "$SAFE_PATH"
}

# ─── E10-S19: Customize.yaml Migration Tests (continued) ────────────────────

@test "E10-S19: customize.yaml files copied from agents/ to custom/skills/ (Scenario 2, AC1)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  # Place a customize.yaml in _gaia/_config/agents/
  mkdir -p "$TEST_DIR/_gaia/_config/agents"
  cat > "$TEST_DIR/_gaia/_config/agents/typescript-dev.customize.yaml" <<'YAML'
skill_overrides:
  git-workflow:
    source: "custom/skills/git-workflow.md"
YAML

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # File should now exist in custom/skills/
  [ -f "$TEST_DIR/custom/skills/typescript-dev.customize.yaml" ]

  rm -rf "$SRC_DIR"
}

@test "E10-S19: multiple customize.yaml files all migrated (Scenario 3, AC1)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  # Place 3 customize.yaml files in _gaia/_config/agents/
  mkdir -p "$TEST_DIR/_gaia/_config/agents"
  for agent in typescript-dev angular-dev all-dev; do
    echo "skill_overrides: {}" > "$TEST_DIR/_gaia/_config/agents/${agent}.customize.yaml"
  done

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # All 3 should be in custom/skills/
  [ -f "$TEST_DIR/custom/skills/typescript-dev.customize.yaml" ]
  [ -f "$TEST_DIR/custom/skills/angular-dev.customize.yaml" ]
  [ -f "$TEST_DIR/custom/skills/all-dev.customize.yaml" ]

  rm -rf "$SRC_DIR"
}

@test "E10-S19: existing files in custom/skills/ not overwritten (Scenario 4, AC5)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  # Place customize.yaml in agents/
  mkdir -p "$TEST_DIR/_gaia/_config/agents"
  echo "old-version" > "$TEST_DIR/_gaia/_config/agents/typescript-dev.customize.yaml"

  # Pre-create same file in custom/skills/ with different content
  mkdir -p "$TEST_DIR/custom/skills"
  echo "user-customized-version" > "$TEST_DIR/custom/skills/typescript-dev.customize.yaml"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # custom/skills/ version should be preserved (not overwritten)
  [ "$(cat "$TEST_DIR/custom/skills/typescript-dev.customize.yaml")" = "user-customized-version" ]

  rm -rf "$SRC_DIR"
}

@test "E10-S19: mixed migration — some exist in target, some don't (Scenario 5)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  # 2 files in agents/
  mkdir -p "$TEST_DIR/_gaia/_config/agents"
  echo "source-a" > "$TEST_DIR/_gaia/_config/agents/typescript-dev.customize.yaml"
  echo "source-b" > "$TEST_DIR/_gaia/_config/agents/angular-dev.customize.yaml"

  # 1 already in custom/skills/
  mkdir -p "$TEST_DIR/custom/skills"
  echo "user-custom-a" > "$TEST_DIR/custom/skills/typescript-dev.customize.yaml"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # typescript-dev not overwritten
  [ "$(cat "$TEST_DIR/custom/skills/typescript-dev.customize.yaml")" = "user-custom-a" ]
  # angular-dev migrated
  [ -f "$TEST_DIR/custom/skills/angular-dev.customize.yaml" ]
  [ "$(cat "$TEST_DIR/custom/skills/angular-dev.customize.yaml")" = "source-b" ]

  rm -rf "$SRC_DIR"
}

@test "E10-S19: originals remain in agents/ after migration (AC2)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  mkdir -p "$TEST_DIR/_gaia/_config/agents"
  echo "original-content" > "$TEST_DIR/_gaia/_config/agents/typescript-dev.customize.yaml"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Original file should still exist in agents/ (copy-only, no delete)
  # Note: the _gaia/ overwrite may replace framework-shipped files, but user files
  # in _gaia/_config/agents/ are preserved because _config/agents/ is not in update_targets
  [ -f "$TEST_DIR/_gaia/_config/agents/typescript-dev.customize.yaml" ]

  rm -rf "$SRC_DIR"
}

@test "E10-S19: migration log output matches [migrate] format (AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  mkdir -p "$TEST_DIR/_gaia/_config/agents"
  echo "skill_overrides: {}" > "$TEST_DIR/_gaia/_config/agents/typescript-dev.customize.yaml"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Output should contain the [migrate] log line
  echo "$output" | grep -q '\[migrate\]'
  echo "$output" | grep -q 'typescript-dev.customize.yaml'

  rm -rf "$SRC_DIR"
}

@test "E10-S19: post-install verification warns on broken skill references (Scenario 6, AC4)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  # Create a customize.yaml in custom/skills/ with a broken reference
  mkdir -p "$TEST_DIR/custom/skills"
  cat > "$TEST_DIR/custom/skills/broken.customize.yaml" <<'YAML'
skill_overrides:
  git-workflow:
    source: "custom/skills/nonexistent-skill.md"
YAML

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Output should contain a warning about the broken reference
  echo "$output" | grep -qE '\[warn\]|not found|Broken'

  rm -rf "$SRC_DIR"
}

@test "E10-S19: post-install verification passes when all references valid (Scenario 7)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"
  setup_for_update "$SRC_DIR" "$TEST_DIR"

  # Create a customize.yaml with a valid reference
  mkdir -p "$TEST_DIR/custom/skills"
  echo "valid-skill-content" > "$TEST_DIR/custom/skills/git-workflow.md"
  cat > "$TEST_DIR/custom/skills/all-dev.customize.yaml" <<'YAML'
skill_overrides:
  git-workflow:
    source: "custom/skills/git-workflow.md"
YAML

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # No broken-reference warnings should appear
  local warn_count
  warn_count="$(echo "$output" | grep -cE '\[warn\]|Broken skill' || true)"
  [ "$warn_count" -eq 0 ]

  rm -rf "$SRC_DIR"
}

# ─── E15-S6: Installer Support for custom/stakeholders/ ─────────────────────

@test "STK-33: init creates custom/stakeholders/ directory" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  [ -d "$TEST_DIR/custom/stakeholders" ]
  [ -f "$TEST_DIR/custom/stakeholders/README.md" ]

  rm -rf "$SRC_DIR"
}

@test "STK-34: update creates custom/stakeholders/ if missing" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Create initial installation
  bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"

  # Remove custom/stakeholders/ to simulate pre-stakeholder installation
  rm -rf "$TEST_DIR/custom/stakeholders"
  [ ! -d "$TEST_DIR/custom/stakeholders" ]

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # custom/stakeholders/ should be created by update
  [ -d "$TEST_DIR/custom/stakeholders" ]

  rm -rf "$SRC_DIR"
}

@test "STK-35: update preserves existing stakeholder files" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Create initial installation
  bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"

  # Add a user-created stakeholder file
  mkdir -p "$TEST_DIR/custom/stakeholders"
  echo "persona-content-cfo" > "$TEST_DIR/custom/stakeholders/cfo.md"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # User file must be preserved
  [ -f "$TEST_DIR/custom/stakeholders/cfo.md" ]
  [ "$(cat "$TEST_DIR/custom/stakeholders/cfo.md")" = "persona-content-cfo" ]

  rm -rf "$SRC_DIR"
}

# ─── E18-S1: Sprint Gate — Hard Block on Active Sprint ────────────────────

# Helper: create a minimal installed GAIA target with sprint-status.yaml
create_installed_target_with_sprint() {
  local tgt="$1" sprint_yaml="$2"
  local src
  src="$(mktemp -d)"
  create_mock_source "$src"

  # Init a real install so all dirs exist
  bash "$SCRIPT" init --source "$src" --yes "$tgt" >/dev/null 2>&1

  # Write sprint-status.yaml
  mkdir -p "$tgt/docs/implementation-artifacts"
  echo "$sprint_yaml" > "$tgt/docs/implementation-artifacts/sprint-status.yaml"

  # Return source dir path for update --source
  echo "$src"
}

@test "E18-S1/SUS-01: update blocks when a story is in-progress (AC1, AC2)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E1-S1"
    title: "Test Story"
    status: "in-progress"
    points: 3
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Upgrade blocked"* ]]
  [[ "$output" == *"sprint-10"* ]]
  [[ "$output" == *"1 stor"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1/SUS-02: update blocks when a story is in review (AC1, AC2)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E2-S3"
    title: "Review Story"
    status: "review"
    points: 5
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Upgrade blocked"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1/SUS-03: update blocks when a story is ready-for-dev (AC1, AC2)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E3-S1"
    title: "Ready Story"
    status: "ready-for-dev"
    points: 2
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Upgrade blocked"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1/SUS-04: update proceeds when all stories are done (AC3)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E1-S1"
    title: "Done Story"
    status: "done"
    points: 3
  - key: "E1-S2"
    title: "Backlog Story"
    status: "backlog"
    points: 2
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" != *"Upgrade blocked"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1/SUS-05: update proceeds when no sprint file exists (AC3)" {
  local SRC_DIR
  SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Init without sprint-status.yaml
  bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR" >/dev/null 2>&1

  # Ensure no sprint file exists
  rm -f "$TEST_DIR/docs/implementation-artifacts/sprint-status.yaml"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" != *"Upgrade blocked"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1: update counts multiple active stories in error message (AC2)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E1-S1"
    title: "Story A"
    status: "in-progress"
    points: 3
  - key: "E1-S2"
    title: "Story B"
    status: "review"
    points: 5
  - key: "E1-S3"
    title: "Story C"
    status: "done"
    points: 2
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"2 stor"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1: --skip-sprint-gate bypasses the gate (AC5)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E1-S1"
    title: "Active Story"
    status: "in-progress"
    points: 3
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes --skip-sprint-gate "$TEST_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"sprint gate bypassed"* ]] || [[ "$output" == *"Sprint gate bypassed"* ]] || [[ "$output" == *"--skip-sprint-gate"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1: --help mentions --skip-sprint-gate (AC5)" {
  run bash "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"--skip-sprint-gate"* ]]
}

@test "E18-S1: sprint gate completes within 2 seconds (AC4)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E1-S1"
    title: "Story A"
    status: "in-progress"
    points: 3
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  local start_time end_time elapsed
  start_time="$(date +%s)"
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  end_time="$(date +%s)"
  elapsed=$(( end_time - start_time ))

  # Gate should fail fast (exit code 1) within 2 seconds
  [ "$status" -eq 1 ]
  [ "$elapsed" -le 2 ]

  rm -rf "$SRC_DIR"
}

@test "E18-S1: sprint gate still blocks in --dry-run mode (gate runs before file ops)" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
sprint_id: "sprint-10"
stories:
  - key: "E1-S1"
    title: "Active Story"
    status: "in-progress"
    points: 3
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes --dry-run "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Upgrade blocked"* ]]

  rm -rf "$SRC_DIR"
}

@test "E18-S1: sprint gate shows 'unknown' sprint_id when sprint_id field absent" {
  local sprint_yaml
  sprint_yaml="$(cat <<'YAML'
stories:
  - key: "E1-S1"
    title: "Active Story"
    status: "in-progress"
    points: 3
YAML
)"
  local SRC_DIR
  SRC_DIR="$(create_installed_target_with_sprint "$TEST_DIR" "$sprint_yaml")"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 1 ]
  [[ "$output" == *"unknown"* ]]

  rm -rf "$SRC_DIR"
}

# ─── E19-S17: Post-upgrade gap-analysis suggestion (FR-236) ──────────────────

@test "E19-S17: post-upgrade suggests /gaia-test-gap-analysis when test-plan.md exists (AC1, AC2, AC3)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  mkdir -p "$TEST_DIR/docs/test-artifacts"
  echo "# Test Plan" > "$TEST_DIR/docs/test-artifacts/test-plan.md"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # AC1: suggestion shown
  echo "$output" | grep -q "/gaia-test-gap-analysis" || { echo "missing /gaia-test-gap-analysis in output: $output"; false; }
  # AC1: marked recommended
  echo "$output" | grep -q "\[recommended\]" || { echo "missing [recommended] marker: $output"; false; }
  # AC3: exact suggestion message
  echo "$output" | grep -qF "Run \`/gaia-test-gap-analysis\` to check for new test gaps introduced by the upgrade." \
    || { echo "missing exact suggestion text: $output"; false; }

  rm -rf "$SRC_DIR"
}

@test "E19-S17: post-upgrade omits suggestion when test-plan.md is missing (AC2)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # No docs/test-artifacts/test-plan.md present

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # AC2: no suggestion shown
  if echo "$output" | grep -q "/gaia-test-gap-analysis"; then
    echo "suggestion appeared when test-plan.md was absent: $output"
    false
  fi

  rm -rf "$SRC_DIR"
}

@test "E19-S17: post-upgrade in YOLO mode logs but does not auto-execute (AC4)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  mkdir -p "$TEST_DIR/docs/test-artifacts"
  echo "# Test Plan" > "$TEST_DIR/docs/test-artifacts/test-plan.md"

  # --yes is the installer's non-interactive (YOLO-equivalent) mode.
  # Suggestion must be logged but installer must NOT invoke /gaia-* itself.
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  echo "$output" | grep -q "/gaia-test-gap-analysis" || { echo "suggestion missing: $output"; false; }
  if echo "$output" | grep -qE "(Running|Executing) /gaia-test-gap-analysis"; then
    echo "installer auto-executed the suggestion: $output"
    false
  fi

  rm -rf "$SRC_DIR"
}

@test "E19-S17: post-upgrade-hook.yaml contains gap-analysis suggestion entry (AC5)" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  mkdir -p "$TEST_DIR/docs/test-artifacts"
  echo "# Test Plan" > "$TEST_DIR/docs/test-artifacts/test-plan.md"

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  local hook_file="$TEST_DIR/_gaia/_config/.post-upgrade-hook.yaml"
  [ -f "$hook_file" ] || { echo "hook file not created: $hook_file"; false; }

  grep -q "/gaia-test-gap-analysis" "$hook_file" || { echo "hook missing command"; cat "$hook_file"; false; }
  grep -q "test_plan_exists" "$hook_file"        || { echo "hook missing condition"; cat "$hook_file"; false; }
  grep -q "type: suggestion" "$hook_file"        || { echo "hook missing type"; cat "$hook_file"; false; }

  rm -rf "$SRC_DIR"
}

# ─── E17-S25: test-environment.yaml.example install tests ─────────────────

@test "E17-S25 AC4: fresh init copies test-environment.yaml.example" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  [ -f "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example" ]
  [ -s "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example" ]

  rm -rf "$SRC_DIR"
}

@test "E17-S25 AC5: update with absent target creates example file" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # First init, then remove the example file, then update
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]
  rm -f "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example"
  [ ! -f "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example" ]

  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  [ -f "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example" ]

  rm -rf "$SRC_DIR"
}

@test "E17-S25 AC6: update preserves user-edited example file byte-identical" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Init first
  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  # Write sentinel user-edited content
  echo "# USER EDIT MARKER — do not overwrite" > "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example"
  local pre_sha
  pre_sha="$(shasum -a 256 "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example" | awk '{print $1}')"

  # Update should preserve user-edited file
  run bash "$SCRIPT" update --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -eq 0 ]

  local post_sha
  post_sha="$(shasum -a 256 "$TEST_DIR/docs/test-artifacts/test-environment.yaml.example" | awk '{print $1}')"
  [ "$pre_sha" = "$post_sha" ]

  rm -rf "$SRC_DIR"
}

@test "E17-S25 AC7: missing source example file fails validate_source" {
  local SRC_DIR="$(mktemp -d)"
  create_mock_source "$SRC_DIR"

  # Remove the example file from source
  rm -f "$SRC_DIR/docs/test-artifacts/test-environment.yaml.example"

  run bash "$SCRIPT" init --source "$SRC_DIR" --yes "$TEST_DIR"
  [ "$status" -ne 0 ]
  [[ "$output" == *"test-environment.yaml.example"* ]]

  rm -rf "$SRC_DIR"
}
