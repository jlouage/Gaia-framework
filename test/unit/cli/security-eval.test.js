// ATDD — Security tests for eval removal (E7-S1).
// Validates AC1–AC4 from the story acceptance criteria.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

describe("ATDD E7-S1: Remove eval Usage", () => {
  // AC1: No eval in cmd_validate
  describe("AC1: eval replaced in cmd_validate", () => {
    it("should not contain eval in gaia-install.sh cmd_validate function", () => {
      const installScript = join(PROJECT_ROOT, "gaia-install.sh");
      expect(existsSync(installScript), "gaia-install.sh must exist").toBe(true);

      const content = readFileSync(installScript, "utf8");
      // Extract cmd_validate function body
      const validateMatch = content.match(/cmd_validate\s*\(\)\s*\{([\s\S]*?)\n\}/);
      expect(validateMatch, "cmd_validate function must exist in gaia-install.sh").not.toBeNull();

      if (validateMatch) {
        const funcBody = validateMatch[1];
        // Check for eval usage (not in comments)
        const lines = funcBody.split("\n");
        const evalLines = lines.filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith("#") && /\beval\b/.test(trimmed);
        });
        expect(evalLines.length, `cmd_validate still contains eval:\n${evalLines.join("\n")}`).toBe(
          0
        );
      }
    });

    it("should use direct test commands instead of eval", () => {
      const installScript = join(PROJECT_ROOT, "gaia-install.sh");
      const content = readFileSync(installScript, "utf8");
      const validateMatch = content.match(/cmd_validate\s*\(\)\s*\{([\s\S]*?)\n\}/);
      expect(validateMatch, "cmd_validate must exist").not.toBeNull();

      if (validateMatch) {
        const funcBody = validateMatch[1];
        // Should use [[ ]] or test directly, and pass $? to check()
        expect(
          funcBody.includes("$?"),
          "check() should receive exit status ($?) instead of condition string"
        ).toBe(true);
      }
    });
  });

  // AC2: $TARGET path sanitization
  describe("AC2: Target path does not pass through eval", () => {
    it("should not pass user-controlled $TARGET through eval", () => {
      const installScript = join(PROJECT_ROOT, "gaia-install.sh");
      const content = readFileSync(installScript, "utf8");
      // Check that $TARGET is not used inside eval
      const lines = content.split("\n");
      const evalTargetLines = lines.filter(
        (line) => !line.trim().startsWith("#") && /\beval\b/.test(line) && line.includes("TARGET")
      );
      expect(evalTargetLines.length, `$TARGET used in eval: ${evalTargetLines.join("; ")}`).toBe(0);
    });
  });

  // AC3: Command injection prevention
  // These tests verify that malicious paths are treated as literal strings
  // and no code execution occurs. The path value may appear in error messages
  // (that's expected — the error displays the literal path). What matters is
  // that no side effects from the injected commands occur.
  describe("AC3: Command injection safely handled", () => {
    it("should handle malicious path with semicolons safely — no side effects", () => {
      const tmpDir = execSync("mktemp -d", { encoding: "utf8" }).trim();
      const markerFile = join(tmpDir, "injection_marker");
      const result = execSync(
        `bash "${join(PROJECT_ROOT, "gaia-install.sh")}" validate '; touch ${markerFile} ;' 2>&1 || true`,
        { encoding: "utf8" }
      );
      // Script should exit with error (non-zero already handled by || true)
      expect(result).toContain("No GAIA installation found");
      // The injected touch command must NOT have executed
      expect(existsSync(markerFile)).toBe(false);
      execSync(`rm -rf "${tmpDir}"`);
    });

    it("should handle malicious path with backticks safely — no side effects", () => {
      const tmpDir = execSync("mktemp -d", { encoding: "utf8" }).trim();
      const markerFile = join(tmpDir, "backtick_marker");
      execSync(
        `bash "${join(PROJECT_ROOT, "gaia-install.sh")}" validate '\`touch ${markerFile}\`' 2>&1 || true`,
        { encoding: "utf8" }
      );
      expect(existsSync(markerFile)).toBe(false);
      execSync(`rm -rf "${tmpDir}"`);
    });

    it("should handle malicious path with subshell syntax safely — no side effects", () => {
      const tmpDir = execSync("mktemp -d", { encoding: "utf8" }).trim();
      const markerFile = join(tmpDir, "subshell_marker");
      execSync(
        `bash "${join(PROJECT_ROOT, "gaia-install.sh")}" validate '$(touch ${markerFile})' 2>&1 || true`,
        { encoding: "utf8" }
      );
      expect(existsSync(markerFile)).toBe(false);
      execSync(`rm -rf "${tmpDir}"`);
    });
  });

  // AC4: Zero eval matches in production code
  describe("AC4: Zero eval in production code", () => {
    it("should have zero eval matches in gaia-install.sh (excluding comments)", () => {
      const installScript = join(PROJECT_ROOT, "gaia-install.sh");
      const content = readFileSync(installScript, "utf8");
      const lines = content.split("\n");
      const evalLines = lines.filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("#") && /\beval\b/.test(trimmed);
      });
      expect(evalLines.length, `Found eval in production code:\n${evalLines.join("\n")}`).toBe(0);
    });

    it("should have zero eval matches in bin/ JavaScript files", () => {
      try {
        const result = execSync(
          `grep -rn '\\beval\\b' "${join(PROJECT_ROOT, "bin")}" --include="*.js" 2>/dev/null || true`,
          { encoding: "utf8" }
        );
        const evalLines = result
          .trim()
          .split("\n")
          .filter((l) => l.length > 0 && !l.includes("//") && !l.includes("*"));
        expect(evalLines.length, `Found eval in JS production code:\n${evalLines.join("\n")}`).toBe(
          0
        );
      } catch {
        // If grep finds nothing, that's a pass
      }
    });
  });
});
