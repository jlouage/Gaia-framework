/**
 * E17-S21: Bridge Toggle Enable/Disable Workflow
 *
 * Story: /gaia-bridge-enable and /gaia-bridge-disable workflow + slash commands.
 * Wraps the manual bridge activation into a single command with idempotency,
 * comment-preserving YAML writes, and a post-toggle summary.
 *
 * Traces: FR-316, ADR-028 §10.20.12
 * Risk: low | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 *
 * Test IDs: BTG-01 (enable from disabled), BTG-02 (idempotency),
 *           BTG-04 (disable round-trip), comment preservation, missing section.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";

import { readBridgeState, toggleBridge, buildSummary } from "../../../src/bridge/bridge-toggle.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

let tmpRoot;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "gaia-e17-s21-"));
  // Create _gaia/_config/ directory structure
  mkdirSync(join(tmpRoot, "_gaia", "_config"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

/** Helper: write a global.yaml fixture and return the path */
function writeGlobalYaml(content) {
  const p = join(tmpRoot, "_gaia", "_config", "global.yaml");
  writeFileSync(p, content, "utf8");
  return p;
}

// ─── Fixture YAML content ────────────────────────────────────────────────────

const YAML_BRIDGE_DISABLED = `# GAIA Framework — Global Configuration
framework_name: "GAIA"
framework_version: "1.105.0"

# Test Execution Bridge (ADR-028, FR-202, NFR-035)
# Opt-in subsystem that runs tests during the post-review phase.
test_execution_bridge:
  # Master switch. false = bridge completely inactive.
  bridge_enabled: false
  # Maximum wall-clock seconds for a test run.
  timeout_seconds: 300
`;

const YAML_BRIDGE_ENABLED = `# GAIA Framework — Global Configuration
framework_name: "GAIA"
framework_version: "1.105.0"

# Test Execution Bridge (ADR-028, FR-202, NFR-035)
# Opt-in subsystem that runs tests during the post-review phase.
test_execution_bridge:
  # Master switch. false = bridge completely inactive.
  bridge_enabled: true
  # Maximum wall-clock seconds for a test run.
  timeout_seconds: 300
`;

const YAML_NO_BRIDGE_SECTION = `# GAIA Framework — Global Configuration
framework_name: "GAIA"
framework_version: "1.105.0"

# No test_execution_bridge section at all
`;

const YAML_SECTION_NO_KEY = `# GAIA Framework — Global Configuration
framework_name: "GAIA"
framework_version: "1.105.0"

# Test Execution Bridge (ADR-028)
test_execution_bridge:
  # Only timeout, no bridge_enabled key
  timeout_seconds: 300
`;

const YAML_WITH_COMMENTS = `# GAIA Framework — Global Configuration
framework_name: "GAIA"
framework_version: "1.105.0"

# === Bridge Config ===
# This block controls the test execution bridge.
# See ADR-028 for rationale.
test_execution_bridge:
  # Master switch for the bridge subsystem.
  # When false, all bridge layers are bypassed.
  bridge_enabled: false  # inline comment: toggle me
  # Timeout for test runs in seconds.
  timeout_seconds: 300  # default 5 minutes
`;

// ─── BTG-01: Enable from disabled ───────────────────────────────────────────

