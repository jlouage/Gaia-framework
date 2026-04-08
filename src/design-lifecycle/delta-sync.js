/**
 * E13-S9: Design Review & Iteration Loop — Delta Sync
 *
 * Computes minimal change sets for design token updates following the
 * 6-step delta computation process from architecture section 10.17.2.
 * Preserves unchanged tokens to protect manual overrides by dev agents.
 */

/**
 * Compute deep diff between current and new design tokens.
 * Follows delta diff semantics from architecture 10.17.2:
 * - Added: entries in newTokens not in currentTokens
 * - Removed: entries in currentTokens absent from newTokens
 * - Modified: entries in both where $value or $type differs
 * - Unchanged: entries in both with identical $value and $type
 *
 * @param {object} currentTokens - Existing design-tokens.json parsed object
 * @param {object} newTokens - Freshly extracted tokens from Figma MCP
 * @returns {{ added: object, removed: string[], modified: object, unchanged: string[] }}
 */
export function computeTokenDiff(currentTokens, newTokens) {
  const added = {};
  const removed = [];
  const modified = {};
  const unchanged = [];

  const currentKeys = Object.keys(currentTokens);
  const newKeys = Object.keys(newTokens);

  // Check for added and modified
  for (const key of newKeys) {
    if (!(key in currentTokens)) {
      added[key] = newTokens[key];
    } else {
      const curr = currentTokens[key];
      const next = newTokens[key];
      if (curr.$value !== next.$value || curr.$type !== next.$type) {
        modified[key] = next;
      } else {
        unchanged.push(key);
      }
    }
  }

  // Check for removed
  for (const key of currentKeys) {
    if (!(key in newTokens)) {
      removed.push(key);
    }
  }

  return { added, removed, modified, unchanged };
}

/**
 * Apply delta to current tokens (incremental update, preserve unchanged).
 * @param {object} currentTokens - Existing tokens
 * @param {{ added: object, removed: string[], modified: object }} delta - Diff result
 * @returns {object} Updated tokens object
 */
export function applyTokenDelta(currentTokens, delta) {
  const updated = { ...currentTokens };

  // Apply modifications
  for (const [key, value] of Object.entries(delta.modified || {})) {
    updated[key] = value;
  }

  // Apply additions
  for (const [key, value] of Object.entries(delta.added || {})) {
    updated[key] = value;
  }

  // Apply removals
  for (const key of delta.removed || []) {
    delete updated[key];
  }

  return updated;
}

/**
 * Format a delta into a markdown changelog entry.
 * Follows token changelog format from architecture 10.17.2.
 * @param {{ added: object, removed: string[], modified: object }} delta
 * @param {{ timestamp: string, source: string }} metadata
 * @returns {string} Markdown changelog entry
 */
export function formatChangelogEntry(delta, metadata) {
  const lines = [];
  lines.push(`## ${metadata.timestamp} — Delta sync from ${metadata.source}`);
  lines.push('');
  lines.push('| Token Path | Change | Old Value | New Value |');
  lines.push('|------------|--------|-----------|-----------|');

  // Modified tokens
  for (const [path, token] of Object.entries(delta.modified || {})) {
    lines.push(`| ${path} | modified | — | ${token.$value} |`);
  }

  // Added tokens
  for (const [path, token] of Object.entries(delta.added || {})) {
    lines.push(`| ${path} | added | — | ${token.$value} |`);
  }

  // Removed tokens
  for (const path of delta.removed || []) {
    lines.push(`| ${path} | removed | — | — |`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Append a changelog entry to token-changelog.md.
 * @param {string} existingContent - Current file content (empty string if new)
 * @param {string} entry - Formatted changelog entry
 * @returns {string} Updated file content
 */
export function appendChangelog(existingContent, entry) {
  if (!existingContent || existingContent.trim() === '') {
    return `# Token Changelog\n\n${entry}`;
  }

  return `${existingContent.trimEnd()}\n\n${entry}`;
}
