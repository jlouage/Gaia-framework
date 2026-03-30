const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const os = require("os");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const ROOT = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(ROOT, "bin/generate-checksums.js");
const CHECKSUMS_FILE = path.join(ROOT, "checksums.txt");

/**
 * Create an isolated temp project with a copy of generate-checksums.js
 * and a minimal package.json. Used by error-handling tests to avoid
 * mutating the real gaia-install.sh (which causes race conditions
 * with parallel Vitest forks — see AF-2026-03-28-1).
 *
 * @param {object} opts
 * @param {string[]} opts.files - files array for the temp package.json
 * @param {object} [opts.fileContents] - map of relative path → content to create
 * @returns {{ root: string, script: string, cleanup: () => void }}
 */
function createIsolatedProject({ files, fileContents = {} }) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gaia-checksum-test-"));
  const binDir = path.join(tmpRoot, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  // Copy the real generate-checksums.js script
  fs.copyFileSync(SCRIPT, path.join(binDir, "generate-checksums.js"));

  // Write a minimal package.json with the requested files array
  fs.writeFileSync(
    path.join(tmpRoot, "package.json"),
    JSON.stringify({ name: "test-project", version: "0.0.0", files }, null, 2)
  );

  // Create any requested files
  for (const [relPath, content] of Object.entries(fileContents)) {
    const fullPath = path.join(tmpRoot, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  const script = path.join(binDir, "generate-checksums.js");

  return {
    root: tmpRoot,
    script,
    cleanup: () => fs.rmSync(tmpRoot, { recursive: true, force: true }),
  };
}

/**
 * Helper: run the generator script and return { stdout, exitCode }.
 * Throws on non-zero exit unless `expectFailure` is true.
 */
function runGenerator({ expectFailure = false, cwd = ROOT, script = SCRIPT } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      env: { ...process.env },
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    if (expectFailure) {
      return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.status };
    }
    throw err;
  }
}

/**
 * Helper: parse checksums.txt content into an array of { hash, file } objects.
 */
function parseChecksums(content) {
  return content
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      // BSD format: <hash>  <filename> (two spaces)
      const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/);
      if (!match) throw new Error(`Invalid checksum line: ${line}`);
      return { hash: match[1], file: match[2] };
    });
}

describe("generate-checksums.js", () => {
  // Clean up any generated checksums.txt after each test
  afterEach(() => {
    try {
      if (fs.existsSync(CHECKSUMS_FILE)) {
        fs.unlinkSync(CHECKSUMS_FILE);
      }
    } catch {
      // ignore cleanup errors
    }
  });

  it("should exist as a script file", () => {
    expect(fs.existsSync(SCRIPT)).toBe(true);
  });

  it("should be valid Node.js syntax", () => {
    expect(() => {
      execFileSync(process.execPath, ["--check", SCRIPT]);
    }).not.toThrow();
  });

  describe("happy path — checksums.txt generation", () => {
    it("should generate checksums.txt in the project root", () => {
      runGenerator();
      expect(fs.existsSync(CHECKSUMS_FILE)).toBe(true);
    });

    it("should use BSD-compatible format with two spaces between hash and filename", () => {
      runGenerator();
      const content = fs.readFileSync(CHECKSUMS_FILE, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        // Exactly 64 hex chars, two spaces, then a relative path
        expect(line).toMatch(/^[a-f0-9]{64} {2}.+$/);
      }
    });

    it("should include package.json in the checksums", () => {
      runGenerator();
      const content = fs.readFileSync(CHECKSUMS_FILE, "utf8");
      const entries = parseChecksums(content);
      const packageEntry = entries.find((e) => e.file === "package.json");
      expect(packageEntry).toBeDefined();
    });

    it("should include all files from the package.json files array", () => {
      runGenerator();
      const content = fs.readFileSync(CHECKSUMS_FILE, "utf8");
      const entries = parseChecksums(content);
      // Normalize to forward slashes for cross-platform comparison
      const files = entries.map((e) => e.file.replace(/\\/g, "/"));

      // At minimum, gaia-install.sh and bin/gaia-framework.js must be present
      expect(files).toContain("gaia-install.sh");
      expect(files.some((f) => f.startsWith("bin/"))).toBe(true);
    });

    it("should produce correct sha256 hashes for each file", () => {
      runGenerator();
      const content = fs.readFileSync(CHECKSUMS_FILE, "utf8");
      const entries = parseChecksums(content);

      for (const entry of entries) {
        const filePath = path.join(ROOT, entry.file);
        const fileContent = fs.readFileSync(filePath);
        const expectedHash = crypto.createHash("sha256").update(fileContent).digest("hex");
        expect(entry.hash).toBe(expectedHash);
      }
    });

    it("should use relative paths (no leading slash or absolute paths)", () => {
      runGenerator();
      const content = fs.readFileSync(CHECKSUMS_FILE, "utf8");
      const entries = parseChecksums(content);
      for (const entry of entries) {
        expect(entry.file).not.toMatch(/^\//);
        expect(entry.file).not.toMatch(/^[A-Z]:\\/);
      }
    });

    it("should produce identical output on re-run (idempotency)", () => {
      runGenerator();
      const first = fs.readFileSync(CHECKSUMS_FILE, "utf8");
      runGenerator();
      const second = fs.readFileSync(CHECKSUMS_FILE, "utf8");
      expect(first).toBe(second);
    });
  });

  describe("error handling", () => {
    it("should exit non-zero when a file in files array is missing", () => {
      // Use an isolated temp project so we never mutate the real gaia-install.sh.
      // The package.json lists "gaia-install.sh" but we don't create the file.
      const iso = createIsolatedProject({ files: ["gaia-install.sh"] });
      try {
        const result = runGenerator({ expectFailure: true, cwd: iso.root, script: iso.script });
        expect(result.exitCode).not.toBe(0);
      } finally {
        iso.cleanup();
      }
    });

    it("should exit non-zero when a file is zero bytes", () => {
      // Use an isolated temp project with a zero-byte gaia-install.sh.
      const iso = createIsolatedProject({
        files: ["gaia-install.sh"],
        fileContents: { "gaia-install.sh": "" },
      });
      try {
        const result = runGenerator({ expectFailure: true, cwd: iso.root, script: iso.script });
        expect(result.exitCode).not.toBe(0);
      } finally {
        iso.cleanup();
      }
    });
  });

  describe("verification compatibility (AC3, AC5)", () => {
    // shasum is not available on Windows; verification uses sha256sum or certUtil there
    it.skipIf(process.platform === "win32")("should be verifiable with shasum -a 256 -c", () => {
      runGenerator();
      // Run shasum -a 256 -c checksums.txt from project root
      expect(() => {
        execFileSync("shasum", ["-a", "256", "-c", "checksums.txt"], {
          cwd: ROOT,
          encoding: "utf8",
        });
      }).not.toThrow();
    });
  });
});
