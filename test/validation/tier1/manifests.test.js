import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";
import { walkFiles } from "../helpers/fs-walk.js";
const CONFIG_PATH = join(PROJECT_ROOT, "_gaia", "_config");

/**
 * Parse a CSV file into an array of objects.
 * Handles quoted fields with commas inside them.
 */
function parseCSV(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Run a find command under _gaia/ and return paths relative to PROJECT_ROOT.
 * @param {string} findArgs - arguments appended to `find -L _gaia/`
 * @param {(abs: string) => string} [mapFn] - optional transform per result (default: relative path)
 */
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
// walkFiles returns forward-slash paths; normalize root for consistent relative path computation
const ROOT_PREFIX = PROJECT_ROOT.replace(/\\/g, "/") + "/";

function toRelative(absPath) {
  return absPath.startsWith(ROOT_PREFIX) ? absPath.slice(ROOT_PREFIX.length) : absPath;
}

function findWorkflowDirsOnDisk() {
  const files = walkFiles(GAIA_DIR, {
    namePattern: "workflow.yaml",
    exclude: ["node_modules", "_backups", ".resolved"],
  });
  return files.map((f) => {
    const rel = toRelative(f);
    // Remove trailing /workflow.yaml to get the directory
    return rel.replace(/\/workflow\.yaml$/, "");
  });
}

function findAgentFilesOnDisk() {
  const files = walkFiles(GAIA_DIR, {
    namePattern: "*.md",
    exclude: ["node_modules", "_backups"],
  });
  return files
    .filter((f) => f.includes("/agents/") && !f.includes("/_config/agents/"))
    .map(toRelative);
}

function findSkillFilesOnDisk() {
  const files = walkFiles(GAIA_DIR, {
    namePattern: "*.md",
    exclude: ["node_modules", "_backups"],
  });
  return files
    .filter((f) => f.includes("/skills/") && !f.endsWith("_skill-index.yaml"))
    .map(toRelative);
}

function findTaskFilesOnDisk() {
  const mdFiles = walkFiles(GAIA_DIR, {
    namePattern: "*.md",
    exclude: ["node_modules", "_backups"],
  }).filter((f) => f.includes("/tasks/"));
  const xmlFiles = walkFiles(GAIA_DIR, {
    namePattern: "*.xml",
    exclude: ["node_modules", "_backups"],
  }).filter((f) => f.includes("/tasks/"));
  return [...mdFiles, ...xmlFiles].map(toRelative);
}

// ─── Load manifests ───────────────────────────────────────────────

const workflowManifest = parseCSV(join(CONFIG_PATH, "workflow-manifest.csv"));
const agentManifest = parseCSV(join(CONFIG_PATH, "agent-manifest.csv"));
const skillManifest = parseCSV(join(CONFIG_PATH, "skill-manifest.csv"));
const taskManifest = parseCSV(join(CONFIG_PATH, "task-manifest.csv"));
const filesManifest = parseCSV(join(CONFIG_PATH, "files-manifest.csv"));

// ─── AC1: Every workflow-manifest entry has a corresponding workflow directory ─

describe("Manifest-Filesystem Sync Validation (E1-S5)", () => {
  describe("AC1: workflow-manifest → filesystem", () => {
    it("should have workflow-manifest entries to validate", () => {
      expect(workflowManifest.length).toBeGreaterThan(0);
    });

    it.each(workflowManifest.map((w) => [w.name, w.path]))(
      "workflow '%s' should have a workflow.yaml at %s",
      (name, path) => {
        const fullPath = join(PROJECT_ROOT, path);
        expect(
          existsSync(fullPath),
          `Workflow '${name}' references ${path} but file does not exist`
        ).toBe(true);
      }
    );
  });

  // ─── AC2: Every agent-manifest entry has a corresponding agent file ───

  describe("AC2: agent-manifest → filesystem", () => {
    it("should have agent-manifest entries to validate", () => {
      expect(agentManifest.length).toBeGreaterThan(0);
    });

    it.each(agentManifest.map((a) => [a.name, a.path]))(
      "agent '%s' should have a file at %s",
      (name, path) => {
        const fullPath = join(PROJECT_ROOT, path);
        expect(
          existsSync(fullPath),
          `Agent '${name}' references ${path} but file does not exist`
        ).toBe(true);
      }
    );
  });

  // ─── AC3: Every skill-manifest entry has a corresponding skill file ───

  describe("AC3: skill-manifest → filesystem", () => {
    it("should have skill-manifest entries to validate", () => {
      expect(skillManifest.length).toBeGreaterThan(0);
    });

    it.each(skillManifest.map((s) => [s.name, s.path]))(
      "skill '%s' should have a file at %s",
      (name, path) => {
        const fullPath = join(PROJECT_ROOT, path);
        expect(
          existsSync(fullPath),
          `Skill '${name}' references ${path} but file does not exist`
        ).toBe(true);
      }
    );
  });

  // ─── AC4: Every task-manifest entry has a corresponding task file ─────

  describe("AC4: task-manifest → filesystem", () => {
    it("should have task-manifest entries to validate", () => {
      expect(taskManifest.length).toBeGreaterThan(0);
    });

    it.each(taskManifest.map((t) => [t.name, t.path]))(
      "task '%s' should have a file at %s",
      (name, path) => {
        const fullPath = join(PROJECT_ROOT, path);
        expect(
          existsSync(fullPath),
          `Task '${name}' references ${path} but file does not exist`
        ).toBe(true);
      }
    );
  });

  // ─── AC5: Every files-manifest entry has a corresponding file ───────────

  describe("AC5: files-manifest → filesystem", () => {
    it("should have files-manifest entries to validate", () => {
      expect(filesManifest.length).toBeGreaterThan(0);
    });

    it.each(filesManifest.map((f) => [f.path, f.type]))(
      "file '%s' (%s) should exist on disk",
      (path, type) => {
        const fullPath = join(PROJECT_ROOT, path);
        expect(
          existsSync(fullPath),
          `files-manifest entry '${path}' (type: ${type}) does not exist on disk`
        ).toBe(true);
      }
    );
  });

  // ─── AC6: Reverse check — every file on disk has a manifest entry ─────

  describe("AC6: filesystem → manifest (reverse check)", () => {
    const workflowPaths = new Set(workflowManifest.map((w) => w.path));
    const agentPaths = new Set(agentManifest.map((a) => a.path));
    const skillPaths = new Set(skillManifest.map((s) => s.path));
    const taskPaths = new Set(taskManifest.map((t) => t.path));

    describe("workflows on disk → workflow-manifest", () => {
      const diskWorkflows = findWorkflowDirsOnDisk();

      it("should find workflow directories on disk", () => {
        expect(diskWorkflows.length).toBeGreaterThan(0);
      });

      it.each(diskWorkflows.map((w) => [w]))(
        "workflow at %s should have a manifest entry",
        (dirPath) => {
          // Use forward-slash concatenation to match CSV paths (join() uses OS separators)
          const yamlPath = `${dirPath}/workflow.yaml`;
          expect(
            workflowPaths.has(yamlPath),
            `Workflow directory '${dirPath}' exists on disk but has no entry in workflow-manifest.csv (expected path: ${yamlPath})`
          ).toBe(true);
        }
      );
    });

    describe("agents on disk → agent-manifest", () => {
      const diskAgents = findAgentFilesOnDisk();

      it("should find agent files on disk", () => {
        expect(diskAgents.length).toBeGreaterThan(0);
      });

      it.each(diskAgents.map((a) => [a]))(
        "agent at %s should have a manifest entry",
        (filePath) => {
          expect(
            agentPaths.has(filePath),
            `Agent file '${filePath}' exists on disk but has no entry in agent-manifest.csv`
          ).toBe(true);
        }
      );
    });

    describe("skills on disk → skill-manifest", () => {
      const diskSkills = findSkillFilesOnDisk();

      it("should find skill files on disk", () => {
        expect(diskSkills.length).toBeGreaterThan(0);
      });

      it.each(diskSkills.map((s) => [s]))(
        "skill at %s should have a manifest entry",
        (filePath) => {
          expect(
            skillPaths.has(filePath),
            `Skill file '${filePath}' exists on disk but has no entry in skill-manifest.csv`
          ).toBe(true);
        }
      );
    });

    describe("tasks on disk → task-manifest", () => {
      const diskTasks = findTaskFilesOnDisk();

      it("should find task files on disk", () => {
        expect(diskTasks.length).toBeGreaterThan(0);
      });

      it.each(diskTasks.map((t) => [t]))("task at %s should have a manifest entry", (filePath) => {
        expect(
          taskPaths.has(filePath),
          `Task file '${filePath}' exists on disk but has no entry in task-manifest.csv`
        ).toBe(true);
      });
    });
  });

  // ─── AC6: No orphaned entries, no missing entries (summary) ───────────

  describe("AC6: no orphaned or missing entries", () => {
    it("should have zero orphaned workflow-manifest entries (manifest → disk)", () => {
      const orphaned = workflowManifest.filter((w) => !existsSync(join(PROJECT_ROOT, w.path)));
      expect(
        orphaned,
        `Orphaned workflow entries: ${orphaned.map((w) => w.name).join(", ")}`
      ).toHaveLength(0);
    });

    it("should have zero orphaned agent-manifest entries (manifest → disk)", () => {
      const orphaned = agentManifest.filter((a) => !existsSync(join(PROJECT_ROOT, a.path)));
      expect(
        orphaned,
        `Orphaned agent entries: ${orphaned.map((a) => a.name).join(", ")}`
      ).toHaveLength(0);
    });

    it("should have zero orphaned skill-manifest entries (manifest → disk)", () => {
      const orphaned = skillManifest.filter((s) => !existsSync(join(PROJECT_ROOT, s.path)));
      expect(
        orphaned,
        `Orphaned skill entries: ${orphaned.map((s) => s.name).join(", ")}`
      ).toHaveLength(0);
    });

    it("should have zero orphaned task-manifest entries (manifest → disk)", () => {
      const orphaned = taskManifest.filter((t) => !existsSync(join(PROJECT_ROOT, t.path)));
      expect(
        orphaned,
        `Orphaned task entries: ${orphaned.map((t) => t.name).join(", ")}`
      ).toHaveLength(0);
    });

    it("should have zero orphaned files-manifest entries (manifest → disk)", () => {
      const orphaned = filesManifest.filter((f) => !existsSync(join(PROJECT_ROOT, f.path)));
      expect(
        orphaned,
        `Orphaned files-manifest entries: ${orphaned.map((f) => f.path).join(", ")}`
      ).toHaveLength(0);
    });

    it("should have zero missing workflow entries (disk → manifest)", () => {
      const workflowPaths = new Set(workflowManifest.map((w) => w.path));
      const missing = findWorkflowDirsOnDisk().filter(
        (d) => !workflowPaths.has(`${d}/workflow.yaml`)
      );
      expect(missing, `Missing workflow manifest entries for: ${missing.join(", ")}`).toHaveLength(
        0
      );
    });

    it("should have zero missing agent entries (disk → manifest)", () => {
      const agentPaths = new Set(agentManifest.map((a) => a.path));
      const missing = findAgentFilesOnDisk().filter((f) => !agentPaths.has(f));
      expect(missing, `Missing agent manifest entries for: ${missing.join(", ")}`).toHaveLength(0);
    });

    it("should have zero missing skill entries (disk → manifest)", () => {
      const skillPaths = new Set(skillManifest.map((s) => s.path));
      const missing = findSkillFilesOnDisk().filter((f) => !skillPaths.has(f));
      expect(missing, `Missing skill manifest entries for: ${missing.join(", ")}`).toHaveLength(0);
    });

    it("should have zero missing task entries (disk → manifest)", () => {
      const taskPaths = new Set(taskManifest.map((t) => t.path));
      const missing = findTaskFilesOnDisk().filter((f) => !taskPaths.has(f));
      expect(missing, `Missing task manifest entries for: ${missing.join(", ")}`).toHaveLength(0);
    });
  });
});
