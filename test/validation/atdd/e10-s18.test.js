import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_XML = join(PROJECT_ROOT, "_gaia", "core", "engine", "workflow.xml");
const BASE_DEV = join(PROJECT_ROOT, "_gaia", "dev", "agents", "_base-dev.md");
const DEV_CONFIG = join(PROJECT_ROOT, "_gaia", "dev", "config.yaml");
const RETRO_INSTRUCTIONS = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "retrospective",
  "instructions.xml"
);

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E10-S18: Customize.yaml Registry Lookup Path", () => {
  // AC1: Engine checks custom/skills/{agent-id}.customize.yaml first,
  // falls back to _gaia/_config/agents/{agent-id}.customize.yaml
  describe("AC1: Engine checks custom/skills/ first for .customize.yaml", () => {
    it("workflow.xml Step 3 references custom/skills/ for customize.yaml lookup", () => {
      const content = loadFile(WORKFLOW_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/custom\/skills\/.*customize\.yaml/);
    });

    it("workflow.xml Step 3 checks custom/skills/ before _gaia/_config/agents/", () => {
      const content = loadFile(WORKFLOW_XML);
      expect(content).not.toBeNull();
      const customSkillsIndex = content.indexOf("custom/skills/");
      const configAgentsIndex = content.indexOf("_gaia/_config/agents/{agent-id}.customize.yaml");
      // Both must exist
      expect(customSkillsIndex).toBeGreaterThan(-1);
      expect(configAgentsIndex).toBeGreaterThan(-1);
      // custom/skills/ must appear first in the lookup order
      expect(customSkillsIndex).toBeLessThan(configAgentsIndex);
    });

    it("workflow.xml mentions fallback to _gaia/_config/agents/ for customize.yaml", () => {
      const content = loadFile(WORKFLOW_XML);
      expect(content).not.toBeNull();
      // Must still reference the legacy path as a fallback
      expect(content).toMatch(/_gaia\/_config\/agents\/.*customize\.yaml/);
    });

    it("workflow.xml checks custom/skills/all-dev.customize.yaml for dev agents", () => {
      const content = loadFile(WORKFLOW_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/custom\/skills\/all-dev\.customize\.yaml/);
    });
  });

  // AC2: File-level replacement — custom/skills/ takes full precedence, no merge
  describe("AC2: File-level replacement semantics (no merge)", () => {
    it("workflow.xml specifies that custom/skills/ file replaces _gaia/_config/agents/ entirely", () => {
      const content = loadFile(WORKFLOW_XML);
      expect(content).not.toBeNull();
      // The instruction must convey file-level replacement / no merge / skip fallback
      // when custom/skills/ file is found
      const hasReplacementSemantics =
        /custom\/skills\/[\s\S]{0,500}(skip|replace|entire|no merge|full precedence|instead of)/i.test(
          content
        );
      expect(hasReplacementSemantics).toBe(true);
    });
  });

  // AC3: _base-dev.md references custom/skills/ as primary customize.yaml location
  describe("AC3: _base-dev.md references custom/skills/ as primary location", () => {
    it("_base-dev.md mentions custom/skills/ for customize.yaml files", () => {
      const content = loadFile(BASE_DEV);
      expect(content).not.toBeNull();
      expect(content).toMatch(/custom\/skills\/.*customize\.yaml/);
    });

    it("_base-dev.md indicates custom/skills/ is the primary location", () => {
      const content = loadFile(BASE_DEV);
      expect(content).not.toBeNull();
      // Must convey that custom/skills/ is the preferred / primary location
      const hasPrimaryRef =
        /custom\/skills\/[\s\S]{0,300}(primary|first|preferred)/i.test(content) ||
        /(primary|first|preferred)[\s\S]{0,300}custom\/skills\//i.test(content);
      expect(hasPrimaryRef).toBe(true);
    });
  });

  // AC4: dev/config.yaml has custom_skills_path key
  describe("AC4: dev/config.yaml contains custom_skills_path", () => {
    it("dev/config.yaml has custom_skills_path key with correct value", () => {
      const content = loadFile(DEV_CONFIG);
      expect(content).not.toBeNull();
      expect(content).toMatch(/custom_skills_path:\s*["']?\{project-root\}\/custom\/skills["']?/);
    });
  });

  // AC5: Retrospective workflow writes .customize.yaml to custom/skills/
  describe("AC5: Retrospective workflow writes to custom/skills/", () => {
    it("retro instructions.xml references custom/skills/ as the write target for .customize.yaml", () => {
      const content = loadFile(RETRO_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/custom\/skills\/.*customize\.yaml/);
    });

    it("retro instructions.xml does not write .customize.yaml to _gaia/_config/agents/", () => {
      const content = loadFile(RETRO_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // The register step (step 6) should no longer reference _gaia/_config/agents/
      // as a WRITE target for .customize.yaml
      // Extract the registration/write section and check it doesn't target the old path
      const registerMatch = content.match(/[Rr]egister[\s\S]{0,1000}customize\.yaml/);
      if (registerMatch) {
        const registerSection = registerMatch[0];
        // The register section should use custom/skills/, not _gaia/_config/agents/
        expect(registerSection).toMatch(/custom\/skills\//);
      } else {
        // If no register section found at all, the step may have been rewritten
        // Check that custom/skills/ is referenced somewhere for .customize.yaml writes
        expect(content).toMatch(/custom\/skills\/[\s\S]{0,200}customize\.yaml/);
      }
    });
  });

  // AC6: Silent fallback — no error or warning when custom/skills/ file absent
  describe("AC6: Silent fallback to _gaia/_config/agents/ with no error/warning", () => {
    it("workflow.xml describes silent fallback behavior when custom/skills/ file is absent", () => {
      const content = loadFile(WORKFLOW_XML);
      expect(content).not.toBeNull();
      // Must convey that absence of custom/skills/ file falls back silently
      const hasSilentFallback =
        /custom\/skills\/[\s\S]{0,800}(silent|no error|no warning|fall\s*back|not found[\s\S]{0,200}fall)/i.test(
          content
        );
      expect(hasSilentFallback).toBe(true);
    });

    it("workflow.xml does not raise errors when custom/skills/ customize.yaml is missing", () => {
      const content = loadFile(WORKFLOW_XML);
      expect(content).not.toBeNull();
      // Should not contain error/warning actions for missing custom/skills/ customize.yaml
      const hasErrorOnMissing = /custom\/skills\/[\s\S]{0,200}(error|warn|halt|fail)/i.test(
        content
      );
      // If this matches, check it's a "no error" / "no warning" phrasing, not an actual error
      if (hasErrorOnMissing) {
        const noErrorPhrasing =
          /custom\/skills\/[\s\S]{0,200}(no error|no warning|without error|without warning|silent)/i.test(
            content
          );
        expect(noErrorPhrasing).toBe(true);
      }
    });
  });
});
