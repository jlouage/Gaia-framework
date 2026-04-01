import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { walkFiles } from "../helpers/fs-walk.js";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

// ─── File Content Cache ──────────────────────────────────────

const fileContentCache = new Map();

function readCached(filePath) {
  if (!fileContentCache.has(filePath)) {
    fileContentCache.set(filePath, readFileSync(filePath, "utf8"));
  }
  return fileContentCache.get(filePath);
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Discover all slash command files via recursive walk.
 * Auto-discovery — no hardcoded counts.
 */
function findCommandFiles() {
  const commandDir = join(PROJECT_ROOT, ".claude", "commands");
  return walkFiles(commandDir, { namePattern: "gaia*.md", exclude: ["node_modules"] }).sort();
}

/**
 * Parse YAML frontmatter from a command file.
 */
function parseFrontmatter(filePath) {
  const content = readCached(filePath);
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const result = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w[\w_-]*)\s*:\s*['"]?(.+?)['"]?\s*$/);
    if (m) result[m[1]] = m[2];
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Reference extraction patterns, ordered by specificity.
 * Each entry: [type, regex] — first match wins.
 */
const REFERENCE_PATTERNS = [
  // Workflow: "Pass {project-root}/_gaia/.../workflow.yaml as 'workflow-config'"
  ["workflow", /Pass\s+\{project-root\}(\/[^\s]+\/workflow\.yaml)\s+as\s+'workflow-config'/],
  // Agent: "LOAD ... {project-root}/_gaia/.../agents/{name}.md"
  ["agent", /LOAD[^\n]*\{project-root\}(\/[^\s]+\/agents\/[^\s]+\.md)/],
  // Orchestrator: "LOAD ... {project-root}/_gaia/.../orchestrator.md"
  ["orchestrator", /LOAD[^\n]*\{project-root\}(\/[^\s]+\/orchestrator\.md)/],
  // Task via runner: "Pass {project-root}/_gaia/.../tasks/*.xml as 'task-config'"
  ["task", /Pass\s+\{project-root\}(\/[^\s]+\/tasks\/[^\s]+\.xml)\s+as\s+'task-config'/],
  // Task direct: "LOAD ... {project-root}/_gaia/.../tasks/*.xml|md"
  ["task", /LOAD[^\n]*\{project-root\}(\/[^\s]+\/tasks\/[^\s]+\.(?:xml|md))/],
  // Utility file: inline {project-root}/_gaia/... file reference
  ["utility", /\{project-root\}(\/_gaia\/[^\s,)]+\.(?:yaml|xml|md|csv))/],
  // Utility dir: inline {project-root}/_gaia/.../ directory reference
  ["utility-dir", /\{project-root\}(\/_gaia\/[^\s,)]+\/)/],
  // Memory dir: inline {project-root}/_memory/.../ directory reference (ADR-013)
  ["memory-dir", /\{project-root\}(\/_memory\/[^\s,)]+\/)/],
];

/**
 * Extract the target reference path from a command file's <steps> block.
 * Returns { type, path } or null.
 */
function extractReference(filePath) {
  const content = readCached(filePath);
  for (const [type, pattern] of REFERENCE_PATTERNS) {
    const match = content.match(pattern);
    if (match) return { type, path: match[1] };
  }
  return null;
}

/**
 * Parse a CSV file and return array of objects keyed by header row.
 */
function parseCsv(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  return lines.slice(1).map((line) => {
    const values = line.match(/(".*?"|[^,]+)/g) || [];
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || "").replace(/"/g, "").trim();
    });
    return row;
  });
}

/**
 * Build a map from agent file path → command file path.
 * Scans all gaia-agent-*.md command files, extracts the agent .md path they LOAD,
 * and maps it back. Handles naming mismatches between manifest names and
 * command file names (e.g., manifest "typescript-dev" → command "gaia-agent-dev-typescript.md").
 */
