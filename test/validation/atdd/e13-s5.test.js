import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

/**
 * ATDD — E13-S5: Implement Dev Agent Figma Consumption in /gaia-dev-story
 *
 * Risk: HIGH
 * Traces to: FR-138, FR-142, FR-144, FR-176, FR-177, FR-178, NFR-027, NFR-028, ADR-024
 *
 * These tests define expected behavior for the Figma consumption integration
 * in /gaia-dev-story. All tests MUST FAIL until E13-S5 is implemented (red phase).
 */

const FIGMA_SKILL_PATH = resolve(PROJECT_ROOT, "_gaia/dev/skills/figma-integration.md");

const SKILL_INDEX_PATH = resolve(PROJECT_ROOT, "_gaia/dev/skills/_skill-index.yaml");

const SKILL_MANIFEST_PATH = resolve(PROJECT_ROOT, "_gaia/_config/skill-manifest.csv");

const DEV_STORY_INSTRUCTIONS_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/dev-story/instructions.xml"
);

const BASE_DEV_AGENT_PATH = resolve(PROJECT_ROOT, "_gaia/dev/agents/_base-dev.md");

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFigmaSkill() {
  return readFileSync(FIGMA_SKILL_PATH, "utf-8");
}

function readSkillIndex() {
  return readFileSync(SKILL_INDEX_PATH, "utf-8");
}

function readSkillManifest() {
  return readFileSync(SKILL_MANIFEST_PATH, "utf-8");
}

function readDevStoryInstructions() {
  return readFileSync(DEV_STORY_INSTRUCTIONS_PATH, "utf-8");
}

function readBaseDevAgent() {
  return readFileSync(BASE_DEV_AGENT_PATH, "utf-8");
}

// ─── AC1: Extract tokens via MCP → write design-tokens.json ─────────────────

describe("AC1: Figma token extraction writes design-tokens.json", () => {
  it("figma-integration.md skill file must exist at _gaia/dev/skills/", () => {
    // RED: file does not exist yet — E13-S2 creates it, E13-S5 extends it
    expect(existsSync(FIGMA_SKILL_PATH)).toBe(true);
  });

  it("skill tokens section must describe extracting design tokens via MCP and writing design-tokens.json", () => {
    const content = readFigmaSkill();
    // RED: tokens section + design-tokens.json reference not yet in skill
    expect(content).toMatch(/<!-- SECTION: tokens -->/);
    expect(content).toMatch(/design-tokens\.json/);
  });

  it("skill tokens section must reference MCP call to extract token data", () => {
    const content = readFigmaSkill();
    // RED: MCP token extraction not yet described
    expect(content).toMatch(/<!-- SECTION: tokens -->[\s\S]*?MCP/i);
  });

  it("dev-story instructions must reference figma: metadata block check before token extraction", () => {
    const content = readDevStoryInstructions();
    // RED: figma: metadata check not yet in dev-story instructions
    expect(content).toMatch(/figma[:\s]/i);
    expect(content).toMatch(/design-tokens\.json/);
  });
});

// ─── AC2: Extract component specs → write component-specs.yaml ──────────────

describe("AC2: Figma component spec extraction writes component-specs.yaml", () => {
  it("skill components section must describe extracting component specs and writing component-specs.yaml", () => {
    const content = readFigmaSkill();
    // RED: components section not yet in skill
    expect(content).toMatch(/<!-- SECTION: components -->/);
    expect(content).toMatch(/component-specs\.yaml/);
  });

  it("dev-story instructions must reference component-specs.yaml as output target", () => {
    const content = readDevStoryInstructions();
    // RED: component-specs.yaml not yet referenced in dev-story instructions
    expect(content).toMatch(/component-specs\.yaml/);
  });
});

// ─── AC3: Active dev agent reads intermediates and generates stack-specific code

describe("AC3: Dev agent generates stack-specific scaffolded code from intermediate files", () => {
  it("base dev agent must reference figma-integration skill loading when figma: metadata is present", () => {
    const content = readBaseDevAgent();
    // RED: figma-integration skill not yet referenced in base dev agent
    expect(content).toMatch(/figma-integration/);
  });

  it("skill export section must define per-stack token resolution table", () => {
    const content = readFigmaSkill();
    // RED: export section with stack resolution table not yet present
    expect(content).toMatch(/<!-- SECTION: export -->/);
    // Must cover all 6 supported stacks
    expect(content).toMatch(/Cleo|typescript/i);
    expect(content).toMatch(/Lena|angular/i);
    expect(content).toMatch(/Freya|flutter/i);
    expect(content).toMatch(/Hugo|java/i);
    expect(content).toMatch(/Ravi|python/i);
    expect(content).toMatch(/Talia|mobile/i);
  });

  it("dev-story instructions must describe stack-specific code generation step using intermediate files", () => {
    const content = readDevStoryInstructions();
    // RED: stack-specific generation step from intermediates not yet in dev-story
    expect(content).toMatch(/stack.specific|figma.*scaffold/i);
  });
});

// ─── AC4: Story files gain optional figma: metadata block ───────────────────

describe("AC4: Story files accept optional figma: metadata block", () => {
  it("dev-story instructions must document the figma: YAML frontmatter block fields", () => {
    const content = readDevStoryInstructions();
    // RED: figma: frontmatter block spec not yet in instructions
    expect(content).toMatch(/file_key/);
    expect(content).toMatch(/node_ids/);
  });

  it("figma: metadata block must declare pages field alongside file_key and node_ids", () => {
    const content = readDevStoryInstructions();
    // RED: pages field not yet declared
    expect(content).toMatch(/pages/);
  });

  it("figma metadata in story frontmatter must include design iteration version field (AC9 dependency)", () => {
    const content = readDevStoryInstructions();
    // RED: design iteration version field not yet in story frontmatter spec
    expect(content).toMatch(/design_version|design_iteration/i);
  });
});

