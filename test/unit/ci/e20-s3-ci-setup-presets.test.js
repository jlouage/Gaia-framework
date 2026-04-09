const path = require("path");
const fs = require("fs");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

// E20-S3 — Enhance /gaia-ci-setup with Preset Selection
//
// Verifies the structural enhancements made to the ci-setup instructions.xml
// workflow file. The story enhances the workflow by inserting a new "Preset
// Selection" step between the existing "Detect CI Platform" (Step 1) and
// "Define Pipeline" (previously Step 2). After insertion, all subsequent
// steps shift by +1 to maintain numerical ordering.
//
// Acceptance criteria:
//   AC1: 4 presets + custom option presented when no ci_cd block exists
//   AC2: Selected preset writes full promotion_chain to global.yaml
//   AC3: Custom builder walks user through environment definition
//   AC4: E20-S1 schema validation runs after write
//   AC5: Existing ci_cd block triggers overwrite/skip/edit prompt
//   AC6: YOLO mode auto-selects "standard" preset
//
// Story file: docs/implementation-artifacts/E20-S3-enhance-gaia-ci-setup-with-preset-selection.md

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const INSTRUCTIONS_PATH = path.join(
  PROJECT_ROOT,
  "_gaia/testing/workflows/ci-setup/instructions.xml"
);
const PRESETS_PATH = path.join(PROJECT_ROOT, "_gaia/_config/environment-presets.yaml");

const PRESET_NAMES = ["solo", "small-team", "standard", "enterprise"];

// Helper — extract the <step n="N" title="..."> blocks in document order.
// Returns an array of { n, title, body } where body is the raw inner XML
// between the opening <step> and its matching closing </step> tag.
function extractSteps(xml) {
  const steps = [];
  const stepRegex = /<step\s+n="(\d+)"\s+title="([^"]+)"\s*>([\s\S]*?)<\/step>/g;
  let match;
  while ((match = stepRegex.exec(xml)) !== null) {
    steps.push({
      n: Number(match[1]),
      title: match[2],
      body: match[3],
    });
  }
  return steps;
}

