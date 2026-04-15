# Parity Baseline Golden Fixture

> **Purpose:** an immutable, byte-level reference point for the GAIA Native
> Conversion program (E28). Cluster 19's parity harness compares the native
> plugin build against the artifacts captured here.

## Contents

```
parity-baseline/
├── README.md                       <-- you are here
├── manifest.yaml                   <-- every fixture file + sha256 + versions + tag_sha
├── verify.sh                       <-- POSIX drift detector, exits 0 on match
├── sample-project/                 <-- minimal greenfield project (HelloCounter)
│   └── docs/
│       ├── planning-artifacts/     <-- PRD, architecture, epics-and-stories
│       └── implementation-artifacts/
│           ├── E1-S1-*.md          <-- the sole story file
│           └── reviews/            <-- six review reports (all PASSED)
├── transcripts/                    <-- per-workflow stdout/stderr logs
│   ├── create-prd.{stdout,stderr}.log
│   ├── create-arch.{stdout,stderr}.log
│   ├── create-epics.{stdout,stderr}.log
│   ├── create-story.{stdout,stderr}.log
│   ├── dev-story.{stdout,stderr}.log
│   └── code-review.{stdout,stderr}.log
└── checkpoints/                    <-- workflow checkpoints snapshot
    └── *.yaml
```

## Running the verifier

```sh
bash Gaia-framework/test/fixtures/parity-baseline/verify.sh
```

Exit codes:

| Code | Meaning |
|------|---------|
| `0`  | All files match `manifest.yaml` — no drift |
| `1`  | One or more files have drifted (sha256 mismatch, missing, or extra) |
| `2`  | A file listed in the manifest is missing from disk |
| `3`  | `manifest.yaml` could not be parsed |

## Regenerating the fixture

> **You almost never want to do this.** `v-parity-baseline` is frozen by design.
> Only regenerate if the tag is being cut a second time (e.g., `v-parity-baseline-2`).

1. Start from a clean clone at the desired baseline commit: `git clone … && git checkout <commit>`.
2. Instantiate a fresh sample project (HelloCounter) under a scratch directory.
3. Run each workflow end-to-end against the custom engine, capturing stdout and stderr
   to `parity-baseline/transcripts/<workflow>.{stdout,stderr}.log`:
   - `/gaia-create-prd`
   - `/gaia-create-arch`
   - `/gaia-create-epics`
   - `/gaia-create-story`
   - `/gaia-dev-story`
   - `/gaia-run-all-reviews` (produces the six review reports)
4. Copy the produced artifacts into `parity-baseline/sample-project/docs/` and the
   review reports into `parity-baseline/sample-project/docs/implementation-artifacts/reviews/`.
5. Copy the relevant `_memory/checkpoints/*.yaml` snapshots into `parity-baseline/checkpoints/`.
6. Regenerate `manifest.yaml` with the provided helper:
   `bash Gaia-framework/test/fixtures/parity-baseline/verify.sh --regenerate`
   (or re-run `scripts/regenerate-parity-manifest.sh` if available).
7. Confirm the regenerated fixture is under 5 MB: `du -sh parity-baseline/`.
8. Commit on a feature branch and open a PR referencing the new tag name.

## Immutability policy

`v-parity-baseline` is **immutable**:

- **No force-push** to the tag.
- **No re-tag** on a different commit.
- **No deletion** of the tag from `origin`.

If the baseline truly must change (new major engine version, corrupted fixture,
discovered defect that invalidates the snapshot), cut a new tag **`v-parity-baseline-2`**
and log the rationale in a follow-up story. Cluster 19's parity harness must be
updated to point at the new tag deliberately — never silently.

## Size budget

The fixture target is **< 5 MB** so every clone of `Gaia-framework/` stays cheap.
The `size guard` BATS test in `test/validation/atdd/e28-s2.test.sh` enforces this.
If regeneration pushes the fixture over the ceiling, trim transcripts before
committing.
