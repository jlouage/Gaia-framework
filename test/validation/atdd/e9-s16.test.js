import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const MEMORY_ROOT = resolve(PROJECT_ROOT, "../_memory");
const CONFIG_PATH = join(MEMORY_ROOT, "config.yaml");

// The 9 untiered agents that E9-S16 must formalize
const FORMERLY_UNTIERED_AGENTS = [
  { id: "analyst", sidecarDir: "analyst-sidecar" },
  { id: "brainstorming-coach", sidecarDir: "brainstorming-coach-sidecar" },
  { id: "data-engineer", sidecarDir: "data-engineer-sidecar" },
  { id: "design-thinking-coach", sidecarDir: "design-thinking-coach-sidecar" },
  { id: "innovation-strategist", sidecarDir: "innovation-strategist-sidecar" },
  { id: "performance", sidecarDir: "performance-sidecar" },
  { id: "presentation-designer", sidecarDir: "presentation-designer-sidecar" },
  { id: "problem-solver", sidecarDir: "problem-solver-sidecar" },
  { id: "ux-designer", sidecarDir: "ux-designer-sidecar" },
];

// Existing tier assignments that must NOT change
const EXISTING_TIER_1 = ["validator", "architect", "pm", "sm"];
const EXISTING_TIER_2 = ["orchestrator", "security", "devops", "test-architect"];
const EXISTING_TIER_3_ORIGINAL = [
  "typescript-dev", "angular-dev", "flutter-dev", "java-dev",
  "python-dev", "mobile-dev", "storyteller", "tech-writer", "qa",
];

/**
 * Parse the agents list from a tier block in config.yaml using regex.
 * Matches: agents: [agent1, agent2, ...] within a tier block.
 */
function parseTierAgents(content, tierName) {
  const tierPattern = new RegExp(`${tierName}:[\\s\\S]*?agents:\\s*\\[([^\\]]+)\\]`);
  const match = content.match(tierPattern);
  if (!match) return [];
  return match[1].split(",").map((a) => a.trim()).filter(Boolean);
}

/**
 * Parse per-agent sidecar entries from the agents: section.
 */
function parseAgentSidecar(content, agentId) {
  const pattern = new RegExp(`\\b${agentId.replace("-", "\\-")}:\\s*\\n\\s+sidecar:\\s+(\\S+)`);
  const match = content.match(pattern);
  return match ? match[1] : null;
}