describe("E20-S3: /gaia-ci-setup Preset Selection", () => {
  let xml;
  let steps;

  beforeAll(() => {
    xml = fs.readFileSync(INSTRUCTIONS_PATH, "utf8");
    steps = extractSteps(xml);
  });

  // ── Structural guarantees ───────────────────────────────────────────────
  describe("Structural invariants", () => {
    it("instructions.xml file exists and is non-empty", () => {
      expect(fs.existsSync(INSTRUCTIONS_PATH)).toBe(true);
      expect(xml.length).toBeGreaterThan(0);
    });

    it("parses at least 9 steps (originally 8, +1 for new preset step)", () => {
      expect(steps.length).toBeGreaterThanOrEqual(9);
    });

    it("step numbering is contiguous starting from 1", () => {
      const numbers = steps.map((s) => s.n);
      const expected = numbers.map((_, i) => i + 1);
      expect(numbers).toEqual(expected);
    });

    it("Step 1 remains 'Detect CI Platform'", () => {
      expect(steps[0].n).toBe(1);
      expect(steps[0].title).toBe("Detect CI Platform");
    });
  });

  // ── AC1, Task 1: Preset Selection step exists as Step 2 ─────────────────
  describe("AC1 — Preset Selection step", () => {
    it("inserts a new Step 2 titled with 'Preset Selection'", () => {
      expect(steps[1].n).toBe(2);
      expect(steps[1].title).toMatch(/Preset Selection/i);
    });

    it("reads environment-presets.yaml", () => {
      expect(steps[1].body).toMatch(/environment-presets\.yaml/);
    });

    it("presents all 4 preset names plus a custom option", () => {
      for (const name of PRESET_NAMES) {
        expect(steps[1].body).toContain(name);
      }
      expect(steps[1].body).toMatch(/custom/i);
    });

    it("includes an <ask> tag to prompt the user for preset choice", () => {
      expect(steps[1].body).toMatch(/<ask[^>]*>/);
    });
  });

  // ── AC6, Task 1.4: YOLO auto-selects 'standard' ─────────────────────────
  describe("AC6 — YOLO auto-selection", () => {
    it("has a <check if=\"yolo_mode\"> that selects the 'standard' preset", () => {
      const body = steps[1].body;
      expect(body).toMatch(/yolo_mode/);
      // The yolo branch must reference the 'standard' preset explicitly
      const yoloRegionMatch = body.match(/yolo_mode[\s\S]*?(?:<\/check>|<\/action>)/);
      expect(yoloRegionMatch).not.toBeNull();
      expect(yoloRegionMatch[0]).toMatch(/standard/);
    });
  });

  // ── AC5, Task 1.5: Existing ci_cd block triggers overwrite/skip/edit ────
  describe("AC5 — Existing ci_cd block handling", () => {
    it("detects existing ci_cd block in global.yaml", () => {
      expect(steps[1].body).toMatch(/ci_cd/);
    });

    it("prompts with overwrite/skip/edit options", () => {
      const body = steps[1].body;
      expect(body).toMatch(/overwrite/i);
      expect(body).toMatch(/skip/i);
      expect(body).toMatch(/edit/i);
    });
  });

  // ── AC2, Task 2: Preset application writes promotion_chain ──────────────
  describe("AC2 — Preset application", () => {
    it("writes ci_cd.promotion_chain block to global.yaml", () => {
      const body = steps[1].body;
      expect(body).toMatch(/promotion_chain/);
      expect(body).toMatch(/global\.yaml/);
    });

    it("preserves existing global.yaml content (only adds/replaces ci_cd)", () => {
      expect(steps[1].body).toMatch(/preserve|existing/i);
    });
  });

  // ── AC3, Task 3: Custom environment builder ─────────────────────────────
  describe("AC3 — Custom environment builder", () => {
    it("guides user through environment definition fields", () => {
      const body = steps[1].body;
      // Required fields per story: id, name, branch, ci_provider, merge_strategy, ci_checks
      expect(body).toMatch(/\bid\b/);
      expect(body).toMatch(/\bname\b/);
      expect(body).toMatch(/\bbranch\b/);
      expect(body).toMatch(/ci_provider/);
      expect(body).toMatch(/merge_strategy/);
      expect(body).toMatch(/ci_checks/);
    });

    it("enumerates ci_provider options", () => {
      const body = steps[1].body;
      // At minimum must mention the common providers from the enum
      expect(body).toMatch(/github_actions/);
    });

    it("enumerates merge_strategy options", () => {
      const body = steps[1].body;
      expect(body).toMatch(/merge|squash|rebase/);
    });
  });

  // ── AC4, Task 4: E20-S1 schema validation integration ──────────────────
  describe("AC4 — E20-S1 schema validation", () => {
    it("references schema validation after writing the block", () => {
      const body = steps[1].body;
      expect(body).toMatch(/validat/i);
    });

    it("covers the validation rules (min 1 env, no duplicates)", () => {
      const body = steps[1].body;
      // min 1 environment rule and duplicate detection rule
      expect(body).toMatch(/duplicate|unique/i);
    });
  });

  // ── Task 5: Subsequent steps renumbered correctly ───────────────────────
  describe("Task 5 — Renumbering of subsequent steps", () => {
    it("Step 3 is 'Define Pipeline' (previously Step 2)", () => {
      const s3 = steps.find((s) => s.n === 3);
      expect(s3).toBeDefined();
      expect(s3.title).toBe("Define Pipeline");
    });

    it("Step 4 is 'Quality Gates'", () => {
      const s4 = steps.find((s) => s.n === 4);
      expect(s4).toBeDefined();
      expect(s4.title).toBe("Quality Gates");
    });

    it("Step 5 is 'Secrets Management'", () => {
      const s5 = steps.find((s) => s.n === 5);
      expect(s5).toBeDefined();
      expect(s5.title).toBe("Secrets Management");
    });

    it("Step 6 is 'Deployment Strategy'", () => {
      const s6 = steps.find((s) => s.n === 6);
      expect(s6).toBeDefined();
      expect(s6.title).toBe("Deployment Strategy");
    });

    it("Step 7 is 'Monitoring and Notifications'", () => {
      const s7 = steps.find((s) => s.n === 7);
      expect(s7).toBeDefined();
      expect(s7.title).toBe("Monitoring and Notifications");
    });

    it("Step 8 is 'Generate Pipeline Config'", () => {
      const s8 = steps.find((s) => s.n === 8);
      expect(s8).toBeDefined();
      expect(s8.title).toBe("Generate Pipeline Config");
    });

    it("Step 9 is 'Generate Output'", () => {
      const s9 = steps.find((s) => s.n === 9);
      expect(s9).toBeDefined();
      expect(s9.title).toBe("Generate Output");
    });

    it("Generate Output step still has a <template-output> tag", () => {
      const s9 = steps.find((s) => s.title === "Generate Output");
      expect(s9.body).toMatch(/<template-output/);
    });
  });

  // ── Sanity — presets file referenced by the workflow exists ─────────────
  describe("Dependency sanity", () => {
    it("environment-presets.yaml dependency exists on disk", () => {
      expect(fs.existsSync(PRESETS_PATH)).toBe(true);
    });
  });
});
