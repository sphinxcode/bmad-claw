/**
 * openclaw bmad install-bmad
 * Guides the user through installing BMAD via npx bmad-method@latest.
 *
 * Detection-first: shows all existing BMAD installs before prompting.
 * Resolution order: cwd/_bmad → sharedBmadHome → ~/.openclaw/_bmad
 * Project-local always wins at runtime regardless of what is installed here.
 *
 * Prints the npx command for the user to run — no shell exec in plugin.
 */

import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { writePluginConfig, readPluginConfig } from "../config/writer.js";
import {
  discoverBmadCandidates,
  defaultSharedBmadHome,
  type BmadCandidate,
} from "../lib/bmad-paths.js";

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

const SOURCE_LABEL: Record<BmadCandidate["source"], string> = {
  "project":        "project-local  (./_bmad)",
  "shared-config":  "shared config  (configured path)",
  "shared-default": "shared default (~/.openclaw/_bmad)",
};

export async function installBmadCommand(args: string[]): Promise<void> {
  console.log("\n─── BMAD Installer ──────────────────────────────────────\n");

  // ── Detection first ───────────────────────────────────────
  const pluginConf = readPluginConfig();
  const sharedBmadHome = pluginConf.sharedBmadHome ?? null;
  const candidates = discoverBmadCandidates({ sharedBmadHome, cwd: process.cwd() });
  const validCandidates = candidates.filter((c) => c.valid);

  if (validCandidates.length > 0) {
    console.log("Existing BMAD installs detected:\n");
    for (const c of validCandidates) {
      const active = c === validCandidates[0] ? " ← active (highest priority)" : " (shadowed)";
      console.log(`  ✓ [${SOURCE_LABEL[c.source]}]${active}`);
      console.log(`    ${c.path}\n`);
    }
    console.log("Note: project-local (_bmad in cwd) always wins over shared at runtime.\n");

    const proceed = await askYN("Install/upgrade BMAD anyway? [Y/n] ");
    if (!proceed) {
      console.log("Aborted. Run 'openclaw bmad sync' to refresh agents.\n");
      console.log("─────────────────────────────────────────────────────────\n");
      return;
    }
    console.log();
  } else {
    console.log("No existing BMAD install detected.\n");
  }

  // ── Determine target ──────────────────────────────────────
  let targetDir: string;
  let installMode: "shared" | "project-local";

  if (args[0]) {
    targetDir = resolve(args[0]);
    installMode = targetDir === defaultSharedBmadHome().replace("/_bmad", "") ||
                  targetDir === defaultSharedBmadHome()
      ? "shared"
      : "project-local";
    console.log(`Target: ${targetDir} (${installMode})`);
  } else {
    console.log("Where should BMAD be installed?\n");
    console.log("  1. Shared  — ~/.openclaw  (recommended — fallback for all projects)");
    console.log("  2. Project — current dir  (this project only, checked into repo)\n");

    const choice = await ask("Choose [1/2] (default: 1): ");
    if (choice === "2") {
      targetDir = process.cwd();
      installMode = "project-local";
    } else {
      targetDir = defaultSharedBmadHome().replace("/_bmad", "");
      installMode = "shared";
    }
    console.log(`\nTarget: ${installMode} → ${targetDir}\n`);
  }

  // ── Module selection ──────────────────────────────────────
  console.log("Core modules (always included): BMM + BMB + TEA\n");

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
  console.log("    openclaw bmad sync\n");

  // ── Auto-save config if already present ──────────────────
  const expectedBmadPath = join(targetDir, "_bmad");
  const alreadyThere = existsSync(join(expectedBmadPath, "_config", "manifest.yaml"));

  if (alreadyThere) {
    if (installMode === "shared") {
      writePluginConfig({ sharedBmadHome: expectedBmadPath, installMode: "shared", defaultMode: "full" });
    } else {
      writePluginConfig({ installMode: "project-local", defaultMode: "full" });
    }
    console.log(`✓ BMAD already at target — config saved.`);
    console.log("  Run 'openclaw bmad sync' to refresh agents.\n");
  }

  console.log("─────────────────────────────────────────────────────────\n");
}
