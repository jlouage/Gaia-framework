/**
 * E17-S11: Three-Tier Test Environment Model
 *
 * Formal definition of the bridge's three test-execution tiers and a
 * small helper that maps a requested tier to a runner command read
 * from `test-environment.yaml`. The model is referenced by:
 *
 *   - Layer 2 execution (this module selects the command to run)
 *   - Layer 3 evidence writer (records which tier was executed)
 *   - The gate-to-tier mapping in E17-S12 (future work)
 *
 * Formal definitions (FR-195, architecture §10.20.4):
 *
 *   Tier 1 — unit
 *     Fast tests with no external dependencies. Safe to run inside a
 *     Claude Code session. Typical runtime: seconds.
 *
 *   Tier 2 — integration
 *     Tests where services and I/O boundaries are mocked. No real
 *     network, database, or filesystem effects beyond temporary
 *     fixtures. Typical runtime: seconds to a minute.
 *
 *   Tier 3 — e2e
 *     Tests that exercise real external dependencies — deployed
 *     application, live services, browsers, containers. Typical
 *     runtime: minutes.
 *
 * Traces: FR-195, ADR-028
 */

// ─── Tier catalog ──────────────────────────────────────────────────────────

/**
 * Canonical tier metadata. Keys are the tier names; the `id` field gives
 * the numeric alias used by the legacy `test-environment.yaml` runners
 * list (tier: 1 | 2 | 3) and by any project that addresses tiers by
 * number rather than by name.
 */
export const TIERS = Object.freeze({
  unit: Object.freeze({
    id: 1,
    name: "unit",
    description:
      "Tier 1 — unit tests: fast, no external dependencies. Safe to run inside a Claude Code session.",
  }),
  integration: Object.freeze({
    id: 2,
    name: "integration",
    description: "Tier 2 — integration tests: services and I/O boundaries are mocked.",
  }),
  e2e: Object.freeze({
    id: 3,
    name: "e2e",
    description: "Tier 3 — end-to-end tests: real external dependencies and deployed application.",
  }),
});

const ID_TO_NAME = {
  1: "unit",
  2: "integration",
  3: "e2e",
};

const KNOWN_NAMES = new Set(Object.keys(TIERS));

/**
 * Normalise a caller-provided tier value to its canonical name.
 *
 * Accepts tier names (case-insensitive: "unit", "INTEGRATION", "e2e"),
 * numeric ids (1, 2, 3), and numeric strings ("1", "2", "3"). Returns
 * null for any value that does not map to a known tier — the caller
 * decides how to present the "unknown tier" case to the user.
 *
 * @param {string | number | null | undefined} value
 * @returns {"unit" | "integration" | "e2e" | null}
 */
export function normaliseTierName(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return ID_TO_NAME[value] || null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "") return null;
    if (KNOWN_NAMES.has(trimmed)) return trimmed;
    // Numeric string aliases — "1" / "2" / "3".
    if (/^[1-3]$/.test(trimmed)) {
      return ID_TO_NAME[Number(trimmed)] || null;
    }
    return null;
  }

  return null;
}

// ─── tiers block reader ────────────────────────────────────────────────────

/**
 * Extract the command string from a tiers[name] entry. Accepts either
 * { command: "..." } or a bare string.
 */
function readTierCommand(tiersBlock, tierName) {
  if (!tiersBlock || typeof tiersBlock !== "object") return null;
  // Prefer the canonical name key, then the numeric id key (e.g. `1`).
  const canonical = tiersBlock[tierName];
  const byId = canonical === undefined ? tiersBlock[TIERS[tierName].id] : undefined;
  const entry = canonical !== undefined ? canonical : byId;
  if (entry === null || entry === undefined) return null;
  if (typeof entry === "string") return entry.trim() || null;
  if (typeof entry === "object" && typeof entry.command === "string") {
    return entry.command.trim() || null;
  }
  return null;
}

/**
 * Check whether the tiers block declares at least one tier→command map.
 * An empty object or an object with no command strings is treated as
 * "no tiers declared" — the bridge should default to "run all".
 */
