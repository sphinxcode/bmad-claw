/**
 * openclaw bmad install
 * Main 1-step setup: detect BMAD → multiselect agents → generate identities → write openclaw.json.
 * Idempotent: skips already-bound agents.
 */

import { createInterface } from "node:readline";
import { detectBmad, type BmadMode } from "../discovery/bmad-detect.js";
import { generateIdentity } from "../identity/generator.js";
import { syncIdentity } from "../identity/syncer.js";
import {
  addAgentsBatch,
  agentExists,
  readPluginConfig,
  writePluginConfig,
} from "../config/writer.js";
import type { BmadPersona } from "../discovery/manifest-reader.js";

// Default selected modules in the multiselect
const DEFAULT_SELECTED_MODULES = ["bmm", "tea"];

interface AgentChoice {
  persona: BmadPersona;
  selected: boolean;
}

export async function installCommand(args: string[]): Promise<void> {
  const isAuto = args.includes("--auto");

  console.log("\n─── BMAD Claw Setup ──────────────────────────────────────\n");

  // Detect BMAD
  const pluginConf = readPluginConfig();
  const bmadHome = (pluginConf["bmadHome"] as string | null) ?? null;
  const ctx = detectBmad({ bmadHome, cwd: process.cwd() });

  if (ctx.detection) {
    console.log(`✓ BMAD found at: ${ctx.detection.path} (${ctx.detection.source})`);
    writePluginConfig({ bmadHome: ctx.detection.path, defaultMode: "full" });
  } else {
    const fallback = ctx.fallbackVersion ?? "bundled";
    console.log(`⚠ BMAD not detected — using fallback personas (${fallback})`);
    console.log("  Agents will work in persona-only mode.");
    console.log("  Install BMAD later: openclaw bmad install-bmad\n");
    writePluginConfig({ defaultMode: "persona-only" });
  }

  // Read user config for identity generation
  const userName = (pluginConf["userName"] as string | undefined) ?? "there";
  const language = (pluginConf["language"] as string | undefined) ?? "English";
  const bmadVersion = ctx.versions["_bmad"] ?? ctx.fallbackVersion ?? "unknown";

  // Build agent choices
  const choices: AgentChoice[] = ctx.agents.map((p) => ({
    persona: p,
    selected: DEFAULT_SELECTED_MODULES.includes(p.module),
  }));

  // Multiselect
  let selected: BmadPersona[];
  if (isAuto) {
    selected = choices.filter((c) => c.selected).map((c) => c.persona);
    console.log(`Auto-installing ${selected.length} agents (BMM + TEA)...`);
  } else {
    selected = await multiselect(choices);
  }

  if (selected.length === 0) {
    console.log("\nNo agents selected. Run 'openclaw bmad install' to set up agents.");
    return;
  }

  console.log(`\nCreating ${selected.length} agents...\n`);

  const results: Array<{ agentId: string; status: "created" | "updated" | "skipped" | "failed"; error?: string }> = [];

  // Generate + sync identity files per agent (may fail individually)
  const toRegister: Array<{ agentId: string; displayName: string }> = [];

  for (const persona of selected) {
    const agentId = persona.name;

    try {
      const identity = generateIdentity({
        persona,
        workflows: ctx.workflows,
        mode: ctx.mode,
        userName,
        language,
      });

      const syncResult = syncIdentity(agentId, persona, identity, bmadVersion);
      const alreadyExists = agentExists(agentId);
      const status = !alreadyExists ? "created" : syncResult.created ? "updated" : "skipped";

      results.push({ agentId, status });
      const icon = status === "created" ? "✓" : status === "updated" ? "↺" : "–";
      console.log(`  ${icon} ${persona.displayName.padEnd(12)} (${agentId}) ${status}`);

      toRegister.push({ agentId, displayName: persona.displayName });
    } catch (err) {
      results.push({ agentId, status: "failed", error: String(err) });
      console.error(`  ✗ ${agentId}: ${String(err)}`);
    }
  }

  // Single batch write — one read+write cycle for all agents + boundAgents
  if (toRegister.length > 0) {
    addAgentsBatch(toRegister);
  }

  // Write final mode
  writePluginConfig({ defaultMode: ctx.mode });

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed");

  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`Created: ${created} | Updated: ${updated} | Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log(`\nFailed agents:`);
    for (const f of failed) console.log(`  ${f.agentId}: ${f.error}`);
  }

  if (ctx.mode === "full") {
    console.log(`\n✓ Agents ready with full BMAD workflow access.`);
  } else {
    console.log(`\n✓ Agents ready in persona-only mode.`);
    console.log(`  To enable workflows: openclaw bmad install-bmad`);
  }

  console.log("\n─────────────────────────────────────────────────────────\n");
}

async function multiselect(choices: AgentChoice[]): Promise<BmadPersona[]> {
  console.log("\nSelect agents to create:");
  console.log("(All BMM + TEA pre-selected. CIS is opt-in.)\n");

  // Display the list
  choices.forEach((c, i) => {
    const bullet = c.selected ? "◉" : "○";
    const num = String(i + 1).padStart(2);
    console.log(
      `  ${num}. ${bullet} ${c.persona.displayName.padEnd(18)} ${c.persona.title.padEnd(26)} (${c.persona.module})`,
    );
  });

  console.log("\nPress Enter to install selected (default), or type numbers to toggle (e.g. 11 12 13):");
  console.log("Type 'all' to select all, 'none' to deselect all.\n");

  const answer = await prompt("> ");

  if (!answer.trim() || answer.trim() === "") {
    return choices.filter((c) => c.selected).map((c) => c.persona);
  }

  if (answer.toLowerCase() === "all") {
    return choices.map((c) => c.persona);
  }

  if (answer.toLowerCase() === "none") {
    return [];
  }

  // Toggle by number
  const toggled = new Set(choices.map((c, i) => (c.selected ? i : -1)).filter((i) => i >= 0));
  const nums = answer.match(/\d+/g) ?? [];
  for (const n of nums) {
    const idx = parseInt(n, 10) - 1;
    if (idx >= 0 && idx < choices.length) {
      if (toggled.has(idx)) toggled.delete(idx);
      else toggled.add(idx);
    }
  }

  return [...toggled].map((i) => choices[i]!.persona);
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}
