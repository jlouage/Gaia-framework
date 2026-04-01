import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const BROWNFIELD_DIR = join(GAIA_DIR, "lifecycle", "workflows", "anytime", "brownfield-onboarding");
const INSTRUCTIONS = join(BROWNFIELD_DIR, "instructions.xml");
const TEMPLATES_DIR = join(GAIA_DIR, "lifecycle", "templates");
const PROMPT_FILE = join(TEMPLATES_DIR, "brownfield-scan-doc-code-prompt.md");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E11-S7: Implement Doc-vs-Code Verifier", () => {
  describe("AC1: Doc-vs-code scan subagent in brownfield Step 2.5", () => {
    it("brownfield instructions.xml exists", () => {
      expect(existsSync(INSTRUCTIONS)).toBe(true);
    });
    it("contains a doc-vs-code scan step", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/[Dd]oc.*[Cc]ode|[Dd]ocumentation.*[Cc]ode.*[Mm]ismatch/);
    });
    it("appears in Step 2.5", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/2\.5/);
    });
    it("defined as subagent spawn using Agent tool", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/brownfield-scan-doc-code/i);
      expect(content).toMatch(/subagent|[Ss]pawn/i);
    });
    it("spawned in parallel alongside other scanners", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Step 2.5 should contain multiple scanner spawns
      expect(content).toMatch(/parallel/i);
    });
  });

  describe("AC2: Parses all discoverable documentation files", () => {
    it("parses README.md files", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/README\.md/);
    });
    it("parses CONTRIBUTING.md files", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/CONTRIBUTING\.md/);
    });
    it("parses API documentation files", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/API\s+doc|api.*doc/i);
    });
    it("parses inline JSDoc/docstrings", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/JSDoc|docstring/i);
    });
    it("parses OpenAPI/Swagger specification files", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/OpenAPI|[Ss]wagger/);
      expect(prompt).toMatch(/openapi\.yaml|swagger\.json/);
    });
  });

  describe("AC3: Verifies documented claims against code", () => {
    it("verifies documented API endpoints exist as route definitions", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/endpoint.*route|route.*definition/i);
    });
    it("verifies documented config options are referenced in code", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/config.*option|configuration.*option/i);
    });
    it("verifies documented dependencies match package manifests", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/package\.json|pom\.xml|go\.mod|requirements\.txt|pyproject\.toml/);
    });
    it("verifies documented build/run commands are consistent", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/build.*command|run.*command/i);
    });
  });

  describe("AC4: Detects documentation-code mismatches", () => {
    it("detects stale documentation (documented features not in code)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/stale.*doc|documented.*not.*exist|no\s+longer\s+exist/i);
    });
    it("detects undocumented features (code exists but not documented)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/undocumented.*feature|missing.*doc|not\s+documented/i);
    });
    it("detects version mismatches between docs and package files", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/version.*mismatch/i);
    });
  });

  describe("AC5: Gap entries conform to standardized schema", () => {
    it("references gap-entry-schema.md", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/gap-entry-schema\.md/);
    });
    it("uses category doc-code-drift", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/doc-code-drift/);
    });
    it("uses GAP-DOC-CODE ID format", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/GAP-DOC-CODE-\{?seq|GAP-DOC-CODE-\d{3}/);
    });
    it("sets verified_by to machine-detected", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/verified_by.*machine-detected|machine-detected/);
    });
    it("requires all standard schema fields", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/severity/);
      expect(prompt).toMatch(/title/);
      expect(prompt).toMatch(/description/);
      expect(prompt).toMatch(/evidence/);
      expect(prompt).toMatch(/recommendation/);
      expect(prompt).toMatch(/verified_by/);
      expect(prompt).toMatch(/confidence/);
    });
    it("outputs to brownfield-scan-doc-code.md", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/brownfield-scan-doc-code\.md/);
    });
  });

  describe("AC6: NFR-024 token budget compliance", () => {
    it("references NFR-024 token budget", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/NFR-024/);
    });
    it("enforces ~100 tokens per gap entry", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/100\s+tokens/i);
    });
    it("includes gap count cap (~70 gaps)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/70\s+gap/i);
    });
    it("includes truncation logic for budget overflow", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/truncat/i);
    });
  });

  describe("AC7: Edge case handling", () => {
    it("handles non-UTF-8 encoded documentation files gracefully", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/UTF-8|encoding|decode/i);
    });
    it("skips empty/stub documentation files", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/empty.*file|stub.*doc|fewer\s+than/i);
    });
    it("logs warning for encoding errors without crashing", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/warning.*encod|log.*warning/i);
    });
    it("no false positives for empty docs", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/false.positive|skip.*empty/i);
    });
  });

  describe("AC8: OpenAPI/Swagger auto-generated spec detection", () => {
    it("detects x-generator metadata in OpenAPI specs", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/x-generator/);
    });
    it("detects x-generated-by metadata", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/x-generated-by/);
    });
    it("detects known generator tool signatures", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/generator.*tool|swagger-codegen|openapi-generator/i);
    });
    it("marks auto-generated specs with lower confidence (INFO severity)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/auto.generated.*lower|lower.*confidence|INFO.*sever/i);
    });
  });

  describe("Stack-aware patterns: 4 stacks minimum", () => {
    it("includes Java/Spring documentation patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Java.*Spring|Spring.*Boot/i);
    });
    it("includes Node/Express documentation patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Node.*Express|Express/i);
    });
    it("includes Python/Django documentation patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Python.*Django|Django/i);
    });
    it("includes Go/Gin documentation patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Go.*Gin|Gin/i);
    });
  });

  describe("Integration: brownfield workflow references doc-vs-code scan", () => {
    it("instructions.xml references doc-vs-code scan prompt template", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/brownfield-scan-doc-code/i);
    });
    it("instructions.xml includes brownfield-scan-doc-code.md in verification list", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/brownfield-scan-doc-code\.md/);
    });
  });
});
