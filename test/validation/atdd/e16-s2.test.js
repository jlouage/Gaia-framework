import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const INSTRUCTIONS_XML = join(
  PROJECT_ROOT,
  "_gaia",
  "creative",
  "workflows",
  "problem-solving",
  "instructions.xml"
);
const CHECKLIST_MD = join(
  PROJECT_ROOT,
  "_gaia",
  "creative",
  "workflows",
  "problem-solving",
  "checklist.md"
);

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E16-S2: Context-Informed Analysis", () => {
  // AC1: Steps 3-7 reference Context Brief from checkpoint instead of asking user
  describe("AC1: Steps 3-7 reference Context Brief from checkpoint", () => {
    it("Step 3 (Problem Framing) has a context-informed path that reads from Context Brief", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Step 3 must reference context_brief_available conditional
      const step3Match = content.match(
        /step\s+n=["']?3["']?\s+title=["']Problem Framing["'][\s\S]*?<\/step>/
      );
      expect(step3Match).not.toBeNull();
      const step3 = step3Match[0];
      expect(step3).toMatch(/context_brief_available/);
      expect(step3).toMatch(/[Cc]ontext\s*[Bb]rief/);
    });

    it("Step 4 (Root Cause Analysis) has a context-informed path that reads from Context Brief", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step4Match = content.match(
        /step\s+n=["']?4["']?\s+title=["']Root Cause Analysis["'][\s\S]*?<\/step>/
      );
      expect(step4Match).not.toBeNull();
      const step4 = step4Match[0];
      expect(step4).toMatch(/context_brief_available/);
      expect(step4).toMatch(/[Cc]ontext\s*[Bb]rief/);
    });

    it("Step 5 (Constraint Identification) has a context-informed path that reads from Context Brief", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step5Match = content.match(
        /step\s+n=["']?5["']?\s+title=["']Constraint Identification["'][\s\S]*?<\/step>/
      );
      expect(step5Match).not.toBeNull();
      const step5 = step5Match[0];
      expect(step5).toMatch(/context_brief_available/);
      expect(step5).toMatch(/[Cc]ontext\s*[Bb]rief/);
    });

    it("Step 6 (Solution Generation) has a context-informed path that reads from Context Brief", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step6Match = content.match(
        /step\s+n=["']?6["']?\s+title=["']Solution Generation["'][\s\S]*?<\/step>/
      );
      expect(step6Match).not.toBeNull();
      const step6 = step6Match[0];
      expect(step6).toMatch(/context_brief_available/);
      expect(step6).toMatch(/[Cc]ontext\s*[Bb]rief/);
    });

    it("Step 7 (Solution Evaluation) has a context-informed path that reads from Context Brief", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step7Match = content.match(
        /step\s+n=["']?7["']?\s+title=["']Solution Evaluation["'][\s\S]*?<\/step>/
      );
      expect(step7Match).not.toBeNull();
      const step7 = step7Match[0];
      expect(step7).toMatch(/context_brief_available/);
      expect(step7).toMatch(/[Cc]ontext\s*[Bb]rief/);
    });
  });

  // AC2: Steps that previously asked for project context read from Context Brief instead
  describe("AC2: Steps read from Context Brief instead of asking user for project context", () => {
    it("context-informed paths do NOT ask user for information available in Context Brief", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must contain explicit instruction to not ask user for available info
      expect(content).toMatch(/[Dd]o\s*NOT\s*ask\s*the\s*user/);
    });

    it("context-informed paths reference specific Context Brief sections", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference reading specific sections of the Context Brief
      expect(content).toMatch(/Architecture Context/);
      expect(content).toMatch(/Decision Log Entries/);
      expect(content).toMatch(/Related Stories/);
    });
  });

  // AC3: Only asks for information NOT available in the Context Brief
  describe("AC3: Only asks for information NOT in the Context Brief", () => {
    it("context-informed steps mention asking only for unavailable information", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must mention only asking for information not in the Context Brief
      expect(content).toMatch(/[Oo]nly\s*ask.*NOT.*(?:present|available|in\s*the\s*Context)/);
    });
  });

  // AC4: Root cause analysis populates test_gaps field as array of test gap objects
  describe("AC4: test_gaps field populated as array", () => {
    it("Step 4 defines test_gaps output as an array of objects", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step4Match = content.match(
        /step\s+n=["']?4["']?\s+title=["']Root Cause Analysis["'][\s\S]*?<\/step>/
      );
      expect(step4Match).not.toBeNull();
      const step4 = step4Match[0];
      // Must use test_gaps (plural) not test_gap (singular)
      expect(step4).toMatch(/test_gaps/);
      // Must describe it as an array
      expect(step4).toMatch(/array/i);
    });

    it("test_gaps is persisted to checkpoint for downstream steps", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step4Match = content.match(
        /step\s+n=["']?4["']?\s+title=["']Root Cause Analysis["'][\s\S]*?<\/step>/
      );
      expect(step4Match).not.toBeNull();
      const step4 = step4Match[0];
      // Must reference persisting test_gaps to checkpoint
      expect(step4).toMatch(/[Pp]ersist.*test_gaps|test_gaps.*checkpoint/);
    });
  });

  // AC5: Each test_gaps entry has file_path, gap_description, suggested_test_type, severity
  describe("AC5: test_gaps entry schema", () => {
    it("test_gaps entries include file_path (string)", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/file_path/);
    });

    it("test_gaps entries include gap_description (string)", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/gap_description/);
    });

    it("test_gaps entries include suggested_test_type (enum: unit/integration/e2e)", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/suggested_test_type/);
      expect(content).toMatch(/unit.*integration.*e2e/i);
    });

    it("test_gaps entries include severity (enum: critical/high/medium/low)", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/severity/);
      expect(content).toMatch(/critical.*high.*medium.*low/i);
    });
  });

  // AC6: Fallback to interrogation-based behavior when Context Brief unavailable
  describe("AC6: Fallback behavior when Context Brief is empty or Step 0 skipped", () => {
    it("Step 3 has a fallback path for when context_brief is not available", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step3Match = content.match(
        /step\s+n=["']?3["']?\s+title=["']Problem Framing["'][\s\S]*?<\/step>/
      );
      expect(step3Match).not.toBeNull();
      const step3 = step3Match[0];
      // Must have a fallback path
      expect(step3).toMatch(/[Ff]allback\s*path/);
      expect(step3).toMatch(/not\s*context_brief_available/);
    });

    it("Step 4 has a fallback path for when context_brief is not available", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step4Match = content.match(
        /step\s+n=["']?4["']?\s+title=["']Root Cause Analysis["'][\s\S]*?<\/step>/
      );
      expect(step4Match).not.toBeNull();
      const step4 = step4Match[0];
      expect(step4).toMatch(/[Ff]allback\s*path/);
      expect(step4).toMatch(/not\s*context_brief_available/);
    });

    it("Step 5 has a fallback path for when context_brief is not available", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step5Match = content.match(
        /step\s+n=["']?5["']?\s+title=["']Constraint Identification["'][\s\S]*?<\/step>/
      );
      expect(step5Match).not.toBeNull();
      const step5 = step5Match[0];
      expect(step5).toMatch(/[Ff]allback\s*path/);
      expect(step5).toMatch(/not\s*context_brief_available/);
    });

    it("Step 6 has a fallback path for when context_brief is not available", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step6Match = content.match(
        /step\s+n=["']?6["']?\s+title=["']Solution Generation["'][\s\S]*?<\/step>/
      );
      expect(step6Match).not.toBeNull();
      const step6 = step6Match[0];
      expect(step6).toMatch(/[Ff]allback\s*path/);
      expect(step6).toMatch(/not\s*context_brief_available/);
    });

    it("Step 7 has a fallback path for when context_brief is not available", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step7Match = content.match(
        /step\s+n=["']?7["']?\s+title=["']Solution Evaluation["'][\s\S]*?<\/step>/
      );
      expect(step7Match).not.toBeNull();
      const step7 = step7Match[0];
      expect(step7).toMatch(/[Ff]allback\s*path/);
      expect(step7).toMatch(/not\s*context_brief_available/);
    });

    it("checklist.md includes fallback behavior verification items", () => {
      const content = loadFile(CHECKLIST_MD);
      expect(content).not.toBeNull();
      // Checklist must reference fallback behavior
      expect(content).toMatch(/[Ff]allback/);
      expect(content).toMatch(/no\s*errors.*degraded|no\s*degraded/i);
    });
  });

  // Step 9 frontmatter uses test_gaps (plural array) not test_gap (singular)
  describe("Step 9 artifact frontmatter uses test_gaps (plural)", () => {
    it("Step 9 template-output uses test_gaps (not test_gap) in frontmatter", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step9Match = content.match(
        /step\s+n=["']?9["']?\s+title=["']Problem-Solving Artifact["'][\s\S]*?<\/step>/
      );
      expect(step9Match).not.toBeNull();
      const step9 = step9Match[0];
      // Must use test_gaps (plural) in the frontmatter section
      expect(step9).toMatch(/test_gaps:/);
      // Must NOT use test_gap: (singular) in frontmatter
      const frontmatterSection = step9.match(/---[\s\S]*?---/);
      expect(frontmatterSection).not.toBeNull();
      expect(frontmatterSection[0]).not.toMatch(/\btest_gap:/);
    });
  });
});
