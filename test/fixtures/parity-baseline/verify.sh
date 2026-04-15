#!/usr/bin/env bash
# verify.sh — parity baseline drift detector
#
# Recomputes sha256 for every file listed in manifest.yaml and compares it
# against the recorded value. Also detects extra files that are not listed.
#
# Exit codes:
#   0 — all files match (no drift)
#   1 — one or more files drifted (sha256 mismatch, missing file, or extra file)
#   3 — manifest.yaml could not be parsed
#
# Dependencies: POSIX bash, shasum, python3 (stdlib only — no pyyaml needed).
# Works on macOS and Linux CI runners.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR"
MANIFEST="$FIXTURE_DIR/manifest.yaml"

if [ ! -f "$MANIFEST" ]; then
  echo "verify.sh: manifest.yaml not found at $MANIFEST" >&2
  exit 3
fi

# Parse manifest with a tiny stdlib-only Python parser. The manifest format is
# intentionally simple (see README.md) — we avoid a pyyaml dependency so the
# verifier runs on any CI image with a bare python3.
MANIFEST_ENTRIES=$(python3 - "$MANIFEST" <<'PY'
import sys
path = sys.argv[1]
entries = []
current = {}
try:
    with open(path) as f:
        for raw in f:
            line = raw.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            stripped = line.strip()
            if stripped.startswith("- path:"):
                if current:
                    entries.append(current)
                current = {}
                val = stripped[len("- path:"):].strip().strip('"').strip("'")
                current["path"] = val
            elif stripped.startswith("sha256:"):
                val = stripped[len("sha256:"):].strip().strip('"').strip("'")
                if val.startswith("sha256:"):
                    val = val[len("sha256:"):]
                current["sha256"] = val
            elif stripped.startswith("size_bytes:"):
                continue
    if current:
        entries.append(current)
except Exception as e:
    print(f"PARSE_ERROR: {e}", file=sys.stderr)
    sys.exit(3)

if not entries:
    print("PARSE_ERROR: no file entries in manifest", file=sys.stderr)
    sys.exit(3)

for e in entries:
    if "path" not in e or "sha256" not in e:
        print(f"PARSE_ERROR: malformed entry {e}", file=sys.stderr)
        sys.exit(3)
    print(f"{e['path']}\t{e['sha256']}")
PY
)
parse_status=$?
if [ "$parse_status" -ne 0 ]; then
  exit 3
fi

# Locate the repo root (the directory that contains `Gaia-framework/`).
# Manifest paths are recorded relative to the repo root.
REPO_ROOT="$(cd "$FIXTURE_DIR/../../../.." && pwd)"

fail=0

tmp_listed=$(mktemp)
trap 'rm -f "$tmp_listed"' EXIT

while IFS=$'\t' read -r path recorded_sha; do
  [ -z "${path:-}" ] && continue
  full="$REPO_ROOT/$path"
  echo "$full" >> "$tmp_listed"

  if [ ! -f "$full" ]; then
    echo "FAIL (missing): $path" >&2
    fail=1
    continue
  fi

  actual_sha=$(shasum -a 256 "$full" | awk '{print $1}')
  if [ "$actual_sha" = "$recorded_sha" ]; then
    echo "PASS: $path"
  else
    echo "FAIL (sha256 mismatch): $path" >&2
    echo "  expected: $recorded_sha" >&2
    echo "  actual:   $actual_sha" >&2
    fail=1
  fi
done <<< "$MANIFEST_ENTRIES"

# Detect extra files under fixture dir that are not recorded in the manifest
# (excluding manifest.yaml and verify.sh themselves).
while IFS= read -r f; do
  case "$(basename "$f")" in
    manifest.yaml|verify.sh) continue ;;
  esac
  if ! grep -Fxq "$f" "$tmp_listed"; then
    rel="${f#$REPO_ROOT/}"
    echo "FAIL (extra file not in manifest): $rel" >&2
    fail=1
  fi
done < <(find "$FIXTURE_DIR" -type f | sort)

if [ "$fail" -eq 0 ]; then
  echo ""
  echo "verify.sh: all files match — no drift detected."
  exit 0
fi

echo "" >&2
echo "verify.sh: drift detected." >&2
exit 1
