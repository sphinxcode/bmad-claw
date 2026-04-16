/**
 * openclaw bmad install-bmad
 * Wraps npx bmad-method@latest with --yes + module selection.
 *
 * Prompts for install strategy:
 *   1. Shared (default) → installs at ~/.openclaw, available across all projects
 *   2. Project-local    → installs at cwd, lives at ./_bmad
 *
 * After success, stores strategy and path in plugin config.
 */

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { writePluginConfig } from "../config/writer.js";
import { discoverBmadCandidates, defaultSharedBmadHome } from "../lib/bmad-paths.js";

async function ask(question: string): Promise<string> {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => {
      rl.close();
      res(ans.trim());
    });
  });
}

async function askYN(question: string): Promise<boolean> {
  const ans = await ask(question);
  return ans.toLowerCase() !== "n";
}

export async function installBmadCommand(args: string[]): Promise<void> {
  console.log("\n─── BMAD Installer ──────────────────────────────────────\n");

  // Determine install target
  let targetDir: string;
  let installMode: "shared" | "project-local";

  if (args[0]) {
    // Explicit directory argument — honor it, infer mode
    targetDir = resolve(args[0]);
    installMode = targetDir === defaultSharedBmadHome().replace("/_bmad", "") ||
                  targetDir === defaultSharedBmadHome()
      ? "shared"
      : "project-local";
    console.log(`Installing to: ${targetDir} (${installMode})`);
  } else {
    // No arg — prompt user to choose strategy
    console.log("Where should BMAD be installed?\n");
    console.log("  1. Shared  — ~/.openclaw  (recommended — one install for all projects)");
    console.log("  2. Project — current dir  (this project only, checked into repo)\n");

    const choice = await ask("Choose [1/2] (default: 1): ");
    if (choice === "2") {
      targetDir = process.cwd();
      installMode = "project-local";
    } else {
      // Default: shared
      const sharedBase = defaultSharedBmadHome().replace("/_bmad", ""); // ~/.openclaw
      targetDir = sharedBase;
      installMode = "shared";
    }
    console.log(`\nInstalling ${installMode} at: ${targetDir}\n`);
  }

  // Module selection
  console.log("Core modules installing automatically: BMM + BMB + TEA");
  console.log("(Business team, builder, master test architect)\n");

  const includeGds = await askYN("Include Game Development (GDS)? [Y/n] ");
  const includeCis = await askYN("Include Creative Intelligence (CIS)? [Y/n] ");

  const modules = ["bmm", "bmb", "tea"];
  if (includeGds) modules.push("gds");
  if (includeCis) modules.push("cis");

  console.log(`\nModules: ${modules.join(", ")}`);
  console.log("Running BMAD installer...\n");

  // shell: false — let Node handle arg quoting (avoids shell injection + path-with-spaces bugs)
  const result = spawnSync(
    "npx",
    [
      "bmad-method@latest",
      "install",
      "--yes",
      "--modules", modules.join(","),
      "--tools", "claude-code",
      "--directory", targetDir,
    ],
    { stdio: "inherit", shell: false },
  );

  if (result.status !== 0) {
    console.error(
      "\n[bmad-claw] BMAD installation failed.\n" +
      "Try manually: npx bmad-method@latest install\n" +
      "Then run: openclaw bmad config set-home <path-to-_bmad>",
    );
    process.exit(1);
  }

  // Resolve where _bmad actually landed
  const expectedBmadPath = join(targetDir, "_bmad");
  const candidates = discoverBmadCandidates({ sharedBmadHome: expectedBmadPath, cwd: targetDir });
  const found = candidates.find((c) => c.valid);

  const bmadPath = found?.path ??
    (existsSync(join(expectedBmadPath, "_config", "manifest.yaml")) ? expectedBmadPath : null);

  if (bmadPath) {
    if (installMode === "shared") {
      // Store as the shared BMAD home
      writePluginConfig({ sharedBmadHome: bmadPath, installMode: "shared", defaultMode: "full" });
      console.log(`\n✓ BMAD installed (shared) at: ${bmadPath}`);
      console.log("✓ All projects will use this BMAD unless overridden by ./_bmad");
    } else {
      // Project-local — do NOT overwrite shared config
      writePluginConfig({ installMode: "project-local", defaultMode: "full" });
      console.log(`\n✓ BMAD installed (project-local) at: ${bmadPath}`);
      console.log("✓ This project will use ./_bmad; other projects use shared BMAD if configured");
    }
    console.log("\nRun 'openclaw bmad sync' to refresh agents with workflow access.");
  } else {
    console.log(
      "\n⚠ BMAD installed but path not auto-detected.\n" +
      `Expected: ${expectedBmadPath}\n` +
      "Set manually: openclaw bmad config set-home <path-to-_bmad>",
    );
  }

  console.log("\n─────────────────────────────────────────────────────────\n");
}
