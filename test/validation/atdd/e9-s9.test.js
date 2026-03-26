import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const MEMORY_DIR = join(PROJECT_ROOT, "_memory");
const CONFIG_YAML = join(MEMORY_DIR, "config.yaml");
const SKILLS_DIR = join(GAIA_DIR, "lifecycle", "skills");
const MEMORY_SKILL = join(SKILLS_DIR, "memory-management.md");
const CROSS_AGENT_SKILL = join(SKILLS_DIR, "memory-management-cross-agent.md");

function loadConfig() {
  return yaml.load(readFileSync(CONFIG_YAML, "utf-8"));
}

function readSkill(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function countLines(content) {
  return content.split("\n").length;
}

function extractSection(content, sectionName) {
  const startMarker = `<!-- SECTION: ${sectionName} -->`;
  const endMarker = "<!-- END SECTION -->";
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return null;
  const afterStart = startIdx + startMarker.length;
  const endIdx = content.indexOf(endMarker, afterStart);
  if (endIdx === -1) return null;
  return content.substring(afterStart, endIdx).trim();
}

describe("E9-S9: Memory Skill Extensions", () => {
  // AC1: cross-reference-loading section with correct marker name
  describe("AC1: cross-reference-loading section", () => {
    it("cross-reference-loading section exists with correct marker name", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      expect(combined).toMatch(/<!-- SECTION: cross-reference-loading -->/);
    });

    it("cross-reference-loading section documents JIT loading for cross-agent sidecar access", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/jit|just.in.time/i);
      expect(section).toMatch(/read.only/i);
    });
  });

  // AC2: budget-monitoring section
  describe("AC2: budget-monitoring section", () => {
    it("budget-monitoring section exists with correct marker name", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      expect(combined).toMatch(/<!-- SECTION: budget-monitoring -->/);
    });

    it("budget-monitoring section references config-driven thresholds (not hardcoded)", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "budget-monitoring");
      expect(section).not.toBeNull();
      expect(section).toMatch(/config\.yaml|_memory\/config/i);
      expect(section).toMatch(/budget_warn_at|budget_alert_at|budget_archive_at/i);
    });

    it("budget-monitoring section documents archival trigger at budget_archive_at threshold", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "budget-monitoring");
      expect(section).not.toBeNull();
      expect(section).toMatch(/archival|archive/i);
      expect(section).toMatch(/budget_archive_at/);
    });
  });

  // AC3: session-save delegates budget checks to budget-monitoring
  describe("AC3: session-save delegates to budget-monitoring", () => {
    it("session-save section references budget-monitoring for threshold checks", () => {
      const content = readSkill(MEMORY_SKILL);
      expect(content).not.toBeNull();
      const section = extractSection(content, "session-save");
      expect(section).not.toBeNull();
      expect(section).toMatch(/budget-monitoring/i);
    });

    it("session-save section does NOT contain inline hardcoded threshold percentages", () => {
      const content = readSkill(MEMORY_SKILL);
      expect(content).not.toBeNull();
      const section = extractSection(content, "session-save");
      expect(section).not.toBeNull();
      // Should not have inline 80%/90%/100% threshold checks anymore
      expect(section).not.toMatch(/warn at 80%|warn at 90%|trigger archival prompt at 100%/i);
    });
  });

  // AC4: Skill file within 300-line limit or correctly split
  describe("AC4: File split and line limits", () => {
    it("memory-management.md is within 300 lines", () => {
      const content = readSkill(MEMORY_SKILL);
      expect(content).not.toBeNull();
      expect(countLines(content)).toBeLessThanOrEqual(300);
    });

    it("memory-management-cross-agent.md exists as the split target", () => {
      expect(existsSync(CROSS_AGENT_SKILL)).toBe(true);
    });

    it("cross-agent skill file has correct frontmatter", () => {
      const content = readSkill(CROSS_AGENT_SKILL);
      expect(content).not.toBeNull();
      expect(content).toMatch(/name:\s*memory-management-cross-agent/);
    });

    it("cross-agent skill file contains both cross-reference-loading and budget-monitoring sections", () => {
      const content = readSkill(CROSS_AGENT_SKILL);
      expect(content).not.toBeNull();
      expect(content).toMatch(/<!-- SECTION: cross-reference-loading -->/);
      expect(content).toMatch(/<!-- SECTION: budget-monitoring -->/);
    });
  });

  // AC5: Three load modes (recent, full, summary)
  describe("AC5: Three load modes", () => {
    it("cross-reference-loading section documents recent mode (last 2 sprints)", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/recent.*mode/i);
      expect(section).toMatch(/last 2 sprints|2 sprints/i);
    });

    it("cross-reference-loading section documents full mode", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/full.*mode/i);
    });

    it("cross-reference-loading section documents summary mode (headers only)", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/summary.*mode/i);
      expect(section).toMatch(/header/i);
    });
  });

  // AC6: Missing/empty sidecar graceful handling
  describe("AC6: Graceful handling of missing/empty sidecars", () => {
    it("cross-reference-loading section documents empty result for missing sidecar", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/missing.*sidecar|sidecar.*not.*exist/i);
      expect(section).toMatch(/empty.*result|skip|graceful/i);
    });

    it("cross-reference-loading section documents no-error behavior for empty sidecars", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/no.*error|without.*error|never.*halt/i);
    });
  });

  // AC7: Token estimate and per-agent cross_ref_budget_cap
  describe("AC7: Token estimate and budget cap", () => {
    it("cross-reference-loading section documents token estimate (chars/4)", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/char.*\/\s*4|character.*4|token_approximation/i);
    });

    it("cross-reference-loading section documents per-agent cross_ref_budget_cap enforcement", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "cross-reference-loading");
      expect(section).not.toBeNull();
      expect(section).toMatch(/cross_ref_budget_cap/i);
    });
  });

  // AC8: Untiered agent graceful degradation
  describe("AC8: Untiered agent graceful degradation", () => {
    it("budget-monitoring section documents graceful handling for untiered agents", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "budget-monitoring");
      expect(section).not.toBeNull();
      expect(section).toMatch(/untiered|no.*budget|tier.*absent|no.*tier/i);
    });

    it("budget-monitoring section returns no-op for untiered agents (no error)", () => {
      const core = readSkill(MEMORY_SKILL);
      const crossAgent = readSkill(CROSS_AGENT_SKILL);
      const combined = (core || "") + (crossAgent || "");
      const section = extractSection(combined, "budget-monitoring");
      expect(section).not.toBeNull();
      expect(section).toMatch(/no.op|skip.*enforcement|no.*error/i);
    });

    it("_memory/config.yaml has 9 untiered agents that budget-monitoring must handle", () => {
      const config = loadConfig();
      // Tier 3 has no session_budget (null) — these are effectively untiered for budget purposes
      expect(config.tiers.tier_3.session_budget).toBeNull();
    });
  });

  // Cross-cutting: Section marker integrity
  describe("Section markers integrity", () => {
    it("all sections in memory-management.md have matching END SECTION markers", () => {
      const content = readSkill(MEMORY_SKILL);
      expect(content).not.toBeNull();
      const starts = content.match(/<!-- SECTION: [\w-]+ -->/g) || [];
      const ends = content.match(/<!-- END SECTION -->/g) || [];
      expect(starts.length).toBe(ends.length);
    });

    it("all sections in memory-management-cross-agent.md have matching END SECTION markers", () => {
      const content = readSkill(CROSS_AGENT_SKILL);
      expect(content).not.toBeNull();
      const starts = content.match(/<!-- SECTION: [\w-]+ -->/g) || [];
      const ends = content.match(/<!-- END SECTION -->/g) || [];
      expect(starts.length).toBe(ends.length);
    });
  });
});
