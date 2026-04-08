/**
 * E20-S4 — /gaia-ci-edit Workflow
 *
 * Pure-function CRUD operations over the `ci_cd.promotion_chain` block in
 * global.yaml. The workflow layer (instructions.xml) reads global.yaml,
 * invokes these helpers to transform the chain, re-runs the E20-S1
 * promotion-chain validator against the result, and writes the updated
 * config back.
 *
 * Design notes:
 *   - All helpers are pure: they take a chain array and return a new
 *     array. They never mutate input.
 *   - The `id` field is the stable key per ADR-033 — never rename.
 *   - Minimum chain length is 1 (AC7, enforced via MinimumChainError).
 *   - Duplicate detection matches the E20-S1 validator semantics so that
 *     a chain passing these helpers will also pass the downstream
 *     schema validator without surprises.
 */

// ── Error classes ─────────────────────────────────────────────────

export class MinimumChainError extends Error {
  constructor() {
    super("Promotion chain must have at least 1 environment");
    this.name = "MinimumChainError";
  }
}

export class DuplicateFieldError extends Error {
  /**
   * @param {"id"|"branch"} field
   * @param {string} value
   */
  constructor(field, value) {
    super(`Duplicate ${field}: '${value}' already exists in promotion chain`);
    this.name = "DuplicateFieldError";
    this.field = field;
    this.value = value;
  }
}

export class ImmutableFieldError extends Error {
  /** @param {string} field */
  constructor(field) {
    super(
      `Field '${field}' is immutable (ADR-033). Remove and re-add the entry ` +
        `if you need to rename the stable key.`
    );
    this.name = "ImmutableFieldError";
    this.field = field;
  }
}

export class EnvironmentNotFoundError extends Error {
  /** @param {string} id */
  constructor(id) {
    super(`Environment id '${id}' not found in promotion chain`);
    this.name = "EnvironmentNotFoundError";
    this.id = id;
  }
}

// ── Internal helpers ─────────────────────────────────────────────

const clone = (chain) => chain.map((e) => ({ ...e }));

const assertUnique = (chain, field, value, excludeIndex = -1) => {
  for (let i = 0; i < chain.length; i++) {
    if (i === excludeIndex) continue;
    if (chain[i][field] === value) {
      throw new DuplicateFieldError(field, value);
    }
  }
};

// ── Add ──────────────────────────────────────────────────────────

/**
 * Add a new environment entry to the chain.
 *
 * @param {Array<object>} chain — current promotion chain (not mutated)
 * @param {object} entry — the new entry (must contain id + branch + required fields)
 * @param {{position?: number}} [options]
 * @returns {Array<object>} new chain
 * @throws {DuplicateFieldError} if id or branch already exists
 */
export function addEnvironment(chain, entry, options = {}) {
  if (!entry || typeof entry !== "object") {
    throw new TypeError("addEnvironment: entry must be an object");
  }
  if (!entry.id || !entry.branch) {
    throw new TypeError("addEnvironment: entry must include id and branch fields");
  }

  const source = Array.isArray(chain) ? clone(chain) : [];
  assertUnique(source, "id", entry.id);
  assertUnique(source, "branch", entry.branch);

  const next = clone(source);
  const position =
    typeof options.position === "number"
      ? Math.max(0, Math.min(options.position, next.length))
      : next.length;
  next.splice(position, 0, { ...entry });
  return next;
}

// ── Remove ───────────────────────────────────────────────────────

/**
 * Remove the environment with the given id.
 * Blocks the operation if the result would leave zero entries (AC7).
 *
 * @param {Array<object>} chain
 * @param {string} id
 * @returns {Array<object>} new chain
 */
export function removeEnvironment(chain, id) {
  if (!Array.isArray(chain)) {
    throw new TypeError("removeEnvironment: chain must be an array");
  }
  const idx = chain.findIndex((e) => e.id === id);
  if (idx === -1) {
    throw new EnvironmentNotFoundError(id);
  }
  if (chain.length <= 1) {
    throw new MinimumChainError();
  }
  const next = clone(chain);
  next.splice(idx, 1);
  return next;
}

// ── Edit ─────────────────────────────────────────────────────────

const IMMUTABLE_FIELDS = new Set(["id"]);

/**
 * Update fields on the environment with the given id.
 * `id` is immutable (ADR-033).
 *
 * @param {Array<object>} chain
 * @param {string} id
 * @param {object} updates
 * @returns {Array<object>} new chain
 */
