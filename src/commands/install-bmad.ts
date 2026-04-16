/**
 * openclaw bmad install-bmad
 * Wraps npx bmad-method@latest with --yes + --modules built from 2 Y/n prompts.
 * After success, auto-detects and sets bmadHome.
 */

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { writePluginConfig } from "../config/writer.js";
import { resolveBmadPath } from "../lib/bmad-paths.js";

async function ask(question: string): Promise<boolean> {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => {
      rl.close();
      res(ans.trim().toLowerCase() !== "n");
    });
  });
}

export async function installBmadCommand(args: string[]): Promise<void> {
  const targetDir = args[0] ? resolve(args[0]) : process.cwd();

  console.log("\n─── BMAD Installer ──────────────────────────────────────\n");
  console.log("Core modules installing automatically: BMM + BMB + TEA");
  console.log("(Business team, builder, master test architect)\n");

  const includeGds = await ask("Include Game Development (GDS)? [Y/n] ");
  const includeCis = await ask("Include Creative Intelligence (CIS)? [Y/n] ");

  const modules = ["bmm", "bmb", "tea"];
  if (includeGds) modules.push("gds");
  if (includeCis) modules.push("cis");

  console.log(`\nInstalling modules: ${modules.join(", ")}`);
  console.log("Running BMAD installer (this may take a moment)...\n");

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

  // Auto-detect and set bmadHome
  const expectedBmadPath = join(targetDir, "_bmad");
  const detection = resolveBmadPath({ cwd: targetDir });

  const bmadPath = detection?.path ??
    (existsSync(join(expectedBmadPath, "_config", "manifest.yaml")) ? expectedBmadPath : null);

  if (bmadPath) {
    writePluginConfig({ bmadHome: bmadPath, defaultMode: "full" });
    console.log(`\n✓ BMAD installed at: ${bmadPath}`);
    console.log("✓ BMAD home set automatically");
    console.log("\nRun 'openclaw bmad sync' to refresh your agents with workflow access.");
  } else {
    console.log(
      "\n⚠ BMAD installed but path not auto-detected.\n" +
      `Expected: ${expectedBmadPath}\n` +
      "Set manually: openclaw bmad config set-home <path-to-_bmad>",
    );
  }

  console.log("\n─────────────────────────────────────────────────────────\n");
}
