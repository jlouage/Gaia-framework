/**
 * Dev-Story Security Controls (E20-S13)
 *
 * Pure, deterministic invariants that harden the dev-story CI integration
 * against the threats identified in Threat Model v1.3.0. These functions are
 * the single source of truth for the four security controls — Steps 13-16 of
 * the dev-story workflow MUST delegate to these helpers rather than inlining
 * their own check logic. This keeps the bypass-attempt test matrix in one
 * place and prevents drift between the workflow engine and the security
 * contract.
 *
 * Threats mitigated:
 *   - T25 (High)  — PR target manipulation              → resolvePrTargetBase
 *   - T26 (Med/H) — Unexpected CI check bypass          → classifyCiCheck / evaluateMergeGate
 *   - T27 (High)  — Force-merge attack                  → evaluateMergeGate
 *   - TB-10       — Credential leakage via CLI args/env → verifyAuthHygiene
 *
 * Architecture references:
 *   - ADR-033: Multi-Environment Promotion Chain
 *   - architecture §10.24.5 Steps 14 (Create PR), 15 (Wait for CI), 16 (Merge PR)
 *   - FR-249 (wait-for-ci allowlist), FR-250 (merge-gate enforcement)
 *
 * Design principles:
 *   - Pure functions: no I/O, no filesystem, no network. Inputs in, decision out.
 *   - No silent defaults — missing config throws, never falls back to `main`.
 *   - Bypass flags are NEVER honored at the merge gate. YOLO mode is an
 *     explicit carve-out: it accelerates user interaction but MUST NOT
 *     weaken security invariants (see E20-S13 story Dev Notes).
 *   - Halt messages are verbatim contracts — negative-path tests assert the
 *     exact wording so downstream tooling (audit log parsers, run-book docs)
 *     can rely on it.
 *
 * @module dev-story-security-controls
 */

// ─── T25 — PR target pinning ─────────────────────────────────────

/**
 * Resolve the `--base` branch for `gh pr create` by reading ONLY from the
 * workflow-loaded global.yaml `ci_cd.promotion_chain[0].branch`. Any runtime
 * source (env vars, CLI flags, user input) is ignored by construction —
 * the `runtime` argument is accepted for API symmetry and is deliberately
 * not consulted beyond preserving the call site signature.
 *
 * @param {object} globalConfig — Parsed global.yaml.
 * @param {object} [_runtime]   — Runtime context (env, cliFlags, userInput). Ignored by design.
 * @returns {string} The pinned base branch name.
 * @throws If `promotion_chain[0]` or its `branch` field is missing.
 */
// T25 — see E20-S13 AC1: base branch is bound once from promotion_chain[0].branch.
export function resolvePrTargetBase(globalConfig, _runtime) {
  const chain = globalConfig?.ci_cd?.promotion_chain;
  if (!Array.isArray(chain) || chain.length === 0) {
    throw new Error(
      "T25: promotion_chain[0] is not defined in global.yaml. " +
        "Dev-story Step 14 requires a pinned base branch — no default to main is allowed.",
    );
  }
  const first = chain[0];
  const branch = first && first.branch;
  if (!branch || typeof branch !== "string") {
    throw new Error(
      "T25: promotion_chain[0].branch is missing or not a string. " +
        "Cannot construct a safe --base for gh pr create.",
    );
  }
  return branch;
}

// ─── T26 — CI check name allowlist ───────────────────────────────

/**
 * Classify a CI check name as expected (in the allowlist) or unexpected.
 *
 * @param {string} name
 * @param {string[]} allowlist — The resolved `promotion_chain[0].ci_checks`.
 * @returns {"expected"|"unexpected"}
 */
// T26 — see E20-S13 AC2: unexpected checks never count toward PASS.
export function classifyCiCheck(name, allowlist) {
  if (!Array.isArray(allowlist)) return "unexpected";
  return allowlist.includes(name) ? "expected" : "unexpected";
}

// ─── T27 — Merge gate enforcement ────────────────────────────────

const FAILED_STATES = new Set(["failure", "cancelled", "timed_out"]);

/**
 * Evaluate whether a merge is allowed given the current CI check states.
 *
 * Rules (AC2 + AC3):
 *   1. Build an index of returned checks. Any check whose name is NOT in
 *      `requiredChecks` is classified unexpected — WARNING emitted, never
 *      counted toward PASS.
 *   2. For each name in `requiredChecks`, look up its status. Status must
 *      be "success". `failure`, `cancelled`, `timed_out`, and missing are
 *      all treated as NOT PASSED.
 *   3. If any required check is not passed, `halt = true` and `haltMessage`
 *      contains the canonical verbatim text. Bypass flags (`force`, `yolo`,
 *      `env.GAIA_FORCE_MERGE`, `userConfirmation`) are NEVER honored — if
 *      they are set while the gate is failing, the halt still fires.
 *
 * @param {{name:string, status:string}[]} checks — Live states from `gh pr checks`.
 * @param {string[]} requiredChecks — Allowlist from promotion_chain[0].ci_checks.
 * @param {object} [bypassAttempt] — Hostile inputs: force, yolo, env, userConfirmation. All ignored.
 * @returns {{
 *   allRequiredPassed: boolean,
 *   halt: boolean,
 *   haltMessage: string|null,
 *   warnings: string[],
 *   unexpected: string[],
 * }}
 */
