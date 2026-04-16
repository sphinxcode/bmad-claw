/**
 * Writes agent entries and plugin config to openclaw.json.
 * CLI commands run in user context and can write openclaw.json directly
 * using plugin-sdk/config-runtime helpers.
 *
 * Agent entry format (confirmed from openclaw.json):
 *   { id, name, workspace, agentDir }
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { openclawHome, agentWorkspaceDir, agentDir } from "../lib/bmad-paths.js";

export interface AgentEntry {
  id: string;
  name: string;
  workspace: string;
  agentDir: string;
}

interface OpenClawJson {
  agents?: {
    list?: AgentEntry[];
    [key: string]: unknown;
  };
  plugins?: {
    entries?: Record<string, { config?: Record<string, unknown> }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function getConfigPath(): string {
  return join(openclawHome(), "openclaw.json");
}

function readConfig(): OpenClawJson {
  const path = getConfigPath();
  if (!existsSync(path)) {
    throw new Error(`openclaw.json not found at ${path}. Is OpenClaw installed?`);
  }
  const raw = readFileSync(path, "utf-8");
  try {
    return JSON.parse(raw) as OpenClawJson;
  } catch (e) {
    throw new Error(
      `[bmad-claw] openclaw.json is not valid JSON at ${path}. ` +
      `Fix the file manually or restore from ${path}.bmad-claw.bak\n` +
      `Parse error: ${String(e)}`,
    );
  }
}

function writeConfig(config: OpenClawJson): void {
  const path = getConfigPath();
  const json = JSON.stringify(config, null, 2) + "\n";
  // Backup: use the content we're about to overwrite (read once)
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : null;
  if (existing !== null) {
    writeFileSync(path + ".bmad-claw.bak", existing, "utf-8");
  }
  writeFileSync(path, json, "utf-8");
}

/** Normalize path separators to forward slashes for cross-platform storage. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Sanitize agentId to prevent path traversal. */
function sanitizeAgentId(agentId: string): string {
  // Strip traversal sequences and normalize separators
  const safe = agentId
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error(`[bmad-claw] Invalid agentId: "${agentId}"`);
  return safe;
}

/** Add an agent entry to openclaw.json. Idempotent — skips if id already exists. */
export function addAgent(agentId: string, displayName: string): boolean {
  const safeId = sanitizeAgentId(agentId);
  const config = readConfig();

  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  const exists = config.agents.list.some((a) => a.id === safeId);
  if (exists) return false;

  config.agents.list.push({
    id: safeId,
    name: displayName,
    workspace: normalizePath(agentWorkspaceDir(safeId)),
    agentDir: normalizePath(agentDir(safeId)),
  });

  writeConfig(config);
  return true;
}

/**
 * Batch-add multiple agents and update boundAgents in ONE read+write cycle.
 * Idempotent per agent.
 */
export function addAgentsBatch(
  agents: Array<{ agentId: string; displayName: string }>,
): { added: string[]; skipped: string[] } {
  const config = readConfig();

  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  if (!config.plugins) config.plugins = {};
  if (!config.plugins.entries) config.plugins.entries = {};
  if (!config.plugins.entries["bmad-claw"]) {
    config.plugins.entries["bmad-claw"] = { config: {} };
  }
  const pluginConf = config.plugins.entries["bmad-claw"]!.config!;
  const bound = (pluginConf["boundAgents"] as string[] | undefined) ?? [];

  const added: string[] = [];
  const skipped: string[] = [];

  for (const { agentId, displayName } of agents) {
    const safeId = sanitizeAgentId(agentId);

    const exists = config.agents.list!.some((a) => a.id === safeId);
    if (!exists) {
      config.agents.list!.push({
        id: safeId,
        name: displayName,
        workspace: normalizePath(agentWorkspaceDir(safeId)),
        agentDir: normalizePath(agentDir(safeId)),
      });
      added.push(safeId);
    } else {
      skipped.push(safeId);
    }

    if (!bound.includes(safeId)) {
      bound.push(safeId);
    }
  }

  pluginConf["boundAgents"] = bound;
  writeConfig(config);

  return { added, skipped };
}

/** Remove agent from openclaw.json. */
export function removeAgent(agentId: string): boolean {
  const safeId = sanitizeAgentId(agentId);
  const config = readConfig();
  const list = config.agents?.list ?? [];
  const idx = list.findIndex((a) => a.id === safeId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  if (config.agents) config.agents.list = list;
  writeConfig(config);
  return true;
}

/** Check if an agent id already exists in openclaw.json */
export function agentExists(agentId: string): boolean {
  const safeId = sanitizeAgentId(agentId);
  const config = readConfig();
  return (config.agents?.list ?? []).some((a) => a.id === safeId);
}

/** Write plugin config values (bmadHome, boundAgents, defaultMode) */
export function writePluginConfig(updates: Partial<{
  bmadHome: string | null;
  boundAgents: string[];
  defaultMode: "full" | "persona-only";
}>): void {
  const config = readConfig();

  if (!config.plugins) config.plugins = {};
  if (!config.plugins.entries) config.plugins.entries = {};
  if (!config.plugins.entries["bmad-claw"]) {
    config.plugins.entries["bmad-claw"] = { config: {} };
  }

  const pluginConfig = config.plugins.entries["bmad-claw"]!.config ?? {};

  if ("bmadHome" in updates) {
    pluginConfig["bmadHome"] = updates.bmadHome != null
      ? normalizePath(updates.bmadHome)
      : null;
  }
  if ("boundAgents" in updates) pluginConfig["boundAgents"] = updates.boundAgents;
  if ("defaultMode" in updates) pluginConfig["defaultMode"] = updates.defaultMode;

  config.plugins.entries["bmad-claw"]!.config = pluginConfig;
  writeConfig(config);
}

/** Add agent id to boundAgents list — single read+write, no TOCTOU */
export function addBoundAgent(agentId: string): void {
  const safeId = sanitizeAgentId(agentId);
  const config = readConfig();

  if (!config.plugins) config.plugins = {};
  if (!config.plugins.entries) config.plugins.entries = {};
  if (!config.plugins.entries["bmad-claw"]) {
    config.plugins.entries["bmad-claw"] = { config: {} };
  }
  const pluginConf = config.plugins.entries["bmad-claw"]!.config!;
  const bound = (pluginConf["boundAgents"] as string[] | undefined) ?? [];

  if (!bound.includes(safeId)) {
    bound.push(safeId);
    pluginConf["boundAgents"] = bound;
    writeConfig(config);
  }
}

/** Read current plugin config from openclaw.json */
export function readPluginConfig(): Record<string, unknown> {
  try {
    const config = readConfig();
    return (config.plugins?.entries?.["bmad-claw"]?.config ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Validate that the stored bmadHome path is still live. Returns null if stale or missing. */
export function validateStoredBmadHome(): string | null {
  const conf = readPluginConfig();
  const stored = conf["bmadHome"] as string | null | undefined;
  if (!stored) return null;
  return existsSync(join(stored, "_config", "manifest.yaml")) ? stored : null;
}
