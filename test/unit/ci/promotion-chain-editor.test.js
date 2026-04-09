import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import {
  addEnvironment,
  removeEnvironment,
  editEnvironment,
  reorderChain,
  scanReferences,
  MinimumChainError,
  DuplicateFieldError,
  ImmutableFieldError,
  EnvironmentNotFoundError,
} from "../../validators/promotion-chain-editor.js";

// E20-S4 — /gaia-ci-edit Workflow
//
// Tests cover the CRUD operations on the ci_cd.promotion_chain block.
// Covers MPC-19 through MPC-24 from the epic test plan, plus the 13 test
// scenarios defined in the story file.
//
// The editor module is a pure function layer — it does NOT touch the
// filesystem. The workflow layer (instructions.xml) is responsible for
// reading global.yaml, calling the editor, validating the result against
// the E20-S1 validator, and writing the updated config back.

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_DIR = join(PROJECT_ROOT, "_gaia/testing/workflows/ci-edit");
const INSTRUCTIONS_PATH = join(WORKFLOW_DIR, "instructions.xml");
const WORKFLOW_YAML_PATH = join(WORKFLOW_DIR, "workflow.yaml");
const CHECKLIST_PATH = join(WORKFLOW_DIR, "checklist.md");
const COMMAND_PATH = join(PROJECT_ROOT, ".claude/commands/gaia-ci-edit.md");
const MANIFEST_PATH = join(PROJECT_ROOT, "_gaia/_config/workflow-manifest.csv");

// ── Fixture builders ─────────────────────────────────────────────
const devEntry = () => ({
  id: "dev",
  name: "Development",
  branch: "develop",
  ci_provider: "github_actions",
  merge_strategy: "squash",
  environment: "dev",
  test_tiers: ["smoke"],
  auto_merge: true,
  approval_required: false,
});
const stagingEntry = () => ({
  id: "staging",
  name: "Staging",
  branch: "staging",
  ci_provider: "github_actions",
  merge_strategy: "squash",
  environment: "staging",
  test_tiers: ["smoke", "regression"],
  auto_merge: false,
  approval_required: false,
});
const prodEntry = () => ({
  id: "prod",
  name: "Production",
  branch: "main",
  ci_provider: "github_actions",
  merge_strategy: "merge",
  environment: "production",
  test_tiers: ["smoke", "regression", "e2e"],
  auto_merge: false,
  approval_required: true,
});
const standardChain = () => [devEntry(), stagingEntry(), prodEntry()];

