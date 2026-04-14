/**
 * E25-S6: Per-Stack Tier Mapping and test-environment.yaml Extension
 *
 * Covers TEB-MS-T01 through TEB-MS-T06 plus Dev Notes edge cases:
 *   - AC1: test-environment.yaml permits `tiers.stack_hints` with the four
 *          allowed keys and their declared shapes.
 *   - AC2: Absent stack_hints → adapters fall back to defaults with
 *          `tier_source: "adapter_default"`.
 *   - AC3: Hint block present → adapter applies override and records
 *          `tier_source: "stack_hints"`.
 *   - AC4: Multi-stack monorepo resolves each adapter independently; no
 *          cross-pollination; stack namespaces remain isolated.
 *   - AC5: JS-only project — DEFAULT_GATE_TIER_MAPPING and
 *          resolveGateTierMapping are byte-identical to pre-change output.
 *   - AC6: Unknown key under `tiers.stack_hints` → validator fails loudly
 *          with the unknown key and the accepted keys.
 *
 * Traces: FR-312, ADR-028, ADR-038 §10.20.11.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import pythonAdapter from "../../../_gaia/core/bridge/adapters/python-adapter.js";
import javaAdapter from "../../../_gaia/core/bridge/adapters/java-adapter.js";
import goAdapter from "../../../_gaia/core/bridge/adapters/go-adapter.js";
import flutterAdapter from "../../../_gaia/core/bridge/adapters/flutter-adapter.js";
import { resolveAllTierMappings } from "../../../_gaia/core/bridge/adapters/index.js";
import {
  DEFAULT_GATE_TIER_MAPPING,
  resolveGateTierMapping,
  resolvePerStackTierMapping,
} from "../../../_gaia/core/bridge/review-gate-tier-mapping.js";
import { validateTestEnvironment } from "../../../_gaia/core/validators/test-environment-validator.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function mkTmp(prefix) {
  return mkdtempSync(join(tmpdir(), `e25-s6-${prefix}-`));
}

function writeFile(dir, relPath, content) {
  const full = join(dir, relPath);
  const parent = full.substring(0, full.lastIndexOf("/"));
  if (parent && parent !== dir) mkdirSync(parent, { recursive: true });
  writeFileSync(full, content);
  return full;
}

// ─── AC1 + AC6: validator schema ────────────────────────────────────────────

describe("E25-S6 AC1+AC6 — test-environment-validator stack_hints schema", () => {
  it("AC1 — accepts a full stack_hints block with every allowed key", () => {
    const yaml = `
version: 1
runners:
  - name: vitest
    command: npm test
    tier: tier_1_unit
tiers:
  stack_hints:
    pytest_markers: [slow, integration]
    gradle_tasks:
      unit: test
      integration: integrationTest
      e2e: e2eTest
    go_build_tags: [integration, e2e]
    flutter_suites:
      unit: test/
      integration: integration_test/
      e2e: integration_test/e2e/
`;
    const result = validateTestEnvironment(yaml);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.stackHints).toBeTruthy();
    expect(result.stackHints.pytest_markers).toEqual(["slow", "integration"]);
    expect(result.stackHints.gradle_tasks).toEqual({
      unit: "test",
      integration: "integrationTest",
      e2e: "e2eTest",
    });
    expect(result.stackHints.go_build_tags).toEqual(["integration", "e2e"]);
    expect(result.stackHints.flutter_suites).toEqual({
      unit: "test/",
      integration: "integration_test/",
      e2e: "integration_test/e2e/",
    });
  });

  it("AC1 — accepts a partial stack_hints block (single stack)", () => {
    const yaml = `
version: 1
runners:
  - name: pytest
    command: pytest
    tier: tier_1_unit
tiers:
  stack_hints:
    pytest_markers: [slow]
`;
    const result = validateTestEnvironment(yaml);
    expect(result.valid).toBe(true);
    expect(result.stackHints).toEqual({ pytest_markers: ["slow"] });
  });

  it("AC6 — TEB-MS-T05 — rejects unknown key under stack_hints", () => {
    const yaml = `
version: 1
runners:
  - name: vitest
    command: npm test
    tier: tier_1_unit
tiers:
  stack_hints:
    rust_features: [integration, slow]
`;
    const result = validateTestEnvironment(yaml);
    expect(result.valid).toBe(false);
    const msg = result.warnings.find((w) => w.includes("rust_features"));
    expect(msg).toBeTruthy();
    // Error message must list the accepted keys so users can fix typos.
    expect(msg).toContain("pytest_markers");
    expect(msg).toContain("gradle_tasks");
    expect(msg).toContain("go_build_tags");
    expect(msg).toContain("flutter_suites");
  });

  it("AC6 — absent stack_hints is silently valid (no warnings)", () => {
    const yaml = `
version: 1
runners:
  - name: vitest
    command: npm test
    tier: tier_1_unit
`;
    const result = validateTestEnvironment(yaml);
    expect(result.valid).toBe(true);
    expect(result.stackHints).toBeNull();
  });
});

// ─── AC2 + AC3: per-adapter resolveTierMapping ──────────────────────────────

describe("E25-S6 AC2 — adapters fall back to defaults when no hints given", () => {
  it("TEB-MS-T01 — python adapter emits adapter_default entries", () => {
    const dir = mkTmp("py-default");
    try {
      writeFile(dir, "pyproject.toml", '[project]\nname = "x"\n');
      const result = pythonAdapter.resolveTierMapping(dir);
      expect(result.entries.length).toBeGreaterThan(0);
      for (const entry of result.entries) {
        expect(entry.tier_source).toBe("adapter_default");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("TEB-MS-T01 — java adapter emits adapter_default entries", () => {
    const result = javaAdapter.resolveTierMapping("/nonexistent");
    expect(result.entries.map((e) => e.tier_source)).toEqual([
      "adapter_default",
      "adapter_default",
      "adapter_default",
    ]);
    expect(result.mapping).toEqual({
      unit: "test",
      integration: "integrationTest",
      e2e: "e2eTest",
    });
  });

  it("TEB-MS-T01 — flutter adapter emits adapter_default entries", () => {
    const result = flutterAdapter.resolveTierMapping("/nonexistent");
    expect(result.entries.map((e) => e.tier_source)).toEqual([
      "adapter_default",
      "adapter_default",
      "adapter_default",
    ]);
  });
});

describe("E25-S6 AC3 — adapters apply stack_hints overrides", () => {
  it("TEB-MS-T02 — python pytest_markers override records stack_hints", () => {
    const dir = mkTmp("py-hint");
    try {
      writeFile(dir, "pyproject.toml", '[project]\nname = "x"\n');
      const result = pythonAdapter.resolveTierMapping(dir, {
        stackHints: ["slow", "integration"],
      });
      expect(result.entries).toEqual([
        { tier: "slow", marker: "slow", tier_source: "stack_hints" },
        {
          tier: "integration",
          marker: "integration",
          tier_source: "stack_hints",
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("TEB-MS-T03 — java gradle_tasks override records stack_hints", () => {
    const result = javaAdapter.resolveTierMapping("/irrelevant", {
      stackHints: { unit: "fastTest", integration: "intTest", e2e: "e2eSmoke" },
    });
    expect(result.mapping).toEqual({
      unit: "fastTest",
      integration: "intTest",
      e2e: "e2eSmoke",
    });
    for (const entry of result.entries) {
      expect(entry.tier_source).toBe("stack_hints");
    }
  });

  it("Edge — java partial hint block: unset tier falls back to default", () => {
    const result = javaAdapter.resolveTierMapping("/irrelevant", {
      stackHints: { unit: "test", integration: "integrationTest" },
      // e2e omitted
    });
    const byTier = Object.fromEntries(result.entries.map((e) => [e.tier, e]));
    expect(byTier.unit.tier_source).toBe("stack_hints");
    expect(byTier.integration.tier_source).toBe("stack_hints");
    expect(byTier.e2e.tier_source).toBe("adapter_default");
    expect(byTier.e2e.task).toBe("e2eTest");
  });

  it("Flutter — flutter_suites override records stack_hints", () => {
    const result = flutterAdapter.resolveTierMapping("/irrelevant", {
      stackHints: { unit: "test/fast/", e2e: "integration_test/smoke/" },
    });
    const byTier = Object.fromEntries(result.entries.map((e) => [e.tier, e]));
    expect(byTier.unit.suite).toBe("test/fast/");
    expect(byTier.unit.tier_source).toBe("stack_hints");
    expect(byTier.e2e.suite).toBe("integration_test/smoke/");
    expect(byTier.e2e.tier_source).toBe("stack_hints");
    expect(byTier.integration.tier_source).toBe("adapter_default");
  });

  it("Go — array-form go_build_tags override records stack_hints", () => {
    const dir = mkTmp("go-hint");
    try {
      writeFile(dir, "go.mod", "module x\n");
      const result = goAdapter.resolveTierMapping(dir, {
        stackHints: ["integration", "e2e"],
      });
      for (const e of result.entries) expect(e.tier_source).toBe("stack_hints");
      expect(result.mapping).toEqual({ integration: "integration", e2e: "e2e" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── AC4: multi-stack registry resolution ─────────────────────────────────

describe("E25-S6 AC4 — TEB-MS-T04 multi-stack registry resolution", () => {
  it("resolves python + go independently with namespace isolation", () => {
    const dir = mkTmp("multi");
    try {
      // Python + Go monorepo
      writeFile(dir, "pyproject.toml", '[project]\nname = "x"\n');
      writeFile(dir, "go.mod", "module x\n");

      const stackHints = {
        pytest_markers: ["slow"],
        go_build_tags: ["integration", "e2e"],
      };

      const { perStack, unusedHints } = resolveAllTierMappings(dir, stackHints);

      // Python active with stack_hints
      expect(perStack.python.active).toBe(true);
      expect(perStack.python.entries.every((e) => e.tier_source === "stack_hints")).toBe(true);

      // Go active with stack_hints
      expect(perStack.go.active).toBe(true);
      expect(perStack.go.entries.every((e) => e.tier_source === "stack_hints")).toBe(true);

      // Java / Flutter inactive (no pom.xml, no pubspec.yaml)
      expect(perStack.java.active).toBe(false);
      expect(perStack.flutter.active).toBe(false);

      // No cross-pollination: unusedHints is empty because every hint we
      // supplied had a corresponding active stack.
      expect(unusedHints).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Edge — hint for inactive stack is silently ignored and logged in unusedHints", () => {
    const dir = mkTmp("unused-hint");
    try {
      // Only a Python project — no go.mod
      writeFile(dir, "pyproject.toml", '[project]\nname = "x"\n');
      const { perStack, unusedHints } = resolveAllTierMappings(dir, {
        go_build_tags: ["integration", "e2e"],
      });
      expect(perStack.go.active).toBe(false);
      expect(unusedHints).toContain("go");
      expect(perStack.python.active).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolvePerStackTierMapping — reads tiers.stack_hints from parsed test-environment", () => {
    const dir = mkTmp("resolver");
    try {
      writeFile(dir, "pyproject.toml", '[project]\nname = "x"\n');
      const testEnvironment = {
        tiers: { stack_hints: { pytest_markers: ["fast"] } },
      };
      const { perStack } = resolvePerStackTierMapping(dir, testEnvironment);
      expect(perStack.python.active).toBe(true);
      expect(perStack.python.entries[0].tier_source).toBe("stack_hints");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── AC5: JS byte-identical regression ─────────────────────────────────────

describe("E25-S6 AC5 — TEB-MS-T06 JS gate mapping byte-identical", () => {
  it("DEFAULT_GATE_TIER_MAPPING unchanged (pre-E25-S6 snapshot)", () => {
    // This snapshot is the canonical E17-S12 mapping. Any change to this
    // literal triggers a test failure and forces explicit review —
    // E25-S6 MUST NOT alter the JS gate mapping.
    const snapshot = {
      "qa-tests": ["unit", "integration"],
      "test-automate": ["unit"],
      "test-review": ["integration"],
      "review-perf": ["e2e"],
      "security-review": ["integration", "e2e"],
      "code-review": [],
    };
    // Convert the frozen object to a plain snapshot for comparison.
    const actual = {};
    for (const [k, v] of Object.entries(DEFAULT_GATE_TIER_MAPPING)) {
      actual[k] = [...v];
    }
    expect(actual).toEqual(snapshot);
  });

  it("resolveGateTierMapping with no custom block returns default", () => {
    const resolved = resolveGateTierMapping(null);
    expect(resolved["qa-tests"]).toEqual(["unit", "integration"]);
    expect(resolved["code-review"]).toEqual([]);
  });

  it("JS-only project — registry resolver leaves JS adapter as inactive tier mapper", () => {
    const dir = mkTmp("js-only");
    try {
      writeFile(dir, "package.json", JSON.stringify({ name: "x", scripts: { test: "vitest" } }));
      const { perStack } = resolveAllTierMappings(dir, null);
      // JS adapter does not expose resolveTierMapping — it is reported as
      // active: true with mapping: null, preserving E17-S12 semantics.
      expect(perStack.javascript.active).toBe(true);
      expect(perStack.javascript.mapping).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
