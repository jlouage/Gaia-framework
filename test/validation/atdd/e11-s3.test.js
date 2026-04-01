import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const LIFECYCLE_DIR = join(GAIA_DIR, "lifecycle");
const KNOWLEDGE_DIR = join(LIFECYCLE_DIR, "knowledge", "brownfield");
const TEMPLATES_DIR = join(LIFECYCLE_DIR, "templates");
const BROWNFIELD_INSTRUCTIONS = join(
  LIFECYCLE_DIR,
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "instructions.xml"
);

const SCAN_PROMPT_PATH = join(KNOWLEDGE_DIR, "dead-code-scan.md");
const GAP_SCHEMA_PATH = join(TEMPLATES_DIR, "gap-entry-schema.md");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E11-S3: Dead Code & Dead State Analyzer", () => {
  let scanPrompt;
  let instructions;
  let gapSchema;

  beforeAll(() => {
    scanPrompt = loadFile(SCAN_PROMPT_PATH);
    instructions = loadFile(BROWNFIELD_INSTRUCTIONS);
    gapSchema = loadFile(GAP_SCHEMA_PATH);
  });

  // --- AC1: Subagent invocation in Step 2.5 with {tech_stack} and {project-path} ---
  describe("AC1: Subagent invocation in brownfield Step 2.5", () => {
    it("should have a dead code scan prompt template file", () => {
      expect(existsSync(SCAN_PROMPT_PATH)).toBe(true);
    });

    it("should reference {tech_stack} as an input variable in the prompt", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("{tech_stack}");
    });

    it("should reference {project-path} as an input variable in the prompt", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("{project-path}");
    });

    it("should be integrated into brownfield workflow Step 2.5", () => {
      expect(instructions).not.toBeNull();
      expect(instructions).toContain("dead-code-scan.md");
    });

    it("should be spawned as a parallel subagent alongside other scan subagents", () => {
      expect(instructions).not.toBeNull();
      // Step 2.5 should contain the dead code scan subagent invocation
      const step25Match = instructions.match(/<step n="2\.5"[^>]*>[\s\S]*?<\/step>/);
      expect(step25Match).not.toBeNull();
      expect(step25Match[0]).toContain("dead-code");
    });

    it("should configure output path as brownfield-scan-dead-code.md", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("brownfield-scan-dead-code.md");
    });
  });

  // --- AC2: Detection patterns for dead code categories ---
  describe("AC2: Dead code detection patterns", () => {
    it("should detect unreachable code paths", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toContain("unreachable");
    });

    it("should detect unused exports/functions/classes", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(/unused.*(export|function|class)/);
    });

    it("should detect commented-out code blocks >5 lines", () => {
      expect(scanPrompt).not.toBeNull();
      // Must specify >5 lines threshold (not >=5, not >4)
      expect(scanPrompt).toMatch(/>5|> 5|more than 5|greater than 5/i);
    });

    it("should detect unused database tables/columns from migrations", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(
        /migration|database.*unused|unused.*table|unused.*column/
      );
    });

    it("should detect feature flags that are permanently on/off", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(/feature.flag/);
    });
  });

  // --- AC3: Stack-aware pattern detection ---
  describe("AC3: Stack-aware pattern detection", () => {
    it("should include Java/Spring patterns", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("@Service");
      expect(scanPrompt).toContain("@Repository");
    });

    it("should include Node/Express patterns", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toMatch(/module\.exports|export\s/);
      expect(scanPrompt.toLowerCase()).toContain("middleware");
    });

    it("should include Python/Django patterns", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("urlpatterns");
      expect(scanPrompt.toLowerCase()).toContain("django");
    });

    it("should include Go/Gin patterns", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toContain("unexported");
      expect(scanPrompt.toLowerCase()).toMatch(/go|gin/);
    });

    it("should handle multi-stack projects without cross-contamination", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(/multi.stack|monorepo/);
    });
  });

  // --- AC4: Standardized gap schema compliance ---
  describe("AC4: Gap schema compliance", () => {
    it('should specify category as "dead-code"', () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain('category: "dead-code"');
    });

    it("should specify id format as GAP-DEAD-CODE-{seq}", () => {
      expect(scanPrompt).not.toBeNull();
      // Accept both GAP-DEAD-CODE and GAP-DEADCODE per the schema SCAN_TYPE enum
      expect(scanPrompt).toMatch(/GAP-DEAD-?CODE-/);
    });

    it("should reference the gap entry schema", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("gap-entry-schema.md");
    });

    it("should include all required gap schema fields", () => {
      expect(scanPrompt).not.toBeNull();
      const requiredFields = [
        "id",
        "category",
        "severity",
        "title",
        "description",
        "evidence",
        "recommendation",
        "verified_by",
        "confidence",
      ];
      for (const field of requiredFields) {
        expect(scanPrompt.toLowerCase()).toContain(field);
      }
    });

    it('should set verified_by to "machine-detected"', () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("machine-detected");
    });
  });

  // --- AC5: Confidence levels for static analysis limitations ---
  describe("AC5: Confidence levels for static analysis limitations", () => {
    it("should define high confidence for zero-reference findings", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(
        /high.*zero.reference|no.reference.*high|definitely.*unused.*high/
      );
    });

    it("should define medium confidence for dynamic-import-possible findings", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(/medium.*dynamic|dynamic.*medium/);
    });

    it("should define low confidence for reflection/meta-programming contexts", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(
        /low.*reflect|reflect.*low|meta.program.*low|low.*meta/
      );
    });

    it("should distinguish between definitely unused and possibly unused", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(/definitely.*unused|possibly.*unused/);
    });
  });

  // --- AC6: Budget control (~70 entries, ~7K tokens) ---
  describe("AC6: Budget control", () => {
    it("should specify ~70 gap entry cap", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toMatch(/70/);
    });

    it("should specify ~100 tokens per gap entry", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toMatch(/100.*token|~100 token/);
    });

    it("should specify structured schema format (not prose)", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(/structured.*schema|schema.*format/);
    });

    it("should include budget summary section for truncation", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt).toContain("Budget Summary");
    });

    it("should prioritize higher-severity findings when truncating", () => {
      expect(scanPrompt).not.toBeNull();
      expect(scanPrompt.toLowerCase()).toMatch(/highest.severity|prioritize.*sever/);
    });
  });

  // --- Brownfield workflow integration validation ---
  describe("Brownfield workflow integration", () => {
    it("should verify output file in Step 2.5 wait action", () => {
      expect(instructions).not.toBeNull();
      expect(instructions).toContain("brownfield-scan-dead-code.md");
    });

    it("gap entry schema file should exist", () => {
      expect(existsSync(GAP_SCHEMA_PATH)).toBe(true);
    });

    it("gap schema should define DEADCODE scan type", () => {
      expect(gapSchema).not.toBeNull();
      expect(gapSchema).toMatch(/DEADCODE|DEAD-CODE/i);
    });
  });
});
