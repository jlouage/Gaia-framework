import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const BROWNFIELD_DIR = join(GAIA_DIR, "lifecycle", "workflows", "anytime", "brownfield-onboarding");
const INSTRUCTIONS = join(BROWNFIELD_DIR, "instructions.xml");
const TEMPLATES_DIR = join(GAIA_DIR, "lifecycle", "templates");
const PROMPT_FILE = join(TEMPLATES_DIR, "brownfield-scan-runtime-behavior-prompt.md");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E11-S6: Implement Runtime Behavior Inventory", () => {
  describe("AC1: Runtime behavior scan subagent in brownfield Step 2.5", () => {
    it("brownfield instructions.xml exists", () => {
      expect(existsSync(INSTRUCTIONS)).toBe(true);
    });
    it("contains a runtime behavior scan step", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/[Rr]untime\s+[Bb]ehavior/);
    });
    it("appears in Step 2.5", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/2\.5/);
    });
    it("defined as subagent spawn", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/runtime.behavior/i);
      expect(content).toMatch(/subagent|[Ss]pawn/i);
    });
  });

  describe("AC2: Catalogs all 5 runtime behavior categories", () => {
    it("catalogs cron jobs and scheduled tasks", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/cron\s+job|scheduled\s+task/i);
    });
    it("catalogs startup hooks and initialization sequences", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/startup\s+hook|initialization\s+sequence/i);
    });
    it("catalogs health probes", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/[Hh]ealth\s+[Pp]robe/);
    });
    it("catalogs background workers and message consumers", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/background\s+worker|message\s+consumer/i);
    });
    it("catalogs shutdown hooks and cleanup procedures", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/shutdown\s+hook|cleanup\s+procedure/i);
    });
  });

  describe("AC3: Stack-aware patterns for 4 stacks", () => {
    it("includes Java/Spring patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/@Scheduled/);
      expect(prompt).toMatch(/@PostConstruct/);
      expect(prompt).toMatch(/CommandLineRunner/);
      expect(prompt).toMatch(/ApplicationListener/);
      expect(prompt).toMatch(/@DisallowConcurrentExecution/);
    });
    it("includes Node/Express patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/setInterval/);
      expect(prompt).toMatch(/SIGTERM/);
      expect(prompt).toMatch(/SIGINT/);
      expect(prompt).toMatch(/node-cron/);
      expect(prompt).toMatch(/agenda/);
      expect(prompt).toMatch(/bull/);
    });
    it("includes Python/Django patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/AppConfig\.ready\(\)/);
      expect(prompt).toMatch(/Celery/i);
      expect(prompt).toMatch(/@periodic_task/);
      expect(prompt).toMatch(/django-crontab/);
    });
    it("includes Go/Gin patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/robfig\/cron/);
      expect(prompt).toMatch(/time\.Ticker/);
      expect(prompt).toMatch(/os\.Signal/);
      expect(prompt).toMatch(/sync\.Once/);
    });
  });

  describe("AC4: Gap entries conform to standardized schema", () => {
    it("references gap-entry-schema.md", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/gap-entry-schema\.md/);
    });
    it("uses category runtime-behavior", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/runtime-behavior/);
    });
    it("uses GAP-RUNTIME ID format", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/GAP-RUNTIME-\{?seq|GAP-RUNTIME-\d{3}/);
    });
    it("references gap-entry-schema for standard fields", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/gap-entry-schema/);
      expect(prompt).toMatch(/severity/);
      expect(prompt).toMatch(/category/);
    });
    it("outputs to brownfield-scan-runtime-behavior.md", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/brownfield-scan-runtime-behavior\.md/);
    });
  });

  describe("AC5: Frequency and dependency extraction", () => {
    it("extracts cron expression frequencies", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/cron\s+expression/i);
    });
    it("extracts scheduling and concurrency settings", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/concurrencyPolicy/i);
    });
    it("identifies scheduled task patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/scheduled\s+task/i);
    });
    it("includes schedule field extraction in gap entries", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/spec\.schedule/i);
    });
  });

  describe("AC6: Token budget compliance (NFR-024)", () => {
    it("enforces max 70 gap entries budget", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/max\s+70\s+entries/i);
    });
    it("includes truncation logic for budget overflow", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/truncat/i);
    });
    it("includes truncation logic for budget overflow", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/truncat/i);
    });
  });

  describe("AC7: Init container and sidecar pattern detection", () => {
    it("detects init containers in pod specs", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/initContainers/i);
    });
    it("flags init containers without resource limits", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/init\s+container/i);
      expect(prompt).toMatch(/resource\s+limit/i);
    });
    it("detects sidecar container patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/sidecar/i);
    });
  });

  describe("AC8: Edge case detection", () => {
    it("detects race conditions and concurrency risks", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/[Rr]ace\s+[Cc]ondition/);
    });
    it("detects missing health probes", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/without\s+.*(liveness|readiness)Probe/i);
    });
    it("flags concurrency risks with shared mutable state", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/shared\s+mutable\s+state/i);
      expect(prompt).toMatch(/medium/i);
    });
    it("flags missing probes with severity high", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/high.*missing.*probe|missing.*probe.*high/is);
    });
  });

  describe("Integration: brownfield workflow references runtime behavior scan", () => {
    it("instructions.xml references runtime behavior scan prompt template", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/brownfield-scan-runtime-behavior/i);
    });
    it("instructions.xml references runtime behavior scan output file", () => {
      const content = loadFile(INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/brownfield-scan-runtime-behavior\.md/);
    });
  });
});
