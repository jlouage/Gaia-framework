const path = require("path");
const fs = require("fs");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

describe("Node.js version guard (E7-S2)", () => {
  const cliPath = path.resolve(__dirname, "../../../bin/gaia-framework.js");

  it("should export a checkNodeVersion function", () => {
    const cli = require(cliPath);
    expect(typeof cli.checkNodeVersion).toBe("function");
  });

  it("should return true for Node >= 20", () => {
    const cli = require(cliPath);
    expect(cli.checkNodeVersion("v20.0.0")).toBe(true);
    expect(cli.checkNodeVersion("v22.3.1")).toBe(true);
    expect(cli.checkNodeVersion("v20.11.0")).toBe(true);
  });

  it("should return false for Node < 20", () => {
    const cli = require(cliPath);
    expect(cli.checkNodeVersion("v18.20.0")).toBe(false);
    expect(cli.checkNodeVersion("v16.0.0")).toBe(false);
    expect(cli.checkNodeVersion("v19.9.0")).toBe(false);
  });

  it("should include nodejs.org link in the warning message", () => {
    const cli = require(cliPath);
    const message = cli.getNodeVersionWarning("v18.20.0");
    expect(message).toContain("nodejs.org");
    expect(message).toContain("20");
  });

  it("should include the current version in the warning message", () => {
    const cli = require(cliPath);
    const message = cli.getNodeVersionWarning("v18.20.0");
    expect(message).toContain("18.20.0");
  });

  it("should have the version check at the top of the CLI file, before main logic", () => {
    const source = fs.readFileSync(cliPath, "utf8");
    const checkIndex = source.indexOf("checkNodeVersion");
    const mainIndex = source.indexOf("function main(");
    expect(checkIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(mainIndex);
  });
});

describe("package.json engines.node (E7-S2)", () => {
  const pkgPath = path.resolve(__dirname, "../../../package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  it("should require Node >= 20", () => {
    expect(pkg.engines.node).toBe(">=20");
  });
});