function hasAnyTierCommand(tiersBlock) {
  if (!tiersBlock || typeof tiersBlock !== "object") return false;
  for (const name of KNOWN_NAMES) {
    if (readTierCommand(tiersBlock, name) !== null) return true;
  }
  return false;
}

// ─── Public API: selectTier ────────────────────────────────────────────────

/**
 * @typedef {Object} TierSelectionInput
 * @property {object} testEnvironment — parsed test-environment.yaml
 * @property {string | number | null | undefined} [requestedTier]
 * @property {string} [fallbackCommand] — command to use when running all
 *   tiers (AC3 default). Typically the project's `npm test` equivalent.
 * @property {{ info?: Function, warn?: Function }} [logger] — optional
 *   sink for graceful-skip messages (AC5). Defaults to console.
 *
 * @typedef {Object} TierSelectionResult
 * @property {"unit" | "integration" | "e2e" | null} tier
 * @property {string | null} command
 * @property {boolean} skipped  — true when the tier was requested but not
 *   configured, or when the tier name is unknown
 * @property {boolean} runAll   — true when no tier was requested AND no
 *   tiers block is declared — bridge runs the full suite
 * @property {string} [reason]  — human-readable explanation when skipped
 */

/**
 * Select the runner command for a given tier from test-environment.yaml.
 *
 * Behaviour matrix:
 *
 *   tiers block declared   requestedTier   result
 *   ────────────────────   ─────────────   ──────────────────────────────
 *   yes (non-empty)        named/id        command from tiers[name] OR
 *                                          skipped=true when unconfigured
 *   yes (non-empty)        null            runAll=true, command=fallback
 *   no / empty             anything        runAll=true, command=fallback
 *   any                    unknown name    skipped=true, reason="unknown tier"
 *
 * AC5: when the requested tier is unconfigured, the function logs a
 * warning via the supplied logger (or console.warn) and returns
 * skipped=true rather than throwing — the caller can then continue
 * with the next tier in its sequence.
 *
 * @param {TierSelectionInput} input
 * @returns {TierSelectionResult}
 */
export function selectTier(input = {}) {
  const {
    testEnvironment = {},
    requestedTier = null,
    fallbackCommand = null,
    logger = null,
  } = input;

  const tiersBlock =
    testEnvironment && typeof testEnvironment === "object" ? testEnvironment.tiers : null;
  const tiersDeclared = hasAnyTierCommand(tiersBlock);

  // Case 1: no requested tier.
  if (requestedTier === null || requestedTier === undefined) {
    // AC3 — default to "run all" when no tier is requested.
    return {
      tier: null,
      command: fallbackCommand,
      skipped: false,
      runAll: true,
    };
  }

  // Case 2: requested tier — validate the name.
  const canonical = normaliseTierName(requestedTier);
  if (canonical === null) {
    const reason = `unknown tier "${String(requestedTier)}" — expected one of unit / integration / e2e (or 1 / 2 / 3)`;
    logTierSkip(logger, reason);
    return {
      tier: null,
      command: null,
      skipped: true,
      runAll: false,
      reason,
    };
  }

  // Case 3: known tier — look it up in the tiers block.
  if (!tiersDeclared) {
    // No tiers configured at all → AC3 default to run-all.
    return {
      tier: null,
      command: fallbackCommand,
      skipped: false,
      runAll: true,
    };
  }

  const command = readTierCommand(tiersBlock, canonical);
  if (command === null) {
    // AC5 — tier exists in catalog but is not configured in this project.
    const reason = `tier "${canonical}" not configured in test-environment.yaml tiers block`;
    logTierSkip(logger, `tier "${canonical}" skipped: ${reason}`);
    return {
      tier: canonical,
      command: null,
      skipped: true,
      runAll: false,
      reason,
    };
  }

  return {
    tier: canonical,
    command,
    skipped: false,
    runAll: false,
  };
}

function logTierSkip(logger, message) {
  const sink = logger && typeof logger.warn === "function" ? logger.warn : null;
  if (sink) {
    sink(`[bridge/tier-selection] ${message}`);
    return;
  }
  // Fallback — mirror the warning to console so local runs still see it.
  // eslint-disable-next-line no-console
  console.warn(`[bridge/tier-selection] ${message}`);
}
