import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

// Tier 3 agents per ADR-014
const TIER_3_DEV_AGENTS = [
  {
    id: "angular-dev",
    name: "Lena",
    title: "Angular Developer",
    sidecarDir: "angular-dev-sidecar",
  },
  {
    id: "typescript-dev",
    name: "Cleo",
    title: "TypeScript Developer",
    sidecarDir: "typescript-dev-sidecar",
  },
  {
    id: "flutter-dev",
    name: "Freya",
    title: "Flutter Developer",
    sidecarDir: "flutter-dev-sidecar",
  },
  { id: "java-dev", name: "Hugo", title: "Java Developer", sidecarDir: "java-dev-sidecar" },
  { id: "python-dev", name: "Ravi", title: "Python Developer", sidecarDir: "python-dev-sidecar" },
  { id: "mobile-dev", name: "Talia", title: "Mobile Developer", sidecarDir: "mobile-dev-sidecar" },
];

const TIER_3_SUPPORTING_AGENTS = [
  {
    id: "tech-writer",
    name: "Iris",
    title: "Technical Writer",
    sidecarDir: "tech-writer-sidecar",
    personaPath: "_gaia/lifecycle/agents/tech-writer.md",
  },
  {
    id: "storyteller",
    name: "Elara",
    title: "Master Storyteller",
    sidecarDir: "storyteller-sidecar",
    personaPath: "_gaia/creative/agents/storyteller.md",
  },
  {
    id: "qa",
    name: "Vera",
    title: "QA Engineer",
    sidecarDir: "qa-sidecar",
    personaPath: "_gaia/lifecycle/agents/qa.md",
  },
];

const ALL_TIER_3_AGENTS = [
  ...TIER_3_DEV_AGENTS.map((a) => ({ ...a, personaPath: `_gaia/dev/agents/${a.id}.md` })),
  ...TIER_3_SUPPORTING_AGENTS,
];

// Untiered agents that should NOT be modified
const UNTIERED_AGENTS = [
  "analyst",
  "data-engineer",
  "performance",
  "ux-designer",
  "brainstorming-coach",
  "design-thinking-coach",
  "innovation-strategist",
  "presentation-designer",
  "problem-solver",
];

const MEMORY_ROOT = join(PROJECT_ROOT, "_memory");

