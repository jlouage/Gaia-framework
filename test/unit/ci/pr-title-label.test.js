const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

/** Read a file relative to project root */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

const deriveBumpLabel = require(path.join(
  PROJECT_ROOT,
  "bin/helpers/derive-bump-label.js",
));

// --- Part 1: derive-bump-label unit tests ---

describe("E14-S11: deriveBumpLabel — PR title to bump label mapping", () => {
  // AC3: feat → bump:minor
  it("should return bump:minor for feat: prefix", () => {
    const result = deriveBumpLabel("feat: add user auth", "");
    expect(result).toEqual({
      label: "bump:minor",
      type: "feat",
      breaking: false,
    });
  });

  // AC4: fix → bump:patch
  it("should return bump:patch for fix: prefix", () => {
    const result = deriveBumpLabel("fix: null pointer in parser", "");
    expect(result).toEqual({
      label: "bump:patch",
      type: "fix",
      breaking: false,
    });
  });

  // AC4: perf → bump:patch
  it("should return bump:patch for perf: prefix", () => {
    const result = deriveBumpLabel("perf: reduce query time", "");
    expect(result).toEqual({
      label: "bump:patch",
      type: "perf",
      breaking: false,
    });
  });

  // AC2: feat! → bump:major
  it("should return bump:major for feat!: prefix (bang)", () => {
    const result = deriveBumpLabel("feat!: redesign API", "");
    expect(result).toEqual({
      label: "bump:major",
      type: "feat",
      breaking: true,
    });
  });

  // AC2: BREAKING CHANGE in body → bump:major
  it("should return bump:major when body contains BREAKING CHANGE", () => {
    const result = deriveBumpLabel(
      "feat: new API",
      "Some details\n\nBREAKING CHANGE: removed old endpoints",
    );
    expect(result).toEqual({
      label: "bump:major",
      type: "feat",
      breaking: true,
    });
  });

  // AC5: docs → bump:none
  it("should return bump:none for docs: prefix", () => {
    const result = deriveBumpLabel("docs: update README", "");
    expect(result).toEqual({
      label: "bump:none",
      type: "docs",
      breaking: false,
    });
  });

  // AC5: refactor → bump:none
  it("should return bump:none for refactor: prefix", () => {
    const result = deriveBumpLabel("refactor: extract helper", "");
    expect(result).toEqual({
      label: "bump:none",
      type: "refactor",
      breaking: false,
    });
  });

  // AC5: chore → bump:none
  it("should return bump:none for chore: prefix", () => {
    const result = deriveBumpLabel("chore: update deps", "");
    expect(result).toEqual({
      label: "bump:none",
      type: "chore",
      breaking: false,
    });
  });

  // AC5: ci → bump:none
  it("should return bump:none for ci: prefix", () => {
    const result = deriveBumpLabel("ci: fix workflow", "");
    expect(result).toEqual({
      label: "bump:none",
      type: "ci",
      breaking: false,
    });
  });

  // AC5: style → bump:none
  it("should return bump:none for style: prefix", () => {
    const result = deriveBumpLabel("style: fix indentation", "");
    expect(result).toEqual({
      label: "bump:none",
      type: "style",
      breaking: false,
    });
  });

  // AC5: test → bump:none
  it("should return bump:none for test: prefix", () => {
    const result = deriveBumpLabel("test: add coverage", "");
    expect(result).toEqual({
      label: "bump:none",
      type: "test",
      breaking: false,
    });
  });

  // AC7: invalid title → null
  it("should return null for invalid title (no conventional prefix)", () => {
    const result = deriveBumpLabel("updated the thing", "");
    expect(result).toBeNull();
  });

  // AC3: scoped prefix feat(auth) → bump:minor
  it("should return bump:minor for scoped prefix feat(auth):", () => {
    const result = deriveBumpLabel("feat(auth): add login", "");
    expect(result).toEqual({
      label: "bump:minor",
      type: "feat",
      breaking: false,
    });
  });

  // AC2: fix! → bump:major (any type with bang is breaking)
  it("should return bump:major for fix!: prefix (breaking fix)", () => {
    const result = deriveBumpLabel("fix!: critical patch", "");
    expect(result).toEqual({
      label: "bump:major",
      type: "fix",
      breaking: true,
    });
  });

  // AC2: scoped breaking change feat(api)!: → bump:major
  it("should return bump:major for scoped breaking prefix", () => {
    const result = deriveBumpLabel("feat(api)!: change response format", "");
    expect(result).toEqual({
      label: "bump:major",
      type: "feat",
      breaking: true,
    });
  });

  // Edge case: empty title
  it("should return null for empty title", () => {
    const result = deriveBumpLabel("", "");
    expect(result).toBeNull();
  });

  // Edge case: title with only type, no description
  it("should return null for title with type but no description", () => {
    const result = deriveBumpLabel("feat:", "");
    expect(result).toBeNull();
  });

  // Gap 1: null body — code guards with typeof body === "string"
  it("should return bump:minor for feat: when body is null", () => {
    const result = deriveBumpLabel("feat: add feature", null);
    expect(result).toEqual({
      label: "bump:minor",
      type: "feat",
      breaking: false,
    });
  });

  it("should return bump:minor for feat: when body is undefined", () => {
    const result = deriveBumpLabel("feat: add feature", undefined);
    expect(result).toEqual({
      label: "bump:minor",
      type: "feat",
      breaking: false,
    });
  });

  // Gap 2: BREAKING CHANGE in body with non-feat type (fix + body breaking)
  it("should return bump:major for fix: with BREAKING CHANGE in body", () => {
    const result = deriveBumpLabel(
      "fix: repair parser",
      "Details\n\nBREAKING CHANGE: changed return type",
    );
    expect(result).toEqual({
      label: "bump:major",
      type: "fix",
      breaking: true,
    });
  });

  // Gap 3: Exported constants
  it("should export TITLE_REGEX as a RegExp", () => {
    expect(deriveBumpLabel.TITLE_REGEX).toBeInstanceOf(RegExp);
  });

  it("should export TYPE_TO_LABEL as a frozen object with all 9 types", () => {
    const map = deriveBumpLabel.TYPE_TO_LABEL;
    expect(Object.isFrozen(map)).toBe(true);
    expect(Object.keys(map).sort()).toEqual(
      ["chore", "ci", "docs", "feat", "fix", "perf", "refactor", "style", "test"],
    );
  });
});

