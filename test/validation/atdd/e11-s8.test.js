import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const BROWNFIELD_DIR = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding"
);
const INSTRUCTIONS = join(BROWNFIELD_DIR, "instructions.xml");
const PROMPT_TEMPLATE = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "templates",
  "brownfield-scan-integration-seam-prompt.md"
);

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function loadAllContent() {
  const instr = loadFile(INSTRUCTIONS) || "";
  const prompt = loadFile(PROMPT_TEMPLATE) || "";
  return instr + "\n" + prompt;
}

describe("E11-S8: Implement Integration Seam Analyzer", () => {
  describe("AC1: Integration seam analyzer subagent at Step 2.5", () => {
    it("brownfield instructions.xml exists", () => {
      expect(existsSync(INSTRUCTIONS)).toBe(true);
    });
    it("contains integration seam analyzer step around Step 2.5", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/2\.5/);
      expect(content.toLowerCase()).toMatch(/integration.seam/);
    });
    it("defined as subagent or scan step", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      const lower = content.toLowerCase();
      const hasSubagent = lower.includes("subagent") || lower.includes("scan");
      expect(hasSubagent).toBe(true);
      expect(lower).toMatch(/integration.seam.analy/);
    });
  });

  describe("AC2: Data flow tracing at service boundaries", () => {
    it("mentions HTTP client calls", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/http.client/);
    });
    it("mentions message queue producers/consumers", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/message.queue/);
    });
    it("mentions database shared access patterns", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/database.shared.access/);
    });
    it("mentions coupling classification patterns", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/coupling.classification/);
    });
  });

  describe("AC3: Detection of coupling and resilience issues", () => {
    it("detects tightly coupled services", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/tightly.coupled/);
    });
    it("detects missing circuit breakers or retry logic", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/circuit.breaker|retry.logic/);
    });
    it("detects undocumented external service dependencies", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/undocumented.*dependenc/);
    });
    it("detects inconsistent data serialization formats", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/inconsistent.*serialization/);
    });
  });

  describe("AC4: Stack-aware integration patterns", () => {
    it("mentions Feign clients", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/[Ff]eign/);
    });
    it("mentions axios HTTP client", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/axios/);
    });
    it("mentions Python HTTP clients", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/requests.*httpx|httpx.*requests/);
    });
    it("mentions Go HTTP client patterns", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/net\/http|go-retryablehttp/);
    });
  });

  describe("AC5: Gap entries with standardized schema and integration-seam category", () => {
    it("references standardized gap schema from E11-S1", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      const lower = content.toLowerCase();
      const hasSchemaRef = lower.includes("gap") && lower.includes("schema");
      expect(hasSchemaRef).toBe(true);
    });
    it("specifies integration-seam as the gap category", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/integration-seam/);
    });
  });

  describe("AC6: Dependency graph summary", () => {
    it("references a dependency graph summary", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/dependency.graph/);
    });
    it("mentions service-to-service relationships", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/service.to.service/);
    });
  });

  describe("AC7: NFR-024 token budget constraint", () => {
    it("references NFR-024 token budget", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/NFR-024/);
    });
    it("mentions token budget constraint", () => {
      const content = loadAllContent();
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/token.budget/);
    });
  });
});
