#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// GAIA Framework — npm CLI wrapper
// Clones the GAIA repo, delegates to gaia-install.sh, and cleans up.
// ─────────────────────────────────────────────────────────────────────────────

const { execSync, execFileSync } = require("child_process");
const { mkdtempSync, rmSync, existsSync, realpathSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");

const REPO_URL = "https://github.com/jlouage/Gaia-framework.git";
const SCRIPT_NAME = "gaia-install.sh";
const IS_WINDOWS = process.platform === "win32";

let tempDir = null;
let bashType = "native"; // "native" (mac/linux), "gitbash", or "wsl"

// ─── Helpers ────────────────────────────────────────────────────────────────

function toPosixPath(p) {
  if (!IS_WINDOWS) return p;
  const forward = p.replace(/\\/g, "/");
  if (bashType === "wsl") {
    // WSL: C:\foo\bar → /mnt/c/foo/bar
    return forward.replace(/^([A-Za-z]):/, (_, letter) => "/mnt/" + letter.toLowerCase());
  }
  // Git Bash: C:\foo\bar → /c/foo/bar
  return forward.replace(/^([A-Za-z]):/, (_, letter) => "/" + letter.toLowerCase());
}

function findBash() {
  if (!IS_WINDOWS) return "bash";

  // 1. Try Git for Windows FIRST (preferred — simpler path mapping)
  const gitBashPaths = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Git", "bin", "bash.exe"),
  ];

  for (const p of gitBashPaths) {
    if (existsSync(p)) {
      bashType = "gitbash";
      return p;
    }
  }

  // 2. Try bash in PATH — detect if it's WSL or Git Bash
  try {
    execSync("bash --version", { stdio: "ignore" });
    // Detect WSL vs Git Bash by checking uname
    try {
      const uname = execSync('bash -c "uname -r"', { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      if (/microsoft|wsl/i.test(uname)) {
        bashType = "wsl";
      } else {
        bashType = "gitbash";
      }
    } catch {
      // Can't detect — try MSYSTEM env which Git Bash sets
      try {
        const msys = execSync('bash -c "echo $MSYSTEM"', { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        bashType = msys ? "gitbash" : "wsl";
      } catch {
        bashType = "wsl"; // Assume WSL if detection fails — safer path mapping
      }
    }
    return "bash";
  } catch {}

  return null;
}

function fail(message) {
  console.error(`\x1b[31m✖\x1b[0m  ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`\x1b[34mℹ\x1b[0m  ${message}`);
}

function cleanup() {
  if (tempDir && fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

function ensureGit() {
  try {
    childProcess.execSync("git --version", { stdio: "ignore" });
  } catch {
    fail(
      "git is required but was not found.\n" +
        "   Install git: https://git-scm.com/downloads"
    );
  }
}

function readPackageVersion(pkgPath) {
  const raw = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.version) {
    throw new Error(`No version field found in ${pkgPath}`);
  }
  return pkg.version;
}

function showUsage() {
  console.log(`
\x1b[1mGAIA Framework — npm installer\x1b[0m

Usage: npx gaia-framework <command> [options] [target]

Commands:
  init       Install GAIA into a project
  update     Update framework files (preserves config and memory)
  validate   Check installation integrity
  status     Show installation info

Options:
  --yes             Skip confirmation prompts
  --dry-run         Show what would be done without making changes
  --verbose         Show detailed progress
  --help            Show this help message

Examples:
  npx gaia-framework init .
  npx gaia-framework init ~/my-new-project
  npx gaia-framework update .
  npx gaia-framework validate .
  npx gaia-framework status .
  npx gaia-framework init --yes ~/my-project
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(deps) {
  // Dependency injection for testability — defaults to real modules
  const _exec = deps && deps.execSync || childProcess.execSync;
  const _execFile = deps && deps.execFileSync || childProcess.execFileSync;
  const _mkdtemp = deps && deps.mkdtempSync || fs.mkdtempSync;
  const _exists = deps && deps.existsSync || fs.existsSync;
  const _join = deps && deps.join || path.join;
  const _tmpdir = deps && deps.tmpdir || os.tmpdir;

  const args = process.argv.slice(2);

  // Handle help / no args
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    const pkg = require("../package.json");
    console.log(`gaia-framework v${pkg.version}`);
    process.exit(0);
  }

  // Validate command
  const command = args[0];
  const validCommands = ["init", "update", "validate", "status"];
  if (!validCommands.includes(command)) {
    fail(`Unknown command: ${command}\n   Run 'npx gaia-framework --help' for usage.`);
  }

  // Ensure git is available
  ensureGit();

  // Clone the repo to a temp directory
  tempDir = mkdtempSync(join(tmpdir(), "gaia-framework-"));
  // Resolve 8.3 short names to long paths on Windows (e.g., ELIASN~1 → Elias Nasser)
  // Node's realpathSync doesn't expand 8.3 names, so use PowerShell
  if (IS_WINDOWS) {
    try {
      const longPath = execSync(
        `powershell -NoProfile -Command "(Get-Item -LiteralPath '${tempDir}').FullName"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      ).trim();
      if (longPath && existsSync(longPath)) tempDir = longPath;
    } catch {}
  }

  // Register cleanup for all exit scenarios
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });
  process.on("SIGTERM", () => { cleanup(); process.exit(143); });

  info("Cloning GAIA framework from GitHub...");

  try {
    _exec(`git clone --depth 1 ${REPO_URL} "${tempDir}"`, {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (err) {
    fail(
      `Failed to clone from ${REPO_URL}\n` +
        `   ${err.stderr ? err.stderr.toString().trim() : "Check your network connection."}`
    );
  }

  // Locate the installer script
  const scriptPath = _join(tempDir, SCRIPT_NAME);
  if (!_exists(scriptPath)) {
    fail(`Installer script not found in cloned repo: ${SCRIPT_NAME}`);
  }

  // Build the shell command: inject --source pointing to the temp clone
  // so the shell script doesn't need to clone again
  const passthrough = args.slice(0);
  // Insert --source right after the command (convert to POSIX for bash on Windows)
  passthrough.splice(1, 0, "--source", toPosixPath(tempDir));

  // Locate bash (critical for Windows support)
  const bashPath = findBash();
  if (!bashPath) {
    fail(
      "bash is required but was not found.\n" +
        "   On Windows, install Git for Windows (https://git-scm.com/downloads/win)\n" +
        "   which includes bash. Then re-run this command."
    );
  }

  info("Running installer...\n");

  try {
    // Convert all passthrough args that look like paths (contain backslash or drive letter)
    const posixArgs = passthrough.map(a => IS_WINDOWS && /[\\:]/.test(a) && !a.startsWith("--") ? toPosixPath(a) : a);
    const posixScript = toPosixPath(scriptPath);

    // Debug: on Windows, log the resolved paths if --verbose is passed
    if (IS_WINDOWS && args.includes("--verbose")) {
      info(`Bash: ${bashPath} (${bashType})`);
      info(`Script (Windows): ${scriptPath}`);
      info(`Script (POSIX): ${posixScript}`);
      info(`Temp dir: ${tempDir}`);
    }

    execFileSync(bashPath, [posixScript, ...posixArgs], {
      stdio: "inherit",
      env: { ...process.env, GAIA_SOURCE: toPosixPath(tempDir) },
    });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { findBash, ensureGit, showUsage, fail, info, cleanup, readPackageVersion, main };
