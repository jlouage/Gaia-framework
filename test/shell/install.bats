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
