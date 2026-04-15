#!/usr/bin/env bats
# ATDD E28-S2 — Freeze v-parity-baseline Tag and Golden Fixture Snapshot
#
# These tests pin the contract for:
#   1. The annotated `v-parity-baseline` git tag on `Gaia-framework/`
#   2. The golden fixture directory under `test/fixtures/parity-baseline/`
#   3. The `manifest.yaml` listing every captured file with sha256 + versions
#   4. The `verify.sh` drift detector
#
# Run from the repository root (the directory that contains `Gaia-framework/`):
#   bats Gaia-framework/test/validation/atdd/e28-s2.test.sh

FIXTURE_DIR="Gaia-framework/test/fixtures/parity-baseline"
MANIFEST="$FIXTURE_DIR/manifest.yaml"
VERIFY="$FIXTURE_DIR/verify.sh"
TAG="v-parity-baseline"

# ---------- AC1: tag ----------

@test "AC1: tag $TAG exists locally" {
  run git -C Gaia-framework rev-parse --verify "refs/tags/$TAG"
  [ "$status" -eq 0 ]
}

@test "AC1: tag is annotated (not lightweight)" {
  run git -C Gaia-framework cat-file -t "$TAG"
  [ "$status" -eq 0 ]
  [ "$output" = "tag" ]
}

@test "AC1: tag points at a commit reachable from main" {
  run bash -c "git -C Gaia-framework merge-base --is-ancestor $TAG origin/main 2>/dev/null || git -C Gaia-framework merge-base --is-ancestor $TAG main"
  [ "$status" -eq 0 ]
}

@test "AC1: tag pushed to origin (or skipped in offline mode)" {
  if [ "${E28_S2_SKIP_REMOTE:-}" = "1" ]; then
    skip "remote push check skipped (E28_S2_SKIP_REMOTE=1)"
  fi
  run git -C Gaia-framework ls-remote --tags origin "$TAG"
  [ "$status" -eq 0 ]
  [ -n "$output" ]
}

@test "AC1: git show $TAG exits 0" {
  run git -C Gaia-framework show "$TAG"
  [ "$status" -eq 0 ]
}

# ---------- AC2: fixture project ----------

@test "AC2: fixture directory exists" {
  [ -d "$FIXTURE_DIR" ]
}

@test "AC2: sample project subdir contains PRD/architecture/epic/story" {
  [ -f "$FIXTURE_DIR/sample-project/docs/planning-artifacts/prd.md" ]
  [ -f "$FIXTURE_DIR/sample-project/docs/planning-artifacts/architecture.md" ]
  [ -f "$FIXTURE_DIR/sample-project/docs/planning-artifacts/epics-and-stories.md" ]
  compgen -G "$FIXTURE_DIR/sample-project/docs/implementation-artifacts/E*-S*.md" > /dev/null
}

@test "AC2: per-workflow stdout transcripts captured" {
  for wf in create-prd create-arch create-epics create-story dev-story code-review; do
    [ -f "$FIXTURE_DIR/transcripts/$wf.stdout.log" ]
  done
}

@test "AC2: per-workflow stderr transcripts captured" {
  for wf in create-prd create-arch create-epics create-story dev-story code-review; do
    [ -f "$FIXTURE_DIR/transcripts/$wf.stderr.log" ]
  done
}

@test "AC2: review reports captured" {
  for r in code-review qa-tests security-review test-automate test-review review-perf; do
    [ -f "$FIXTURE_DIR/sample-project/docs/implementation-artifacts/reviews/$r.md" ]
  done
}

@test "AC2: checkpoint files captured" {
  compgen -G "$FIXTURE_DIR/checkpoints/*.yaml" > /dev/null
}

@test "AC2: README.md exists and is non-empty" {
  [ -s "$FIXTURE_DIR/README.md" ]
}

@test "AC2: README documents regeneration procedure" {
  run grep -i "regenerat" "$FIXTURE_DIR/README.md"
  [ "$status" -eq 0 ]
}

# ---------- AC3: manifest.yaml ----------

@test "AC3: manifest.yaml exists" {
  [ -f "$MANIFEST" ]
}

@test "AC3: manifest.yaml is parseable (stdlib-only)" {
  run python3 - "$MANIFEST" <<'PY'
import sys
path = sys.argv[1]
entries = []
cur = {}
with open(path) as f:
    for line in f:
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("- path:"):
            if cur: entries.append(cur)
            cur = {"path": s[len("- path:"):].strip().strip('"').strip("'")}
        elif s.startswith("sha256:"):
            v = s[len("sha256:"):].strip().strip('"').strip("'")
            if v.startswith("sha256:"): v = v[len("sha256:"):]
            cur["sha256"] = v
if cur: entries.append(cur)
sys.exit(0 if entries else 1)
PY
  [ "$status" -eq 0 ]
}

