/**
 * E17-S5: Bridge Layer 1 — Test Runner Discovery
 *
 * Second layer of the Test Execution Bridge (ADR-028, architecture §10.20).
 * Auto-discovers which test runners are configured for the project so the
 * correct runner can be invoked without manual configuration.
 *
 * Inputs (read-only):
 *   1. test-environment.yaml — explicit runner declarations + primary_runner
 *   2. package.json — scripts.test and devDependencies
 *
 * Priority (highest to lowest):
 *   1. test-environment.yaml entry (explicit author intent)
 *   2. package.json scripts.test (runtime contract)
 *   3. devDependency presence (inference)
 *
 * Layer 1 is strictly read-only — it parses configuration files and emits
 * a structured runner manifest for Layer 2. It NEVER executes test commands.
 *
 * Traces to: FR-196, FR-201, ADR-028 | Test cases: TEB-21 to TEB-25
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ─── Known JS test runners (inferred from devDependencies) ─────────────────

const KNOWN_JS_RUNNERS = ["vitest", "jest", "mocha", "bats"];

const DEFAULT_COMMANDS = {
  vitest: "vitest run",
  jest: "jest",
  mocha: "mocha",
  bats: "bats test/",
};

// Patterns used to identify a runner invocation inside a `scripts.test` string.
const SCRIPT_RUNNER_PATTERNS = [
  { pattern: /\bvitest\b/, runner: "vitest" },
  { pattern: /\bjest\b/, runner: "jest" },
  { pattern: /\bmocha\b/, runner: "mocha" },
  { pattern: /\bbats\b/, runner: "bats" },
];

// ─── Safe file helpers ──────────────────────────────────────────────────────

function readJsonSafe(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readTextSafe(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

// ─── Minimal YAML parser (scoped to the manifest schema) ───────────────────
//
// The repo already ships a richer parser in
// _gaia/core/validators/test-environment-validator.js, but Layer 1 lives in
// src/bridge/ and must not reach into _gaia/. To avoid a cross-tree import we
// inline a small schema-aware parser that handles exactly what Layer 1 needs:
// top-level scalars, a list of runner maps, and an optional `tiers` sub-map.
//
// Supported: `key: value`, `- key: value` list items followed by indented
// sibling `key: value` lines, nested `key:` sub-maps (one level), and inline
// flow sequences `[a, b, c]`.

function parseScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseFlowSequence(raw) {
  return raw
    .slice(1, -1)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseScalar);
}

function parseTestEnvironmentYaml(text) {
  const result = {};
  const lines = text.split("\n");

  let topKey = null;
  let currentList = null; // list of runner maps
  let currentMap = null; // current nested map (e.g., tiers)
  let currentSubKey = null; // nested sub-map key inside currentMap

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trimStart();

    // Top-level key
    if (indent === 0 && trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.substring(0, colonIdx).trim();
      const val = trimmed.substring(colonIdx + 1).trim();

      topKey = key;
      currentList = null;
      currentMap = null;
      currentSubKey = null;

      if (val === "") {
        // Nested structure follows
        continue;
      }
      result[key] = parseScalar(val);
      topKey = null;
      continue;
    }

    // List item under top-level key (e.g., runners)
    if (trimmed.startsWith("- ") && topKey) {
      if (currentList === null) {
        currentList = [];
        result[topKey] = currentList;
      }
      const itemText = trimmed.substring(2).trim();
      if (itemText.includes(":")) {
        const colonIdx = itemText.indexOf(":");
        const k = itemText.substring(0, colonIdx).trim();
        const v = itemText.substring(colonIdx + 1).trim();
        currentList.push({ [k]: parseScalar(v) });
      } else {
        currentList.push(parseScalar(itemText));
      }
      continue;
    }

    // Indented `key: value` — either a sibling field of the last list item
    // or a nested map under topKey.
    if (indent > 0 && trimmed.includes(":") && topKey) {
      const colonIdx = trimmed.indexOf(":");
      const k = trimmed.substring(0, colonIdx).trim();
      const v = trimmed.substring(colonIdx + 1).trim();

      // Append to last list entry when we're inside a list
      if (currentList && currentList.length > 0) {
        const last = currentList[currentList.length - 1];
        if (typeof last === "object" && last !== null) {
          if (v === "") {
            last[k] = {};
          } else if (v.startsWith("[") && v.endsWith("]")) {
            last[k] = parseFlowSequence(v);
          } else {
            last[k] = parseScalar(v);
          }
          continue;
        }
      }

      // Otherwise it's a nested map under topKey
      if (currentMap === null) {
        currentMap = {};
        result[topKey] = currentMap;
      }

      if (v === "") {
        currentSubKey = k;
        if (!currentMap[k]) currentMap[k] = {};
        continue;
      }

      const target =
        currentSubKey && currentMap[currentSubKey]
          ? currentMap[currentSubKey]
          : currentMap;

      if (v.startsWith("[") && v.endsWith("]")) {
        target[k] = parseFlowSequence(v);
      } else {
        target[k] = parseScalar(v);
      }
    }
  }

  return result;
}

// ─── Source-specific detectors ──────────────────────────────────────────────

/**
 * Detect runners declared in test-environment.yaml.
 * Returns: { runners: Array<entry>, primaryRunnerName: string|null, tiers: object }
 */
