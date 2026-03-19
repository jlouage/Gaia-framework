import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const VALIDATOR_PATH = `${PROJECT_ROOT}/_gaia/lifecycle/agents/validator.md`;
const MANIFEST_PATH = `${PROJECT_ROOT}/_gaia/_config/agent-manifest.csv`;
const HELP_PATH = `${PROJECT_ROOT}/_gaia/_config/gaia-help.csv`;

describe("E8-S4: Val Agent Persona and Manifest Entries", () => {
  // AC1: Persona file exists with required fields
  describe("AC1: Persona file exists with correct identity", () => {
    it("should exist at _gaia/lifecycle/agents/validator.md", () => {
      expect(existsSync(VALIDATOR_PATH), "validator.md not found").toBe(true);
    });

    it("should have correct YAML frontmatter", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain("name: 'validator'");
    });

    it('should have agent id="validator"', () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/id="validator"/);
    });

    it('should have agent name="Val"', () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/name="Val"/);
    });

    it('should have title="Artifact Validator"', () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/title="Artifact Validator"/);
    });

    it("should have icon set to magnifying glass", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain("\uD83D\uDD0D"); // 🔍
    });

    it("should have model_override: opus", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/model_override:\s*opus/);
    });

    it("should list required capabilities", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain("artifact verification");
      expect(content).toContain("claim extraction");
      expect(content).toContain("ground truth management");
      expect(content).toContain("cross-reference validation");
    });
  });

  // AC2: Diplomatic communication style
  describe("AC2: Communication style is meticulous/diplomatic/memory-driven", () => {
    it("should have a <persona> block", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain("<persona>");
    });

    it("should describe diplomatic/constructive communication style", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      // Must contain constructive framing guidance
      expect(content).toMatch(/constructive/i);
      expect(content).toMatch(/diplomatic|meticulous/i);
    });

    it("should include a constructive framing example", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      // Should have a positive framing example rather than harsh error style
      expect(content).toMatch(/consider|suggest|recommend/i);
    });
  });

  // AC3: Menu has exactly 7 items
  describe("AC3: Menu contains exactly 7 items", () => {
    it("should have a <menu> block", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain("<menu>");
    });

    it("should have exactly 7 <item> tags in the menu", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      const menuMatch = content.match(/<menu>([\s\S]*?)<\/menu>/);
      expect(menuMatch, "No <menu> block found").toBeTruthy();
      const menuContent = menuMatch[1];
      const items = menuContent.match(/<item\s/g) || [];
      expect(items.length).toBe(7);
    });

    it("should have the 7 required menu labels", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      const requiredLabels = [
        "Validate Artifact",
        "Validate Plan",
        "Revalidate",
        "Review Findings",
        "Refresh Ground Truth",
        "Save Session",
        "Memory Status",
      ];
      for (const label of requiredLabels) {
        expect(content, `Missing menu item: ${label}`).toContain(label);
      }
    });
  });

  // AC4: Read-only on target artifacts, write-only on validation output
  describe("AC4: Read-only/write-only scope documented", () => {
    it("should have a <specification> block", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain("<specification");
    });

    it("should state read-only constraint on target artifacts", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/read[- ]only/i);
    });

    it("should state write-only constraint on validation output", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/write[- ]only/i);
    });

    it("should have a <scope> block with owns and does-not-own", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain("<owns>");
      expect(content).toContain("<does-not-own>");
    });
  });

  // AC5: Missing artifact handling
  describe("AC5: Missing artifact returns clear message", () => {
    it("should have a rule for missing artifact handling", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/does not exist|nothing to validate/i);
    });
  });

  // AC6: Mid-edit artifact handling
  describe("AC6: Mid-edit artifact validated with caveat", () => {
    it("should have a rule for mid-edit artifact handling", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toMatch(/mid[- ]edit|pending changes|in[- ]progress workflow/i);
    });
  });

  // AC7: agent-manifest.csv entry
  describe("AC7: Agent manifest entry", () => {
    it("should have a validator row in agent-manifest.csv", () => {
      const content = readFileSync(MANIFEST_PATH, "utf8");
      expect(content).toContain('"validator"');
    });

    it("should have correct manifest fields", () => {
      const content = readFileSync(MANIFEST_PATH, "utf8");
      const lines = content.split("\n");
      const valLine = lines.find((l) => l.includes('"validator"'));
      expect(valLine, "No validator row found").toBeTruthy();
      expect(valLine).toContain('"Val"');
      expect(valLine).toContain('"Artifact Validator"');
      expect(valLine).toContain('"lifecycle"');
      expect(valLine).toContain("_gaia/lifecycle/agents/validator.md");
    });
  });

  // AC8: gaia-help.csv entries
  describe("AC8: Help CSV entries", () => {
    it("should have Val-related entries in gaia-help.csv", () => {
      const content = readFileSync(HELP_PATH, "utf8");
      expect(content).toContain("validator");
    });
  });

  // AC9: Orchestrator routing — verified as pattern-based (manifest-driven)
  describe("AC9: Orchestrator routing via manifest", () => {
    it("should be discoverable via agent-manifest.csv (pattern-based routing)", () => {
      const content = readFileSync(MANIFEST_PATH, "utf8");
      const lines = content.split("\n");
      const valLine = lines.find((l) => l.includes('"validator"'));
      expect(valLine, "Validator not in manifest — orchestrator cannot route").toBeTruthy();
      expect(valLine).toContain("_gaia/lifecycle/agents/validator.md");
    });
  });

  // AC10: File within 200-line limit
  describe("AC10: Line count within budget", () => {
    it("should be 200 lines or fewer", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      const lineCount = content.split("\n").length;
      expect(lineCount, `validator.md is ${lineCount} lines (max 200)`).toBeLessThanOrEqual(200);
    });
  });

  // Structural consistency with architect.md
  describe("Structural consistency", () => {
    it("should have same XML structure elements as architect.md", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      const requiredElements = [
        "<activation",
        "<menu-handlers>",
        "<rules>",
        "<specification",
        "<memory sidecar=",
        "<persona>",
        "<menu>",
      ];
      for (const el of requiredElements) {
        expect(content, `Missing structural element: ${el}`).toContain(el);
      }
    });

    it("should have 3 memory sidecar declarations (Tier 1)", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      const sidecars = content.match(/<memory\s+sidecar="[^"]+"\s*\/>/g) || [];
      expect(sidecars.length).toBe(3);
    });

    it("should declare sidecars at _memory/validator-sidecar/", () => {
      const content = readFileSync(VALIDATOR_PATH, "utf8");
      expect(content).toContain('_memory/validator-sidecar/ground-truth.md"');
      expect(content).toContain('_memory/validator-sidecar/decision-log.md"');
      expect(content).toContain('_memory/validator-sidecar/conversation-context.md"');
    });
  });
});