// ─── AC5: No figma: block → use ux-design.md as today (zero change) ─────────

describe("AC5: Absent figma: block falls back to ux-design.md unchanged", () => {
  it("dev-story instructions must have explicit conditional: if no figma: block, use ux-design.md", () => {
    const content = readDevStoryInstructions();
    // RED: conditional fallback to ux-design.md not yet in instructions
    expect(content).toMatch(/no figma|figma.*absent|if.*figma.*not.*present/i);
    expect(content).toMatch(/ux-design\.md/);
  });

  it("figma-integration skill must document zero-change path when no figma metadata", () => {
    const content = readFigmaSkill();
    // RED: zero-change fallback not yet documented in skill
    expect(content).toMatch(/no figma|absent|zero.change|unchanged/i);
  });
});

// ─── AC6: Cache responses in .figma-cache/ with 1-hour TTL ──────────────────

describe("AC6: Figma MCP responses cached with 1-hour TTL", () => {
  it("figma-integration skill must document .figma-cache/ directory and TTL", () => {
    const content = readFigmaSkill();
    // RED: cache section not yet in skill
    expect(content).toMatch(/\.figma-cache\//);
    expect(content).toMatch(/TTL|1.hour|3600/i);
  });

  it("dev-story instructions must reference .figma-cache/ path using {project-path}", () => {
    const content = readDevStoryInstructions();
    // RED: figma-cache path not yet in dev-story instructions
    expect(content).toMatch(/figma-cache/);
    expect(content).toMatch(/\{project-path\}/);
  });
});

// ─── AC7: Composite cache key with version hash ──────────────────────────────

describe("AC7: Cache key is composite {file_key}:{page_id}:{design_version_hash}", () => {
  it("figma-integration skill must document composite cache key format", () => {
    const content = readFigmaSkill();
    // RED: composite cache key format not yet documented
    expect(content).toMatch(/file_key.*page_id|cache.key.*composite/i);
    expect(content).toMatch(/design_version_hash|lastModified/i);
  });

  it("skill must state that TTL is secondary expiry (version hash is primary cache key component)", () => {
    const content = readFigmaSkill();
    // RED: TTL as secondary expiry not yet documented
    expect(content).toMatch(/secondary.*expiry|TTL.*secondary/i);
  });
});

// ─── AC8: MCP unreachable + TTL expired → last-known-good with [OFFLINE] ─────

describe("AC8: Offline mode serves last-known-good files with [OFFLINE] warning", () => {
  it("figma-integration skill must document offline fallback behaviour", () => {
    const content = readFigmaSkill();
    // RED: offline fallback not yet in skill
    expect(content).toMatch(/offline|MCP.*unreachable|last.known.good/i);
    expect(content).toMatch(/\[OFFLINE\]/);
  });

  it("dev-story instructions must describe [OFFLINE] warning output when cache is stale and MCP unreachable", () => {
    const content = readDevStoryInstructions();
    // RED: [OFFLINE] warning not yet in dev-story instructions
    expect(content).toMatch(/\[OFFLINE\]/);
  });

  it("offline fallback must not throw or halt — must continue with last-known-good files", () => {
    const content = readFigmaSkill();
    // RED: non-halting fallback not yet described
    expect(content).toMatch(/not fail|do not halt|continue.*last.known/i);
  });
});

// ─── AC9: Design change detection → offer incremental update ────────────────

describe("AC9: Design version tracking and incremental update offer", () => {
  it("dev-story instructions must describe checking design version on each run", () => {
    const content = readDevStoryInstructions();
    // RED: design version check not yet in dev-story instructions
    expect(content).toMatch(/design.*version.*consumed|figma.*version.*since.*last/i);
  });

  it("dev-story instructions must offer incremental update when design version has changed since last implementation", () => {
    const content = readDevStoryInstructions();
    // RED: incremental update offer not yet in dev-story instructions
    expect(content).toMatch(/incremental.*update|design.*changed.*since/i);
  });

  it("story file figma: metadata must record the design version consumed (traceability)", () => {
    const content = readDevStoryInstructions();
    // RED: version consumed field not yet in story metadata spec
    expect(content).toMatch(/design_version.*consumed|consumed.*version/i);
  });
});

// ─── Skill registration (cross-cutting: E13-S2 prerequisite) ────────────────

describe("Figma skill registration in manifests", () => {
  it("figma-integration.md must be registered in _skill-index.yaml", () => {
    const content = readSkillIndex();
    // RED: skill not yet registered — E13-S2 must add it
    expect(content).toMatch(/figma-integration\.md/);
  });

  it("_skill-index.yaml entry for figma-integration must declare all 6 sections", () => {
    const content = readSkillIndex();
    // RED: 6-section entry not yet in index
    const sections = ["detection", "tokens", "components", "frames", "assets", "export"];
    for (const section of sections) {
      expect(content).toMatch(new RegExp(`id:\\s*${section}`));
    }
  });

  it("figma-integration.md must be present in skill-manifest.csv", () => {
    const content = readSkillManifest();
    // RED: skill not yet in manifest
    expect(content).toMatch(/figma-integration/);
  });
});
