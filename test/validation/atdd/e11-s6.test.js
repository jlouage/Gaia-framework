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
    it("catalogs health check endpoints", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/health\s+check\s+endpoint/i);
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
      expect(prompt).toMatch(/ApplicationReadyEvent/);
      expect(prompt).toMatch(/@DisallowConcurrentExecution/);
    });
    it("includes Node/Express patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/setInterval/);
      expect(prompt).toMatch(/setTimeout/);
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
      expect(prompt).toMatch(/Celery/);
      expect(prompt).toMatch(/@shared_task/);
      expect(prompt).toMatch(/@periodic_task/);
      expect(prompt).toMatch(/APScheduler/);
    });
    it("includes Go/Gin patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/robfig\/cron/);
      expect(prompt).toMatch(/time\.Tick|time\.NewTicker/);
      expect(prompt).toMatch(/init\(\)/);
      expect(prompt).toMatch(/signal\.Notify/);
      expect(prompt).toMatch(/http\.Server\.Shutdown/);
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
    it("requires all standard fields", () => {
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
    it("extracts fixed-rate and fixed-delay intervals", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/fixedRate|fixed.rate|fixedDelay|fixed.delay/i);
    });
    it("identifies service and bean dependencies", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/depends_on|dependency|dependencies/i);
    });
    it("includes frequency in gap entry description", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/frequency/i);
    });
  });

  describe("AC6: Token budget compliance (NFR-024)", () => {
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
    it("includes truncation logic for budget overflow", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/truncat/i);
    });
  });

  describe("AC7: Wired/active verification for unwired components", () => {
    it("verifies component wiring and registration", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/wired|active\s+verification|component.*(regist|scan)/i);
    });
    it("flags unwired components with severity high", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/unwired/i);
      expect(prompt).toMatch(/severity.*high|high.*severity/i);
    });
    it("checks framework component model registration", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(
        /component\s+(model|scan)|bean\s+regist|middleware\s+chain|app\s+registry/i
      );
    });
  });

  describe("AC8: Edge case detection", () => {
    it("detects circular startup dependencies", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/circular.*dep|deadlock/i);
    });
    it("detects shutdown hooks without timeout", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/shutdown.*timeout|timeout.*shutdown|zombie\s+process/i);
    });
    it("flags circular deps with severity medium", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/circular/i);
      expect(prompt).toMatch(/medium/i);
    });
    it("flags missing timeouts with severity medium", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/missing\s+timeout|no\s+timeout/i);
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