describe("E9-S5: Tier 3 Dev Agent Sidecars", () => {
  // AC1: Dev agent decision-log.md files
  describe("AC1: Dev agent sidecar files", () => {
    for (const agent of TIER_3_DEV_AGENTS) {
      it(`should have decision-log.md in ${agent.sidecarDir}`, () => {
        const filePath = join(MEMORY_ROOT, agent.sidecarDir, "decision-log.md");
        expect(existsSync(filePath), `${filePath} does not exist`).toBe(true);
      });

      it(`should have correct scaffold header in ${agent.sidecarDir}/decision-log.md`, () => {
        const filePath = join(MEMORY_ROOT, agent.sidecarDir, "decision-log.md");
        const content = readFileSync(filePath, "utf8");
        expect(content).toContain(`# ${agent.name} — Decision Log`);
        expect(content).toContain(
          "Chronological record of decisions made during workflow sessions."
        );
        expect(content).toContain("---");
      });
    }

    it("should have all 6 dev agent decision-log.md files", () => {
      const found = TIER_3_DEV_AGENTS.filter((a) =>
        existsSync(join(MEMORY_ROOT, a.sidecarDir, "decision-log.md"))
      );
      expect(found.length).toBe(6);
    });
  });

  // AC2: Supporting agent decision-log.md files
  describe("AC2: Supporting agent sidecar files", () => {
    for (const agent of TIER_3_SUPPORTING_AGENTS) {
      it(`should have decision-log.md in ${agent.sidecarDir}`, () => {
        const filePath = join(MEMORY_ROOT, agent.sidecarDir, "decision-log.md");
        expect(existsSync(filePath), `${filePath} does not exist`).toBe(true);
      });

      it(`should have correct scaffold header in ${agent.sidecarDir}/decision-log.md`, () => {
        const filePath = join(MEMORY_ROOT, agent.sidecarDir, "decision-log.md");
        const content = readFileSync(filePath, "utf8");
        expect(content).toContain(`# ${agent.name} — Decision Log`);
        expect(content).toContain(
          "Chronological record of decisions made during workflow sessions."
        );
        expect(content).toContain("---");
      });
    }

    it("should have all 3 supporting agent decision-log.md files", () => {
      const found = TIER_3_SUPPORTING_AGENTS.filter((a) =>
        existsSync(join(MEMORY_ROOT, a.sidecarDir, "decision-log.md"))
      );
      expect(found.length).toBe(3);
    });
  });

  // AC3: Persona file memory declarations
  describe("AC3: Persona file memory tag verification", () => {
    for (const agent of ALL_TIER_3_AGENTS) {
      it(`should have correct <memory sidecar> tag in ${agent.id}.md`, () => {
        const filePath = join(PROJECT_ROOT, agent.personaPath);
        const content = readFileSync(filePath, "utf8");
        const expectedPath = `_memory/${agent.sidecarDir}/decision-log.md`;
        expect(content).toContain(`<memory sidecar="${expectedPath}" />`);
      });

      it(`should have exactly 1 <memory> tag in ${agent.id}.md`, () => {
        const filePath = join(PROJECT_ROOT, agent.personaPath);
        const content = readFileSync(filePath, "utf8");
        const matches = content.match(/<memory\s+sidecar="[^"]+"\s*\/>/g) || [];
        expect(
          matches.length,
          `${agent.id}.md has ${matches.length} <memory> tags, expected 1`
        ).toBe(1);
      });
    }
  });

  // AC4: Directory count verification
  describe("AC4: Exactly 9 Tier 3 sidecar directories with decision-log.md", () => {
    it("should have exactly 9 directories containing decision-log.md among Tier 3 agents", () => {
      const count = ALL_TIER_3_AGENTS.filter((a) =>
        existsSync(join(MEMORY_ROOT, a.sidecarDir, "decision-log.md"))
      ).length;
      expect(count).toBe(9);
    });

    it("should NOT have decision-log.md in untiered agent directories", () => {
      const violations = [];
      for (const agent of UNTIERED_AGENTS) {
        const filePath = join(MEMORY_ROOT, `${agent}-sidecar`, "decision-log.md");
        if (existsSync(filePath)) {
          violations.push(agent);
        }
      }
      expect(violations, `Untiered agents with decision-log.md: ${violations.join(", ")}`).toEqual(
        []
      );
    });
  });

  // AC5: config.yaml Tier 3 entries
  describe("AC5: _memory/config.yaml Tier 3 agent entries", () => {
    let configContent;

    it("should list all 9 agents under tier_3.agents", () => {
      configContent = readFileSync(join(MEMORY_ROOT, "config.yaml"), "utf8");
      const tier3Match = configContent.match(/tier_3:[\s\S]*?agents:\s*\[([^\]]+)\]/);
      expect(tier3Match, "tier_3.agents not found in config.yaml").toBeTruthy();
      const agentsList = tier3Match[1];
      for (const agent of ALL_TIER_3_AGENTS) {
        expect(agentsList, `${agent.id} not in tier_3.agents list`).toContain(agent.id);
      }
    });

    it("should have individual agents: entries with sidecar: fields for all 9 Tier 3 agents", () => {
      configContent = configContent || readFileSync(join(MEMORY_ROOT, "config.yaml"), "utf8");
      for (const agent of ALL_TIER_3_AGENTS) {
        const pattern = new RegExp(`${agent.id}:\\s*\\n\\s+sidecar:\\s+${agent.sidecarDir}`);
        expect(
          pattern.test(configContent),
          `Missing or incorrect agents entry for ${agent.id} with sidecar: ${agent.sidecarDir}`
        ).toBe(true);
      }
    });
  });
});
