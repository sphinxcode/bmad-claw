/**
 * Loads bundled fallback assets when no BMAD install is present.
 * assets/fallback/ is committed and refreshed by scripts/snapshot-bmad.mjs.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BmadPersona, BmadWorkflowEntry } from "./manifest-reader.js";

const ASSETS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../assets/fallback",
);

export interface FallbackCatalog {
  agents: BmadPersona[];
  workflows: BmadWorkflowEntry[];
  version: string;
}

let _cache: FallbackCatalog | null = null;

export function loadFallbackCatalog(): FallbackCatalog {
  if (_cache) return _cache;

  const agentsPath = join(ASSETS_DIR, "agents.json");
  const workflowsPath = join(ASSETS_DIR, "workflows-catalog.json");
  const versionPath = join(ASSETS_DIR, "VERSION");

  if (!existsSync(agentsPath)) {
    throw new Error(
      "[bmad-claw] Fallback snapshot missing. Run: npm run snapshot\n" +
      `Expected: ${agentsPath}`,
    );
  }

  const agents: BmadPersona[] = JSON.parse(readFileSync(agentsPath, "utf-8"));
  const workflows: BmadWorkflowEntry[] = existsSync(workflowsPath)
    ? JSON.parse(readFileSync(workflowsPath, "utf-8"))
    : [];
  const version = existsSync(versionPath)
    ? readFileSync(versionPath, "utf-8").trim()
    : "unknown";

  _cache = { agents, workflows, version };
  console.info(`[bmad-claw] Using fallback snapshot: ${version}`);
  return _cache;
}
