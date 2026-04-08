/**
 * E19-S13: Brownfield CI Test Execution Detection -- Acceptance Tests
 *
 * RED PHASE -- These tests define expected behavior for the CI test detector.
 * The implementation module (src/brownfield/ci-test-detector.js) must pass all tests.
 *
 * Story: As a brownfield user, I want /gaia-brownfield to detect whether the
 * project runs tests in CI so that the onboarding report accurately reflects
 * whether test execution is already automated.
 *
 * Covers: AC1-AC5 (BTI-07 through BTI-12)
 * Traces to: FR-232, NFR-041
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";

// Implementation under test
import { detectCITestExecution } from "../../../src/brownfield/ci-test-detector.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TMP_BASE = join(tmpdir(), "gaia-e19-s13-tests");

function createFixtureDir(name) {
  const dir = join(TMP_BASE, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanFixtures() {
  if (existsSync(TMP_BASE)) {
    rmSync(TMP_BASE, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1: GitHub Actions scanner (BTI-07)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S13 AC1: GitHub Actions scanner detects test job steps", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac1-github-actions");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-07a: detects npm test in GitHub Actions workflow", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-07b: detects 'npm run test' in GitHub Actions workflow", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "test.yml"),
      `name: Tests
on: push
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-07c: detects pytest in GitHub Actions workflow", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "python.yml"),
      `name: Python Tests
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pytest
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-07d: detects ./gradlew test in GitHub Actions workflow", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "java.yml"),
      `name: Java CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-07e: detects 'go test ./...' in GitHub Actions workflow", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "go.yml"),
      `name: Go CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: go test ./...
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-07f: detects bats invocations in GitHub Actions workflow", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "shell.yml"),
      `name: Shell Tests
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bats test/shell/
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-07g: detects 'mvn test' in GitHub Actions workflow", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "maven.yml"),
      `name: Maven CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: mvn test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-07h: scans multiple workflow files", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    // deploy.yml has no test step
    writeFileSync(
      join(workflowDir, "deploy.yml"),
      `name: Deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: echo "deploying"
`
    );
    // test.yml has a test step
    writeFileSync(
      join(workflowDir, "test.yml"),
      `name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Other CI provider scanners (BTI-08)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S13 AC2: Other CI provider scanners", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac2-other-ci");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-08a: detects test commands in .circleci/config.yml", async () => {
    const circleDir = join(projectDir, ".circleci");
    mkdirSync(circleDir, { recursive: true });
    writeFileSync(
      join(circleDir, "config.yml"),
      `version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run: npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("circleci");
  });

  it("BTI-08b: detects test commands in azure-pipelines.yml", async () => {
    writeFileSync(
      join(projectDir, "azure-pipelines.yml"),
      `trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
steps:
  - script: npm test
    displayName: 'Run tests'
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("azure");
  });

  it("BTI-08c: detects test commands in azure-pipelines.yml with bash step", async () => {
    writeFileSync(
      join(projectDir, "azure-pipelines.yml"),
      `trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
steps:
  - bash: pytest
    displayName: 'Run pytest'
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("azure");
  });

  it("BTI-08d: detects test commands in Jenkinsfile", async () => {
    writeFileSync(
      join(projectDir, "Jenkinsfile"),
      `pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
    }
}
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("jenkins");
  });

  it("BTI-08e: detects pytest in Jenkinsfile sh step", async () => {
    writeFileSync(
      join(projectDir, "Jenkinsfile"),
      `pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh 'pytest -v'
            }
        }
    }
}
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("jenkins");
  });

  it("BTI-08f: detects test commands in .bitbucket-pipelines.yml", async () => {
    writeFileSync(
      join(projectDir, "bitbucket-pipelines.yml"),
      `pipelines:
  default:
    - step:
        name: Test
        script:
          - npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("bitbucket");
  });

  it("BTI-08g: detects test commands in .gitlab-ci.yml", async () => {
    writeFileSync(
      join(projectDir, ".gitlab-ci.yml"),
      `test:
  stage: test
  script:
    - npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("gitlab");
  });

  it("BTI-08h: detects pytest in GitLab CI", async () => {
    writeFileSync(
      join(projectDir, ".gitlab-ci.yml"),
      `test:
  stage: test
  script:
    - pytest --cov
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("gitlab");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: Detection result format (BTI-09)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S13 AC3: Detection result format", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac3-result-format");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-09a: returns ci_test_execution with provider name", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result).toHaveProperty("ci_test_execution");
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-09b: returns ci_test_execution as null when no CI runs tests", async () => {
    // Empty project -- no CI config at all
    const result = await detectCITestExecution(projectDir);
    expect(result).toHaveProperty("ci_test_execution");
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-09c: returns test_commands array with detected commands", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result).toHaveProperty("test_commands");
    expect(Array.isArray(result.test_commands)).toBe(true);
    expect(result.test_commands.length).toBeGreaterThan(0);
  });

  it("BTI-09d: returns empty test_commands when no CI test detected", async () => {
    const result = await detectCITestExecution(projectDir);
    expect(result.test_commands).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4: Zero false positives -- NFR-041 (BTI-10)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S13 AC4: Zero false positives -- NFR-041", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac4-no-false-positives");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-10a: CI present but no test step returns null", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "deploy.yml"),
      `name: Deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build
      - run: npm run deploy
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-10b: comment containing 'npm test' does not trigger detection", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # TODO: add npm test step later
      - run: npm run build
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-10c: echo containing test command does not trigger detection", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "tests coming soon"
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-10d: env var referencing test does not trigger detection", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
env:
  TEST_CMD: "npm test"
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-10e: test mentioned in job name only does not trigger", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test-setup:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-10f: GitLab CI with only lint commands returns null", async () => {
    writeFileSync(
      join(projectDir, ".gitlab-ci.yml"),
      `lint:
  stage: test
  script:
    - npm run lint
    - npm run format:check
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-10g: Jenkinsfile with only build commands returns null", async () => {
    writeFileSync(
      join(projectDir, "Jenkinsfile"),
      `pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
    }
}
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-10h: test command in YAML comment in CircleCI does not trigger", async () => {
    const circleDir = join(projectDir, ".circleci");
    mkdirSync(circleDir, { recursive: true });
    writeFileSync(
      join(circleDir, "config.yml"),
      `version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      # - run: npm test  # disabled for now
      - run: npm run build
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: Runner correlation (BTI-11)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S13 AC5: Runner and CI provider correlation", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac5-correlation");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-11a: correlates detected runner with CI provider", async () => {
    // Project has jest as runner AND GitHub Actions running npm test
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { jest: "^29.0.0" },
        scripts: { test: "jest --coverage" },
      })
    );
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
    expect(result.test_commands).toContain("npm test");
  });

  it("BTI-11b: correlates pytest runner with GitLab CI provider", async () => {
    writeFileSync(join(projectDir, "pytest.ini"), "[pytest]\naddopts = -v");
    writeFileSync(
      join(projectDir, ".gitlab-ci.yml"),
      `test:
  stage: test
  script:
    - pytest --cov
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("gitlab");
    expect(result.test_commands).toContain("pytest --cov");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases (BTI-12)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S13 Edge cases: BTI-12", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("edge-cases");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-12a: empty project returns null", async () => {
    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
    expect(result.test_commands).toEqual([]);
  });

  it("BTI-12b: .github/workflows directory exists but is empty", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBeNull();
  });

  it("BTI-12c: multiple CI providers -- first detected wins", async () => {
    // Both GitHub Actions and GitLab CI have test commands
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
    );
    writeFileSync(
      join(projectDir, ".gitlab-ci.yml"),
      `test:
  stage: test
  script:
    - npm test
`
    );

    const result = await detectCITestExecution(projectDir);
    // Should detect one provider (github-actions has priority)
    expect(result.ci_test_execution).not.toBeNull();
    expect(["github-actions", "gitlab"]).toContain(result.ci_test_execution);
  });

  it("BTI-12d: vitest run detected as test command in CI", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: vitest run --coverage
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });

  it("BTI-12e: 'npx vitest' detected as test command in CI", async () => {
    const workflowDir = join(projectDir, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "ci.yml"),
      `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npx vitest run
`
    );

    const result = await detectCITestExecution(projectDir);
    expect(result.ci_test_execution).toBe("github-actions");
  });
});
