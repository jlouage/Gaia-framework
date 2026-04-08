/**
 * E20-S1 — Promotion Chain Schema Validator
 *
 * Validates the optional `ci_cd.promotion_chain` block in global.yaml.
 * Invoked from the workflow engine config-resolution path (workflow.xml Step 1)
 * so that any malformed chain halts the workflow with a clear, descriptive
 * error before downstream consumers (E20-S3..S11) read the chain.
 *
 * Schema (per docs/implementation-artifacts/E20-S1-promotion-chain-schema.md):
 *   ci_cd:
 *     default_merge_strategy: <enum>          # optional
 *     promotion_chain:                         # optional
 *       - id: <slug>                           # required, unique, [a-z0-9-]+
 *         name: <string>                       # required
 *         branch: <string>                     # required, unique
 *         ci_provider: <enum>                  # required
 *         merge_strategy: <enum>               # optional if default set
 *         ci_checks: [<string>]                # optional
 *         # Architecture-only fields below are accepted but not validated:
 *         environment: <string>
 *         test_tiers: [<string>]
 *         auto_merge: <bool>
 *         approval_required: <bool>
 *
 * Backward compatibility (AC8, AC10):
 *   - If `ci_cd` is absent → returns chain-absent (no error).
 *   - If `ci_cd` exists but `promotion_chain` is missing → chain-absent.
 *   - If `ci_cd.promotion_chain` is an empty array → REJECTED (AC2).
 */

export const PROMOTION_CHAIN_PROVIDERS = Object.freeze([
  "github_actions",
  "gitlab_ci",
  "jenkins",
  "circleci",
  "azure_devops",
  "bitbucket",
  "none",
]);

export const PROMOTION_CHAIN_MERGE_STRATEGIES = Object.freeze(["merge", "squash", "rebase"]);

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const REQUIRED_FIELDS = ["id", "name", "branch", "ci_provider"];

/**
 * Custom error class so callers can distinguish promotion-chain validation
 * failures from other config errors. The `violations` array carries every
 * detected problem so the user sees them all in a single run.
 */
export class PromotionChainValidationError extends Error {
  constructor(violations) {
    const list = violations.map((v) => `  - ${v}`).join("\n");
    super(`Promotion chain validation failed:\n${list}`);
    this.name = "PromotionChainValidationError";
    this.violations = violations;
  }
}

/**
 * Push a "Duplicate promotion chain {field}: {value}" violation for every
 * entry in `counts` whose count is greater than one. Shared between the id
 * (AC3) and branch (AC4) uniqueness checks.
 *
 * @param {Map<string, number>} counts
 * @param {"id"|"branch"} field
 * @param {string[]} violations — mutated
 */
function collectDuplicates(counts, field, violations) {
  for (const [value, count] of counts) {
    if (count > 1) {
      violations.push(`Duplicate promotion chain ${field}: ${value}`);
    }
  }
}

/**
 * Validate a parsed global.yaml object's `ci_cd.promotion_chain` block.
 *
 * @param {object|null} config — parsed global.yaml (or any subset that may
 *   contain a `ci_cd` key). `null` is treated as chain-absent.
 * @returns {{
 *   valid: true,
 *   chain: Array|null,
 *   chain_absent: boolean
 * }} — `chain` is the validated entries (with default_merge_strategy applied)
 *   or `null` when no chain is configured. `chain_absent` is true on the
 *   backward-compat path.
 * @throws {PromotionChainValidationError} on any schema or uniqueness error.
 */