function detectFromTestEnvironment(projectPath) {
  const path = join(projectPath, "test-environment.yaml");
  const content = readTextSafe(path);
  if (!content) {
    return { runners: [], primaryRunnerName: null, tiers: {} };
  }

  let parsed;
  try {
    parsed = parseTestEnvironmentYaml(content);
  } catch {
    return { runners: [], primaryRunnerName: null, tiers: {} };
  }

  const rawRunners = Array.isArray(parsed.runners) ? parsed.runners : [];
  const tiers = parsed.tiers && typeof parsed.tiers === "object" ? parsed.tiers : {};

  const runners = rawRunners
    .filter((r) => r && typeof r === "object" && r.name && r.command)
    .map((r) => ({
      runner_name: String(r.name),
      command: String(r.command),
      source: "test-environment.yaml",
      tier_mapping: resolveTierMapping(r.tier, tiers),
      tier: r.tier ?? null,
    }));

  return {
    runners,
    primaryRunnerName: parsed.primary_runner || null,
    tiers,
  };
}

/**
 * Map a tier number to its gate list from the top-level `tiers` block.
 * Returns null when no mapping is defined for the tier.
 */
function resolveTierMapping(tier, tiers) {
  if (tier === null || tier === undefined) return null;
  const entry = tiers[tier] || tiers[String(tier)];
  if (!entry || typeof entry !== "object") return null;
  return {
    tier,
    gates: Array.isArray(entry.gates) ? entry.gates : [],
  };
}

/**
 * Detect runners inferred from package.json (devDependencies + scripts.test).
 * Returns an array of manifest entries, each tagged with a `source` string
 * so callers can apply priority ranking.
 */
function detectFromPackageJson(projectPath) {
  const pkg = readJsonSafe(join(projectPath, "package.json"));
  if (!pkg) return [];

  const entries = [];
  const seen = new Set();

  // Highest package.json priority: the `test` script names a known runner.
  const testScript = pkg.scripts?.test;
  if (typeof testScript === "string" && testScript.trim() !== "") {
    for (const { pattern, runner } of SCRIPT_RUNNER_PATTERNS) {
      if (pattern.test(testScript)) {
        entries.push({
          runner_name: runner,
          command: testScript,
          source: "package.json:scripts.test",
          tier_mapping: null,
          tier: null,
        });
        seen.add(runner);
        break; // One runner per test script is sufficient
      }
    }
  }

  // Lower priority: runner present only as a devDependency.
  const devDeps = pkg.devDependencies || {};
  for (const runner of KNOWN_JS_RUNNERS) {
    if (runner in devDeps && !seen.has(runner)) {
      entries.push({
        runner_name: runner,
        command: DEFAULT_COMMANDS[runner],
        source: "package.json:devDependencies",
        tier_mapping: null,
        tier: null,
      });
      seen.add(runner);
    }
  }

  return entries;
}

// ─── Ranking ────────────────────────────────────────────────────────────────

const SOURCE_PRIORITY = {
  "test-environment.yaml": 0,
  "package.json:scripts.test": 1,
  "package.json:devDependencies": 2,
};

function rankEntries(entries) {
  return [...entries].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 99;
    const pb = SOURCE_PRIORITY[b.source] ?? 99;
    return pa - pb;
  });
}

/**
 * Collapse entries that refer to the same runner_name, keeping the
 * highest-priority source.
 */
