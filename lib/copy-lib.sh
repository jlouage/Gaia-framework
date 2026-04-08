#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# copy-lib.sh — Extracted copy functions for gaia-install.sh
# Origin: gaia-install.sh (E3-S11 — Extract copy_gaia_files for Unit Testability)
#
# This library is intentionally free of `set -euo pipefail`. The caller's
# shell options govern execution. When BATS sources this directly, the BATS
# process shell options apply. When gaia-install.sh sources it, the
# installer's `set -euo pipefail` applies. Function bodies are neutral.
# ─────────────────────────────────────────────────────────────────────────────

# Remove .resolved/*.yaml files from target _gaia/ directory.
# Called after cp/tar copy to replicate rsync's --exclude behavior.
# Only .resolved/*.yaml is relevant to the _gaia/ subtree; the other rsync
# --exclude patterns target _memory/ paths outside _gaia/ and never match.
clean_resolved_yaml() {
  local target_gaia="$1"
  find "$target_gaia" -path '*/.resolved/*.yaml' -delete 2>/dev/null || true
}

# Copy _gaia/ directory from source to target using a fallback chain:
#   rsync → cp -rp → tar
# Tries each tool in order. If a tool is found but fails at runtime (e.g.,
# broken rsync stub on Windows), falls through to the next tool. Exits with
# a diagnostic error if all tools fail or none are available.
#
# Excludes .resolved/*.yaml files from the final output (rsync handles this
# natively via --exclude; cp and tar do a post-copy cleanup).
#
# Note: No symlinks currently exist in _gaia/. If symlinks are introduced
# in the future, verify that cp -rp behavior matches rsync -a on all
# target platforms (ADR-004).
copy_gaia_files() {
  local src="$1" dst="$2"
  local copy_done=false

  # Try rsync first (preferred — handles excludes natively)
  if command -v rsync >/dev/null 2>&1; then
    if rsync -a \
      --exclude='_memory/checkpoints/*.yaml' \
      --exclude='_memory/checkpoints/completed/*.yaml' \
      --exclude='.resolved/*.yaml' \
      --exclude='_memory/*-sidecar/*.md' \
      --exclude='_memory/*-sidecar/*.yaml' \
      "$src/_gaia/" "$dst/_gaia/" 2>/dev/null; then
      detail "Copied framework files using rsync"
      copy_done=true
    else
      detail "rsync found but failed — trying fallback methods"
    fi
  fi

  # Fallback: cp -rp (preserves permissions like rsync -a)
  if [[ "$copy_done" == false ]] && command -v cp >/dev/null 2>&1; then
    if cp -rp "$src/_gaia/." "$dst/_gaia/" 2>/dev/null; then
      clean_resolved_yaml "$dst/_gaia"
      detail "Copied framework files using cp -rp (rsync unavailable)"
      copy_done=true
    else
      error "cp failed to copy framework files — check permissions and disk space"
      exit 1
    fi
  fi

  # Fallback: tar (last resort — available on virtually all POSIX systems)
  if [[ "$copy_done" == false ]] && command -v tar >/dev/null 2>&1; then
    if (tar -cf - -C "$src" _gaia | tar -xf - -C "$dst") 2>/dev/null; then
      clean_resolved_yaml "$dst/_gaia"
      detail "Copied framework files using tar (rsync and cp unavailable)"
      copy_done=true
    else
      error "tar failed to copy framework files — check permissions and disk space"
      exit 1
    fi
  fi

  if [[ "$copy_done" == false ]]; then
    error "No suitable copy tool found (tried rsync, cp, tar). Cannot copy framework files."
    exit 1
  fi
}
