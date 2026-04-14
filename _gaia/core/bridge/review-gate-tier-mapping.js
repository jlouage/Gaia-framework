/**
 * E17-S12: Review Gate-to-Tier Mapping Table
 *
 * Canonical mapping between the six GAIA review gates and the three test
 * tiers defined in E17-S11 (unit / integration / e2e). This module is the
 * single source of truth the Test Execution Bridge consults when it needs
 * to know which tiers to execute to produce a PASSED verdict for a given
 * review gate, and which tiers to suggest in the Nudge Block (E17-S3) when
 * a gate is UNVERIFIED.
 *
 * Canonical default mapping (story AC1, architecture §10.20.4):
 *
 *   qa-tests         → Tier 1 + Tier 2        (unit + integration)
 *   test-automate    → Tier 1                 (unit)
 *   test-review      → Tier 2                 (integration)
 *   review-perf      → Tier 3                 (e2e)
 *   security-review  → Tier 2 + Tier 3        (integration + e2e)
 *   code-review      → no tier                (static analysis only)
 *
 * Projects may override individual entries via the `tiers.gate_mapping`
 * block in `test-environment.yaml` — the custom mapping is merged over the
 * default, gate by gate, so partial overrides are safe.
 *
 * Traces: FR-195, ADR-028, architecture §10.20.4
 */

import { TIERS, normaliseTierName } from "./layer-2-tier-selection.js";
import { resolveAllTierMappings } from "./adapters/index.js";

// ─── Canonical gate + mapping definitions ──────────────────────────────────

/**
 * The six canonical review gate names, in their slug form (matches the
 * `/gaia-{gate}` slash-command suffix and the `test-environment.yaml`
 * gate list used by E17-S11).
 */
export const REVIEW_GATES = Object.freeze([
  "code-review",
  "qa-tests",
  "security-review",
  "test-automate",
  "test-review",
  "review-perf",
]);

/**
 * Canonical default gate-to-tier mapping. Each value is a frozen list of
 * canonical tier names from the E17-S11 TIERS catalog. `code-review` has
 * an empty list — code review is a static-analysis gate and does not
 * require any test-tier evidence.
 */
export const DEFAULT_GATE_TIER_MAPPING = Object.freeze({
  "qa-tests": Object.freeze(["unit", "integration"]),
  "test-automate": Object.freeze(["unit"]),
  "test-review": Object.freeze(["integration"]),
  "review-perf": Object.freeze(["e2e"]),
  "security-review": Object.freeze(["integration", "e2e"]),
  "code-review": Object.freeze([]),
});

const KNOWN_GATES = new Set(REVIEW_GATES);

// ─── resolveGateTierMapping ────────────────────────────────────────────────

/**
 * Read the gate-to-tier mapping from a parsed `test-environment.yaml`
 * object and merge it over the canonical default. Missing / null / empty
 * inputs fall back to the default mapping.
 *
 * Merge semantics (AC2):
 *   - The default mapping is used as the base for every gate.
 *   - For each entry in `testEnvironment.tiers.gate_mapping` where the
 *     gate name is recognised, the default list is replaced (not merged)
 *     with the custom list — overrides are whole-list.
 *   - Unknown gate names in the custom block are ignored.
 *   - Tier values in the custom block are normalised via
 *     `normaliseTierName` from layer-2-tier-selection. Unknown tier
 *     values are dropped.
 *
 * The returned object is a fresh deep clone — callers may mutate it
 * without corrupting the frozen default.
 *
 * @param {object | null | undefined} testEnvironment — parsed test-environment.yaml
 * @returns {Record<string, string[]>}
 */
export function resolveGateTierMapping(testEnvironment) {
  // Start from a deep clone of the default so the returned object is safe
  // to mutate and the frozen defaults stay pristine.
  const resolved = cloneDefault();

  if (!testEnvironment || typeof testEnvironment !== "object") {
    return resolved;
  }

  const tiersBlock = testEnvironment.tiers;
  if (!tiersBlock || typeof tiersBlock !== "object") {
    return resolved;
  }

  const customMapping = tiersBlock.gate_mapping;
  if (!customMapping || typeof customMapping !== "object") {
    return resolved;
  }

  for (const [gate, tierList] of Object.entries(customMapping)) {
    if (!KNOWN_GATES.has(gate)) continue;
    if (!Array.isArray(tierList)) continue;

    const normalised = [];
    for (const value of tierList) {
      const name = normaliseTierName(value);
      if (name !== null && !normalised.includes(name)) {
        normalised.push(name);
      }
    }
    resolved[gate] = normalised;
  }

  return resolved;
}

