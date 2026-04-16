/**
 * openclaw bmad status
 * Prints diagnostic table: BMAD home, modules, bound agents, mode.
 */

import { detectBmad } from "../discovery/bmad-detect.js";
import { readPluginConfig } from "../config/writer.js";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { openclawHome } from "../lib/bmad-paths.js";

export async function statusCommand(): Promise<void> {
  const pluginConf = readPluginConfig();
  const bmadHome = (pluginConf["bmadHome"] as string | null) ?? null;
  const boundAgents = (pluginConf["boundAgents"] as string[] | undefined) ?? [];

  const ctx = detectBmad({ bmadHome, cwd: process.cwd() });

  console.log("\n─── BMAD Claw Status ─────────────────────────────────────\n");

  // Mode
  const modeLabel = ctx.mode === "full" ? "✓ full (workflows available)" : "⚠ persona-only";
  console.log(`Mode:        ${modeLabel}`);

  // BMAD install
  if (ctx.detection) {
    console.log(`BMAD home:   ${ctx.detection.path}`);
    console.log(`Source:      ${ctx.detection.source}`);
  } else {
    console.log(`BMAD home:   (not detected)`);
    if (ctx.fallbackVersion) {
      console.log(`Fallback:    ${ctx.fallbackVersion}`);
    }
  }

  // Modules
  const modEntries = Object.entries(ctx.versions).filter(([k]) => k !== "_bmad");
  if (modEntries.length > 0) {
    console.log(`\nModules:`);
    for (const [mod, ver] of modEntries) {
      console.log(`  ${mod.padEnd(12)} ${ver}`);
    }
  }

  // Bound agents
  console.log(`\nBound agents: ${boundAgents.length === 0 ? "(none — run: openclaw bmad install)" : ""}`);
  for (const agentId of boundAgents) {
    const ws = join(openclawHome(), `workspace-${agentId}`);
    const hasWorkspace = existsSync(ws);
    const hasSoul = hasWorkspace && existsSync(join(ws, "SOUL.md"));
    const status = hasSoul ? "✓" : "⚠ missing SOUL.md";
    console.log(`  ${agentId.padEnd(35)} ${status}`);
  }

  // Skills
  const skillsDir = join(openclawHome(), ".claude", "skills");
  if (existsSync(skillsDir)) {
    const bmadSkills = readdirSync(skillsDir).filter((s) => s.startsWith("bmad-"));
    console.log(`\nBMAD skills loaded: ${bmadSkills.length}`);
  }

  console.log("\n──────────────────────────────────────────────────────────\n");
}
