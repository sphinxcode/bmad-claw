/**
 * Orchestrates BMAD install detection.
 * Uses candidate discovery from bmad-paths for explainable resolution.
 */

import {
  discoverBmadCandidates,
  selectActiveBmadCandidate,
  type BmadCandidate,
} from "../lib/bmad-paths.js";
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
  /** Active BMAD candidate (null in persona-only mode). */
  detection: BmadCandidate | null;
  /** All discovered candidates including invalid ones (for status display). */
  candidates: BmadCandidate[];
  agents: BmadPersona[];
  workflows: BmadWorkflowEntry[];
  versions: BmadManifestVersions;
  fallbackVersion?: string;
}

/**
 * Detect BMAD install and load all relevant data.
 * Falls back to snapshot if no BMAD found or manifest unreadable.
 */
export function detectBmad(opts: {
  sharedBmadHome?: string | null;
  /** @deprecated pass sharedBmadHome */
  bmadHome?: string | null;
  cwd?: string;
}): BmadContext {
  const shared = opts.sharedBmadHome ?? opts.bmadHome;
  const candidates = discoverBmadCandidates({ sharedBmadHome: shared, cwd: opts.cwd });
  const active = selectActiveBmadCandidate(candidates);

  if (active) {
    const agents = readAgentManifest(active.path);
    const workflows = readWorkflowCatalog(active.path);
    const versions = readModuleVersions(active.path);

    // If manifest-reader degraded to empty (schema mismatch), fall back for persona data
    if (agents.length === 0) {
      const fb = loadFallbackCatalog();
      return {
        mode: "full",
        detection: active,
        candidates,
        agents: fb.agents,
        workflows: fb.workflows,
        versions,
        fallbackVersion: fb.version,
      };
    }

    return { mode: "full", detection: active, candidates, agents, workflows, versions };
  }

  // No BMAD — persona-only mode
  try {
    const fb = loadFallbackCatalog();
    return {
      mode: "persona-only",
      detection: null,
      candidates,
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
      candidates,
      agents: [],
      workflows: [],
      versions: {},
    };
  }
}
