import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const PROTOCOL_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/core/protocols/review-gate-check.xml",
);

describe("E17-S2: Review-Gate-Check Protocol Vocabulary (FR-191, NFR-035)", () => {
  const xml = readFileSync(PROTOCOL_PATH, "utf8");

  describe("AC1: UNVERIFIED/PASSED/FAILED vocabulary", () => {
    it("protocol treats UNVERIFIED as 'not yet run'", () => {
      expect(xml).toMatch(/UNVERIFIED/);
      expect(xml).toMatch(/not yet run/i);
    });

    it("protocol recognizes PASSED as pass", () => {
      expect(xml).toMatch(/PASSED/);
    });

    it("protocol recognizes FAILED as fail", () => {
      expect(xml).toMatch(/FAILED/);
    });

    it("parses each row with the three canonical status values", () => {
      expect(xml).toMatch(/UNVERIFIED\s*\|\s*PASSED\s*\|\s*FAILED/);
    });
  });

  describe("AC2: Story advances to done ONLY when all 6 gates are PASSED", () => {
    it("protocol requires ALL 6 rows PASSED for review → done", () => {
      expect(xml).toMatch(/ALL 6 rows show PASSED/);
    });

    it("protocol does not transition to done when any gate is UNVERIFIED or FAILED", () => {
      // The evaluation step must only trigger status-sync to done under the all-PASSED branch
      expect(xml).toMatch(
        /If ALL 6 rows show PASSED[\s\S]*new_status="done"/,
      );
    });
  });

  describe("AC3: FAILED gates are surfaced by name and return story to in-progress", () => {
    it("protocol collects FAILED gate names into a list", () => {
      expect(xml).toMatch(/FAILED.*(list|names)|list.*FAILED.*(gate|review)/i);
    });

    it("protocol instructs returning the story to in-progress when any gate FAILED", () => {
      expect(xml).toMatch(/return(ed)?\s+to\s+['`"]?in-progress['`"]?/i);
    });
  });

  describe("AC4: UNVERIFIED gates produce an 'N gates not yet run' report", () => {
    it("protocol counts UNVERIFIED gates", () => {
      expect(xml).toMatch(/count.*UNVERIFIED|UNVERIFIED.*count/i);
    });

    it("protocol emits the 'N gates not yet run' phrase with gate names", () => {
      expect(xml).toMatch(/gates?\s+not\s+yet\s+run/i);
      // must reference emitting the gate names (not only the count)
      expect(xml).toMatch(
        /UNVERIFIED[\s\S]{0,400}(gate names|names of|list)/i,
      );
    });

    it("protocol blocks advancement when any gate is UNVERIFIED", () => {
      expect(xml).toMatch(/blocks?\s+advancement|do\s+not\s+(change|transition)/i);
    });
  });

  describe("AC5: Legacy values (-, blank, pending) normalize to UNVERIFIED", () => {
    it("protocol normalizes the literal dash legacy value", () => {
      expect(xml).toMatch(/['"`\-]\s*['"`]?\s*(→|->|to)\s*UNVERIFIED/);
    });

    it("protocol normalizes blank / empty legacy values", () => {
      expect(xml).toMatch(/blank|empty/i);
    });

    it("protocol normalizes the legacy 'pending' value", () => {
      expect(xml).toMatch(/pending/i);
    });

    it("normalization happens BEFORE gate evaluation", () => {
      // The normalization action must appear in Step 1 (parsing) so Step 2
      // (evaluation) operates on already-canonical values
      const step1Match = xml.match(
        /<step n="1"[\s\S]*?<\/step>/,
      );
      expect(step1Match).not.toBeNull();
      expect(step1Match[0]).toMatch(/normaliz/i);
      expect(step1Match[0]).toMatch(/UNVERIFIED/);
    });

    it("references NFR-035 for backward compatibility", () => {
      expect(xml).toMatch(/NFR-035/);
    });
  });

  describe("Structural safety", () => {
    it("protocol file name unchanged (backward compat)", () => {
      // Existing file still lives at the same path — this is the hard contract
      expect(() => readFileSync(PROTOCOL_PATH, "utf8")).not.toThrow();
    });

    it("protocol XML is well-formed (balanced tags)", () => {
      const openSteps = (xml.match(/<step\b/g) || []).length;
      const closeSteps = (xml.match(/<\/step>/g) || []).length;
      expect(openSteps).toBe(closeSteps);
      expect(xml).toMatch(/^<protocol/);
      expect(xml).toMatch(/<\/protocol>\s*$/);
    });
  });
});
