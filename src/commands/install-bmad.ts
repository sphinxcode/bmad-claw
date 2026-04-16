/**
 * openclaw bmad install-bmad
 * Guides the user through installing BMAD via npx bmad-method@latest.
 *
 * Prompts for install strategy:
 *   1. Shared (default) → ~/.openclaw, available across all projects
 *   2. Project-local    → cwd, lives at ./_bmad
 *
 * Prints the npx command for the user to run — no shell exec in plugin.
 * After BMAD installs, stores strategy and path in plugin config.
 */

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
    targetDir = resolve(args[0]);
    installMode = targetDir === defaultSharedBmadHome().replace("/_bmad", "") ||
                  targetDir === defaultSharedBmadHome()
      ? "shared"
      : "project-local";
    console.log(`Installing to: ${targetDir} (${installMode})`);
  } else {
    console.log("Where should BMAD be installed?\n");
    console.log("  1. Shared  — ~/.openclaw  (recommended — one install for all projects)");
    console.log("  2. Project — current dir  (this project only, checked into repo)\n");

    const choice = await ask("Choose [1/2] (default: 1): ");
    if (choice === "2") {
      targetDir = process.cwd();
      installMode = "project-local";
    } else {
      const sharedBase = defaultSharedBmadHome().replace("/_bmad", "");
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

  const npxCmd = [
    "npx bmad-method@latest install",
    "--yes",
    `--modules ${modules.join(",")}`,
    "--tools claude-code",
    `--directory "${targetDir}"`,
  ].join(" \\\n    ");

  console.log(`\nModules: ${modules.join(", ")}`);
  console.log("\n─── Run this command to install BMAD ────────────────────\n");
  console.log(`    ${npxCmd}`);
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("\nAfter BMAD installs, run:");
  console.log("    openclaw bmad config set-home <path-to-_bmad>\n");

  // If BMAD is already present at the target (re-run after manual install), save config
  const expectedBmadPath = join(targetDir, "_bmad");
  const candidates = discoverBmadCandidates({ sharedBmadHome: expectedBmadPath, cwd: targetDir });
  const found = candidates.find((c) => c.valid);
  const bmadPath = found?.path ??
    (existsSync(join(expectedBmadPath, "_config", "manifest.yaml")) ? expectedBmadPath : null);

  if (bmadPath) {
    if (installMode === "shared") {
      writePluginConfig({ sharedBmadHome: bmadPath, installMode: "shared", defaultMode: "full" });
      console.log(`✓ BMAD already detected at: ${bmadPath} — config saved.`);
    } else {
      writePluginConfig({ installMode: "project-local", defaultMode: "full" });
      console.log(`✓ BMAD already detected at: ${bmadPath} — config saved.`);
    }
    console.log("  Run 'openclaw bmad sync' to refresh agents.\n");
  }

  console.log("─────────────────────────────────────────────────────────\n");
}
