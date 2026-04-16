/**
 * openclaw bmad status
 * Prints diagnostic table: BMAD resolution chain, modules, bound agents, mode.
 */

import { detectBmad } from "../discovery/bmad-detect.js";
import { readPluginConfig } from "../config/writer.js";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { openclawHome, defaultSharedBmadHome } from "../lib/bmad-paths.js";
import type { BmadCandidate } from "../lib/bmad-paths.js";

const SOURCE_LABEL: Record<BmadCandidate["source"], string> = {
  "project":        "project-local (./_bmad)",
  "shared-config":  "shared (configured)",
  "shared-default": "shared (default ~/.openclaw/_bmad)",
};

export async function statusCommand(): Promise<void> {
  const pluginConf = readPluginConfig();
  const sharedBmadHome = pluginConf.sharedBmadHome ?? null;
  const installMode = pluginConf.installMode ?? null;
  const boundAgents = pluginConf.boundAgents ?? [];

  const ctx = detectBmad({ sharedBmadHome, cwd: process.cwd() });

  console.log("\n─── BMAD Claw Status ─────────────────────────────────────\n");

  // Mode
  const modeLabel = ctx.mode === "full" ? "✓ full (workflows available)" : "⚠ persona-only";
  console.log(`Mode:          ${modeLabel}`);
  if (installMode) {
    console.log(`Install mode:  ${installMode}`);
  }

  // ── Resolution chain ──────────────────────────────────────
  console.log(`\nBMAD resolution chain:`);
  for (const c of ctx.candidates) {
    const active = ctx.detection?.path === c.path;
    const marker = active ? "→ ACTIVE  " : c.valid ? "  shadowed" : "  missing ";
    const label = SOURCE_LABEL[c.source] ?? c.source;
    console.log(`  ${marker}  [${label}]`);
    console.log(`             ${c.path}`);
  }

  // Active BMAD detail
  if (ctx.detection) {
    console.log(`\nActive BMAD:   ${ctx.detection.path}`);
    console.log(`Source:        ${SOURCE_LABEL[ctx.detection.source]}`);
  } else {
    console.log(`\nActive BMAD:   (none — persona-only mode)`);
    if (ctx.fallbackVersion) {
      console.log(`Snapshot:      ${ctx.fallbackVersion}`);
    }
  }

  // Configured shared home (even if not active)
  if (sharedBmadHome && sharedBmadHome !== ctx.detection?.path) {
    const live = existsSync(join(sharedBmadHome, "_config", "manifest.yaml"));
    console.log(`Shared config: ${sharedBmadHome} ${live ? "(valid)" : "(not found)"}`);
  }

  // Default shared home (if not already shown)
  const defaultShared = defaultSharedBmadHome();
  const defaultShownAsCandidate = ctx.candidates.some((c) => c.path === defaultShared);
  if (!defaultShownAsCandidate) {
    const live = existsSync(join(defaultShared, "_config", "manifest.yaml"));
    console.log(`Default shared: ${defaultShared} ${live ? "(valid)" : "(not found)"}`);
  }

  // Project-local signal
  const projectCandidate = ctx.candidates.find((c) => c.source === "project");
  if (projectCandidate?.valid && ctx.detection?.source !== "project") {
    console.log(`\n⚠ Project-local _bmad detected but not active (shadowed by higher priority?)`);
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