@test "AC3: manifest lists every file under fixture dir (except manifest + verify)" {
  expected=$(find "$FIXTURE_DIR" -type f \
             ! -name manifest.yaml ! -name verify.sh | sort)
  listed=$(python3 - "$MANIFEST" <<'PY'
import sys
path = sys.argv[1]
files = []
with open(path) as f:
    for line in f:
        s = line.strip()
        if s.startswith("- path:"):
            files.append(s[len("- path:"):].strip().strip('"').strip("'"))
for f in sorted(files):
    print(f)
PY
)
  [ "$expected" = "$listed" ]
}

@test "AC3: every manifest entry has a sha256 field" {
  run python3 - "$MANIFEST" <<'PY'
import sys
path = sys.argv[1]
entries = []
cur = {}
with open(path) as f:
    for line in f:
        s = line.strip()
        if s.startswith("- path:"):
            if cur: entries.append(cur)
            cur = {"path": s[len("- path:"):].strip().strip('"').strip("'")}
        elif s.startswith("sha256:"):
            cur["sha256"] = s[len("sha256:"):].strip()
if cur: entries.append(cur)
sys.exit(0 if all(e.get("sha256") for e in entries) else 1)
PY
  [ "$status" -eq 0 ]
}

@test "AC3: every manifest sha256 matches actual file content" {
  run python3 - <<'PY'
import hashlib, sys
path = "Gaia-framework/test/fixtures/parity-baseline/manifest.yaml"
entries = []
cur = {}
with open(path) as f:
    for line in f:
        s = line.strip()
        if s.startswith("- path:"):
            if cur: entries.append(cur)
            cur = {"path": s[len("- path:"):].strip().strip('"').strip("'")}
        elif s.startswith("sha256:"):
            v = s[len("sha256:"):].strip().strip('"').strip("'")
            if v.startswith("sha256:"): v = v[len("sha256:"):]
            cur["sha256"] = v
if cur: entries.append(cur)
for e in entries:
    h = hashlib.sha256(open(e["path"],"rb").read()).hexdigest()
    if h != e["sha256"]:
        print("MISMATCH", e["path"]); sys.exit(1)
PY
  [ "$status" -eq 0 ]
}

@test "AC3: manifest declares claude_code_version" {
  run grep -E "^claude_code_version:" "$MANIFEST"
  [ "$status" -eq 0 ]
}

@test "AC3: manifest declares gaia_version: v-parity-baseline" {
  run grep -E "^gaia_version:[[:space:]]+v-parity-baseline" "$MANIFEST"
  [ "$status" -eq 0 ]
}

@test "AC3: manifest declares ISO 8601 capture_date" {
  run grep -E "^capture_date:[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}" "$MANIFEST"
  [ "$status" -eq 0 ]
}

# ---------- AC4: verify.sh ----------

@test "AC4: verify.sh exists" {
  [ -f "$VERIFY" ]
}

@test "AC4: verify.sh is executable" {
  [ -x "$VERIFY" ]
}

@test "AC4: verify.sh exits 0 on clean fixture" {
  run "$VERIFY"
  [ "$status" -eq 0 ]
}

@test "AC4: verify.sh exits non-zero on modified file" {
  target="$FIXTURE_DIR/sample-project/docs/planning-artifacts/prd.md"
  cp "$target" "$target.bak"
  printf '\ndrift\n' >> "$target"
  run "$VERIFY"
  local rc=$status
  cp "$target.bak" "$target" && rm "$target.bak"
  [ "$rc" -ne 0 ]
}

@test "AC4: verify.sh exits non-zero on deleted file" {
  target="$FIXTURE_DIR/sample-project/docs/planning-artifacts/prd.md"
  cp "$target" "$target.bak"
  rm "$target"
  run "$VERIFY"
  local rc=$status
  cp "$target.bak" "$target" && rm "$target.bak"
  [ "$rc" -ne 0 ]
}

@test "AC4: verify.sh exits non-zero when an extra file is added" {
  extra="$FIXTURE_DIR/sample-project/extra-drift.txt"
  echo "stray" > "$extra"
  run "$VERIFY"
  local rc=$status
  rm "$extra"
  [ "$rc" -ne 0 ]
}

@test "AC4: verify.sh prints offending path to stderr on failure" {
  target="$FIXTURE_DIR/sample-project/docs/planning-artifacts/prd.md"
  cp "$target" "$target.bak"
  printf '\ndrift\n' >> "$target"
  run bash -c "'$VERIFY' 2>&1 1>/dev/null"
  cp "$target.bak" "$target" && rm "$target.bak"
  [[ "$output" == *"prd.md"* ]]
}

# ---------- Repo size guard ----------

@test "size guard: fixture dir is under 5 MB" {
  size=$(du -sk "$FIXTURE_DIR" | awk '{print $1}')
  [ "$size" -lt 5120 ]
}

# ---------- Immutability guard ----------

@test "immutability: manifest tag_sha matches git rev-parse" {
  manifest_sha=$(grep -E "^tag_sha:" "$MANIFEST" | awk '{print $2}' | tr -d '"')
  git_sha=$(git -C Gaia-framework rev-parse "$TAG^{commit}")
  [ "$manifest_sha" = "$git_sha" ]
}