export function editEnvironment(chain, id, updates) {
  if (!Array.isArray(chain)) {
    throw new TypeError("editEnvironment: chain must be an array");
  }
  if (!updates || typeof updates !== "object") {
    throw new TypeError("editEnvironment: updates must be an object");
  }

  for (const field of Object.keys(updates)) {
    if (IMMUTABLE_FIELDS.has(field)) {
      throw new ImmutableFieldError(field);
    }
  }

  const idx = chain.findIndex((e) => e.id === id);
  if (idx === -1) {
    throw new EnvironmentNotFoundError(id);
  }

  // Uniqueness re-check for updatable unique fields (branch)
  if (updates.branch !== undefined) {
    assertUnique(chain, "branch", updates.branch, idx);
  }

  const next = clone(chain);
  next[idx] = { ...next[idx], ...updates };
  return next;
}

// ── Reorder ──────────────────────────────────────────────────────

/**
 * Reorder the chain per the given id list. The id list must be a
 * permutation of the current chain ids. Returns a new chain array with
 * a `meta` property (non-enumerable on the array prototype, but set as
 * a normal array expando for easy consumption by tests and the workflow).
 *
 * @param {Array<object>} chain
 * @param {string[]} order — ordered list of ids
 * @returns {Array<object>} new chain (with .meta attached)
 */
export function reorderChain(chain, order) {
  if (!Array.isArray(chain)) {
    throw new TypeError("reorderChain: chain must be an array");
  }
  if (!Array.isArray(order)) {
    throw new TypeError("reorderChain: order must be an array");
  }
  if (order.length === 0) {
    throw new MinimumChainError();
  }

  const currentIds = chain.map((e) => e.id);
  const currentSet = new Set(currentIds);

  // Detect unknown ids in `order`
  const unknown = order.filter((id) => !currentSet.has(id));
  if (unknown.length > 0) {
    throw new Error(`reorderChain: unknown id(s) in order list: ${unknown.join(", ")}`);
  }
  // Detect missing ids
  if (order.length !== chain.length) {
    throw new Error(
      `reorderChain: order list must include all ${chain.length} existing ids, got ${order.length}`
    );
  }
  const orderSet = new Set(order);
  const missing = currentIds.filter((id) => !orderSet.has(id));
  if (missing.length > 0) {
    throw new Error(
      `reorderChain: order list must include all existing ids — missing: ${missing.join(", ")}`
    );
  }

  const byId = new Map(chain.map((e) => [e.id, { ...e }]));
  const next = order.map((id) => byId.get(id));
  next.meta = {
    previous_pr_target: currentIds[0],
    new_pr_target: order[0],
    position_zero_changed: currentIds[0] !== order[0],
  };
  return next;
}

// ── Reference scanning (AC3 safety) ──────────────────────────────

/**
 * Scan for references to a given environment id across the project.
 *
 * @param {string} envId — the environment id being removed or renamed
 * @param {{
 *   testEnvironment?: {tiers?: Array<{id: string, environment: string}>},
 *   stories?: Array<{file: string, matches: string[]}>,
 *   checkpoints?: Array<{file: string, branch?: string}>,
 *   envBranch?: string
 * }} sources
 * @returns {{found: boolean, locations: Array<{type: string, location: string, detail: string}>}}
 */
export function scanReferences(envId, sources = {}) {
  const locations = [];

  // test-environment.yaml tier references
  const tiers = sources.testEnvironment?.tiers ?? [];
  for (const tier of tiers) {
    if (tier.environment === envId) {
      locations.push({
        type: "test-environment",
        location: `tiers[${tier.id ?? "?"}]`,
        detail: `tier '${tier.id}' references environment '${envId}'`,
      });
    }
  }

  // Story file references (docs/implementation-artifacts)
  const stories = sources.stories ?? [];
  for (const story of stories) {
    if (Array.isArray(story.matches) && story.matches.includes(envId)) {
      locations.push({
        type: "story",
        location: story.file,
        detail: `story '${story.file}' references environment '${envId}'`,
      });
    }
  }

  // Checkpoint files targeting the env branch
  const checkpoints = sources.checkpoints ?? [];
  for (const cp of checkpoints) {
    if (sources.envBranch && cp.branch === sources.envBranch) {
      locations.push({
        type: "checkpoint",
        location: cp.file,
        detail: `in-flight checkpoint '${cp.file}' targets branch '${cp.branch}'`,
      });
    }
  }

  return { found: locations.length > 0, locations };
}
