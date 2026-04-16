/**
 * Portable path resolver for BMAD install locations.
 *
 * Resolution order (project-local wins):
 *   1. cwd/_bmad                     → source: "project"
 *   2. configured sharedBmadHome     → source: "shared-config"
 *   3. ~/.openclaw/_bmad (default)   → source: "shared-default"
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Types ────────────────────────────────────────────────────────────────────

/** @deprecated Use BmadCandidate.source. */
export type BmadDetectionSource = "config" | "cwd" | "home";

/** @deprecated Use BmadCandidate. */
export interface BmadDetection {
  path: string;
  source: BmadDetectionSource;
  configDir: string;
}

export type BmadCandidateSource = "project" | "shared-config" | "shared-default";

export interface BmadCandidate {
  path: string;
  source: BmadCandidateSource;
  configDir: string;
  valid: boolean; // manifest.yaml exists
}

// ─── Core: candidate discovery ────────────────────────────────────────────────

/**
 * Discover all BMAD candidates in priority order.
 * Returns all candidates, including invalid ones (for status display).
 */
export function discoverBmadCandidates(opts: {
  sharedBmadHome?: string | null;
  cwd?: string;
}): BmadCandidate[] {
  const cwd = opts.cwd ?? process.cwd();
  const candidates: BmadCandidate[] = [];

  // 1. Project-local (highest priority)
  const projectPath = join(cwd, "_bmad");
  candidates.push({
    path: projectPath,
    source: "project",
    configDir: join(projectPath, "_config"),
    valid: isValidBmadDir(projectPath),
  });

  // 2. Configured shared home
  if (opts.sharedBmadHome) {
    candidates.push({
      path: opts.sharedBmadHome,
      source: "shared-config",
      configDir: join(opts.sharedBmadHome, "_config"),
      valid: isValidBmadDir(opts.sharedBmadHome),
    });
  }

  // 3. Default OpenClaw shared home
  const defaultShared = join(homedir(), ".openclaw", "_bmad");
  // Only add if distinct from configured shared
  if (!opts.sharedBmadHome || normalizeSep(opts.sharedBmadHome) !== normalizeSep(defaultShared)) {
    candidates.push({
      path: defaultShared,
      source: "shared-default",
      configDir: join(defaultShared, "_config"),
      valid: isValidBmadDir(defaultShared),
    });
  }

  return candidates;
}

/**
 * Select the highest-priority valid candidate.
 * Returns null if none are valid.
 */
export function selectActiveBmadCandidate(
  candidates: BmadCandidate[],
): BmadCandidate | null {
  return candidates.find((c) => c.valid) ?? null;
}

// ─── Backward-compat wrapper ──────────────────────────────────────────────────

/**
 * @deprecated Use discoverBmadCandidates + selectActiveBmadCandidate.
 * Kept for callers that haven't migrated yet.
 */
export function resolveBmadPath(opts: {
  bmadHome?: string | null;
  sharedBmadHome?: string | null;
  cwd?: string;
}): BmadDetection | null {
  const shared = opts.sharedBmadHome ?? opts.bmadHome;
  const candidates = discoverBmadCandidates({ sharedBmadHome: shared, cwd: opts.cwd });
  const active = selectActiveBmadCandidate(candidates);
  if (!active) return null;

  const legacySource: BmadDetectionSource =
    active.source === "project" ? "cwd"
    : active.source === "shared-config" ? "config"
    : "home";

  return { path: active.path, source: legacySource, configDir: active.configDir };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidBmadDir(bmadPath: string): boolean {
  return existsSync(join(bmadPath, "_config", "manifest.yaml"));
}

function normalizeSep(p: string): string {
  return p.replace(/\\/g, "/");
}

// ─── Canonical paths within a known BMAD install ─────────────────────────────

export function bmadConfigPaths(bmadPath: string) {
  const configDir = join(bmadPath, "_config");
  return {
    agentManifestCsv: join(configDir, "agent-manifest.csv"),
    manifestYaml: join(configDir, "manifest.yaml"),
    moduleHelpCsv: (module: string) => join(bmadPath, module, "module-help.csv"),
    globalModuleHelp: join(configDir, "module-help.csv"),
  };
}

// ─── OpenClaw home helpers ───────────────────────────────────────────────────

export function openclawHome(): string {
  return join(homedir(), ".openclaw");
}

export function bmadIdentityDir(): string {
  return join(openclawHome(), "identity", "bmad");
}

export function agentIdentityDir(agentId: string): string {
  return join(bmadIdentityDir(), agentId);
}

export function agentWorkspaceDir(agentId: string): string {
  return join(openclawHome(), `workspace-${agentId}`);
}

export function agentDir(agentId: string): string {
  return join(openclawHome(), "agents", agentId, "agent");
}

/** Default shared BMAD install path (OpenClaw-scoped). */
export function defaultSharedBmadHome(): string {
  return join(openclawHome(), "_bmad");
}
