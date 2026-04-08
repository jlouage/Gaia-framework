/**
 * E13-S9: Design Review & Iteration Loop — Design State Management
 *
 * Manages design lifecycle state machine, state transitions, stakeholder
 * convergence, design gate checks, and stale detection for the Figma MCP
 * integration (architecture section 10.17.1, ADR-024).
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Valid design states for the lifecycle state machine. */
export const DESIGN_STATES = ['draft', 'review', 'approved', 'in-dev', 'stale'];

/** Valid state transitions as adjacency list (source -> targets). */
export const VALID_TRANSITIONS = {
  draft: ['review'],
  review: ['draft', 'approved'],
  approved: ['in-dev'],
  'in-dev': ['stale'],
  stale: ['review'],
};

/** States that allow dev agents to consume design tokens. */
const ALLOWED_GATE_STATES = new Set(['approved', 'in-dev']);

/** NFR-030: iteration count threshold for excessive cycle warning. */
const NFR_030_THRESHOLD = 5;

// ── Frontmatter helpers ──────────────────────────────────────────────────────

/**
 * Extract raw frontmatter block from file content.
 * @param {string} content - Full file content
 * @returns {string|null} Frontmatter text (between --- delimiters), or null
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

/**
 * Read a scalar field from frontmatter text.
 * @param {string} fm - Frontmatter block
 * @param {string} field - Field name
 * @param {*} fallback - Default if not found
 * @returns {string|number|null}
 */