describe("E9-S16: Formalize Untiered Agent Tier Assignments", () => {
  const configContent = readFileSync(CONFIG_PATH, "utf8");

  // AC1: All 9 untiered agents have tier assignments, each in exactly one tier
  describe("AC1: Every sidecar agent appears in exactly one tier", () => {
    it("should have all 9 previously-untiered agents in a tier list", () => {
      const tier1 = parseTierAgents(configContent, "tier_1");
      const tier2 = parseTierAgents(configContent, "tier_2");
      const tier3 = parseTierAgents(configContent, "tier_3");
      const allTiered = [...tier1, ...tier2, ...tier3];

      for (const agent of FORMERLY_UNTIERED_AGENTS) {
        expect(allTiered, `${agent.id} not found in any tier`).toContain(agent.id);
      }
    });

    it("should have each agent in exactly one tier (no duplicates across tiers)", () => {
      const tier1 = parseTierAgents(configContent, "tier_1");
      const tier2 = parseTierAgents(configContent, "tier_2");
      const tier3 = parseTierAgents(configContent, "tier_3");
      const all = [...tier1, ...tier2, ...tier3];
      const duplicates = all.filter((a, i) => all.indexOf(a) !== i);
      expect(duplicates, `Duplicate agents across tiers: ${duplicates.join(", ")}`).toEqual([]);
    });

    it("should have every on-disk sidecar directory represented in a tier", () => {
      const dirs = readdirSync(MEMORY_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.endsWith("-sidecar"))
        .map((d) => d.name.replace(/-sidecar$/, ""));

      const tier1 = parseTierAgents(configContent, "tier_1");
      const tier2 = parseTierAgents(configContent, "tier_2");
      const tier3 = parseTierAgents(configContent, "tier_3");
      const allTiered = [...tier1, ...tier2, ...tier3];

      const untiered = dirs.filter((d) => !allTiered.includes(d));
      expect(untiered, `Sidecar dirs with no tier: ${untiered.join(", ")}`).toEqual([]);
    });
  });

  // AC2: Tier assignments are consistent with agent responsibilities
  describe("AC2: Tier assignments match classification criteria", () => {
    it("should assign all 9 agents to Tier 3 (session-based/consultative)", () => {
      const tier3 = parseTierAgents(configContent, "tier_3");
      for (const agent of FORMERLY_UNTIERED_AGENTS) {
        expect(tier3, `${agent.id} should be in Tier 3`).toContain(agent.id);
      }
    });
  });

  // AC3: Memory-hygiene emits zero warnings about untiered agents
  describe("AC3: Zero untiered agent warnings", () => {
    it("should have zero agents with sidecar directories but no tier assignment", () => {
      const tier1 = parseTierAgents(configContent, "tier_1");
      const tier2 = parseTierAgents(configContent, "tier_2");
      const tier3 = parseTierAgents(configContent, "tier_3");
      const allTiered = [...tier1, ...tier2, ...tier3];

      const dirs = readdirSync(MEMORY_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.endsWith("-sidecar"))
        .map((d) => d.name.replace(/-sidecar$/, ""));

      const missing = dirs.filter((d) => !allTiered.includes(d));
      expect(missing.length, `Untiered agents: ${missing.join(", ")}`).toBe(0);
    });
  });

  // AC4: Sidecar fields match on-disk directories
  describe("AC4: Sidecar fields match on-disk directory names", () => {
    for (const agent of FORMERLY_UNTIERED_AGENTS) {
      it(`should have a per-agent sidecar entry for ${agent.id}`, () => {
        const sidecar = parseAgentSidecar(configContent, agent.id);
        expect(sidecar, `Missing sidecar entry for ${agent.id}`).toBe(agent.sidecarDir);
      });
    }

    it("should have sidecar directories on disk for all 9 agents", () => {
      for (const agent of FORMERLY_UNTIERED_AGENTS) {
        const dir = join(MEMORY_ROOT, agent.sidecarDir);
        expect(existsSync(dir), `Sidecar directory missing: ${dir}`).toBe(true);
      }
    });
  });

  // Existing tiers must be unchanged
  describe("Existing tiers unchanged", () => {
    it("should preserve Tier 1 agents unchanged", () => {
      const tier1 = parseTierAgents(configContent, "tier_1");
      for (const agent of EXISTING_TIER_1) {
        expect(tier1, `${agent} missing from Tier 1`).toContain(agent);
      }
      expect(tier1.length).toBe(EXISTING_TIER_1.length);
    });

    it("should preserve Tier 2 agents unchanged", () => {
      const tier2 = parseTierAgents(configContent, "tier_2");
      for (const agent of EXISTING_TIER_2) {
        expect(tier2, `${agent} missing from Tier 2`).toContain(agent);
      }
      expect(tier2.length).toBe(EXISTING_TIER_2.length);
    });

    it("should preserve existing Tier 3 agents", () => {
      const tier3 = parseTierAgents(configContent, "tier_3");
      for (const agent of EXISTING_TIER_3_ORIGINAL) {
        expect(tier3, `${agent} missing from Tier 3`).toContain(agent);
      }
    });
  });

  // YAML validity — basic structural check
  describe("YAML validity", () => {
    it("should contain required top-level sections", () => {
      expect(configContent).toContain("tiers:");
      expect(configContent).toContain("agents:");
      expect(configContent).toContain("cross_references:");
      expect(configContent).toContain("archival:");
    });

    it("should have valid tier structure", () => {
      expect(configContent).toMatch(/tier_1:[\s\S]*?agents:\s*\[/);
      expect(configContent).toMatch(/tier_2:[\s\S]*?agents:\s*\[/);
      expect(configContent).toMatch(/tier_3:[\s\S]*?agents:\s*\[/);
    });
  });
});
