/**
 * E9-S12: Brownfield Tier 1 Ground Truth Bootstrap
 *
 * Tier classification: Tier 1 (programmatic, CI-safe)
 * Validates that the brownfield-onboarding instructions.xml contains
 * sub-steps 7d/7e/7f for Tier 1 agent ground truth bootstrap
 * (Theo, Derek, Nate) with proper extraction, merge, and reporting logic.
 *
 * References: E9-S12, AC1-AC7
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const INSTRUCTIONS_XML = join(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/anytime/brownfield-onboarding/instructions.xml"
);

let xml;
try {
  xml = readFileSync(INSTRUCTIONS_XML, "utf8");
} catch {
  xml = "";
}

describe("E9-S12: Confirmation prompt before Tier 1 bootstrap (AC7)", () => {
  it("should have a confirmation ask for Tier 1 ground truth bootstrap", () => {
    expect(xml).toMatch(
      /[Bb]ootstrap\s+[Tt]ier\s+1.*ground\s+truth|[Tt]ier\s+1.*[Bb]ootstrap.*\[y\/n\]/is
    );
  });

  it("should mention Theo, Derek, and Nate in the confirmation", () => {
    // The ask prompt should reference all three agents
    expect(xml).toMatch(/Theo.*Derek.*Nate|Theo.*Nate.*Derek/is);
  });
});

describe("E9-S12: Theo ground truth extraction — Step 7d (AC1)", () => {
  it("should extract from architecture.md for Theo", () => {
    expect(xml).toMatch(
      /[Tt]heo.*architecture\.md|architecture\.md.*[Tt]heo/is
    );
  });

  it("should extract tech stack from architecture.md", () => {
    expect(xml).toMatch(/tech.?stack/is);
  });

  it("should extract ADRs from architecture.md", () => {
    expect(xml).toMatch(/ADR/);
  });

  it("should extract component inventory from architecture.md", () => {
    expect(xml).toMatch(/component.?inventory/is);
  });

  it("should extract dependency map from architecture.md", () => {
    expect(xml).toMatch(/dependency.?map/is);
  });

  it("should fall back to brownfield-assessment.md for Theo", () => {
    expect(xml).toMatch(
      /[Tt]heo.*brownfield-assessment\.md|brownfield-assessment\.md.*fallback/is
    );
  });

  it("should write to architect-sidecar/ground-truth.md", () => {
    expect(xml).toMatch(/architect-sidecar\/ground-truth\.md/);
  });
});

describe("E9-S12: Derek ground truth extraction — Step 7e (AC2)", () => {
  it("should extract from prd.md for Derek", () => {
    expect(xml).toMatch(/[Dd]erek.*prd\.md|prd\.md.*[Dd]erek/is);
  });

  it("should support prd-brownfield-gaps.md as alternate path", () => {
    expect(xml).toMatch(/prd-brownfield-gaps\.md/);
  });

  it("should extract from epics-and-stories.md for Derek", () => {
    expect(xml).toMatch(
      /[Dd]erek.*epics-and-stories\.md|epics-and-stories\.md.*[Dd]erek/is
    );
  });

  it("should extract from nfr-assessment.md for Derek", () => {
    expect(xml).toMatch(
      /[Dd]erek.*nfr-assessment\.md|nfr-assessment\.md.*[Dd]erek/is
    );
  });

  it("should write to pm-sidecar/ground-truth.md", () => {
    expect(xml).toMatch(/pm-sidecar\/ground-truth\.md/);
  });
});

describe("E9-S12: Nate ground truth extraction — Step 7f (AC3)", () => {
  it("should extract from sprint-status.yaml for Nate", () => {
    expect(xml).toMatch(
      /[Nn]ate.*sprint-status\.yaml|sprint-status\.yaml.*[Nn]ate/is
    );
  });

  it("should extract from velocity-data.md for Nate", () => {
    expect(xml).toMatch(
      /[Nn]ate.*velocity-data\.md|velocity-data\.md.*[Nn]ate/is
    );
  });

  it("should handle missing sprint data gracefully with log message", () => {
    expect(xml).toMatch(
      /insufficient\s+sprint\s+data|velocity\s+unavailable|sprint\s+data.*missing|graceful/is
    );
  });

  it("should write to sm-sidecar/ground-truth.md", () => {
    expect(xml).toMatch(/sm-sidecar\/ground-truth\.md/);
  });
});

describe("E9-S12: Merge-safe write logic (AC4)", () => {
  it("should JIT load ground-truth-management skill", () => {
    expect(xml).toMatch(/ground-truth-management/);
  });

  it("should reference entry-structure section", () => {
    expect(xml).toMatch(/entry-structure/);
  });

  it("should reference conflict-resolution section", () => {
    expect(xml).toMatch(/conflict-resolution/);
  });

  it("should reference brownfield-extraction section", () => {
    expect(xml).toMatch(/brownfield-extraction/);
  });

  it("should specify merge semantics — no destructive overwrite", () => {
    expect(xml).toMatch(
      /merge|[Nn]o.*destructive.*overwrite|destructive.*overwrite.*never/is
    );
  });
});

describe("E9-S12: Directory auto-creation for missing sidecars (AC5)", () => {
  it("should handle missing sidecar directories", () => {
    expect(xml).toMatch(
      /directory.*creat|creat.*directory|sidecar.*missing.*creat|mkdir/is
    );
  });

  it("should create ground-truth.md with standard headers if missing", () => {
    expect(xml).toMatch(
      /ground-truth\.md.*creat|creat.*ground-truth\.md|standard\s+header/is
    );
  });
});

describe("E9-S12: Summary report output (AC6)", () => {
  it("should output a summary with entry counts per agent", () => {
    expect(xml).toMatch(
      /[Ss]eeded.*entries.*Theo|Theo.*entries|entry\s+counts/is
    );
  });

  it("should mention all three agents in the summary", () => {
    // Summary should reference Theo, Derek, and Nate
    expect(xml).toMatch(/Theo.*Derek.*Nate/is);
  });

  it("should note when sprint data was absent in summary", () => {
    expect(xml).toMatch(
      /sprint\s+data.*absent|absent.*sprint|velocity.*absent|note.*sprint/is
    );
  });
});

describe("E9-S12: Token budget guards (Task 5)", () => {
  it("should mention Theo 150K budget", () => {
    expect(xml).toMatch(/150[,.]?000|150K/i);
  });

  it("should mention Derek 100K budget", () => {
    expect(xml).toMatch(/100[,.]?000|100K/i);
  });

  it("should mention Nate 100K budget", () => {
    // This will match the same 100K as Derek but both agents should be referenced
    expect(xml).toMatch(
      /[Nn]ate.*100[,.]?000|[Nn]ate.*100K/is
    );
  });

  it("should enforce 60% budget threshold", () => {
    expect(xml).toMatch(/60%|60\s*percent|budget.*threshold/is);
  });

  it("should trim to highest-signal entries if budget exceeded", () => {
    expect(xml).toMatch(
      /trim.*highest.?signal|highest.?signal.*trim|budget.*exceed.*trim/is
    );
  });
});

describe("E9-S12: Preservation of existing Step 7 content", () => {
  it("should still contain Val ground truth bootstrap actions", () => {
    expect(xml).toMatch(/validator-sidecar/);
  });

  it("should still contain the refresh-ground-truth invoke", () => {
    expect(xml).toMatch(/refresh-ground-truth/);
  });

  it("should still contain the Val installation check", () => {
    expect(xml).toMatch(/validator\.md.*exists|[Vv]al.*installed/is);
  });
});
