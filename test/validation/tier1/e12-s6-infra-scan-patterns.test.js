import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const LIFECYCLE_DIR = join(GAIA_DIR, "lifecycle");
const TEMPLATES_DIR = join(LIFECYCLE_DIR, "templates");
const KNOWLEDGE_DIR = join(LIFECYCLE_DIR, "knowledge", "brownfield");
const BROWNFIELD_DIR = join(LIFECYCLE_DIR, "workflows", "anytime", "brownfield-onboarding");

/** Helper to read file content */
function readFile(filePath) {
  return readFileSync(filePath, "utf8");
}

// ===========================================================================
// AC1: Infra-specific detection patterns applied alongside app patterns
// ===========================================================================

describe("E12-S6: Gap Entry Schema — 12 categories", () => {
  const schemaPath = join(TEMPLATES_DIR, "gap-entry-schema.md");

  it("gap-entry-schema.md exists", () => {
    expect(existsSync(schemaPath)).toBe(true);
  });

  it("contains all 5 infrastructure categories", () => {
    const content = readFile(schemaPath);
    const infraCategories = [
      "resource-drift",
      "config-sprawl",
      "secret-exposure",
      "missing-policy",
      "environment-skew",
    ];
    for (const cat of infraCategories) {
      expect(content).toContain(cat);
    }
  });

  it("contains all 7 application categories", () => {
    const content = readFile(schemaPath);
    const appCategories = [
      "config-contradiction",
      "dead-code",
      "hard-coded-logic",
      "security-endpoint",
      "runtime-behavior",
      "doc-code-drift",
      "integration-seam",
    ];
    for (const cat of appCategories) {
      expect(content).toContain(cat);
    }
  });

  it("ID regex includes all 12 category values", () => {
    const content = readFile(schemaPath);
    const regexMatch = content.match(/\^GAP-\(([^)]+)\)/);
    expect(regexMatch).not.toBeNull();
    const categories = regexMatch[1].split("|");
    expect(categories).toHaveLength(12);
    expect(categories).toContain("resource-drift");
    expect(categories).toContain("config-sprawl");
    expect(categories).toContain("secret-exposure");
    expect(categories).toContain("missing-policy");
    expect(categories).toContain("environment-skew");
  });
});

// ===========================================================================
// AC2: E11-S2 Config Contradiction Scanner — infra patterns
// ===========================================================================

describe("E12-S6: Config Contradiction Scanner infra patterns (AC2)", () => {
  const scannerPath = join(KNOWLEDGE_DIR, "config-contradiction-scan.md");

  it("config-contradiction-scan.md exists", () => {
    expect(existsSync(scannerPath)).toBe(true);
  });

  it("contains terraform.tfvars detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toContain("terraform.tfvars");
  });

  it("contains values.yaml detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toContain("values.yaml");
  });

  it("contains kustomize overlay detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toContain("kustomize");
  });

  it("contains project_type conditional logic", () => {
    const content = readFile(scannerPath);
    expect(content).toMatch(/project.type|infrastructure|platform/i);
  });
});

// ===========================================================================
// AC3: E11-S4 Hard-Coded Logic Detector — infra patterns
// ===========================================================================

describe("E12-S6: Hard-Coded Logic Detector infra patterns (AC3)", () => {
  const scannerPath = join(TEMPLATES_DIR, "brownfield-scan-hardcoded-prompt.md");

  it("brownfield-scan-hardcoded-prompt.md exists", () => {
    expect(existsSync(scannerPath)).toBe(true);
  });

  it("contains hard-coded IP detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/hard.coded.ip|ip.address/);
  });

  it("contains magic port detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/magic.port|port.number/);
  });

  it("contains embedded secret/credential detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/embedded.secret|ami.id|access.key/);
  });

  it("contains hard-coded resource limit detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/resource.limit|cpu|memory/);
  });

  it("contains project_type conditional logic", () => {
    const content = readFile(scannerPath);
    expect(content).toMatch(/project.type|infrastructure|platform/i);
  });
});

// ===========================================================================
// AC4: E11-S5 Security Endpoint Audit — infra patterns
// ===========================================================================