describe("E17-S21: Bridge Toggle", () => {
  describe("BTG-01: enable from disabled state", () => {
    it("readBridgeState returns false when bridge_enabled is false", () => {
      const yamlPath = writeGlobalYaml(YAML_BRIDGE_DISABLED);
      const state = readBridgeState(yamlPath);
      expect(state).toBe(false);
    });

    it("toggleBridge flips false → true and returns changed=true", () => {
      const yamlPath = writeGlobalYaml(YAML_BRIDGE_DISABLED);
      const result = toggleBridge(yamlPath, "enable");
      expect(result.changed).toBe(true);
      expect(result.previousState).toBe(false);
      expect(result.newState).toBe(true);
    });

    it("after enable, readBridgeState returns true", () => {
      const yamlPath = writeGlobalYaml(YAML_BRIDGE_DISABLED);
      toggleBridge(yamlPath, "enable");
      const state = readBridgeState(yamlPath);
      expect(state).toBe(true);
    });

    it("summary includes previous state, new state, and /gaia-build-configs", () => {
      const summary = buildSummary({
        previousState: false,
        newState: true,
        mode: "enable",
        changed: true,
      });
      expect(summary).toContain("false");
      expect(summary).toContain("true");
      expect(summary).toContain("/gaia-build-configs");
    });
  });

  // ─── BTG-02: Idempotency ─────────────────────────────────────────────────

  describe("BTG-02: idempotency — enable when already enabled", () => {
    it("toggleBridge returns changed=false when already in target state", () => {
      const yamlPath = writeGlobalYaml(YAML_BRIDGE_ENABLED);
      const result = toggleBridge(yamlPath, "enable");
      expect(result.changed).toBe(false);
      expect(result.previousState).toBe(true);
      expect(result.newState).toBe(true);
    });

    it("global.yaml is byte-identical after no-op toggle", () => {
      const yamlPath = writeGlobalYaml(YAML_BRIDGE_ENABLED);
      const before = readFileSync(yamlPath, "utf8");
      toggleBridge(yamlPath, "enable");
      const after = readFileSync(yamlPath, "utf8");
      expect(after).toBe(before);
    });

    it("summary reports 'Bridge already enabled'", () => {
      const summary = buildSummary({
        previousState: true,
        newState: true,
        mode: "enable",
        changed: false,
      });
      expect(summary).toMatch(/already enabled/i);
    });
  });

  // ─── BTG-04: Disable round-trip ──────────────────────────────────────────

  describe("BTG-04: disable round-trip", () => {
    it("enable then disable returns final state false", () => {
      const yamlPath = writeGlobalYaml(YAML_BRIDGE_DISABLED);
      toggleBridge(yamlPath, "enable");
      const result = toggleBridge(yamlPath, "disable");
      expect(result.changed).toBe(true);
      expect(result.newState).toBe(false);
    });

    it("disable summary skips post-flip checks", () => {
      const summary = buildSummary({
        previousState: true,
        newState: false,
        mode: "disable",
        changed: true,
      });
      // Disable mode should NOT mention post-flip checks or test-environment.yaml
      expect(summary).not.toMatch(/post-flip check/i);
      expect(summary).not.toMatch(/test-environment\.yaml/i);
      // But should still mention /gaia-build-configs
      expect(summary).toContain("/gaia-build-configs");
    });
  });

  // ─── Comment preservation ─────────────────────────────────────────────────

  describe("Comment preservation", () => {
    it("inline and block comments survive the write", () => {
      const yamlPath = writeGlobalYaml(YAML_WITH_COMMENTS);
      toggleBridge(yamlPath, "enable");
      const after = readFileSync(yamlPath, "utf8");

      // Block comments preserved
      expect(after).toContain("# === Bridge Config ===");
      expect(after).toContain("# This block controls the test execution bridge.");
      expect(after).toContain("# See ADR-028 for rationale.");
      expect(after).toContain("# Master switch for the bridge subsystem.");
      expect(after).toContain("# When false, all bridge layers are bypassed.");
      // Inline comment preserved
      expect(after).toContain("# inline comment: toggle me");
      expect(after).toContain("# default 5 minutes");
      // Other values untouched
      expect(after).toContain("timeout_seconds: 300");
      expect(after).toContain('framework_version: "1.105.0"');
    });

    it("only the bridge_enabled value line changes", () => {
      const yamlPath = writeGlobalYaml(YAML_WITH_COMMENTS);
      const before = readFileSync(yamlPath, "utf8");
      toggleBridge(yamlPath, "enable");
      const after = readFileSync(yamlPath, "utf8");

      // Split into lines and compare — only the bridge_enabled line should differ
      const beforeLines = before.split("\n");
      const afterLines = after.split("\n");
      expect(afterLines.length).toBe(beforeLines.length);

      let changedCount = 0;
      for (let i = 0; i < beforeLines.length; i++) {
        if (beforeLines[i] !== afterLines[i]) {
          changedCount++;
          expect(beforeLines[i]).toContain("bridge_enabled: false");
          expect(afterLines[i]).toContain("bridge_enabled: true");
        }
      }
      expect(changedCount).toBe(1);
    });
  });

  // ─── Missing section ─────────────────────────────────────────────────────

  describe("Missing section handling", () => {
    it("readBridgeState returns false when section is missing (AC3 default)", () => {
      const yamlPath = writeGlobalYaml(YAML_NO_BRIDGE_SECTION);
      const state = readBridgeState(yamlPath);
      expect(state).toBe(false);
    });

    it("toggleBridge throws when section is missing", () => {
      const yamlPath = writeGlobalYaml(YAML_NO_BRIDGE_SECTION);
      expect(() => toggleBridge(yamlPath, "enable")).toThrow(/test_execution_bridge.*missing/i);
    });
  });

  // ─── Key absent but section present ───────────────────────────────────────

  describe("Key absent but section present", () => {
    it("readBridgeState returns false when key is absent (AC3 default)", () => {
      const yamlPath = writeGlobalYaml(YAML_SECTION_NO_KEY);
      const state = readBridgeState(yamlPath);
      expect(state).toBe(false);
    });

    it("toggleBridge throws when bridge_enabled key is absent", () => {
      const yamlPath = writeGlobalYaml(YAML_SECTION_NO_KEY);
      expect(() => toggleBridge(yamlPath, "enable")).toThrow(/bridge_enabled.*not found/i);
    });
  });
});