function buildAgentCommandMap() {
  const commandDir = join(PROJECT_ROOT, ".claude", "commands");
  const agentCommandFiles = walkFiles(commandDir, { namePattern: "gaia-agent-*.md" });

  const map = {};
  for (const cmdFile of agentCommandFiles) {
    const content = readCached(cmdFile);
    const match = content.match(/LOAD[^\n]*\{project-root\}(\/_gaia\/[^\s]+\/agents\/[^\s]+\.md)/);
    if (match) {
      map[match[1].replace(/^\//, "")] = cmdFile;
    }
  }
  return map;
}

// ─── Deprecated Command Detection ───────────────────────────

/**
 * Check if a command file is deprecated based on its frontmatter description.
 * Returns true if the description contains "DEPRECATED" (case-insensitive).
 */
function isDeprecatedCommand(filePath) {
  const fm = parseFrontmatter(filePath);
  if (!fm?.description) return false;
  return fm.description.toUpperCase().includes("DEPRECATED");
}

/**
 * Classify a command file into a category.
 * Deprecated commands are detected first (via frontmatter description).
 * Non-deprecated commands are classified by their reference pattern type.
 * Categories: deprecated, workflow, agent, orchestrator, task, utility, utility-dir, memory-dir, unknown
 */
function classifyCommand(filePath) {
  if (isDeprecatedCommand(filePath)) return "deprecated";
  const ref = extractReference(filePath);
  return ref ? ref.type : "unknown";
}

// ─── Test Data ───────────────────────────────────────────────

const commandFiles = findCommandFiles();

const workflowManifestPath = join(PROJECT_ROOT, "_gaia", "_config", "workflow-manifest.csv");
const agentManifestPath = join(PROJECT_ROOT, "_gaia", "_config", "agent-manifest.csv");

// ─── AC1 + AC2: Forward Reference Validation ────────────────

describe("Slash Command Forward References (AC1, AC2)", () => {
  it("should discover slash command files", () => {
    expect(commandFiles.length).toBeGreaterThan(0);
  });

  describe.each(commandFiles)("%s", (filePath) => {
    it("should have a parseable reference target", () => {
      // Deprecated commands without workflow references are exempt (AC1)
      if (isDeprecatedCommand(filePath)) {
        const ref = extractReference(filePath);
        if (!ref) return; // deprecated + no ref = OK
        // deprecated + has ref = still validate it resolves (handled by next test)
        return;
      }
      const ref = extractReference(filePath);
      expect(ref, `No workflow/agent/orchestrator reference found in ${filePath}`).not.toBeNull();
    });

    it("should reference an existing file or directory on disk", () => {
      const ref = extractReference(filePath);
      if (!ref) return;
      const resolvedPath = join(PROJECT_ROOT, ref.path);
      expect(
        existsSync(resolvedPath),
        `Orphaned command: ${filePath} references ${resolvedPath} which does not exist`
      ).toBe(true);
    });
  });
});

// ─── AC3a: Workflow Manifest → Command Coverage ─────────────

describe("Workflow Manifest → Command Coverage (AC3a)", () => {
  it("should find workflow-manifest.csv", () => {
    expect(existsSync(workflowManifestPath)).toBe(true);
  });

  const workflowManifest = existsSync(workflowManifestPath) ? parseCsv(workflowManifestPath) : [];

  it("should have workflow manifest entries", () => {
    expect(workflowManifest.length).toBeGreaterThan(0);
  });

  describe.each(
    workflowManifest.filter((row) => row.command).map((row) => [row.command, row.name])
  )("command '%s' (workflow: %s)", (commandName) => {
    it("should have a matching .md file in .claude/commands/", () => {
      const commandFilePath = join(PROJECT_ROOT, ".claude", "commands", `${commandName}.md`);
      expect(
        existsSync(commandFilePath),
        `Manifest entry '${commandName}' has no command file at ${commandFilePath}`
      ).toBe(true);
    });
  });
});

// ─── AC3b: Agent Manifest → Command Coverage ────────────────

describe("Agent Manifest → Command Coverage (AC3b)", () => {
  it("should find agent-manifest.csv", () => {
    expect(existsSync(agentManifestPath)).toBe(true);
  });

  const agentManifest = existsSync(agentManifestPath) ? parseCsv(agentManifestPath) : [];

  // Exclusions: _base-dev (abstract base), orchestrator (uses gaia.md)
  const agentsWithCommands = agentManifest.filter(
    (row) => row.name && row.name !== "_base-dev" && row.name !== "orchestrator"
  );

  it("should have agent manifest entries", () => {
    expect(agentsWithCommands.length).toBeGreaterThan(0);
  });

  const agentCommandMap = buildAgentCommandMap();

  describe.each(agentsWithCommands.map((row) => [row.name, row.path]))(
    "agent '%s' (path: %s)",
    (agentName, agentPath) => {
      it("should have a command file that references its agent .md", () => {
        const commandFile = agentCommandMap[agentPath];
        expect(
          commandFile,
          `Agent '${agentName}' (${agentPath}) has no command file referencing it`
        ).toBeTruthy();
      });
    }
  );
});

// ─── AC5: YAML Frontmatter Validation ───────────────────────

describe("Slash Command Frontmatter Validation (AC5)", () => {
  const validModels = ["opus", "sonnet"];

  describe.each(commandFiles)("%s", (filePath) => {
    it("should have parseable YAML frontmatter", () => {
      const fm = parseFrontmatter(filePath);
      expect(fm, `No YAML frontmatter found in ${filePath}`).not.toBeNull();
    });

    it("should have a 'name' field", () => {
      const fm = parseFrontmatter(filePath);
      expect(fm?.name, `Missing 'name' in frontmatter of ${filePath}`).toBeTruthy();
    });

    it("should have a 'description' field", () => {
      const fm = parseFrontmatter(filePath);
      expect(fm?.description, `Missing 'description' in frontmatter of ${filePath}`).toBeTruthy();
    });

    it("should have a valid 'model' field (opus or sonnet)", () => {
      const fm = parseFrontmatter(filePath);
      expect(fm?.model, `Missing 'model' in frontmatter of ${filePath}`).toBeTruthy();
      expect(
        validModels.includes(fm?.model),
        `Invalid model '${fm?.model}' in ${filePath} — must be opus or sonnet`
      ).toBe(true);
    });
  });
});

// ─── Deprecated Command Validation ─────────────────────────

describe("Deprecated Command Handling", () => {
  const deprecatedFiles = commandFiles.filter((f) => isDeprecatedCommand(f));

  it("should detect at least one deprecated command", () => {
    expect(deprecatedFiles.length).toBeGreaterThan(0);
  });

  describe.each(
    deprecatedFiles.length > 0 ? deprecatedFiles : ["__placeholder__"]
  )("%s", (filePath) => {
    it("should have a description containing DEPRECATED", () => {
      if (filePath === "__placeholder__") return; // skip placeholder
      const fm = parseFrontmatter(filePath);
      expect(fm?.description).toBeTruthy();
      expect(
        fm.description.toUpperCase().includes("DEPRECATED"),
        `Deprecated command ${filePath} should have DEPRECATED in description`
      ).toBe(true);
    });

    it("should be classified as deprecated", () => {
      if (filePath === "__placeholder__") return;
      expect(classifyCommand(filePath)).toBe("deprecated");
    });

    it("should validate redirect reference if present", () => {
      if (filePath === "__placeholder__") return;
      const ref = extractReference(filePath);
      if (ref) {
        const resolvedPath = join(PROJECT_ROOT, ref.path);
        expect(
          existsSync(resolvedPath),
          `Deprecated command ${filePath} has redirect reference to ${resolvedPath} which does not exist`
        ).toBe(true);
      }
      // If no reference, that's OK for deprecated commands — no assertion needed
    });

    it("should have a valid description explaining the deprecation when no reference exists", () => {
      if (filePath === "__placeholder__") return;
      const ref = extractReference(filePath);
      if (!ref) {
        const fm = parseFrontmatter(filePath);
        expect(
          fm?.description?.length,
          `Deprecated command ${filePath} without a reference must have a description explaining deprecation`
        ).toBeGreaterThan(10);
      }
    });
  });
});
