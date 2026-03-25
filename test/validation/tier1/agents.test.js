import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve, basename } from "path";

// Framework root is where _gaia/ lives (one level above Gaia-framework/)
const FRAMEWORK_ROOT = resolve(import.meta.dirname, "../../../..");
const GAIA_DIR = join(FRAMEWORK_ROOT, "_gaia");

// Agent directories to scan (5 modules)
const AGENT_MODULE_DIRS = ["core", "lifecycle", "dev", "creative", "testing"];

// Skill directories for reference resolution
const DEV_SKILLS_DIR = join(GAIA_DIR, "dev", "skills");
const LIFECYCLE_SKILLS_DIR = join(GAIA_DIR, "lifecycle", "skills");

/** Cache file contents to avoid repeated reads. */
const fileContentCache = new Map();
function readCached(filePath) {
  if (!fileContentCache.has(filePath)) {
    fileContentCache.set(filePath, readFileSync(filePath, "utf8"));
  }
  return fileContentCache.get(filePath);
}

/**
 * Discover all agent .md files across all 5 module agent directories.
 * Excludes _backups/ directory.
 */
function discoverAgentFiles() {
  const agents = [];
  for (const mod of AGENT_MODULE_DIRS) {
    const agentsDir = join(GAIA_DIR, mod, "agents");
    if (!existsSync(agentsDir)) continue;
    const files = readdirSync(agentsDir).filter(
      (f) => f.endsWith(".md") && !f.includes("_backups")
    );
    for (const f of files) {
      agents.push(join(agentsDir, f));
    }
  }
  return agents;
}

/**
 * Extract the <agent ...>...</agent> XML block from a markdown file.
 * Handles both raw XML and XML inside code fences (```xml ... ```).
 */
function extractAgentXmlBlock(content) {
  const match = content.match(/<agent\s[^>]*>[\s\S]*?<\/agent>/);
  return match ? match[0] : null;
}

/**
 * Extract the id attribute from the <agent> opening tag.
 */
