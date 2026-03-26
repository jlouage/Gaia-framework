import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const MEMORY_DIR = join(PROJECT_ROOT, "_memory");
const CONFIG_YAML = join(MEMORY_DIR, "config.yaml");

// Helper: find agent persona file by agent ID
function findAgentFile(agentId) {
  const searchPaths = [
    join(GAIA_DIR, "lifecycle", "agents", `${agentId}.md`),
    join(GAIA_DIR, "core", "agents", `${agentId}.md`),
    join(GAIA_DIR, "testing", "agents", `${agentId}.md`),
    join(GAIA_DIR, "dev", "agents", `${agentId}.md`),
  ];

  for (const filePath of searchPaths) {
    if (existsSync(filePath)) {
      return { path: filePath, content: readFileSync(filePath, "utf-8") };
    }
  }
  return null;
}

// Helper: parse <cross-ref> tags from agent file content
function parseCrossRefs(content) {
  const crossRefRegex = /<cross-ref\s+([^>]*)\/?\s*>/gi;
  const refs = [];
  let match;
  while ((match = crossRefRegex.exec(content)) !== null) {
    const attrs = match[1];
    const agent = (attrs.match(/agent=["']([^"']+)["']/i) || [])[1];
    const file = (attrs.match(/file=["']([^"']+)["']/i) || [])[1];
    const mode = (attrs.match(/mode=["']([^"']+)["']/i) || [])[1];
    const requiredMatch = attrs.match(/required=["']([^"']+)["']/i);
    const required = requiredMatch ? requiredMatch[1] : "true";
    refs.push({ agent, file, mode, required });
  }
  return refs;
}

// Helper: check if content has <memory-reads> block
function hasMemoryReads(content) {
  return /<memory-reads>[\s\S]*<\/memory-reads>/i.test(content);
}

// Load _memory/config.yaml cross_references
function loadCrossRefMatrix() {
  const content = readFileSync(CONFIG_YAML, "utf-8");
  const config = yaml.load(content);
  return config.cross_references || {};
}

// Memory-management skill paths (core + cross-agent companion file)
const MEMORY_SKILL_PATH = join(GAIA_DIR, "lifecycle", "skills", "memory-management.md");
const CROSS_AGENT_SKILL_PATH = join(
  GAIA_DIR,
  "lifecycle",
  "skills",
  "memory-management-cross-agent.md"
);

// Helper: read combined content from both skill files (core + cross-agent)
function readMemorySkillContent() {
  let content = readFileSync(MEMORY_SKILL_PATH, "utf-8");
  if (existsSync(CROSS_AGENT_SKILL_PATH)) {
    content += "\n" + readFileSync(CROSS_AGENT_SKILL_PATH, "utf-8");
  }
  return content;
}

// All tiered agents per config.yaml
const TIER_1_AGENTS = ["validator", "architect", "pm", "sm"];
const TIER_2_AGENTS = ["orchestrator", "security", "devops", "test-architect"];
const _DEV_AGENTS = [
  "typescript-dev",
  "angular-dev",
  "flutter-dev",
  "java-dev",
  "python-dev",
  "mobile-dev",
  "go-dev",
];

