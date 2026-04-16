/**
 * Orchestrates BMAD install detection.
 * Uses bmad-paths resolution chain: config → cwd → home.
 */

import { resolveBmadPath, type BmadDetection } from "../lib/bmad-paths.js";
import {
  readAgentManifest,
  readWorkflowCatalog,
  readModuleVersions,
  type BmadPersona,
  type BmadWorkflowEntry,
  type BmadManifestVersions,
} from "./manifest-reader.js";
import { loadFallbackCatalog } from "./fallback-catalog.js";

export type BmadMode = "full" | "persona-only";

export interface BmadContext {
  mode: BmadMode;
  detection: BmadDetection | null;
  agents: BmadPersona[];
  workflows: BmadWorkflowEntry[];
  versions: BmadManifestVersions;
  fallbackVersion?: string;
}

/**
 * Detect BMAD install and load all relevant data.
 * Falls back to snapshot if no BMAD found.
 */
export function detectBmad(opts: {
  bmadHome?: string | null;
  cwd?: string;
}): BmadContext {
  const detection = resolveBmadPath(opts);

  if (detection) {
    const agents = readAgentManifest(detection.path);
    const workflows = readWorkflowCatalog(detection.path);
    const versions = readModuleVersions(detection.path);

    // If manifest-reader degraded to empty (schema mismatch), fall back
    if (agents.length === 0) {
      const fb = loadFallbackCatalog();
      return {
        mode: "full", // BMAD IS installed, just use fallback for persona data
        detection,
        agents: fb.agents,
        workflows: fb.workflows,
        versions,
        fallbackVersion: fb.version,
      };
    }

    return { mode: "full", detection, agents, workflows, versions };
  }

  // No BMAD — persona-only mode
  try {
    const fb = loadFallbackCatalog();
    return {
      mode: "persona-only",
      detection: null,
      agents: fb.agents,
      workflows: fb.workflows,
      versions: {},
      fallbackVersion: fb.version,
    };
  } catch (err) {
    console.error("[bmad-claw] " + String(err));
    return {
      mode: "persona-only",
      detection: null,
      agents: [],
      workflows: [],
      versions: {},
    };
  }
}
