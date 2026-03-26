import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const SLASH_CMD = join(
  PROJECT_ROOT,
  ".claude",
  "commands",
  "gaia-change-request.md",
);
const PM_AGENT = join(GAIA_DIR, "lifecycle", "agents", "pm.md");
const MANIFEST_CSV = join(GAIA_DIR, "_config", "workflow-manifest.csv");
const HELP_CSV = join(GAIA_DIR, "_config", "gaia-help.csv");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E10-S6: Redirect change-request to add-feature", () => {
  // AC1: /gaia-change-request invokes add-feature workflow instead of change-request
  describe("AC1: Command redirects to add-feature", () => {
    it("test_ac1_slash_cmd_references_add_feature — gaia-change-request.md invokes add-feature workflow", () => {
      const content = loadFile(SLASH_CMD);
      expect(content).not.toBeNull();
      // Must reference the add-feature workflow path
      expect(content).toContain("add-feature/workflow.yaml");
      // Must NOT reference the old change-request workflow path as the primary invocation
      expect(content).not.toMatch(
        /process.*change-request\/workflow\.yaml.*as.*workflow-config/,
      );
    });

    it("test_ac1_deprecation_notice — gaia-change-request.md contains deprecation notice", () => {
      const content = loadFile(SLASH_CMD);
      expect(content).not.toBeNull();
      // Must contain a deprecation notice
      expect(content.toLowerCase()).toMatch(/deprecat/);
    });
  });

  // AC2: SIGNIFICANT+ changes display a hint message
  describe("AC2: SIGNIFICANT+ hint message", () => {
    it("test_ac2_significant_hint — gaia-change-request.md contains SIGNIFICANT hint text", () => {
      const content = loadFile(SLASH_CMD);
      expect(content).not.toBeNull();
      // Must contain a hint about SIGNIFICANT changes using add-feature
      expect(content.toUpperCase()).toContain("SIGNIFICANT");
    });
  });

  // AC3: PM agent menu does not list change-request as a separate item
  describe("AC3: PM agent menu updated", () => {
    it("test_ac3_pm_menu_no_change_request — pm.md menu does not contain change-request item", () => {
      const content = loadFile(PM_AGENT);
      expect(content).not.toBeNull();
      // Must NOT have a menu item with label "Change Request"
      expect(content).not.toMatch(
        /<item[^>]*label="Change Request"[^>]*workflow="[^"]*change-request[^"]*"[^>]*\/>/,
      );
    });
  });

  // AC4: workflow-manifest.csv marks change-request as deprecated
  describe("AC4: Manifest deprecation", () => {
    it("test_ac4_manifest_deprecated — workflow-manifest.csv change-request entry is marked deprecated", () => {
      const content = loadFile(MANIFEST_CSV);
      expect(content).not.toBeNull();
      // Find the change-request row
      const lines = content.split("\n");
      const crLine = lines.find((l) => l.startsWith('"change-request"'));
      expect(crLine).toBeDefined();
      // Must contain deprecated marker (case-insensitive)
      expect(crLine.toLowerCase()).toContain("deprecated");
    });

    it("test_ac4_manifest_redirect — workflow-manifest.csv change-request entry mentions add-feature redirect", () => {
      const content = loadFile(MANIFEST_CSV);
      expect(content).not.toBeNull();
      const lines = content.split("\n");
      const crLine = lines.find((l) => l.startsWith('"change-request"'));
      expect(crLine).toBeDefined();
      // Must reference add-feature as the redirect target
      expect(crLine.toLowerCase()).toContain("add-feature");
    });

    it("test_ac4_help_csv_deprecated — gaia-help.csv change-request entry is marked deprecated", () => {
      const content = loadFile(HELP_CSV);
      expect(content).not.toBeNull();
      const lines = content.split("\n");
      const crLine = lines.find((l) => l.includes('"change-request"'));
      expect(crLine).toBeDefined();
      expect(crLine.toLowerCase()).toContain("deprecated");
    });
  });
});
