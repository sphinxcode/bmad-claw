/**
 * openclaw bmad sync
 * Re-checks each bound agent for persona drift and regenerates if changed.
 */

import { detectBmad } from "../discovery/bmad-detect.js";
import { readPluginConfig, validateStoredBmadHome, writePluginConfig } from "../config/writer.js";
import { checkDrift } from "../identity/drift-detector.js";
import { generateIdentity } from "../identity/generator.js";
import { syncIdentity } from "../identity/syncer.js";

export async function syncCommand(): Promise<void> {
  const pluginConf = readPluginConfig();
  const storedBmadHome = pluginConf.sharedBmadHome ?? null;
  const boundAgents = pluginConf.boundAgents ?? [];

  // Warn if the stored shared BMAD home is stale (moved/deleted)
  const liveHome = validateStoredBmadHome();
  if (storedBmadHome && !liveHome) {
    console.warn(
      `\n⚠ Stored BMAD home no longer exists: ${storedBmadHome}\n` +
      "  Agents will sync in persona-only mode.\n" +
      "  Fix: openclaw bmad config set-home <new-path-to-_bmad>\n",
    );
    writePluginConfig({ sharedBmadHome: null });
  }
  const sharedBmadHome = liveHome;
  const userName = "there";
  const language = "English";

  if (boundAgents.length === 0) {
    console.log("No bound agents. Run: openclaw bmad install");
    return;
  }

  const ctx = detectBmad({ sharedBmadHome, cwd: process.cwd() });
  const bmadVersion = ctx.versions["_bmad"] ?? "unknown";

  console.log(`\n─── BMAD Claw Sync ──────────────────────────────────────\n`);
  console.log(`Mode: ${ctx.mode}`);

  let updated = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const agentId of boundAgents) {
    const persona = ctx.agents.find((a) => a.name === agentId);
    if (!persona) {
      console.warn(`  ⚠ ${agentId}: persona not found in manifest — skipping`);
      skipped++;
      continue;
    }

    const drift = checkDrift(agentId, persona);

    if (!drift.drifted) {
      console.log(`  ✓ ${agentId.padEnd(35)} up to date`);
      skipped++;
      continue;
    }

    try {
      const identity = generateIdentity({
        persona,
        workflows: ctx.workflows,
        mode: ctx.mode,
        userName,
        language,
      });
      syncIdentity(agentId, persona, identity, bmadVersion);
      console.log(`  ↺ ${agentId.padEnd(35)} regenerated`);
      updated++;
    } catch (err) {
      console.error(`  ✗ ${agentId}: ${String(err)}`);
      failed.push(agentId);
    }
  }

  console.log(`\nDone. Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`Failed agents (manual resync needed): ${failed.join(", ")}`);
  }
  console.log("\n─────────────────────────────────────────────────────────\n");
}
