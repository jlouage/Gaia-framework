/**
 * Promotion Chain Guard — E20-S11 (NFR-045)
 *
 * Single source of truth for the "is the ci_cd promotion chain configured?"
 * predicate that gates dev-story Steps 13-16, /gaia-ci-edit, the E17 Test
 * Execution Bridge tier selection, and any future workflow that needs to
 * preserve pre-E20 backward compatibility (ADR-033).
 *
 * Contract: returns `true` ONLY when ALL of the following hold:
 *   1. The provided config object is non-null and a plain object
 *   2. The `ci_cd` key is present and non-null
 *   3. `ci_cd.promotion_chain` is present and non-null
 *   4. `ci_cd.promotion_chain` is an array with at least one entry
 *
 * Every other shape — missing key, null, empty object, partial ci_cd, null
 * promotion_chain, empty promotion_chain — returns `false` and the caller
 * MUST treat the workflow as if no promotion chain has been opted into.
 *
 * The function is a pure boolean predicate: no mutation, no logging, no I/O.
 *
 * @param {object|null|undefined} globalConfig — parsed global.yaml object
 * @returns {boolean}
 */
export function chainPresent(globalConfig) {
  // Defensive: any non-object root (null, undefined, primitive) is "absent".
  if (!isPlainObject(globalConfig)) return false;

  // ci_cd must be a non-null object — covers variants (a) missing key,
  // (b) ci_cd: null, and any malformed scalar value.
  if (!isPlainObject(globalConfig.ci_cd)) return false;

  // promotion_chain must be a non-empty array — covers variants (c) ci_cd: {},
  // (d) ci_cd with no promotion_chain key, (e) promotion_chain: null,
  // and (f) promotion_chain: [].
  const chain = globalConfig.ci_cd.promotion_chain;
  return Array.isArray(chain) && chain.length > 0;
}

/** Internal: a non-null, non-array, plain object. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