// --- Part 2: Workflow structure tests ---

describe("E14-S11: pr-title-label.yml — Workflow Structure", () => {
  let workflowYaml;

  beforeAll(() => {
    const content = readProjectFile(".github/workflows/pr-title-label.yml");
    workflowYaml = yaml.parse(content);
  });

  // AC1: triggers on opened, edited, synchronize
  describe("AC1: Workflow triggers on correct PR events", () => {
    it("should have a pull_request trigger", () => {
      expect(workflowYaml.on).toBeDefined();
      expect(workflowYaml.on.pull_request).toBeDefined();
    });

    it("should trigger on opened events", () => {
      expect(workflowYaml.on.pull_request.types).toContain("opened");
    });

    it("should trigger on edited events", () => {
      expect(workflowYaml.on.pull_request.types).toContain("edited");
    });

    it("should trigger on synchronize events", () => {
      expect(workflowYaml.on.pull_request.types).toContain("synchronize");
    });
  });

  // AC8: targets staging only
  describe("AC8: Workflow targets staging branch only", () => {
    it("should target the staging branch", () => {
      expect(workflowYaml.on.pull_request.branches).toContain("staging");
    });

    it("should only target staging (no other branches)", () => {
      expect(workflowYaml.on.pull_request.branches).toEqual(["staging"]);
    });
  });

  // Permissions
  describe("Workflow permissions", () => {
    it("should have pull-requests write permission", () => {
      expect(workflowYaml.permissions["pull-requests"]).toBe("write");
    });
  });

  // Gap 4: Job structure validation
  describe("Workflow job structure", () => {
    it("should have an auto-label job", () => {
      expect(workflowYaml.jobs["auto-label"]).toBeDefined();
    });

    it("should use actions/checkout@v4", () => {
      const steps = workflowYaml.jobs["auto-label"].steps;
      const checkout = steps.find((s) => s.uses && s.uses.startsWith("actions/checkout@"));
      expect(checkout).toBeDefined();
      expect(checkout.uses).toBe("actions/checkout@v4");
    });

    it("should use actions/setup-node@v4", () => {
      const steps = workflowYaml.jobs["auto-label"].steps;
      const nodeSetup = steps.find((s) => s.uses && s.uses.startsWith("actions/setup-node@"));
      expect(nodeSetup).toBeDefined();
      expect(nodeSetup.uses).toBe("actions/setup-node@v4");
    });

    it("should use actions/github-script@v7 for label logic", () => {
      const steps = workflowYaml.jobs["auto-label"].steps;
      const script = steps.find((s) => s.uses && s.uses.startsWith("actions/github-script@"));
      expect(script).toBeDefined();
      expect(script.uses).toBe("actions/github-script@v7");
    });

    // Gap 6: Script references correct helper modules
    it("should require derive-bump-label.js in the script", () => {
      const steps = workflowYaml.jobs["auto-label"].steps;
      const script = steps.find((s) => s.uses && s.uses.startsWith("actions/github-script@"));
      expect(script.with.script).toContain("derive-bump-label.js");
    });

    it("should require validate-bump-labels.js in the script", () => {
      const steps = workflowYaml.jobs["auto-label"].steps;
      const script = steps.find((s) => s.uses && s.uses.startsWith("actions/github-script@"));
      expect(script.with.script).toContain("validate-bump-labels.js");
    });
  });
});
