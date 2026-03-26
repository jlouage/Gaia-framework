#!/usr/bin/env bash
# Wrapper script — Runs ShellCheck on provided files.
# Fails with a clear error if ShellCheck is not installed.
# Used by lint-staged for pre-commit hook validation of .sh files.

set -euo pipefail

if ! command -v shellcheck &> /dev/null; then
  echo "ERROR: ShellCheck is not installed." >&2
  echo "" >&2
  echo "Pre-commit hooks require ShellCheck for .sh file validation." >&2
  echo "Install it using one of these methods:" >&2
  echo "" >&2
  echo "  macOS:   brew install shellcheck" >&2
  echo "  Ubuntu:  sudo apt-get install shellcheck" >&2
  echo "  Fedora:  sudo dnf install ShellCheck" >&2
  echo "" >&2
  echo "See CONTRIBUTING.md for more details." >&2
  exit 1
fi

shellcheck "$@"