// T27 — see E20-S13 AC3: merge is refused on any failing required check.
// Bypass flags (force, yolo, env, userConfirmation) are deliberately not
// consulted — they are accepted for API symmetry so callers can't silently
// drop them and believe a "stricter" call path exists.
export function evaluateMergeGate(checks, requiredChecks, bypassAttempt = {}) {
  void bypassAttempt; // explicit: bypass inputs are accepted and ignored (E20-S13 AC3)

  const warnings = [];
  const unexpected = [];
  const checkIndex = new Map();
  const requiredList = Array.isArray(requiredChecks) ? requiredChecks : [];

  // Index returned checks and flag unexpected ones.
  for (const c of checks || []) {
    if (!c || typeof c.name !== "string") continue;
    const classification = classifyCiCheck(c.name, requiredList);
    if (classification === "unexpected") {
      if (!unexpected.includes(c.name)) {
        unexpected.push(c.name);
        warnings.push(
          `WARNING [dev-story/step-15]: unexpected CI check '${c.name}' ` +
            `returned by gh pr checks but not declared in ` +
            `promotion_chain[0].ci_checks. Excluded from merge-gate PASS calculation.`,
        );
      }
      continue; // never counts toward PASS
    }
    // Expected — record status (last write wins on duplicates).
    checkIndex.set(c.name, c.status);
  }

  // Evaluate each required check.
  for (const name of requiredList) {
    const status = checkIndex.get(name);
    if (status === "success") continue;

    const effective = status === undefined ? "missing" : status;
    // Either a failing state or simply absent — both refuse the merge.
    if (effective === "missing" || FAILED_STATES.has(effective) || status !== "success") {
      return {
        allRequiredPassed: false,
        halt: true,
        haltMessage:
          `Merge refused: required CI check ${name} is in state ${effective}. ` +
          `No bypass is supported.`,
        warnings,
        unexpected,
      };
    }
  }

  return {
    allRequiredPassed: true,
    halt: false,
    haltMessage: null,
    warnings,
    unexpected,
  };
}

// ─── TB-10 — Credential hygiene ──────────────────────────────────

// Matches GitHub personal access tokens and fine-grained tokens.
const GITHUB_TOKEN_PATTERN = /\b(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{16,}\b/;
// Matches any "Authorization:" header value on an argv position.
const AUTH_HEADER_PATTERN = /Authorization\s*:\s*(Bearer|token)\s+\S+/i;
// Matches a URL with userinfo credentials (user:pass@host).
const URL_USERINFO_PATTERN = /\bhttps?:\/\/[^/\s@]*:[^/\s@]+@/i;
// Environment variables that, if set, imply a token is sitting on the
// process table and may leak. `gh` uses its own keyring — GH_TOKEN bypasses
// that and is disallowed for dev-story CI calls.
const FORBIDDEN_ENV_KEYS = new Set([
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
]);

/**
 * Verify a planned shell invocation does not leak credentials via argv,
 * URLs, or the process environment. Returns `{ ok: true }` on pass.
 *
 * Rules (AC4):
 *   1. The `curl` / `wget` / `http` / `https` binaries are disallowed for
 *      GitHub interactions — use `gh` or `gh api` instead.
 *   2. No argv position may contain a recognizable GitHub token.
 *   3. No argv position may contain an Authorization header.
 *   4. No argv position may be a URL with `user:pass@host` userinfo.
 *   5. No forbidden env key (GH_TOKEN, GITHUB_TOKEN, etc.) may be present.
 *
 * @param {{command:string, args:string[], env:Record<string,string>}} invocation
 * @returns {{ok:boolean, violation:(string|null)}}
 */
// TB-10 — see E20-S13 AC4: credentials must never appear in argv or env.
export function verifyAuthHygiene(invocation) {
  const { command, args, env } = invocation || {};
  const argList = Array.isArray(args) ? args : [];
  const envMap = env && typeof env === "object" ? env : {};

  // Rule 1: disallowed commands for GitHub API interactions.
  if (command === "curl" || command === "wget") {
    // Check if the invocation targets GitHub.
    const joined = argList.join(" ");
    if (
      /github\.com/i.test(joined) ||
      /api\.github\.com/i.test(joined) ||
      AUTH_HEADER_PATTERN.test(joined)
    ) {
      return {
        ok: false,
        violation: `curl/wget may not be used for GitHub API calls — use 'gh' or 'gh api'. Command: ${command}`,
      };
    }
  }

  // Rules 2-4: scan every argv position.
  for (const arg of argList) {
    if (typeof arg !== "string") continue;
    if (GITHUB_TOKEN_PATTERN.test(arg)) {
      return {
        ok: false,
        violation: `token-like value present in command arguments: <redacted>`,
      };
    }
    if (AUTH_HEADER_PATTERN.test(arg)) {
      return {
        ok: false,
        violation: `Authorization header present in command arguments — move to gh auth keyring`,
      };
    }
    if (URL_USERINFO_PATTERN.test(arg)) {
      return {
        ok: false,
        violation: `URL embeds userinfo credentials — use gh auth keyring instead`,
      };
    }
  }

  // Rule 5: forbidden env vars.
  for (const key of Object.keys(envMap)) {
    if (FORBIDDEN_ENV_KEYS.has(key)) {
      return {
        ok: false,
        violation: `credential env var ${key} set — gh CLI must use its keyring, not process env`,
      };
    }
  }

  return { ok: true, violation: null };
}