function dedupeByRunnerName(rankedEntries) {
  const seen = new Map();
  for (const entry of rankedEntries) {
    if (!seen.has(entry.runner_name)) {
      seen.set(entry.runner_name, entry);
    }
  }
  return [...seen.values()];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RunnerManifestEntry
 * @property {string} runner_name   — canonical runner name (e.g., "vitest")
 * @property {string} command       — CLI command to invoke the runner
 * @property {string} source        — detection source (priority ranking key)
 * @property {object|null} tier_mapping — tier + gates mapping (from test-environment.yaml)
 *
 * @typedef {Object} DiscoveryResultOk
 * @property {"ok"} status
 * @property {RunnerManifestEntry} primary  — selected runner for Layer 2
 * @property {{ primary_runner: RunnerManifestEntry, runners: RunnerManifestEntry[] }} manifest
 *
 * @typedef {Object} DiscoveryResultDisambiguation
 * @property {"disambiguation"} status
 * @property {RunnerManifestEntry[]} candidates
 *
 * @typedef {Object} DiscoveryResultError
 * @property {"error"} status
 * @property {string} message
 */

/**
 * Discover the test runners configured for a project.
 *
 * @param {object} options
 * @param {string} options.projectPath — absolute path to the project root
 * @param {object} [options.config]    — resolved GAIA config; when
 *   `config.test_execution_bridge.bridge_enabled` is explicitly false the
 *   call short-circuits with `{ status: "ok", skipped: true }` (NFR-035).
 * @returns {Promise<DiscoveryResultOk | DiscoveryResultDisambiguation | DiscoveryResultError>}
 */
export async function discoverRunners({ projectPath, config = {} } = {}) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("discoverRunners: projectPath is required");
  }

  // NFR-035 — honour the bridge_enabled opt-in toggle when present.
  if (config?.test_execution_bridge?.bridge_enabled === false) {
    return {
      status: "ok",
      skipped: true,
      primary: null,
      manifest: { primary_runner: null, runners: [] },
    };
  }

  // 1. Explicit declarations from test-environment.yaml
  const {
    runners: envRunners,
    primaryRunnerName,
  } = detectFromTestEnvironment(projectPath);

  // 2. Inferred runners from package.json
  const pkgRunners = detectFromPackageJson(projectPath);

  // 3. Combine and rank by source priority, then de-dupe by runner_name.
  const ranked = dedupeByRunnerName(rankEntries([...envRunners, ...pkgRunners]));

  if (ranked.length === 0) {
    return {
      status: "error",
      message:
        "No test runner found. Declare one in test-environment.yaml at the project root, or add a test runner (vitest, jest, mocha, bats) to package.json.",
    };
  }

  // 4. Primary selection:
  //    a. If test-environment.yaml declared a primary_runner, honour it.
  //    b. Otherwise if exactly one runner was detected, use it.
  //    c. Otherwise require disambiguation.
  let primary = null;

  if (primaryRunnerName) {
    primary =
      ranked.find(
        (r) =>
          r.source === "test-environment.yaml" &&
          r.runner_name === primaryRunnerName
      ) || ranked.find((r) => r.runner_name === primaryRunnerName);
  }

  if (!primary) {
    // When test-environment.yaml contributed any runners without specifying
    // a primary, treat its top-ranked entry as the implicit primary — the
    // author's file is authoritative even when they forgot the field.
    const topEnv = ranked.find((r) => r.source === "test-environment.yaml");
    if (topEnv) {
      primary = topEnv;
    } else if (ranked.length === 1) {
      primary = ranked[0];
    } else {
      // Priority-based tie-break (AC2): group by source priority tier. If a
      // single entry dominates the top tier, it is the primary. Otherwise
      // multiple entries share the top tier and disambiguation is required.
      const topPriority = SOURCE_PRIORITY[ranked[0].source] ?? 99;
      const topTier = ranked.filter(
        (r) => (SOURCE_PRIORITY[r.source] ?? 99) === topPriority
      );
      if (topTier.length === 1) {
        primary = topTier[0];
      } else {
        return {
          status: "disambiguation",
          candidates: topTier,
          message:
            "Multiple test runners detected. Set `primary_runner` in test-environment.yaml or pick one interactively.",
        };
      }
    }
  }

  return {
    status: "ok",
    primary,
    manifest: {
      primary_runner: primary,
      runners: ranked,
    },
  };
}
