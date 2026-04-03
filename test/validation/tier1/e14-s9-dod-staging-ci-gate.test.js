import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const FRAMEWORK_TEMPLATE = resolve(PROJECT_ROOT, "_gaia/lifecycle/templates/story-template.md");

describe("E14-S9: Definition of Done contains staging CI gate", () => {
  const content = readFileSync(FRAMEWORK_TEMPLATE, "utf8");
  const dodSection = content.slice(content.indexOf("## Definition of Done"));

  it("AC1: DoD section contains the staging CI gate item", () => {
    expect(dodSection).toContain("PR merged to staging with all CI checks passing");
  });

  it("AC2: staging CI gate item is under a Code Quality & CI subsection", () => {
    const codeQualityIdx = dodSection.indexOf("### Code Quality & CI");
    const ciGateIdx = dodSection.indexOf("PR merged to staging with all CI checks passing");
    expect(codeQualityIdx, "### Code Quality & CI heading must exist").toBeGreaterThan(-1);
    expect(ciGateIdx, "CI gate item must exist").toBeGreaterThan(-1);
    expect(
      ciGateIdx,
      "CI gate item must appear after ### Code Quality & CI heading"
    ).toBeGreaterThan(codeQualityIdx);
  });

  it("AC3: product source template matches framework template exactly", () => {
    const productTemplate = readFileSync(
      resolve(PROJECT_ROOT, "_gaia/lifecycle/templates/story-template.md"),
      "utf8"
    );
    expect(productTemplate).toEqual(content);
  });

  it("AC4: DoD placeholder is removed", () => {
    expect(dodSection).not.toContain("Define all the Definition of Done");
  });

  it("DoD section contains structured subsection headings", () => {
    expect(dodSection).toContain("### Acceptance");
    expect(dodSection).toContain("### Testing");
    expect(dodSection).toContain("### Code Quality & CI");
    expect(dodSection).toContain("### Documentation");
  });
});