// ──────────────────────────────────────────────────────────────────
// MPC-20 — Add environment (AC2, AC6)
// ──────────────────────────────────────────────────────────────────
describe("E20-S4 AC2 — addEnvironment", () => {
  it("inserts a new entry at the specified position", () => {
    const chain = standardChain();
    const newEntry = {
      id: "uat",
      name: "UAT",
      branch: "uat",
      ci_provider: "github_actions",
      merge_strategy: "squash",
    };
    const result = addEnvironment(chain, newEntry, { position: 2 });
    expect(result.map((e) => e.id)).toEqual(["dev", "staging", "uat", "prod"]);
  });

  it("appends to end when position is undefined", () => {
    const chain = standardChain();
    const newEntry = {
      id: "canary",
      name: "Canary",
      branch: "canary",
      ci_provider: "github_actions",
      merge_strategy: "squash",
    };
    const result = addEnvironment(chain, newEntry);
    expect(result[result.length - 1].id).toBe("canary");
  });

  it("rejects duplicate id", () => {
    const chain = standardChain();
    const dup = {
      id: "dev",
      name: "Dev2",
      branch: "develop-2",
      ci_provider: "github_actions",
      merge_strategy: "squash",
    };
    expect(() => addEnvironment(chain, dup)).toThrow(DuplicateFieldError);
    expect(() => addEnvironment(chain, dup)).toThrow(/id.*dev/);
  });

  it("rejects duplicate branch", () => {
    const chain = standardChain();
    const dup = {
      id: "dev2",
      name: "Dev2",
      branch: "develop",
      ci_provider: "github_actions",
      merge_strategy: "squash",
    };
    expect(() => addEnvironment(chain, dup)).toThrow(DuplicateFieldError);
    expect(() => addEnvironment(chain, dup)).toThrow(/branch.*develop/);
  });

  it("does not mutate the input chain", () => {
    const chain = standardChain();
    const before = JSON.stringify(chain);
    addEnvironment(chain, {
      id: "new",
      name: "New",
      branch: "new",
      ci_provider: "github_actions",
      merge_strategy: "squash",
    });
    expect(JSON.stringify(chain)).toBe(before);
  });

  it("returns a chain that passes the E20-S1 schema validator", async () => {
    const chain = standardChain();
    const newEntry = {
      id: "uat",
      name: "UAT",
      branch: "uat",
      ci_provider: "github_actions",
      merge_strategy: "squash",
    };
    const updated = addEnvironment(chain, newEntry);
    const { validatePromotionChain } =
      await import("../../validators/promotion-chain-validator.js");
    expect(() => validatePromotionChain({ ci_cd: { promotion_chain: updated } })).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────
// MPC-21 — Remove environment (AC3, AC6)
// MPC-22 — Remove last environment (AC7)
// ──────────────────────────────────────────────────────────────────
describe("E20-S4 AC3/AC7 — removeEnvironment", () => {
  it("removes the entry matching the given id", () => {
    const chain = standardChain();
    const result = removeEnvironment(chain, "staging");
    expect(result.map((e) => e.id)).toEqual(["dev", "prod"]);
  });

  it("throws EnvironmentNotFoundError for unknown id", () => {
    const chain = standardChain();
    expect(() => removeEnvironment(chain, "nonexistent")).toThrow(EnvironmentNotFoundError);
  });

  it("blocks removal that would leave zero entries (AC7)", () => {
    const chain = [devEntry()];
    expect(() => removeEnvironment(chain, "dev")).toThrow(MinimumChainError);
    expect(() => removeEnvironment(chain, "dev")).toThrow(/at least 1 environment/);
  });

  it("does not mutate the input chain", () => {
    const chain = standardChain();
    const before = JSON.stringify(chain);
    removeEnvironment(chain, "staging");
    expect(JSON.stringify(chain)).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────
// MPC-23 — Edit environment (AC4, AC6)
// ──────────────────────────────────────────────────────────────────
describe("E20-S4 AC4 — editEnvironment", () => {
  it("updates the branch and merge_strategy of the given entry", () => {
    const chain = standardChain();
    const result = editEnvironment(chain, "staging", {
      branch: "release",
      merge_strategy: "rebase",
    });
    const staging = result.find((e) => e.id === "staging");
    expect(staging.branch).toBe("release");
    expect(staging.merge_strategy).toBe("rebase");
  });

  it("treats id as immutable (per ADR-033)", () => {
    const chain = standardChain();
    expect(() => editEnvironment(chain, "staging", { id: "stage" })).toThrow(ImmutableFieldError);
    expect(() => editEnvironment(chain, "staging", { id: "stage" })).toThrow(/id.*immutable/);
  });

  it("throws EnvironmentNotFoundError for unknown id", () => {
    const chain = standardChain();
    expect(() => editEnvironment(chain, "nonexistent", { branch: "foo" })).toThrow(
      EnvironmentNotFoundError
    );
  });

  it("rejects edit that would create a duplicate branch", () => {
    const chain = standardChain();
    expect(() => editEnvironment(chain, "staging", { branch: "develop" })).toThrow(
      DuplicateFieldError
    );
  });

  it("returns a chain that passes the E20-S1 schema validator", async () => {
    const chain = standardChain();
    const updated = editEnvironment(chain, "staging", {
      branch: "release",
      merge_strategy: "rebase",
    });
    const { validatePromotionChain } =
      await import("../../validators/promotion-chain-validator.js");
    expect(() => validatePromotionChain({ ci_cd: { promotion_chain: updated } })).not.toThrow();
  });

  it("does not mutate the input chain", () => {
    const chain = standardChain();
    const before = JSON.stringify(chain);
    editEnvironment(chain, "staging", { branch: "release" });
    expect(JSON.stringify(chain)).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────
// MPC-24 — Reorder chain (AC5, AC7)
// ──────────────────────────────────────────────────────────────────
describe("E20-S4 AC5/AC7 — reorderChain", () => {
  it("reorders entries per the given id order", () => {
    const chain = standardChain();
    const result = reorderChain(chain, ["prod", "dev", "staging"]);
    expect(result.map((e) => e.id)).toEqual(["prod", "dev", "staging"]);
  });

  it("reports a position-0 change via result metadata", () => {
    const chain = standardChain();
    const result = reorderChain(chain, ["prod", "dev", "staging"]);
    // Reorder returns an array, but we also expose a flag via a wrapper property
    expect(result.meta?.position_zero_changed).toBe(true);
    expect(result.meta?.previous_pr_target).toBe("dev");
    expect(result.meta?.new_pr_target).toBe("prod");
  });

  it("does not report position-0 change when position 0 is stable", () => {
    const chain = standardChain();
    const result = reorderChain(chain, ["dev", "prod", "staging"]);
    expect(result.meta?.position_zero_changed).toBe(false);
  });

  it("rejects an order list with missing ids", () => {
    const chain = standardChain();
    expect(() => reorderChain(chain, ["prod", "dev"])).toThrow(/order.*must include all/);
  });

  it("rejects an order list with unknown ids", () => {
    const chain = standardChain();
    expect(() => reorderChain(chain, ["prod", "dev", "staging", "ghost"])).toThrow(
      /unknown.*ghost/
    );
  });

  it("blocks reorder to empty chain (AC7)", () => {
    const chain = standardChain();
    expect(() => reorderChain(chain, [])).toThrow(MinimumChainError);
  });
});

// ──────────────────────────────────────────────────────────────────
// AC3 — Reference scanning for safety on remove/edit
// ──────────────────────────────────────────────────────────────────
describe("E20-S4 AC3 — scanReferences", () => {
  it("returns an empty report for an unreferenced environment id", () => {
    const refs = scanReferences("orphan", {
      testEnvironment: { tiers: [] },
      stories: [],
      checkpoints: [],
    });
    expect(refs.found).toBe(false);
    expect(refs.locations).toEqual([]);
  });

  it("flags test-environment.yaml tier references", () => {
    const refs = scanReferences("staging", {
      testEnvironment: {
        tiers: [
          { id: "tier1", environment: "dev" },
          { id: "tier2", environment: "staging" },
        ],
      },
      stories: [],
      checkpoints: [],
    });
    expect(refs.found).toBe(true);
    expect(refs.locations.some((l) => l.type === "test-environment")).toBe(true);
  });

  it("flags in-flight checkpoint references targeting the env branch", () => {
    const refs = scanReferences("staging", {
      testEnvironment: { tiers: [] },
      stories: [],
      checkpoints: [{ file: "dev-story-E99-S1.yaml", branch: "staging" }],
      envBranch: "staging",
    });
    expect(refs.found).toBe(true);
    expect(refs.locations.some((l) => l.type === "checkpoint")).toBe(true);
  });

  it("flags story file references in docs/implementation-artifacts", () => {
    const refs = scanReferences("staging", {
      testEnvironment: { tiers: [] },
      stories: [{ file: "E99-S1-foo.md", matches: ["staging"] }],
      checkpoints: [],
    });
    expect(refs.found).toBe(true);
    expect(refs.locations.some((l) => l.type === "story")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// Workflow file existence + structural checks
// ──────────────────────────────────────────────────────────────────
describe("E20-S4 Task 1 — workflow directory structure", () => {
  it("creates _gaia/testing/workflows/ci-edit/workflow.yaml", () => {
    expect(existsSync(WORKFLOW_YAML_PATH)).toBe(true);
  });

  it("creates _gaia/testing/workflows/ci-edit/instructions.xml", () => {
    expect(existsSync(INSTRUCTIONS_PATH)).toBe(true);
  });

  it("creates _gaia/testing/workflows/ci-edit/checklist.md", () => {
    expect(existsSync(CHECKLIST_PATH)).toBe(true);
  });

  it("workflow.yaml references the expected module, instructions, and validation paths", () => {
    const content = readFileSync(WORKFLOW_YAML_PATH, "utf8");
    expect(content).toMatch(/name:\s*ci-edit/);
    expect(content).toMatch(/module:\s*testing/);
    expect(content).toMatch(/instructions.xml/);
    expect(content).toMatch(/checklist\.md/);
  });

  it("registers /gaia-ci-edit in workflow-manifest.csv", () => {
    const manifest = readFileSync(MANIFEST_PATH, "utf8");
    expect(manifest).toMatch(/"ci-edit"/);
    expect(manifest).toMatch(/gaia-ci-edit/);
    expect(manifest).toMatch(/_gaia\/testing\/workflows\/ci-edit\/workflow\.yaml/);
  });

  it("creates the slash command file .claude/commands/gaia-ci-edit.md", () => {
    expect(existsSync(COMMAND_PATH)).toBe(true);
    const content = readFileSync(COMMAND_PATH, "utf8");
    expect(content).toMatch(/ci-edit/);
  });
});

// ──────────────────────────────────────────────────────────────────
// Instructions.xml structural content — AC1, AC3, AC6, AC7
// ──────────────────────────────────────────────────────────────────
describe("E20-S4 Task 8 — instructions.xml structural content", () => {
  const getInstructions = () => readFileSync(INSTRUCTIONS_PATH, "utf8");

  it("presents the CRUD menu with [a][r][e][o][v] operations (AC1)", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/\[a\]/);
    expect(xml).toMatch(/\[r\]/);
    expect(xml).toMatch(/\[e\]/);
    expect(xml).toMatch(/\[o\]/);
    expect(xml).toMatch(/\[v\]/);
  });

  it("handles missing ci_cd block by pointing to /gaia-ci-setup", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/gaia-ci-setup/);
  });

  it("references the E20-S1 promotion-chain validator for AC6", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/promotion-chain-validator/);
  });

  it("contains safety scan actions referencing checkpoints and stories (AC3)", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/_memory\/checkpoints/);
    expect(xml).toMatch(/implementation-artifacts/);
    expect(xml).toMatch(/test-environment\.yaml/);
  });

  it("blocks operations that would empty the chain (AC7)", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/at least 1 environment|minimum.*1|zero entries/i);
  });

  it("warns on position-0 reorder (AC5)", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/position 0|PR target/i);
  });

  it("treats id as immutable in edit operation", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/immutable/i);
  });

  it("runs cascade updates after save (Task 7)", () => {
    const xml = getInstructions();
    expect(xml).toMatch(/cascade/i);
    expect(xml).toMatch(/gaia-build-configs/);
  });
});
