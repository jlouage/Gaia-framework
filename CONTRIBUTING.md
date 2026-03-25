# Contributing to GAIA Framework

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