function cloneDefault() {
  const clone = {};
  for (const gate of REVIEW_GATES) {
    clone[gate] = [...DEFAULT_GATE_TIER_MAPPING[gate]];
  }
  return clone;
}

// ─── getTiersForGate ───────────────────────────────────────────────────────

/**
 * Look up the tier list for a review gate.
 *
 * @param {string} gate — canonical gate slug (e.g. "qa-tests")
 * @param {Record<string, string[]>} [mapping] — optional mapping to use
 *   instead of the default (e.g. the result of resolveGateTierMapping).
 * @returns {string[] | null} — list of tier names, or `null` when the
 *   gate is not one of the six canonical gates.
 */
export function getTiersForGate(gate, mapping = DEFAULT_GATE_TIER_MAPPING) {
  if (!KNOWN_GATES.has(gate)) return null;
  const tiers = mapping[gate];
  // Return a fresh copy so callers cannot mutate the source mapping.
  return Array.isArray(tiers) ? [...tiers] : [];
}

// ─── formatNudgeSuggestion ─────────────────────────────────────────────────

/**
 * Render the "run Tier N tests" suggestion string shown in the Nudge
 * Block (E17-S3) when a gate is UNVERIFIED. For gates with no tier
 * requirement (code-review by default), returns a dedicated message that
 * makes the static-analysis intent explicit.
 *
 * Examples:
 *   qa-tests         → "run Tier 1 + Tier 2 tests"
 *   test-automate    → "run Tier 1 tests"
 *   review-perf      → "run Tier 3 tests"
 *   code-review      → "no tier required (static analysis only)"
 *
 * @param {string} gate — canonical gate slug
 * @param {Record<string, string[]>} [mapping] — optional mapping override
 * @returns {string | null} — suggestion string, or `null` for unknown gates
 */
export function formatNudgeSuggestion(gate, mapping = DEFAULT_GATE_TIER_MAPPING) {
  const tiers = getTiersForGate(gate, mapping);
  if (tiers === null) return null;

  if (tiers.length === 0) {
    return "no tier required (static analysis only)";
  }

  const labels = tiers.map((name) => {
    const entry = TIERS[name];
    return entry ? `Tier ${entry.id}` : name;
  });

  return `run ${labels.join(" + ")} tests`;
}

// ─── E25-S6: Multi-stack tier resolution ───────────────────────────────────

/**
 * Resolve per-stack tier mapping for a multi-stack project and union the
 * resulting tier lists across all active adapters. The `gateTierMapping`
 * (default or custom-merged via `resolveGateTierMapping`) is unchanged —
 * this helper only consults the registry to iterate over adapters and
 * produce namespaced evidence that downstream consumers (evidence writer,
 * reviewers) can attach to their records.
 *
 * AC4 — multi-stack monorepos: each adapter's gate resolution runs in its
 * own namespace under the returned `perStack` block. There is no cross-
 * pollination between stacks: a hint block in one namespace never leaks
 * into another.
 *
 * AC5 — JS byte-identical regression: the JS adapter does not expose
 * `resolveTierMapping`, so its contribution here is an empty/inactive
 * entry in `perStack`. The canonical `DEFAULT_GATE_TIER_MAPPING`,
 * `resolveGateTierMapping`, `getTiersForGate`, and `formatNudgeSuggestion`
 * are untouched — JS gate resolution output is preserved byte-for-byte.
 *
 * Traces: FR-312, ADR-028, ADR-038 §10.20.11.
 *
 * @param {string} projectPath - Absolute project root
 * @param {object} [testEnvironment] - Parsed test-environment.yaml object
 * @returns {{
 *   perStack: Object<string, { active: boolean, mapping?: object, entries?: Array }>,
 *   unusedHints: string[]
 * }}
 */
export function resolvePerStackTierMapping(projectPath, testEnvironment) {
  const stackHints = testEnvironment?.tiers?.stack_hints ?? null;
  return resolveAllTierMappings(projectPath, stackHints);
}