function extractAgentId(content) {
  const match = content.match(/<agent\s[^>]*\bid="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Extract the extends attribute from the <agent> opening tag.
 */
function extractExtendsAttr(content) {
  const match = content.match(/<agent\s[^>]*\bextends="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Check if an agent file is abstract (filename starts with _).
 */
function isAbstract(filePath) {
  return basename(filePath).startsWith("_");
}

/**
 * Extract skill references from <skill-registry> blocks.
 * Returns array of path strings.
 */
function extractSkillRegistryPaths(content) {
  const paths = [];
  const regex = /<skill\s[^>]*\bpath="([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Extract skill names from skills: YAML-style list in <stack-config> blocks.
 * e.g., skills: [git-workflow, testing-patterns, api-design]
 */
function extractStackConfigSkills(content) {
  const match = content.match(
    /<stack-config>[\s\S]*?skills:\s*\[([^\]]+)\][\s\S]*?<\/stack-config>/
  );
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extract knowledge fragment paths from <fragment path="..."> tags.
 */
function extractFragmentPaths(content) {
  const paths = [];
  const regex = /<fragment\s+path="([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Check if a skill name resolves to a file in either skill directory.
 * Accepts both bare names (e.g., "git-workflow") and full paths.
 */
function resolveSkillPath(skillRef) {
  if (skillRef.includes("/")) {
    const fullPath = join(FRAMEWORK_ROOT, skillRef);
    return existsSync(fullPath) ? fullPath : null;
  }
  const devPath = join(DEV_SKILLS_DIR, `${skillRef}.md`);
  if (existsSync(devPath)) return devPath;
  const lifecyclePath = join(LIFECYCLE_SKILLS_DIR, `${skillRef}.md`);
  if (existsSync(lifecyclePath)) return lifecyclePath;
  return null;
}

// --- Discover all agent files ---
const agentFiles = discoverAgentFiles();

describe("Agent Persona Validation (E1-S2, FR-31)", () => {
  it("should discover agent files via filesystem scan (auto-discovery)", () => {
    expect(
      agentFiles.length,
      "No agent files discovered in any _gaia/*/agents/ directory"
    ).toBeGreaterThan(0);
  });

  // AC1: Line count validation — all agents ≤ 400 lines
  describe("AC1: Line count within 400-line limit", () => {
    describe.each(agentFiles)("%s", (filePath) => {
      it(`should be within the 400-line limit${isAbstract(filePath) ? " [abstract]" : ""}`, () => {
        const content = readCached(filePath);
        const lineCount = content.split("\n").length;
        expect(
          lineCount,
          `${basename(filePath)}${isAbstract(filePath) ? " (abstract)" : ""} is ${lineCount} lines — exceeds 400-line limit`
        ).toBeLessThanOrEqual(400);
      });
    });
  });

  // AC2: Skill reference validation
  describe("AC2: Skill reference resolution", () => {
    describe.each(agentFiles)("%s", (filePath) => {
      const content = readCached(filePath);
      const registryPaths = extractSkillRegistryPaths(content);
      const stackSkills = extractStackConfigSkills(content);
      const hasSkillDeclarations = registryPaths.length > 0 || stackSkills.length > 0;

      if (!hasSkillDeclarations) {
        it("should have no skill declarations (non-dev agent) — skip", () => {
          expect(registryPaths.length + stackSkills.length).toBe(0);
        });
        return;
      }

      if (registryPaths.length > 0) {
        describe("skill-registry paths", () => {
          it.each(registryPaths)("should resolve skill path: %s", (skillPath) => {
            const resolved = resolveSkillPath(skillPath);
            expect(
              resolved,
              `${basename(filePath)}: skill-registry path "${skillPath}" does not resolve to a file in _gaia/dev/skills/ or _gaia/lifecycle/skills/`
            ).not.toBeNull();
          });
        });
      }

      if (stackSkills.length > 0) {
        describe("stack-config skills", () => {
          it.each(stackSkills)("should resolve bare skill name: %s", (skillName) => {
            const resolved = resolveSkillPath(skillName);
            expect(
              resolved,
              `${basename(filePath)}: stack-config skill "${skillName}" does not resolve to ${skillName}.md in _gaia/dev/skills/ or _gaia/lifecycle/skills/`
            ).not.toBeNull();
          });
        });
      }
    });
  });

  // AC3: Knowledge fragment validation
  describe("AC3: Knowledge fragment path resolution", () => {
    describe.each(agentFiles)("%s", (filePath) => {
      const content = readCached(filePath);
      const fragmentPaths = extractFragmentPaths(content);

      if (fragmentPaths.length === 0) {
        it("should have no knowledge fragment declarations — skip", () => {
          expect(fragmentPaths).toHaveLength(0);
        });
        return;
      }

      it.each(fragmentPaths)("should resolve fragment path: %s", (fragmentPath) => {
        const fullPath = join(FRAMEWORK_ROOT, fragmentPath);
        expect(
          existsSync(fullPath),
          `${basename(filePath)}: knowledge fragment "${fragmentPath}" not found at ${fullPath}`
        ).toBe(true);
      });
    });
  });

  // AC4: Agent ID-to-filename validation (excluding _ prefixed files)
  describe("AC4: Agent ID matches filename", () => {
    const nonAbstractAgents = agentFiles.filter((f) => !isAbstract(f));

    describe.each(nonAbstractAgents)("%s", (filePath) => {
      it("should have agent id matching the filename (without .md)", () => {
        const content = readCached(filePath);
        const agentId = extractAgentId(content);
        const expectedId = basename(filePath, ".md");
        expect(
          agentId,
          `${basename(filePath)}: no agent id attribute found in <agent> tag`
        ).not.toBeNull();
        expect(
          agentId,
          `${basename(filePath)}: agent id="${agentId}" does not match filename stem "${expectedId}"`
        ).toBe(expectedId);
      });
    });

    const abstractAgents = agentFiles.filter((f) => isAbstract(f));
    if (abstractAgents.length > 0) {
      it("should exclude abstract agents (files starting with _) from ID check", () => {
        expect(abstractAgents.length).toBeGreaterThan(0);
      });
    }
  });

  // AC5: XML <agent> block structure validation
  describe("AC5: XML <agent> block structure", () => {
    describe.each(agentFiles)("%s", (filePath) => {
      const content = readCached(filePath);

      it("should contain a non-empty <agent> XML block", () => {
        const xmlBlock = extractAgentXmlBlock(content);
        expect(xmlBlock, `${basename(filePath)}: no <agent>...</agent> block found`).not.toBeNull();

        expect(
          content,
          `${basename(filePath)}: agent block appears to be self-closing (<agent ... />)`
        ).not.toMatch(/<agent\s[^>]*\/>/);
      });

      it("should have an id attribute on the <agent> tag", () => {
        const agentId = extractAgentId(content);
        expect(
          agentId,
          `${basename(filePath)}: <agent> tag is missing id attribute`
        ).not.toBeNull();
      });

      it("should have child elements inside the <agent> block", () => {
        const xmlBlock = extractAgentXmlBlock(content);
        if (!xmlBlock) return;

        const innerContent = xmlBlock
          .replace(/<agent\s[^>]*>/, "")
          .replace(/<\/agent>/, "")
          .trim();
        expect(
          innerContent.length,
          `${basename(filePath)}: <agent> block has no child content`
        ).toBeGreaterThan(0);

        expect(innerContent, `${basename(filePath)}: <agent> block has no child elements`).toMatch(
          /<\w+/
        );
      });

      it("should have a valid extends reference (if declared)", () => {
        const extendsRef = extractExtendsAttr(content);
        if (!extendsRef) return;

        let found = false;
        for (const mod of AGENT_MODULE_DIRS) {
          const basePath = join(GAIA_DIR, mod, "agents", `${extendsRef}.md`);
          if (existsSync(basePath)) {
            found = true;
            break;
          }
        }
        expect(
          found,
          `${basename(filePath)}: extends="${extendsRef}" but ${extendsRef}.md not found in any _gaia/*/agents/ directory`
        ).toBe(true);
      });
    });
  });

  // AC6: All checks pass across all 5 directories (integration)
  describe("AC6: Coverage across all 5 module directories", () => {
    for (const mod of AGENT_MODULE_DIRS) {
      it(`should discover agents in _gaia/${mod}/agents/`, () => {
        const agentsDir = join(GAIA_DIR, mod, "agents");
        expect(existsSync(agentsDir), `Agent directory _gaia/${mod}/agents/ does not exist`).toBe(
          true
        );
        const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
        expect(files.length, `No agent .md files found in _gaia/${mod}/agents/`).toBeGreaterThan(0);
      });
    }
  });
});
