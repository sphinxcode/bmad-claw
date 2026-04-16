/**
 * Portable path resolver for BMAD install locations.
 * Resolution chain: stored bmadHome config → cwd/_bmad → home/_bmad
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface BmadDetection {
  path: string; // absolute path to _bmad directory
  source: "config" | "cwd" | "home";
  configDir: string; // _bmad/_config absolute path
}

/**
 * Resolve the _bmad directory using the priority chain.
 * Returns null if no valid installation is found.
 */
export function resolveBmadPath(opts: {
  bmadHome?: string | null;
  cwd?: string;
}): BmadDetection | null {
  const cwd = opts.cwd ?? process.cwd();

  // 1. Stored bmadHome from plugin config
  if (opts.bmadHome) {
    const det = validateBmadDir(opts.bmadHome, "config");
    if (det) return det;
  }

  // 2. cwd/_bmad
  const cwdBmad = join(cwd, "_bmad");
  const cwdDet = validateBmadDir(cwdBmad, "cwd");
  if (cwdDet) return cwdDet;

  // 3. home/_bmad (e.g. ~/.openclaw/_bmad)
  const homeBmad = join(homedir(), ".openclaw", "_bmad");
  const homeDet = validateBmadDir(homeBmad, "home");
  if (homeDet) return homeDet;

  return null;
}

function validateBmadDir(
  bmadPath: string,
  source: BmadDetection["source"],
): BmadDetection | null {
  const manifestPath = join(bmadPath, "_config", "manifest.yaml");
  if (!existsSync(manifestPath)) return null;
  return {
    path: bmadPath,
    source,
    configDir: join(bmadPath, "_config"),
  };
}

/** Canonical paths within a known BMAD install */
export function bmadConfigPaths(bmadPath: string) {
  const configDir = join(bmadPath, "_config");
  return {
    agentManifestCsv: join(configDir, "agent-manifest.csv"),
    manifestYaml: join(configDir, "manifest.yaml"),
    moduleHelpCsv: (module: string) =>
      join(bmadPath, module, "module-help.csv"),
    globalModuleHelp: join(configDir, "module-help.csv"),
  };
}

/** ~/.openclaw base dir */
export function openclawHome(): string {
  return join(homedir(), ".openclaw");
}

/** Identity dir for all BMAD agents */
export function bmadIdentityDir(): string {
  return join(openclawHome(), "identity", "bmad");
}

/** Per-agent identity dir */
export function agentIdentityDir(agentId: string): string {
  return join(bmadIdentityDir(), agentId);
}

/** Per-agent workspace dir */
export function agentWorkspaceDir(agentId: string): string {
  return join(openclawHome(), `workspace-${agentId}`);
}

/** Per-agent OpenClaw agent dir */
export function agentDir(agentId: string): string {
  return join(openclawHome(), "agents", agentId, "agent");
}
