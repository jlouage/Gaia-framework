/**
 * E17-S13: Bridge Scope Guard — Shared Scope Constraint Enforcement
 *
 * Centralises the FR-203 scope constraints for the Test Execution Bridge
 * (ADR-028, architecture §10.20). Both Layer 2 local execution (E17-S6)
 * and Layer 2 CI execution (E17-S9) route their scope checks through this
 * module so the policy lives in exactly one place.
 *
 * The bridge orchestrates test runs ONLY. It never deploys services,
 * provisions infrastructure, mutates databases, or executes arbitrary
 * shell commands. Three layered guards enforce that policy before any
 * subprocess is spawned or any CI workflow is triggered:
 *
 *   1. assertInScope(command)
 *      Rejects commands that contain shell chaining operators (;, &&, ||,
 *      |, >, <) or command substitution (`…`, $(…)) outside of quoted
 *      regions. Defence-in-depth against command injection (Threat T23).
 *
 *   2. assertCommandAllowed(command, allowedCommands)
 *      Rejects commands that are not on an explicit allowlist. The
 *      allowlist is sourced from test-environment.yaml runner definitions
 *      or the project's package.json `test` script (AC2 of E17-S13).
 *
 *   3. assertCiWorkflowAllowed(ciWorkflow, allowedWorkflows)
 *      Rejects CI workflow filenames that are not the `ci_workflow`
 *      declared in test-environment.yaml (AC3 of E17-S13).
 *
 * Traces to: FR-203, ADR-028, Threats T20–T24
 */

// ─── Internal helpers ──────────────────────────────────────────────────────

const ALWAYS_FORBIDDEN_SUBSTRINGS = ["`", "$("];

const UNQUOTED_FORBIDDEN_PATTERNS = [
  { re: /;/, label: ";" },
  { re: /&&/, label: "&&" },
  { re: /\|\|/, label: "||" },
  { re: /\|/, label: "|" },
  { re: />/, label: ">" },
  { re: /</, label: "<" },
];

/**
 * Replace the contents of '...'/"..." runs with their delimiting quotes
 * so that shell operators inside quoted arguments are invisible to the
 * pattern scan. This lets legitimate runner invocations such as
 * `node -e "console.log('a'); console.log('b')"` pass while rejecting
 * `npm test; rm -rf node_modules`.
 */
export function stripQuotedRegions(command) {
  let out = "";
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      out += quote;
      i += 1;
      while (i < command.length && command[i] !== quote) {
        if (quote === '"' && command[i] === "\\" && i + 1 < command.length) {
          i += 2;
          continue;
        }
        i += 1;
      }
      out += quote;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

// ─── Guard 1: Shell operator scope guard (FR-203 / AC5) ────────────────────

/**
 * Reject commands that contain shell chaining/substitution/redirection
 * operators outside of quoted arguments. Throws a scope-violation Error
 * with an actionable message when a violation is detected.
 */
export function assertInScope(command) {
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("Bridge scope violation (FR-203): command must be a non-empty string.");
  }

  for (const needle of ALWAYS_FORBIDDEN_SUBSTRINGS) {
    if (command.includes(needle)) {
      throw new Error(
        `Bridge scope violation (FR-203): command contains command substitution ("${needle}") — "${command}". ` +
          "Only plain runner invocations are permitted."
      );
    }
  }

  const stripped = stripQuotedRegions(command).replace(/"[^"]*"|'[^']*'/g, "");

  for (const { re, label } of UNQUOTED_FORBIDDEN_PATTERNS) {
    if (re.test(stripped)) {
      throw new Error(
        `Bridge scope violation (FR-203): command contains a forbidden shell operator ("${label}") — "${command}". ` +
          "Only plain runner invocations are permitted — no chaining, pipes, or redirection."
      );
    }
  }
}

// ─── Guard 2: Runner command allowlist (AC2) ───────────────────────────────

/**
 * Reject commands that are not on the runner allowlist. The allowlist is
 * expected to be drawn from test-environment.yaml runner entries or the
 * project's package.json `test` script. A missing, null, or empty
 * allowlist is treated as a hard scope violation — callers must supply
 * an explicit list when they opt into the whitelist guard.
 */
export function assertCommandAllowed(command, allowedCommands) {
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("Bridge scope violation (FR-203): command must be a non-empty string.");
  }
  if (!Array.isArray(allowedCommands) || allowedCommands.length === 0) {
    throw new Error(
      `Bridge scope violation (FR-203): command "${command}" rejected — no allowed runner commands supplied.`
    );
  }
  if (!allowedCommands.includes(command)) {
    throw new Error(
      `Bridge scope violation (FR-203): command "${command}" is not on the allowed runner list. ` +
        `Allowed commands must be sourced from test-environment.yaml runners or package.json test scripts.`
    );
  }
}

// ─── Guard 3: CI workflow allowlist (AC3) ──────────────────────────────────

/**
 * Reject CI workflow filenames that are not on the CI workflow allowlist.
 * The allowlist is expected to be drawn from the `ci_workflow` field in
 * test-environment.yaml (a single value, wrapped into an array). Also
 * rejects workflow strings that carry shell metacharacters — the CI
 * workflow name is passed to `gh workflow run` and must be a plain token.
 */
export function assertCiWorkflowAllowed(ciWorkflow, allowedWorkflows) {
  if (typeof ciWorkflow !== "string" || ciWorkflow.trim() === "") {
    throw new Error("Bridge scope violation (FR-203): ci_workflow must be a non-empty string.");
  }
  if (!Array.isArray(allowedWorkflows) || allowedWorkflows.length === 0) {
    throw new Error(
      `Bridge scope violation (FR-203): ci_workflow "${ciWorkflow}" rejected — no allowed CI workflows supplied.`
    );
  }
  // Defence in depth: even if an allowlist entry is malformed, reject
  // workflow values that look like shell injection payloads.
  try {
    assertInScope(ciWorkflow);
  } catch (err) {
    throw new Error(
      `Bridge scope violation (FR-203): ci_workflow "${ciWorkflow}" contains shell metacharacters. ${err.message}`
    );
  }
  if (!allowedWorkflows.includes(ciWorkflow)) {
    throw new Error(
      `Bridge scope violation (FR-203): ci_workflow "${ciWorkflow}" is not on the allowed CI workflow list. ` +
        `Allowed workflows must be sourced from test-environment.yaml ci_workflow.`
    );
  }
}
