/**
 * Promotion Chain Environment Resolver (E20-S10)
 *
 * Cross-references `test-environment.yaml` tier entries with
 * `ci_cd.promotion_chain[]` entries declared in `global.yaml`, enriching the
 * Test Execution Bridge context with CI provider, branch, and ci_checks when
 * a valid mapping exists.
 *
 * Architecture references:
 *   - ADR-028: Test Execution Bridge Protocol
 *   - ADR-033: Multi-Environment Promotion Chain
 *   - FR-244 / MPC-39: E17 Tier Mapping — Test Environment Integration
 *   - NFR-045: Backward compatibility (no ci_cd block → silent ignore)
 *
 * Design principles:
 *   - Opt-in at both layers: the caller must provide `global.ci_cd.promotion_chain`
 *     AND a tier entry must set `promotion_chain_env_id`. Missing either layer
 *     falls back to the pre-E20 tier-local resolution path.
 *   - WARNING-level diagnostics — never HALTs. Orphaned references are
 *     ignored and the bridge falls back to tier-local config.
 *   - Silent backward compat: when `ci_cd` is absent from global.yaml, all
 *     `promotion_chain_env_id` fields are ignored with no warning.
 *
 * @module promotion-chain-env-resolver
 */

/**
 * Look up a promotion chain entry by id.
 *
 * @param {string} envId — The id to search for (from tier entry).
 * @param {object} globalConfig — Parsed global.yaml content.
 * @returns {object|null} The matching chain entry, or null if not found.
 */
export function resolvePromotionChainEnv(envId, globalConfig) {
  if (!envId || !globalConfig) return null;
  const chain = globalConfig?.ci_cd?.promotion_chain;
  if (!Array.isArray(chain) || chain.length === 0) return null;
  return chain.find((entry) => entry && entry.id === envId) || null;
}

/**
 * Resolve the bridge execution context for a tier entry, optionally enriched
 * from the promotion chain.
 *
 * Behavior matrix:
 *   1. No `promotion_chain_env_id` on the tier entry → pre-E20 fallback,
 *      no warnings, no enrichment.
 *   2. `promotion_chain_env_id` set but `global.ci_cd` absent → silent ignore
 *      (NFR-045 backward compat), id recorded on context for audit.
 *   3. `promotion_chain_env_id` set and matches a chain entry → enrich the
 *      context with ci_provider, branch, and ci_checks from the chain entry.
 *   4. `promotion_chain_env_id` set but does NOT match any chain entry
 *      (orphan) → emit WARNING naming the tier, orphaned id, and known ids;
 *      fall back to tier-local config.
 *
 * @param {object} tierEntry — A single runner/tier definition from test-environment.yaml.
 * @param {object} globalConfig — Parsed global.yaml content.
 * @returns {{
 *   promotion_chain_env_id: (string|null),
 *   ci_provider: (string|undefined),
 *   branch: (string|undefined),
 *   ci_checks: (string[]|undefined),
 *   warnings: string[]
 * }}
 */
export function resolveBridgeContext(tierEntry, globalConfig) {
  const context = {
    promotion_chain_env_id: null,
    warnings: [],
  };

  if (!tierEntry || typeof tierEntry !== "object") {
    return context;
  }

  const envId = tierEntry.promotion_chain_env_id;

  // Case 1: field not set / null — pre-E20 fallback, no warnings
  if (envId === undefined || envId === null || envId === "") {
    return context;
  }

  // Record the id on context regardless of resolution outcome — used by
  // evidence JSON for audit (even orphaned references are surfaced).
  context.promotion_chain_env_id = envId;

  // Case 2: ci_cd absent → silent ignore (NFR-045)
  const ciCd = globalConfig && globalConfig.ci_cd;
  if (!ciCd) {
    return context;
  }

  const chain = ciCd.promotion_chain;

  // Case 2b: ci_cd present but promotion_chain not defined → treat like
  // no ci_cd (silent). This guards partial ci_cd blocks.
  if (chain === undefined || chain === null) {
    return context;
  }

  // Case 4: empty chain or no match → orphan WARNING
  if (!Array.isArray(chain) || chain.length === 0) {
    context.warnings.push(formatOrphanWarning(tierEntry, envId, []));
    return context;
  }

  const match = chain.find((entry) => entry && entry.id === envId);

  if (!match) {
    const knownIds = chain.map((e) => (e && e.id) || "?").filter(Boolean);
    context.warnings.push(formatOrphanWarning(tierEntry, envId, knownIds));
    return context;
  }

  // Case 3: valid mapping — enrich context
  context.ci_provider = match.ci_provider;
  context.branch = match.branch;
  context.ci_checks = Array.isArray(match.ci_checks) ? [...match.ci_checks] : undefined;

  return context;
}

/**
 * Format a human-readable orphaned-id warning.
 *
 * @param {object} tierEntry — Tier entry (for tier name).
 * @param {string} orphanId — The orphaned promotion_chain_env_id value.
 * @param {string[]} knownIds — The list of ids present in the chain.
 * @returns {string}
 */
function formatOrphanWarning(tierEntry, orphanId, knownIds) {
  const tierName = (tierEntry && tierEntry.name) || `tier-${tierEntry?.tier ?? "?"}`;
  const knownList = knownIds.length > 0 ? `[${knownIds.join(", ")}]` : "[]";
  return (
    `WARNING [test-environment.yaml]: tier '${tierName}' references ` +
    `promotion_chain_env_id '${orphanId}' which does not exist in ` +
    `ci_cd.promotion_chain (known ids: ${knownList}). ` +
    `Mapping ignored. Falling back to tier-local config.`
  );
}