function readField(fm, field, fallback = null) {
  const match = fm.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  if (!match) return fallback;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

/**
 * Update or insert a frontmatter field in file content.
 * @param {string} content - Full file content
 * @param {string} field - Field name
 * @param {string|number} value - New value
 * @returns {string} Updated content
 */
function updateFrontmatterField(content, field, value) {
  const pattern = new RegExp(`^${field}:\\s*.+$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, `${field}: ${value}`);
  }
  return content.replace(/^---\n/, `---\n${field}: ${value}\n`);
}

/**
 * Parse a YAML scalar value into its JS type.
 */
function coerceValue(raw) {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

/**
 * Parse the design_stakeholders array from frontmatter YAML.
 */
function parseStakeholders(fm) {
  if (fm.match(/design_stakeholders:\s*\[\s*\]/)) return [];

  const section = fm.match(
    /design_stakeholders:\s*\n((?:\s+-[\s\S]*?)(?=\n\w|\n---|\s*$))/
  );
  if (!section) return [];

  return section[1]
    .split(/\n\s+-\s+/)
    .filter(Boolean)
    .map((entry) => {
      const lines = entry.replace(/^\s*-\s+/, '').split('\n');
      const obj = {};
      for (const line of lines) {
        const kv = line.trim().match(/^(\w+):\s*(.+)$/);
        if (kv) obj[kv[1]] = coerceValue(kv[2]);
      }
      return obj;
    })
    .filter((s) => s.id);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse ux-design.md frontmatter to extract design_state and related fields.
 * @param {string} content - Full file content of ux-design.md
 * @returns {{ design_state: string, design_stakeholders: Array, design_iteration_count: number }}
 */
export function parseDesignFrontmatter(content) {
  const fm = extractFrontmatter(content);
  if (!fm) {
    return { design_state: null, design_stakeholders: [], design_iteration_count: 0 };
  }

  const rawCount = readField(fm, 'design_iteration_count', '0');

  return {
    design_state: readField(fm, 'design_state'),
    design_stakeholders: parseStakeholders(fm),
    design_iteration_count: parseInt(rawCount, 10) || 0,
  };
}

/**
 * Validate a state transition.
 * @param {string} fromState - Current state
 * @param {string} toState - Target state
 * @returns {boolean} Whether the transition is valid
 */
export function isValidTransition(fromState, toState) {
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

/**
 * Transition design_state in ux-design.md content.
 * @param {string} content - Full file content
 * @param {string} newState - Target state
 * @param {object} [options] - Optional: { initial: true } to set without validation
 * @returns {string} Updated file content
 * @throws {Error} If newState is invalid or transition is not allowed
 */
export function transitionDesignState(content, newState, options = {}) {
  if (!DESIGN_STATES.includes(newState)) {
    throw new Error(`Invalid design state: ${newState}`);
  }

  const { design_state: currentState } = parseDesignFrontmatter(content);

  if (!options.initial && currentState && !isValidTransition(currentState, newState)) {
    throw new Error(`Invalid transition: ${currentState} -> ${newState}`);
  }

  return updateFrontmatterField(content, 'design_state', newState);
}

/**
 * Record a stakeholder approval in ux-design.md frontmatter.
 * @param {string} content - Full file content
 * @param {string} stakeholderId - ID of the approving stakeholder
 * @param {string} [timestamp] - ISO 8601 timestamp (defaults to now)
 * @returns {string} Updated file content
 * @throws {Error} If stakeholder not found
 */
export function recordStakeholderApproval(content, stakeholderId, timestamp) {
  const ts = timestamp || new Date().toISOString();

  const pattern = new RegExp(
    `(- id: ${stakeholderId}\\n(?:    \\w+:.*\\n)*?)    approved: (?:true|false)\\n    approved_at: (?:"[^"]*"|null)`,
    'm'
  );

  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Stakeholder not found: ${stakeholderId}`);
  }

  return content.replace(
    pattern,
    `${match[1]}    approved: true\n    approved_at: "${ts}"`
  );
}

/**
 * Check if all tagged stakeholders have approved.
 * @param {Array} stakeholders - design_stakeholders array from frontmatter
 * @returns {{ converged: boolean, approved: number, total: number }}
 */
export function checkStakeholderConvergence(stakeholders) {
  const total = stakeholders?.length || 0;
  if (total === 0) return { converged: false, approved: 0, total: 0 };

  const approved = stakeholders.filter((s) => s.approved === true).length;
  return { converged: approved === total, approved, total };
}

/**
 * Increment design_iteration_count in frontmatter (on review -> draft).
 * @param {string} content - Full file content
 * @returns {{ content: string, count: number }}
 */
export function incrementIterationCount(content) {
  const { design_iteration_count } = parseDesignFrontmatter(content);
  const newCount = design_iteration_count + 1;

  return {
    content: updateFrontmatterField(content, 'design_iteration_count', newCount),
    count: newCount,
  };
}

/**
 * Check if iteration count exceeds the NFR-030 threshold (>=5).
 * @param {number} count - Current iteration count
 * @returns {{ warning: boolean, message: string | null }}
 */
export function checkIterationWarning(count) {
  if (count >= NFR_030_THRESHOLD) {
    return {
      warning: true,
      message: `NFR-030: Design review has reached ${count} iteration cycles. Consider converging on a final design to avoid excessive iteration.`,
    };
  }
  return { warning: false, message: null };
}

/**
 * Check design gate for /gaia-dev-story: verify design_state allows token consumption.
 * Silently passes when no ux-design.md exists or no Figma metadata (backward compatible).
 * @param {string|null} designState - Current design_state (null if no ux-design.md)
 * @param {boolean} hasFigmaMetadata - Whether ux-design.md has figma: metadata
 * @returns {{ allowed: boolean, warning: string | null }}
 */
export function checkDesignGate(designState, hasFigmaMetadata) {
  if (designState === null || !hasFigmaMetadata) {
    return { allowed: true, warning: null };
  }

  if (ALLOWED_GATE_STATES.has(designState)) {
    return { allowed: true, warning: null };
  }

  return {
    allowed: false,
    warning: `Design gate blocked: design_state is "${designState}". Design must be approved before dev agents can consume tokens. Complete design review and approval first.`,
  };
}

/**
 * Detect stale design: check if design tokens changed while in-dev.
 * @param {string} currentVersionHash - Hash dev agent consumed
 * @param {string} latestVersionHash - Current Figma version hash
 * @param {object} [options] - Optional { changedTokens: string[] }
 * @returns {{ stale: boolean, changedTokens: string[] }}
 */
export function detectStaleDesign(currentVersionHash, latestVersionHash, options = {}) {
  const stale = currentVersionHash !== latestVersionHash;
  return {
    stale,
    changedTokens: stale ? (options.changedTokens || []) : [],
  };
}
