/**
 * E28-S33 — Sprint-plan dependency inversion lint
 *
 * Detects forward references in acceptance criteria during sprint planning:
 * when story A's AC mentions a resource that story B creates, and B is
 * scheduled at or after A in the sprint order, flag it as a dependency
 * inversion so the scrum master can re-order or add an explicit depends_on.
 *
 * Origin: E28-S4 finding #2 — E28-S1 AC3 referenced a marketplace repo that
 * E28-S4 creates, but E28-S1 was scheduled first.
 *
 * Scope (AC1): this lint is AC-only. It deliberately ignores resource
 * mentions in Dev Notes, Technical Notes, or Tasks that are not also in an
 * AC — false positives during sprint planning are costly.
 *
 * Detection heuristic:
 *   1. Extract AC text from each story.
 *   2. Tokenize resources mentioned (repo names, file paths, CLI commands,
 *      gaia commands, directory paths).
 *   3. For each other story, scan its Tasks/Subtasks for verbs that mean
 *      "create" — create, add, scaffold, initialize, init, generate,
 *      provision, bootstrap — paired with the same token.
 *   4. If story B "creates" a token that story A's AC mentions and B's sprint
 *      position is >= A's position, emit a warning.
 *
 * The module is pure — it takes a parsed story list and returns warnings.
 * I/O (reading story files) lives in the sprint-planning workflow step.
 */

const CREATE_VERBS = [
  "create",
  "creates",
  "created",
  "add",
  "adds",
  "added",
  "scaffold",
  "scaffolds",
  "scaffolded",
  "initialize",
  "initializes",
  "initialized",
  "init",
  "generate",
  "generates",
  "generated",
  "provision",
  "provisions",
  "provisioned",
  "bootstrap",
  "bootstraps",
  "bootstrapped",
  "implement",
  "implements",
  "implemented",
  "build",
  "builds",
  "built",
  "set up",
  "sets up",
  "setup",
];

// Resource-like tokens to extract from AC text. Conservative — only tokens
// that look like identifiers (repos, file paths, code-fenced names, gaia
// commands). Plain english words are ignored to keep false positives low.
const RESOURCE_PATTERNS = [
  // backtick code fences: `foo-bar`, `path/to/thing`
  /`([^`\n]{2,80})`/g,
  // path-like tokens: foo/bar, foo/bar/baz
  /\b([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+)\b/g,
  // slash-commands: /gaia-foo
  /(\/gaia-[a-z0-9-]+)/g,
  // repo-like tokens: gaia-public, gaia-enterprise, foo-bar-baz (kebab, 2+ segments)
  /\b([a-z][a-z0-9]*(?:-[a-z0-9]+){1,})\b/g,
];

/**
 * Extract AC text block from a story markdown body.
 * Returns the text between "## Acceptance Criteria" and the next "## " heading.
 */
export function extractAcceptanceCriteria(markdown) {
  if (typeof markdown !== "string") return "";
  const re = /##\s+Acceptance Criteria\s*\n([\s\S]*?)(?=\n##\s|\n?$)/i;
  const m = markdown.match(re);
  return m ? m[1].trim() : "";
}

/**
 * Extract Tasks/Subtasks text block from a story markdown body.
 */
export function extractTasks(markdown) {
  if (typeof markdown !== "string") return "";
  const re = /##\s+Tasks\s*\/?\s*Subtasks\s*\n([\s\S]*?)(?=\n##\s|\n?$)/i;
  const m = markdown.match(re);
  return m ? m[1].trim() : "";
}

/**
 * Tokenize resource-like identifiers out of a text blob.
 * Returns a lowercased, deduplicated Set.
 */
export function tokenizeResources(text) {
  const out = new Set();
  if (typeof text !== "string" || text.length === 0) return out;
  for (const pattern of RESOURCE_PATTERNS) {
    // reset regex state — these are /g
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const raw = (m[1] || m[0] || "").trim().toLowerCase();
      if (raw.length < 3) continue;
      // strip leading/trailing punctuation
      const cleaned = raw.replace(/^[^a-z0-9/]+|[^a-z0-9/]+$/g, "");
      if (cleaned.length < 3) continue;
      // skip pure english stopword-y tokens
      if (/^[a-z]+$/.test(cleaned) && cleaned.length < 6) continue;
      out.add(cleaned);
    }
  }
  return out;
}

/**
 * Return the subset of `acTokens` that `tasksText` "creates".
 * A token is considered created if any create-verb appears within 80
 * characters before the token on the same line or the preceding line.
 */
export function findCreatedTokens(tasksText, acTokens) {
  const created = new Set();
  if (typeof tasksText !== "string" || acTokens.size === 0) return created;
  const lower = tasksText.toLowerCase();
  for (const token of acTokens) {
    const idx = lower.indexOf(token);
    if (idx === -1) continue;
    // Look at the 120 chars preceding this occurrence for a create-verb.
    const windowStart = Math.max(0, idx - 120);
    const window = lower.slice(windowStart, idx);
    for (const verb of CREATE_VERBS) {
      // word-boundary match on the verb
      const re = new RegExp(`\\b${verb.replace(/\s+/g, "\\s+")}\\b`);
      if (re.test(window)) {
        created.add(token);
        break;
      }
    }
  }
  return created;
}

/**
 * Lint a list of stories in sprint order.
 *
 * @param {Array<{key: string, title?: string, order: number, markdown: string}>} stories
 *        Each story has its sprint position (order, lower = earlier).
 * @returns {Array<{consumer: string, producer: string, token: string, message: string}>}
 */
export function lintSprintPlan(stories) {
  if (!Array.isArray(stories) || stories.length < 2) return [];
  const parsed = stories.map((s) => {
    const ac = extractAcceptanceCriteria(s.markdown || "");
    const tasks = extractTasks(s.markdown || "");
    return {
      key: s.key,
      title: s.title || "",
      order: typeof s.order === "number" ? s.order : 0,
      acTokens: tokenizeResources(ac),
      tasks,
    };
  });

  const warnings = [];
  for (const consumer of parsed) {
    if (consumer.acTokens.size === 0) continue;
    for (const producer of parsed) {
      if (producer.key === consumer.key) continue;
      // Only flag when producer is scheduled at-or-after the consumer
      // (forward reference — the consumer can't rely on it yet).
      if (producer.order < consumer.order) continue;
      const createdOverlap = findCreatedTokens(producer.tasks, consumer.acTokens);
      for (const token of createdOverlap) {
        warnings.push({
          consumer: consumer.key,
          producer: producer.key,
          token,
          message:
            `Dependency inversion: ${consumer.key} acceptance criteria reference "${token}", ` +
            `which ${producer.key} creates (${producer.key} is scheduled ` +
            (producer.order === consumer.order
              ? `in the same wave`
              : `after ${consumer.key}`) +
            `). Suggested fix: move ${producer.key} before ${consumer.key}, or mark ` +
            `${consumer.key} as depends_on ${producer.key}.`,
        });
      }
    }
  }
  return warnings;
}

/**
 * Format warnings as a human-readable block for sprint-planning output.
 */
export function formatWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return "Dependency inversion lint: no issues found.";
  }
  const lines = [
    `Dependency inversion lint: ${warnings.length} warning(s) found.`,
    "",
  ];
  for (const w of warnings) {
    lines.push(`  - ${w.message}`);
  }
  return lines.join("\n");
}
