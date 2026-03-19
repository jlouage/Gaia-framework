import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { execSync } from "child_process";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

// Agent file locations by module
const AGENT_DIRS = {
  core: `${PROJECT_ROOT}/_gaia/core/agents`,
  dev: `${PROJECT_ROOT}/_gaia/dev/agents`,
  lifecycle: `${PROJECT_ROOT}/_gaia/lifecycle/agents`,
  creative: `${PROJECT_ROOT}/_gaia/creative/agents`,
  testing: `${PROJECT_ROOT}/_gaia/testing/agents`,
};

// ADR-014 tier assignments
const TIER_1_AGENTS = ["architect", "pm", "sm", "validator"]; // 3 files: ground-truth, decision-log, conversation-context
const TIER_2_AGENTS = ["orchestrator", "devops", "security", "test-architect"]; // 2 files: decision-log, conversation-context
// Tier 3: all others — 1 file: decision-log

const TIER_1_FILES = ["ground-truth.md", "decision-log.md", "conversation-context.md"];
const TIER_2_FILES = ["decision-log.md", "conversation-context.md"];
const TIER_3_FILES = ["decision-log.md"];

// Map agent IDs to their file paths
function findAllAgentFiles() {
  const files = [];
  for (const [module, dir] of Object.entries(AGENT_DIRS)) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".md") && file !== "_base-dev.md") {
        files.push({ module, file, path: join(dir, file) });
      }
    }
  }
  return files;
}

function getAgentId(filename) {
  return filename.replace(".md", "");
}

