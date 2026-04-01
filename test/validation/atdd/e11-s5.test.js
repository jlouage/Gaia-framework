import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const BROWNFIELD_DIR = join(GAIA_DIR, "lifecycle", "workflows", "anytime", "brownfield-onboarding");
const INSTRUCTIONS = join(BROWNFIELD_DIR, "instructions.xml");
const TEMPLATES_DIR = join(GAIA_DIR, "lifecycle", "templates");
const PROMPT_FILE = join(TEMPLATES_DIR, "brownfield-scan-security-prompt.md");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E11-S5: Implement Security Endpoint Audit", () => {
  describe("AC1: Security endpoint audit subagent in brownfield workflow", () => {
    it("brownfield instructions.xml exists", () => {
      expect(existsSync(INSTRUCTIONS)).toBe(true);
    });
    it("contains a security endpoint audit step", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/[Ss]ecurity\s+[Ee]ndpoint\s+[Aa]udit/);
    });
    it("appears as Step 2.5", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/2\.5|step-2\.5|step_2_5|[Ss]tep\s+2\.5/);
    });
    it("defined as subagent or scan step", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/security.endpoint/i);
      expect(content).toMatch(/subagent|scan/i);
    });
  });

  describe("AC2: Catalogs API endpoints with methods, auth, and authorization", () => {
    it("references HTTP methods cataloging", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/HTTP\s+method/i);
    });
    it("references authentication", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/authentication/i);
    });
    it("references authorization", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/authorization/i);
    });
    it("references API endpoint cataloging", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/API\s+endpoint/i);
    });
  });

  describe("AC3: Detects security vulnerabilities", () => {
    it("detects missing authentication middleware", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/missing\s+auth(entication)?\s+middleware/i);
    });
    it("detects IDOR", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/IDOR/);
    });
    it("detects rate limiting", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/rate\s+limit/i);
    });
    it("detects sensitive data exposure", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/sensitive\s+data/i);
    });
    it("references ownership validation", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/ownership\s+validation/i);
    });
    it("detects missing input validation on mutating endpoints", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/input\s+validation/i);
    });
  });

  describe("AC4: Stack-aware authentication patterns", () => {
    it("references Spring Security", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Spring\s+Security/i);
    });
    it("references Express middleware", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Express\s+middleware/i);
    });
    it("references Django permissions", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Django\s+permission/i);
    });
    it("references Go/Gin middleware", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Go\/Gin|Gin\s+middleware/i);
    });
    it("mentions stack-aware patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/stack.aware/i);
    });
  });

  describe("AC5: Gap entries with standardized schema and security-endpoint category", () => {
    it("references standardized gap schema", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/gap.entry.schema/i);
    });
    it("outputs use category security-endpoint", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/security-endpoint/);
    });
    it("references E11-S1 standardized schema", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/gap-entry-schema\.md/);
    });
    it("sets severity critical for auth gaps on mutating endpoints", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/critical/i);
      expect(prompt).toMatch(/mutating/i);
    });
    it("sets verified_by to machine-detected", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/machine-detected/);
    });
  });

  describe("AC6: NFR-024 token budget constraint", () => {
    it("references budget enforcement", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/[Bb]udget\s+[Ee]nforcement/);
    });
    it("mentions token budget constraint", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/token/i);
    });
    it("enforces max 70 gap entries", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/70/);
    });
  });

  describe("AC7: Graceful handling of no API endpoints", () => {
    it("handles projects with no API endpoints", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/[Nn]o\s+API\s+endpoint/i);
    });
    it("outputs zero gaps for non-API projects", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/zero\s+gap/i);
    });
  });

  describe("AC8: False-positive mitigation for inherited auth", () => {
    it("recognizes inherited auth from app/router-level middleware", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/inherited\s+auth/i);
    });
    it("avoids false positives on protected routes", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/false.positiv/i);
    });
  });

  describe("Integration: brownfield workflow references security scan", () => {
    it("instructions.xml references security scan prompt template", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/brownfield-scan-security/i);
    });
    it("instructions.xml references security scan output file", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/brownfield-scan-security\.md/);
    });
  });
});