describe("E9-S6: Cross-Agent Read-Only Memory Access", () => {
  // AC1: Read-only cross-references — no write to foreign sidecars
  describe("AC1: Read-only cross-references", () => {
    it("memory-management skill has cross-ref-loading section with load_cross_ref", () => {
      const content = readMemorySkillContent();
      expect(content).toMatch(/<!-- SECTION: cross-ref(?:erence)?-loading -->/);
      expect(content).toMatch(/load_cross_ref/i);
    });

    it("memory-management skill has write-guard for foreign sidecars", () => {
      const content = readMemorySkillContent();
      expect(content).toMatch(/write.guard|hard.error|write.*block/i);
    });

    it("cross-ref tags in persona files use only read modes (recent, full, summary)", () => {
      const allAgents = [...TIER_1_AGENTS, ...TIER_2_AGENTS, "_base-dev"];
      for (const agentId of allAgents) {
        const agentFile = findAgentFile(agentId);
        if (!agentFile) continue;
        const refs = parseCrossRefs(agentFile.content);
        for (const ref of refs) {
          expect(
            ["recent", "full", "summary"].includes(ref.mode),
            `${agentId}: invalid mode "${ref.mode}" — only recent, full, summary allowed`
          ).toBe(true);
        }
      }
    });
  });

  // AC2: <memory-reads> declarations in all 17 tiered agents
  describe("AC2: <memory-reads> declarations", () => {
    it("all Tier 1 agents have <memory-reads> blocks", () => {
      for (const agentId of TIER_1_AGENTS) {
        const agentFile = findAgentFile(agentId);
        expect(agentFile, `Agent file not found: ${agentId}.md`).not.toBeNull();
        expect(
          hasMemoryReads(agentFile.content),
          `${agentId}.md missing <memory-reads> block`
        ).toBe(true);
      }
    });

    it("all Tier 2 agents have <memory-reads> blocks", () => {
      for (const agentId of TIER_2_AGENTS) {
        const agentFile = findAgentFile(agentId);
        expect(agentFile, `Agent file not found: ${agentId}.md`).not.toBeNull();
        expect(
          hasMemoryReads(agentFile.content),
          `${agentId}.md missing <memory-reads> block`
        ).toBe(true);
      }
    });

    it("_base-dev has <memory-reads> block (inherited by all dev agents)", () => {
      const agentFile = findAgentFile("_base-dev");
      expect(agentFile, "_base-dev.md not found").not.toBeNull();
      expect(hasMemoryReads(agentFile.content), "_base-dev.md missing <memory-reads> block").toBe(
        true
      );
    });

    it("cross-ref tags have required agent, file, and mode attributes", () => {
      const allAgents = [...TIER_1_AGENTS, ...TIER_2_AGENTS, "_base-dev"];
      for (const agentId of allAgents) {
        const agentFile = findAgentFile(agentId);
        if (!agentFile || !hasMemoryReads(agentFile.content)) continue;
        const refs = parseCrossRefs(agentFile.content);
        expect(
          refs.length,
          `${agentId}.md has <memory-reads> but no <cross-ref> tags`
        ).toBeGreaterThan(0);
        for (const ref of refs) {
          expect(ref.agent, `${agentId}.md: <cross-ref> missing agent attribute`).toBeDefined();
          expect(ref.file, `${agentId}.md: <cross-ref> missing file attribute`).toBeDefined();
          expect(ref.mode, `${agentId}.md: <cross-ref> missing mode attribute`).toBeDefined();
        }
      }
    });
  });

  // AC3a: Val reads Theo, Derek, Nate in full mode with 50% cap
  describe("AC3a: Val cross-references", () => {
    it("Val has cross-refs to architect, pm, sm decision-logs in full mode", () => {
      const agentFile = findAgentFile("validator");
      expect(agentFile, "validator.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      const expected = [
        { agent: "architect", file: "decision-log", mode: "full" },
        { agent: "pm", file: "decision-log", mode: "full" },
        { agent: "sm", file: "decision-log", mode: "full" },
      ];
      for (const exp of expected) {
        const found = refs.find(
          (r) => r.agent === exp.agent && r.file === exp.file && r.mode === exp.mode
        );
        expect(
          found,
          `Val missing cross-ref: agent=${exp.agent} file=${exp.file} mode=${exp.mode}`
        ).toBeDefined();
      }
    });
  });

  // AC3b: Theo, Derek, Nate cross-references
  describe("AC3b: Tier 1 agent cross-references", () => {
    it("Theo reads Derek decision-log + Val ground-truth in recent mode", () => {
      const agentFile = findAgentFile("architect");
      expect(agentFile, "architect.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      expect(
        refs.find((r) => r.agent === "pm" && r.file === "decision-log" && r.mode === "recent"),
        "Theo missing: pm/decision-log/recent"
      ).toBeDefined();
      expect(
        refs.find(
          (r) => r.agent === "validator" && r.file === "ground-truth" && r.mode === "recent"
        ),
        "Theo missing: validator/ground-truth/recent"
      ).toBeDefined();
    });

    it("Derek reads Theo decision-log + Nate ground-truth in recent mode", () => {
      const agentFile = findAgentFile("pm");
      expect(agentFile, "pm.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      expect(
        refs.find(
          (r) => r.agent === "architect" && r.file === "decision-log" && r.mode === "recent"
        ),
        "Derek missing: architect/decision-log/recent"
      ).toBeDefined();
      expect(
        refs.find((r) => r.agent === "sm" && r.file === "ground-truth" && r.mode === "recent"),
        "Derek missing: sm/ground-truth/recent"
      ).toBeDefined();
    });

    it("Nate reads Theo + Derek decision-logs + Val ground-truth in recent mode", () => {
      const agentFile = findAgentFile("sm");
      expect(agentFile, "sm.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      expect(
        refs.find(
          (r) => r.agent === "architect" && r.file === "decision-log" && r.mode === "recent"
        ),
        "Nate missing: architect/decision-log/recent"
      ).toBeDefined();
      expect(
        refs.find((r) => r.agent === "pm" && r.file === "decision-log" && r.mode === "recent"),
        "Nate missing: pm/decision-log/recent"
      ).toBeDefined();
      expect(
        refs.find(
          (r) => r.agent === "validator" && r.file === "ground-truth" && r.mode === "recent"
        ),
        "Nate missing: validator/ground-truth/recent"
      ).toBeDefined();
    });
  });

  // AC3c: Gaia reads all Tier 1 conversation-context in summary mode
  describe("AC3c: Gaia/orchestrator cross-references", () => {
    it("Gaia reads all Tier 1 conversation-context in summary mode", () => {
      const agentFile = findAgentFile("orchestrator");
      expect(agentFile, "orchestrator.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      const tier1Agents = ["validator", "architect", "pm", "sm"];
      for (const agent of tier1Agents) {
        const found = refs.find(
          (r) => r.agent === agent && r.file === "conversation-context" && r.mode === "summary"
        );
        expect(
          found,
          `Gaia missing cross-ref: ${agent}/conversation-context/summary`
        ).toBeDefined();
      }
    });
  });

  // AC3d: Tier 2 agents (Zara, Soren, Sable)
  describe("AC3d: Tier 2 agent cross-references", () => {
    it("Zara reads Theo decision-log + Val ground-truth in recent mode", () => {
      const agentFile = findAgentFile("security");
      expect(agentFile, "security.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      expect(
        refs.find(
          (r) => r.agent === "architect" && r.file === "decision-log" && r.mode === "recent"
        ),
        "Zara missing: architect/decision-log/recent"
      ).toBeDefined();
      expect(
        refs.find(
          (r) => r.agent === "validator" && r.file === "ground-truth" && r.mode === "recent"
        ),
        "Zara missing: validator/ground-truth/recent"
      ).toBeDefined();
    });

    it("Soren reads Theo decision-log in recent mode", () => {
      const agentFile = findAgentFile("devops");
      expect(agentFile, "devops.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      expect(
        refs.find(
          (r) => r.agent === "architect" && r.file === "decision-log" && r.mode === "recent"
        ),
        "Soren missing: architect/decision-log/recent"
      ).toBeDefined();
    });

    it("Sable reads Theo decision-log + Val ground-truth in recent mode", () => {
      const agentFile = findAgentFile("test-architect");
      expect(agentFile, "test-architect.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      expect(
        refs.find(
          (r) => r.agent === "architect" && r.file === "decision-log" && r.mode === "recent"
        ),
        "Sable missing: architect/decision-log/recent"
      ).toBeDefined();
      expect(
        refs.find(
          (r) => r.agent === "validator" && r.file === "ground-truth" && r.mode === "recent"
        ),
        "Sable missing: validator/ground-truth/recent"
      ).toBeDefined();
    });
  });

  // AC3e: Dev agents read Val ground-truth + Theo decision-log
  describe("AC3e: Dev agent cross-references via _base-dev", () => {
    it("_base-dev has cross-refs to validator ground-truth + architect decision-log in recent mode", () => {
      const agentFile = findAgentFile("_base-dev");
      expect(agentFile, "_base-dev.md not found").not.toBeNull();
      const refs = parseCrossRefs(agentFile.content);
      expect(
        refs.find(
          (r) => r.agent === "validator" && r.file === "ground-truth" && r.mode === "recent"
        ),
        "_base-dev missing: validator/ground-truth/recent"
      ).toBeDefined();
      expect(
        refs.find(
          (r) => r.agent === "architect" && r.file === "decision-log" && r.mode === "recent"
        ),
        "_base-dev missing: architect/decision-log/recent"
      ).toBeDefined();
    });
  });

  // AC4: JIT loading — not at session start
  describe("AC4: JIT cross-reference loading", () => {
    it("memory-management skill documents JIT loading for cross-refs", () => {
      const content = readMemorySkillContent();
      expect(content).toMatch(/jit|just.in.time/i);
      expect(content).not.toMatch(/preload.*cross.ref|eager.*cross.ref/i);
    });
  });

  // AC5: Budget enforcement — Tier 1: 300K, Tier 2: 100K, Val 50% cap
  describe("AC5: Budget enforcement", () => {
    it("memory-management skill documents progressive downgrade chain", () => {
      const content = readMemorySkillContent();
      // Must document the downgrade chain: full -> recent -> summary -> skip
      expect(content).toMatch(/full.*recent.*summary.*skip|progressive.*downgrade/i);
    });

    it("memory-management skill documents Val 50% cross-ref budget cap", () => {
      const content = readMemorySkillContent();
      expect(content).toMatch(/50%|cross_ref_budget_cap|150K|150,?000/i);
    });

    it("_memory/config.yaml has tier budgets and Val cross-ref cap", () => {
      const content = readFileSync(CONFIG_YAML, "utf-8");
      const config = yaml.load(content);
      expect(config.tiers.tier_1.session_budget).toBe(300000);
      expect(config.tiers.tier_2.session_budget).toBe(100000);
      expect(config.cross_references.validator.cross_ref_budget_cap).toBe(0.5);
    });
  });

  // AC6: Graceful handling of missing/corrupt sidecars
  describe("AC6: Graceful error handling", () => {
    it("memory-management skill documents graceful handling of missing sidecars", () => {
      const content = readMemorySkillContent();
      // Must document: log warning, skip, continue
      expect(content).toMatch(/missing.*sidecar|absent.*sidecar/i);
      expect(content).toMatch(/warn|warning/i);
      expect(content).toMatch(/skip.*continue|graceful/i);
    });

    it("memory-management skill documents handling of malformed sidecars", () => {
      const content = readMemorySkillContent();
      expect(content).toMatch(/malformed|corrupt|unparseable/i);
    });
  });

  // AC7: Consistency validation — persona vs config.yaml
  describe("AC7: Consistency validation", () => {
    it("memory-management skill documents consistency validation procedure", () => {
      const content = readMemorySkillContent();
      expect(content).toMatch(/consistency.*valid|config\.yaml.*authoritative/i);
    });

    it("memory-management skill documents self-reference guard", () => {
      const content = readMemorySkillContent();
      expect(content).toMatch(/self.reference|own.*sidecar/i);
    });

    it("all persona <memory-reads> declarations match _memory/config.yaml matrix", () => {
      const matrix = loadCrossRefMatrix();

      // Check each agent in the matrix against its persona file
      const agentMapping = {
        architect: "architect",
        pm: "pm",
        sm: "sm",
        orchestrator: "orchestrator",
        security: "security",
        devops: "devops",
        "test-architect": "test-architect",
        validator: "validator",
      };

      for (const [matrixKey, agentId] of Object.entries(agentMapping)) {
        if (!matrix[matrixKey]) continue;
        const agentFile = findAgentFile(agentId);
        if (!agentFile) continue;
        const personaRefs = parseCrossRefs(agentFile.content);
        const configRefs = matrix[matrixKey].reads_from || [];

        for (const configRef of configRefs) {
          const found = personaRefs.find(
            (r) =>
              r.agent === configRef.agent && r.file === configRef.file && r.mode === configRef.mode
          );
          expect(
            found,
            `Mismatch: ${agentId} persona missing cross-ref declared in config.yaml: agent=${configRef.agent} file=${configRef.file} mode=${configRef.mode}`
          ).toBeDefined();
        }
      }
    });
  });
});