describe("E8-S2: Agent Persona Sidecar Path Updates", () => {
  // AC1: No remaining _gaia/_memory references
  describe("AC1: Old path references eliminated", () => {
    it("should have zero _gaia/_memory references in agent files", () => {
      const agentFiles = findAllAgentFiles();
      const violations = [];
      for (const { path, file } of agentFiles) {
        const content = readFileSync(path, "utf8");
        if (content.includes("_gaia/_memory")) {
          violations.push(file);
        }
      }
      expect(violations, `Files still referencing _gaia/_memory: ${violations.join(", ")}`).toEqual([]);
    });

    it("should have zero _gaia/_memory references in _base-dev.md", () => {
      const baseDev = `${AGENT_DIRS.dev}/_base-dev.md`;
      const content = readFileSync(baseDev, "utf8");
      expect(content.includes("_gaia/_memory"), "_base-dev.md still references _gaia/_memory").toBe(false);
    });

    it("should have zero _gaia/_memory references in CLAUDE.md", () => {
      const claudeMd = `${PROJECT_ROOT}/CLAUDE.md`;
      const content = readFileSync(claudeMd, "utf8");
      expect(content.includes("_gaia/_memory"), "CLAUDE.md still references _gaia/_memory").toBe(false);
    });
  });

  // AC2: All agents have sidecar declarations with correct pattern
  describe("AC2: Consistent sidecar pattern", () => {
    const agentFiles = findAllAgentFiles();
    const sidecarPattern = /<memory\s+sidecar="(_memory\/[\w-]+-sidecar\/[\w-]+\.md)"\s*\/>/g;

    it("should have <memory sidecar> XML tags (not YAML frontmatter) in all agent files", () => {
      const yamlMemoryAgents = [];
      for (const { path, file } of agentFiles) {
        const content = readFileSync(path, "utf8");
        // Check for YAML frontmatter memory field (old format)
        if (/^memory:\s/m.test(content)) {
          yamlMemoryAgents.push(file);
        }
      }
      expect(yamlMemoryAgents, `Agents using YAML frontmatter memory instead of XML: ${yamlMemoryAgents.join(", ")}`).toEqual([]);
    });

    it("should have every <memory sidecar> path follow _memory/{id}-sidecar/{filename}.md pattern", () => {
      const violations = [];
      for (const { path, file } of agentFiles) {
        const content = readFileSync(path, "utf8");
        const allMemoryTags = content.matchAll(/<memory\s+sidecar="([^"]+)"\s*\/>/g);
        for (const match of allMemoryTags) {
          const sidecarPath = match[1];
          if (!/^_memory\/[\w-]+-sidecar\/[\w-]+\.md$/.test(sidecarPath)) {
            violations.push(`${file}: ${sidecarPath}`);
          }
        }
      }
      expect(violations, `Invalid sidecar paths: ${violations.join("; ")}`).toEqual([]);
    });

    it("should have at least one <memory sidecar> tag in every agent file", () => {
      const missing = [];
      for (const { path, file } of agentFiles) {
        const content = readFileSync(path, "utf8");
        if (!content.includes("<memory sidecar=")) {
          missing.push(file);
        }
      }
      expect(missing, `Agents missing <memory sidecar> tag: ${missing.join(", ")}`).toEqual([]);
    });
  });

  // AC2 continued: Tier-correct sidecar counts
  describe("AC2: Tier-correct sidecar file counts", () => {
    function countSidecarTags(filePath) {
      const content = readFileSync(filePath, "utf8");
      return (content.match(/<memory\s+sidecar="[^"]+"\s*\/>/g) || []).length;
    }

    function getSidecarFiles(filePath) {
      const content = readFileSync(filePath, "utf8");
      const matches = content.matchAll(/<memory\s+sidecar="[^"]+\/([\w-]+\.md)"\s*\/>/g);
      return [...matches].map((m) => m[1]).sort();
    }

    for (const agentId of TIER_1_AGENTS) {
      it(`should have 3 sidecar files for Tier 1 agent: ${agentId}`, () => {
        const dir = agentId === "architect" || agentId === "pm" || agentId === "sm" || agentId === "validator"
          ? AGENT_DIRS.lifecycle
          : AGENT_DIRS.core;
        const filePath = join(dir, `${agentId}.md`);
        expect(existsSync(filePath), `${agentId}.md not found`).toBe(true);
        expect(countSidecarTags(filePath)).toBe(3);
        expect(getSidecarFiles(filePath)).toEqual(TIER_1_FILES.sort());
      });
    }

    for (const agentId of TIER_2_AGENTS) {
      it(`should have 2 sidecar files for Tier 2 agent: ${agentId}`, () => {
        let dir;
        if (agentId === "orchestrator") dir = AGENT_DIRS.core;
        else if (agentId === "test-architect") dir = AGENT_DIRS.testing;
        else dir = AGENT_DIRS.lifecycle;
        const filePath = join(dir, `${agentId}.md`);
        expect(existsSync(filePath), `${agentId}.md not found`).toBe(true);
        expect(countSidecarTags(filePath)).toBe(2);
        expect(getSidecarFiles(filePath)).toEqual(TIER_2_FILES.sort());
      });
    }

    it("should have exactly 1 sidecar file for all Tier 3 agents", () => {
      const agentFiles = findAllAgentFiles();
      const tier1and2 = [...TIER_1_AGENTS, ...TIER_2_AGENTS];
      const tier3Agents = agentFiles.filter(
        ({ file }) => !tier1and2.includes(getAgentId(file)),
      );
      const wrong = [];
      for (const { path, file } of tier3Agents) {
        const count = (readFileSync(path, "utf8").match(/<memory\s+sidecar="[^"]+"\s*\/>/g) || []).length;
        if (count !== 1) {
          wrong.push(`${file}: ${count} sidecars (expected 1)`);
        }
      }
      expect(wrong, `Tier 3 agents with wrong sidecar count: ${wrong.join("; ")}`).toEqual([]);
    });
  });

  // AC3: Sidecar directories exist in _memory/
  describe("AC3: Sidecar directories exist", () => {
    it("should have _memory/ directory at project root", () => {
      expect(existsSync(`${PROJECT_ROOT}/_memory`), "_memory/ directory not found").toBe(true);
    });

    it("should have sidecar directories for all agents with <memory> tags", () => {
      const agentFiles = findAllAgentFiles();
      const missingDirs = [];
      for (const { path, file } of agentFiles) {
        const content = readFileSync(path, "utf8");
        const matches = content.matchAll(/<memory\s+sidecar="(_memory\/[\w-]+-sidecar)\/[\w-]+\.md"\s*\/>/g);
        for (const match of matches) {
          const dirPath = join(PROJECT_ROOT, match[1]);
          if (!existsSync(dirPath)) {
            missingDirs.push(`${match[1]} (from ${file})`);
          }
        }
      }
      expect(missingDirs, `Missing sidecar directories: ${missingDirs.join("; ")}`).toEqual([]);
    });
  });

  // AC4: Only memory-related lines changed (spot check via content assertions)
  describe("AC4: No unintended changes", () => {
    it("should preserve agent persona sections (spot check: orchestrator)", () => {
      const content = readFileSync(`${AGENT_DIRS.core}/orchestrator.md`, "utf8");
      expect(content).toContain("<agent");
      expect(content).toContain("<persona>");
      expect(content).toContain("<menu>");
    });

    it("should preserve agent persona sections (spot check: typescript-dev)", () => {
      const content = readFileSync(`${AGENT_DIRS.dev}/typescript-dev.md`, "utf8");
      expect(content).toContain('name="Cleo"');
      expect(content).toContain("<stack-config>");
      expect(content).toContain("<menu>");
    });

    it("should preserve agent persona sections (spot check: storyteller)", () => {
      const content = readFileSync(`${AGENT_DIRS.creative}/storyteller.md`, "utf8");
      expect(content).toContain("<agent");
      expect(content).toContain("<persona>");
    });
  });
});
