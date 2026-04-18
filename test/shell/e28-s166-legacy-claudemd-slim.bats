#!/usr/bin/env bats
#
# E28-S166 — Retire or slim legacy Gaia-framework/CLAUDE.md
#
# Asserts that Gaia-framework/CLAUDE.md matches the slim pattern
# established by E28-S129:
#   - ≤ 50 lines (AC1)
#   - contains the "# GAIA Framework v" version heading (AC5 of E28-S129, preserved for parity)
#   - contains environment, how to start, and hard rules sections (AC2)
#
# The test operates on the CLAUDE.md file at the repo root (where this
# bats file lives under test/shell/).

CLAUDE_MD="${BATS_TEST_DIRNAME}/../../CLAUDE.md"

@test "CLAUDE.md exists" {
  [ -f "$CLAUDE_MD" ]
}

@test "CLAUDE.md is ≤ 50 lines" {
  lines=$(wc -l < "$CLAUDE_MD")
  [ "$lines" -le 50 ]
}

@test "CLAUDE.md contains '# GAIA Framework v' version heading" {
  head -1 "$CLAUDE_MD" | grep -qE '^# GAIA Framework v'
}

@test "CLAUDE.md contains Environment section" {
  grep -qE '^## Environment' "$CLAUDE_MD"
}

@test "CLAUDE.md contains How to Start section" {
  grep -qE '^## How to Start' "$CLAUDE_MD"
}

@test "CLAUDE.md contains Hard Rules section" {
  grep -qE '^## Hard Rules' "$CLAUDE_MD"
}
