/**
 * Add-Stories Epic Overview Recount — E2-S8
 *
 * Tier classification: Tier 1 (programmatic, CI-safe)
 * Verifies that the add-stories workflow instructions.xml contains
 * the recount action that auto-updates epic overview table story counts
 * after appending new stories in Step 7.
 *
 * References: E2-S8 (AC1–AC4), E2-S7 Finding #1
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const INSTRUCTIONS_PATH = join(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/add-stories/instructions.xml"
);

describe("E2-S8: Add-Stories Epic Overview Recount", () => {
  const fileExists = existsSync(INSTRUCTIONS_PATH);
  const content = fileExists ? readFileSync(INSTRUCTIONS_PATH, "utf8") : "";

  describe.skipIf(!fileExists)("AC1: Recount action exists in Step 7", () => {
    it("instructions.xml contains a recount action after the template-output in Step 7", () => {
      // The recount action must appear inside step n="7" and after the </template-output> tag
      const step7Match = content.match(/<step\s+n="7"[\s\S]*?<\/step>/);
      expect(step7Match, "Step 7 not found in instructions.xml").not.toBeNull();

      const step7Content = step7Match[0];
      const templateOutputEnd = step7Content.indexOf("</template-output>");
      expect(templateOutputEnd, "No </template-output> found in Step 7").toBeGreaterThan(-1);

      // After </template-output>, there must be an <action> containing recount logic
      const afterTemplateOutput = step7Content.slice(templateOutputEnd);
      expect(
        afterTemplateOutput,
        "No recount action found after template-output in Step 7"
      ).toMatch(/<action>[\s\S]*recount[\s\S]*<\/action>/i);
    });

    it("recount action references the story header regex pattern", () => {
      const step7Match = content.match(/<step\s+n="7"[\s\S]*?<\/step>/);
      expect(step7Match).not.toBeNull();

      const step7Content = step7Match[0];
      // Must reference the regex pattern for matching story headers
      expect(
        step7Content,
        "Recount action must reference story header pattern (E\\d+)-S\\d+"
      ).toMatch(/###\s*Story.*E\\d\+.*S\\d\+|E\\d\+.*-S\\d\+/);
    });
  });

  describe.skipIf(!fileExists)("AC2: Overview table update instruction", () => {
    it("recount action instructs updating the Epic Overview table count column", () => {
      expect(content, "Instructions must reference Epic Overview table update").toMatch(
        /[Ee]pic\s+[Oo]verview\s+table/
      );

      expect(content, "Instructions must reference updating the count column").toMatch(
        /count\s*(column|cell|field)/i
      );
    });
  });

  describe.skipIf(!fileExists)("AC3: New epic row insertion", () => {
    it("recount action handles inserting new epic rows in the overview table", () => {
      expect(content, "Instructions must handle inserting new epic rows in overview table").toMatch(
        /insert.*new.*row|new.*epic.*row|add.*row.*overview/i
      );
    });
  });

  describe.skipIf(!fileExists)("AC4: Zero-count epic guard", () => {
    it("recount action preserves rows for epics with zero story headers", () => {
      expect(content, "Instructions must preserve zero-count epic rows (not delete them)").toMatch(
        /zero.*preserve|preserve.*zero|zero.*row.*keep|do\s+not\s+delete/i
      );
    });
  });
});
