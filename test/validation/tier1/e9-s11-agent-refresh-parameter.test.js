/**
 * E9-S11: Extended Ground Truth Refresh --agent Parameter
 *
 * Tier classification: Tier 1 (programmatic, CI-safe)
 * Validates that the val-refresh-ground-truth workflow correctly declares
 * the --agent parameter and that instructions.xml contains agent-specific
 * dispatch, inventory scans, routing, and budget logic.
 *
 * References: E9-S11, AC1-AC10
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_DIR = join(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/val-refresh-ground-truth"
);
const WORKFLOW_YAML = join(WORKFLOW_DIR, "workflow.yaml");
const INSTRUCTIONS_XML = join(WORKFLOW_DIR, "instructions.xml");
const CHECKLIST_MD = join(WORKFLOW_DIR, "checklist.md");

describe("E9-S11: --agent parameter in workflow.yaml (AC5, AC6)", () => {
  let config;

  try {
    config = yaml.load(readFileSync(WORKFLOW_YAML, "utf8"));
  } catch {
    config = null;
  }

  it("should have a parameters block", () => {
    expect(config?.parameters).toBeTruthy();
  });

  it("should declare an agent parameter", () => {
    expect(config?.parameters?.agent).toBeTruthy();
  });

  it("should have --agent flag", () => {
    expect(config?.parameters?.agent?.flag).toBe("--agent");
  });

  it("should default to val", () => {
    expect(config?.parameters?.agent?.default).toBe("val");
  });

  it("should allow val, theo, derek, nate, all", () => {
    const allowed = config?.parameters?.agent?.allowed_values;
    expect(allowed).toBeTruthy();
    expect(allowed).toContain("val");
    expect(allowed).toContain("theo");
    expect(allowed).toContain("derek");
    expect(allowed).toContain("nate");
    expect(allowed).toContain("all");
    expect(allowed).toHaveLength(5);
  });

  it("should preserve existing incremental parameter", () => {
    expect(config?.parameters?.incremental).toBeTruthy();
    expect(config?.parameters?.incremental?.flag).toBe("--incremental");
  });
});

describe("E9-S11: Resolve Agent Target step in instructions.xml (AC5, AC6)", () => {
  let xml;

  try {
    xml = readFileSync(INSTRUCTIONS_XML, "utf8");
  } catch {
    xml = "";
  }

  it("should contain a step for resolving agent target", () => {
    expect(xml).toMatch(/step\s+n="\d+".*title.*[Rr]esolve\s+[Aa]gent/);
  });

  it("should parse --agent from arguments", () => {
    expect(xml).toMatch(/--agent/);
  });

  it("should validate against allowed values", () => {
    expect(xml).toMatch(/allowed.*(val|theo|derek|nate|all)/is);
  });

  it("should halt on unrecognized agent name (AC6)", () => {
    expect(xml).toMatch(/[Hh][Aa][Ll][Tt].*([Uu]nknown|[Uu]nrecognized|[Ii]nvalid).*agent/is);
  });
});

describe("E9-S11: Per-agent sidecar initialization in Step 2 (AC7)", () => {
  let xml;

  try {
    xml = readFileSync(INSTRUCTIONS_XML, "utf8");
  } catch {
    xml = "";
  }

  it("should reference architect-sidecar for theo", () => {
    expect(xml).toMatch(/architect-sidecar/);
  });

  it("should reference pm-sidecar for derek", () => {
    expect(xml).toMatch(/pm-sidecar/);
  });

  it("should reference sm-sidecar for nate", () => {
    expect(xml).toMatch(/sm-sidecar/);
  });

  it("should handle missing ground-truth.md creation", () => {
    expect(xml).toMatch(/ground-truth\.md.*missing|missing.*ground-truth\.md/is);
  });
});

describe("E9-S11: Agent-specific inventory scans in Step 6 (AC1, AC2, AC3)", () => {
  let xml;

  try {
    xml = readFileSync(INSTRUCTIONS_XML, "utf8");
  } catch {
    xml = "";
  }

  it("should scan architecture.md for theo (AC1)", () => {
    expect(xml).toMatch(/theo.*architecture\.md|architecture\.md.*theo/is);
  });

  it("should scan filesystem structure for theo (AC1)", () => {
    expect(xml).toMatch(/theo.*filesystem|filesystem.*theo/is);
  });

  it("should scan prd.md for derek (AC2)", () => {
    expect(xml).toMatch(/derek.*prd\.md|prd\.md.*derek/is);
  });

  it("should scan epics-and-stories.md for derek (AC2)", () => {
    expect(xml).toMatch(/derek.*epics-and-stories\.md|epics-and-stories\.md.*derek/is);
  });

  it("should scan sprint-status.yaml for derek (AC2)", () => {
    expect(xml).toMatch(/derek.*sprint-status\.yaml|sprint-status\.yaml.*derek/is);
  });

  it("should scan sprint-status.yaml for nate (AC3)", () => {
    expect(xml).toMatch(/nate.*sprint-status\.yaml|sprint-status\.yaml.*nate/is);
  });

  it("should scan story files for nate (AC3)", () => {
    expect(xml).toMatch(
      /nate.*story.*(files|implementation-artifacts)|implementation-artifacts.*nate/is
    );
  });

  it("should preserve existing 6-target val scan (AC5)", () => {
    // Val scan should still have its 6 targets
    expect(xml).toMatch(/[Tt]arget\s+1.*[Pp]roject\s+[Ss]ource/);
  });
});

describe("E9-S11: Decision log routing to agent's own sidecar (AC10)", () => {
  let xml;

  try {
    xml = readFileSync(INSTRUCTIONS_XML, "utf8");
  } catch {
    xml = "";
  }

  it("should route diff report to target agent's decision-log.md", () => {
    // Should reference the resolved agent's sidecar path for decision-log
    expect(xml).toMatch(
      /target.*agent.*decision-log|decision-log.*target.*agent|resolved.*sidecar.*decision-log/is
    );
  });
});

describe("E9-S11: Per-agent token budgets in Step 11 (AC9)", () => {
  let xml;

  try {
    xml = readFileSync(INSTRUCTIONS_XML, "utf8");
  } catch {
    xml = "";
  }

  it("should reference per-agent budget from _memory/config.yaml", () => {
    expect(xml).toMatch(/ground_truth_budget|per-agent.*budget|agent.*budget/is);
  });

  it("should mention Val 200K budget", () => {
    expect(xml).toMatch(/200[,.]?000|200K/i);
  });

  it("should mention Theo 150K budget", () => {
    expect(xml).toMatch(/150[,.]?000|150K/i);
  });

  it("should mention Derek/Nate 100K budget", () => {
    expect(xml).toMatch(/100[,.]?000|100K/i);
  });
});

describe("E9-S11: --agent all orchestration (AC4, AC8)", () => {
  let xml;

  try {
    xml = readFileSync(INSTRUCTIONS_XML, "utf8");
  } catch {
    xml = "";
  }

  it("should support --agent all mode", () => {
    expect(xml).toMatch(/agent.*all|all.*agents/is);
  });

  it("should run agents sequentially: val, theo, derek, nate (AC4)", () => {
    expect(xml).toMatch(/val.*theo.*derek.*nate/is);
  });

  it("should handle partial failure gracefully (AC8)", () => {
    expect(xml).toMatch(/fail.*continue|continue.*remaining|partial.*fail/is);
  });

  it("should present combined summary (AC4)", () => {
    expect(xml).toMatch(/combined.*summary|summary.*all|per-agent.*status/is);
  });
});

describe("E9-S11: Checklist coverage", () => {
  let checklist;

  try {
    checklist = readFileSync(CHECKLIST_MD, "utf8");
  } catch {
    checklist = "";
  }

  it("should have --agent parameter validation item", () => {
    expect(checklist).toMatch(/--agent.*param|agent.*param/is);
  });

  it("should have per-agent sidecar init item", () => {
    expect(checklist).toMatch(/sidecar.*init|per-agent.*sidecar/is);
  });

  it("should have --agent all sequencing item", () => {
    expect(checklist).toMatch(/--agent\s+all|all.*sequen/is);
  });
});
