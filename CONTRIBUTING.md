# Contributing to GAIA Framework

Thank you for your interest in contributing to GAIA Framework. This guide covers everything you need to get started, run tests, and prepare releases.

**Contents:**
[Prerequisites](#prerequisites) | [Getting Started](#getting-started) | [Running Tests](#running-tests) | [Installing ShellCheck](#installing-shellcheck) | [Release Process](#release-process) | [Branch Protection](#branch-protection) | [Pre-Commit Hooks](#pre-commit-hooks)

## Prerequisites

Before you begin, ensure you have:

- **Node.js >= 20** — check your version with `node --version`
- **npm** (included with Node.js)
- **Git**

Verify your Node.js version meets the minimum requirement:

```bash
node --version
# Must output v20.x.x or higher
```

## Getting Started

1. **Fork and clone** the repository:

   ```bash
   git clone https://github.com/<your-username>/Gaia-framework.git
   cd Gaia-framework
   ```

2. **Install dependencies** for local development:

   ```bash
   npm install
   ```

   In CI environments, use `npm ci` instead for a clean, reproducible install from `package-lock.json`.

3. **Run the test suite** to verify everything works:

   ```bash
   npm test
   ```

## Running Tests

GAIA Framework uses [Vitest](https://vitest.dev/) for JavaScript tests and [BATS](https://github.com/bats-core/bats-core) for shell tests.

### Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all Vitest tests with coverage |
| `npm run test:unit` | Run unit tests only |
| `npm run test:validation` | Run Tier 1 validation tests only |
| `npm run test:shell` | Run BATS shell tests (macOS/Linux only) |
| `npm run test:coverage` | Run all tests with coverage report |
| `npm run test:tier2` | Run Tier 2 validation tests (requires LLM runtime) |

### Tier 1 Validation

Tier 1 validation tests are programmatic checks that verify framework structure: YAML parsing, XML well-formedness, CSV integrity, manifest consistency, and cross-reference validation. These run in CI and do not require an LLM runtime — they are pure file-based checks using standard Node.js parsers.

### BATS Shell Tests

BATS (Bash Automated Testing System) tests validate the installer script (`gaia-install.sh`). These tests are **macOS and Linux only** — they are automatically skipped on Windows (per ADR-007).

To run shell tests:

```bash
npm run test:shell
```

### Testing on Your Platform

- **macOS/Linux:** All test suites are fully supported. Run `npm run test:all` to execute both Vitest and BATS tests.
- **Windows:** Vitest tests run normally. BATS shell tests are automatically skipped. Windows support is best-effort (ADR-004) — Git Bash works for most operations but `rsync`, `find -print0`, and BATS have known compatibility issues.

## Installing ShellCheck

[ShellCheck](https://www.shellcheck.net/) is a static analysis tool for shell scripts. It is used to lint `gaia-install.sh` and other Bash files.

### macOS

```bash
brew install shellcheck
```

### Linux

```bash
sudo apt-get install shellcheck
```

### Verify Installation

After installing, verify ShellCheck is available in your PATH:

```bash
shellcheck --version
```

You should see version and license information. If the command is not found:

- **macOS:** Ensure Homebrew's bin directory is in your PATH (`/opt/homebrew/bin` on Apple Silicon, `/usr/local/bin` on Intel).
- **Linux:** Ensure `/usr/bin` is in your PATH (it almost always is).
- Try opening a new terminal session after installation.

ShellCheck is also configured in CI via GitHub Actions, where it is installed using `apt-get` with a pinned version.

## Release Process

Releases are published to npm and triggered by GitHub Release creation (not tag-triggered) per ADR-009.

### 1. Version Bump

Update the version in all 6 files:

| File | Field / Location |
|------|------------------|
| `package.json` | `"version"` field |
| `gaia-install.sh` | `readonly VERSION=` line |
| `_gaia/_config/global.yaml` | `framework_version` field |
| `_gaia/_config/manifest.yaml` | `version` field for affected module(s) |
| `CLAUDE.md` | Version in the `# GAIA Framework v{x.x.x}` heading |
| `README.md` | Version in the `global.yaml` example block |

Use semantic versioning: patch for bug fixes, minor for new features, major for breaking changes.

### 2. Tier 2 Staleness Check

Before publishing, verify that Tier 2 validation results are not stale. Tier 2 tests are LLM-runtime behavioral validations that cannot run in CI. If the last Tier 2 run was more than one sprint ago, re-run them locally to confirm framework behavioral integrity.

### 3. Test and Publish

```bash
npm ci
npm test
npm publish --provenance
```

The `--provenance` flag generates supply chain attestation for the published package. The `$NPM_TOKEN` environment variable must be set for authentication.

### 4. Git Tagging

After publishing, create and push a version tag:

```bash
git tag v{x.x.x}
git push origin v{x.x.x}
```

For example, for version 1.63.0:

```bash
git tag v1.63.0
git push origin v1.63.0
```

## Branch Protection

The `main` branch is protected with enforced rules to ensure code quality and security. All changes must go through a pull request.

### Required Reviews

All pull requests require at least **1 approved review** before merging. Stale approvals are automatically dismissed when new commits are pushed, requiring re-review.

### Required Status Checks

The following CI checks must pass before a pull request can be merged:

- `lint` — code linting
- `test (ubuntu-latest)` — test suite on Ubuntu
- `test (macos-latest)` — test suite on macOS
- `security` — security audit

Branches must be up to date with `main` before merging.

### No Direct Push

Direct pushes to `main` are blocked. All changes must be submitted via pull request. Force pushes and branch deletion are also disabled on `main`.

### CODEOWNERS

Certain critical files require review from `@gaia-framework/maintainers` before changes can be merged. The protected paths are defined in `.github/CODEOWNERS` and include:

- `.github/workflows/` — CI/CD workflow definitions
- `package.json` and `package-lock.json` — package manifests
- `gaia-install.sh` — framework installer
- `bin/` — CLI entry points

### Admin Bypass

The "Do not allow bypassing the above settings" option is enabled for non-admin users. If using GitHub Rulesets, admin bypass is also blocked.

### Bot Exemption

The `github-actions[bot]` actor is exempt from branch protection rules on `main`. This exemption exists because the publish workflow pushes a version-sync commit directly to `main` after a GitHub Release is created. Without the exemption, branch protection would block this automated commit and break the release pipeline.

**Configuration approach:** The exemption is configured using GitHub Rulesets (Settings > Rules). The `github-actions[bot]` is added to the bypass actors list for the `main` branch ruleset. Rulesets are preferred over classic branch protection because they offer more granular control and do not have the admin-bypass loophole present in classic rules.

**CI commit suppression:** Commits made using the default `GITHUB_TOKEN` do not trigger subsequent GitHub Actions workflow runs. This is GitHub's built-in behavior designed to prevent infinite workflow loops. As a result, the version-sync commit pushed by the publish workflow does not trigger additional CI runs.

**Verification:** To confirm the bot exemption is correctly configured, check GitHub Settings > Rules and verify that `github-actions[bot]` appears in the bypass actors list for the `main` branch ruleset. You can also verify by observing a successful publish workflow run where the version-sync commit is pushed to `main` without being blocked.

## Pre-Commit Hooks

> **Note:** Pre-commit hooks are **not yet active**. Hook activation is pending and will be delivered in a future PR (E5-S4). This section will be updated with activation instructions once hooks are enabled.

Pre-commit hooks will prevent accidental commits of secrets, credentials, and files that do not pass linting checks. They provide an important security benefit by catching issues before they enter the repository history, where they are difficult to remove.

Hooks will only be activated after the linting baseline is clean (per FR-15) to avoid blocking contributors on pre-existing issues. Once activated, hooks will run automatically on every commit — no manual setup required.