export function validatePromotionChain(config) {
  // ── AC8: backward compat — null or absent ci_cd ──────────────
  if (!config || typeof config !== "object") {
    return { valid: true, chain: null, chain_absent: true };
  }
  const ciCd = config.ci_cd;
  if (!ciCd || typeof ciCd !== "object") {
    return { valid: true, chain: null, chain_absent: true };
  }

  // ── AC10: ci_cd present but no promotion_chain key ───────────
  if (!Object.prototype.hasOwnProperty.call(ciCd, "promotion_chain")) {
    return { valid: true, chain: null, chain_absent: true };
  }

  const chain = ciCd.promotion_chain;
  const defaultMergeStrategy = ciCd.default_merge_strategy;
  const violations = [];

  // ── AC2: must be a non-empty array ──────────────────────────
  if (!Array.isArray(chain)) {
    throw new PromotionChainValidationError([
      "Promotion chain must be an array of environment entries",
    ]);
  }
  if (chain.length === 0) {
    throw new PromotionChainValidationError(["Promotion chain must have at least 1 environment"]);
  }

  // Validate default_merge_strategy itself if provided
  if (
    defaultMergeStrategy !== undefined &&
    !PROMOTION_CHAIN_MERGE_STRATEGIES.includes(defaultMergeStrategy)
  ) {
    violations.push(
      `Invalid default_merge_strategy '${defaultMergeStrategy}'. ` +
        `Allowed: ${PROMOTION_CHAIN_MERGE_STRATEGIES.join(", ")}`
    );
  }

  // Track ids and branches for uniqueness checks (AC3, AC4)
  const idCounts = new Map();
  const branchCounts = new Map();
  const resolvedEntries = [];

  chain.forEach((entry, idx) => {
    const where = `entry[${idx}]`;

    if (!entry || typeof entry !== "object") {
      violations.push(`${where}: must be an object`);
      return;
    }

    // Required field presence (AC1, AC6)
    for (const field of REQUIRED_FIELDS) {
      if (entry[field] === undefined || entry[field] === null) {
        violations.push(`${where}: missing required field '${field}'`);
      }
    }

    // id format (AC9)
    if (entry.id !== undefined && entry.id !== null) {
      if (typeof entry.id !== "string" || entry.id.length === 0) {
        violations.push(`${where}: id must be a non-empty string`);
      } else if (!ID_PATTERN.test(entry.id)) {
        violations.push(
          `${where}: Promotion chain id '${entry.id}' must be alphanumeric with hyphens only ` +
            `(lowercase letters, digits, hyphens — no spaces, underscores, or unicode)`
        );
      } else {
        idCounts.set(entry.id, (idCounts.get(entry.id) || 0) + 1);
      }
    }

    // branch presence + uniqueness tracking (AC4)
    if (typeof entry.branch === "string" && entry.branch.length > 0) {
      branchCounts.set(entry.branch, (branchCounts.get(entry.branch) || 0) + 1);
    } else if (entry.branch !== undefined) {
      violations.push(`${where}: branch must be a non-empty string`);
    }

    // ci_provider enum (AC1, AC6)
    if (entry.ci_provider !== undefined && entry.ci_provider !== null) {
      if (!PROMOTION_CHAIN_PROVIDERS.includes(entry.ci_provider)) {
        violations.push(
          `${where}: Invalid ci_provider '${entry.ci_provider}'. ` +
            `Allowed: ${PROMOTION_CHAIN_PROVIDERS.join(", ")}`
        );
      }
    }

    // merge_strategy: enum if present, fallback to default if absent (AC7)
    let effectiveStrategy = entry.merge_strategy;
    if (effectiveStrategy === undefined || effectiveStrategy === null) {
      effectiveStrategy = defaultMergeStrategy;
      if (effectiveStrategy === undefined || effectiveStrategy === null) {
        violations.push(
          `${where}: missing merge_strategy and no ci_cd.default_merge_strategy is set`
        );
      }
    } else if (!PROMOTION_CHAIN_MERGE_STRATEGIES.includes(effectiveStrategy)) {
      violations.push(
        `${where}: Invalid merge_strategy '${effectiveStrategy}'. ` +
          `Allowed: ${PROMOTION_CHAIN_MERGE_STRATEGIES.join(", ")}`
      );
    }

    // ci_checks: optional array of strings
    if (entry.ci_checks !== undefined) {
      if (!Array.isArray(entry.ci_checks)) {
        violations.push(`${where}: ci_checks must be an array of strings`);
      } else {
        const bad = entry.ci_checks.find((c) => typeof c !== "string");
        if (bad !== undefined) {
          violations.push(`${where}: ci_checks entries must all be strings`);
        }
      }
    }

    resolvedEntries.push({
      ...entry,
      merge_strategy: effectiveStrategy ?? entry.merge_strategy,
    });
  });

  // ── AC3 + AC4: duplicate id and branch detection ────────────
  collectDuplicates(idCounts, "id", violations);
  collectDuplicates(branchCounts, "branch", violations);

  if (violations.length > 0) {
    throw new PromotionChainValidationError(violations);
  }

  return { valid: true, chain: resolvedEntries, chain_absent: false };
}

/**
 * Resolve the promotion chain for downstream workflow consumption.
 * Returns the validated chain plus the PR target (first entry, AC5).
 *
 * @param {object|null} config — parsed global.yaml
 * @returns {{
 *   chain: Array|null,
 *   pr_target: object|null,
 *   default_merge_strategy: string|null
 * }}
 * @throws {PromotionChainValidationError} on any validation failure.
 */
export function resolvePromotionChain(config) {
  const result = validatePromotionChain(config);
  if (!result.chain || result.chain.length === 0) {
    return {
      chain: null,
      pr_target: null,
      default_merge_strategy: config?.ci_cd?.default_merge_strategy ?? null,
    };
  }
  return {
    chain: result.chain,
    pr_target: result.chain[0],
    default_merge_strategy: config?.ci_cd?.default_merge_strategy ?? null,
  };
}