describe("E12-S6: Security Endpoint Audit infra patterns (AC4)", () => {
  const scannerPath = join(TEMPLATES_DIR, "brownfield-scan-security-prompt.md");

  it("brownfield-scan-security-prompt.md exists", () => {
    expect(existsSync(scannerPath)).toBe(true);
  });

  it("contains exposed port detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/exposed.port/);
  });

  it("contains permissive ingress rule detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/permissive.ingress|ingress.rule/);
  });

  it("contains overly broad RBAC binding detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/rbac|rolebinding|clusterrolebinding/);
  });

  it("contains missing NetworkPolicy detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/networkpolicy/);
  });

  it("contains project_type conditional logic", () => {
    const content = readFile(scannerPath);
    expect(content).toMatch(/project.type|infrastructure|platform/i);
  });
});

// ===========================================================================
// AC5: E11-S6 Runtime Behavior Inventory — infra patterns
// ===========================================================================

describe("E12-S6: Runtime Behavior Inventory infra patterns (AC5)", () => {
  const scannerPath = join(TEMPLATES_DIR, "brownfield-scan-runtime-behavior-prompt.md");

  it("brownfield-scan-runtime-behavior-prompt.md exists", () => {
    expect(existsSync(scannerPath)).toBe(true);
  });

  it("contains CronJob detection", () => {
    const content = readFile(scannerPath);
    expect(content).toMatch(/CronJob/i);
  });

  it("contains DaemonSet detection", () => {
    const content = readFile(scannerPath);
    expect(content).toMatch(/DaemonSet/i);
  });

  it("contains init container detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/init.container/);
  });

  it("contains sidecar pattern detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/sidecar/);
  });

  it("contains health probe detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/health.probe|liveness|readiness|startup/);
  });

  it("contains project_type conditional logic", () => {
    const content = readFile(scannerPath);
    expect(content).toMatch(/project.type|infrastructure|platform/i);
  });
});

// ===========================================================================
// AC6: E11-S8 Integration Seam Analyzer — infra patterns
// ===========================================================================

describe("E12-S6: Integration Seam Analyzer infra patterns (AC6)", () => {
  const scannerPath = join(TEMPLATES_DIR, "brownfield-scan-integration-seam-prompt.md");

  it("brownfield-scan-integration-seam-prompt.md exists", () => {
    expect(existsSync(scannerPath)).toBe(true);
  });

  it("contains service mesh topology mapping", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/service.mesh/);
  });

  it("contains ingress/egress route mapping", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/ingress.*egress|egress.*ingress/);
  });

  it("contains cross-namespace dependency detection", () => {
    const content = readFile(scannerPath);
    expect(content.toLowerCase()).toMatch(/cross.namespace/);
  });

  it("contains project_type conditional logic", () => {
    const content = readFile(scannerPath);
    expect(content).toMatch(/project.type|infrastructure|platform/i);
  });
});

// ===========================================================================
// AC7: Gap-to-requirement mapping for infra PRD sections
// ===========================================================================

describe("E12-S6: Gap-to-requirement mapping (AC7)", () => {
  const instructionsPath = join(BROWNFIELD_DIR, "instructions.xml");

  it("brownfield instructions.xml exists", () => {
    expect(existsSync(instructionsPath)).toBe(true);
  });

  it("Step 2.5 passes project_type to scan subagents", () => {
    const content = readFile(instructionsPath);
    // Step 2.5 should reference project_type
    expect(content).toMatch(/project.type/i);
  });

  it("contains infra gap-to-requirement mapping", () => {
    const content = readFile(instructionsPath);
    // Must map 5 infra gap categories to PRD sections
    expect(content).toContain("resource-drift");
    expect(content).toContain("config-sprawl");
    expect(content).toContain("secret-exposure");
    expect(content).toContain("missing-policy");
    expect(content).toContain("environment-skew");
  });

  it("maps infra categories to correct PRD sections", () => {
    const content = readFile(instructionsPath);
    expect(content).toContain("Resource Specifications");
    expect(content).toContain("Security Posture");
    expect(content).toContain("Environment Strategy");
    expect(content).toContain("Operational");
    expect(content).toContain("Verification Strategy");
  });

  it("wires all 5 scan subagents with infra awareness", () => {
    const content = readFile(instructionsPath);
    // Verify the 5 scanner subagent invocations reference infra
    expect(content).toMatch(/config.contradiction.*infra|infra.*config.contradiction/is);
    expect(content).toMatch(/hard.coded.*infra|infra.*hard.coded/is);
    expect(content).toMatch(/security.*infra|infra.*security/is);
    expect(content).toMatch(/runtime.*infra|infra.*runtime/is);
    expect(content).toMatch(/integration.*infra|infra.*integration/is);
  });
});
