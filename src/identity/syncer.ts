/**
 * Syncs generated identity files into:
 *   ~/.openclaw/identity/bmad/<agentId>/  (source of truth)
 *   ~/.openclaw/workspace-<agentId>/      (loaded by OpenClaw per session)
 *
 * Atomic write: writes to .tmp first, then renames.
 * Falls back to write+delete if rename fails across filesystems (Windows EXDEV).
 */

import {
  mkdirSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import {
  agentIdentityDir,
  agentWorkspaceDir,
  agentDir,
} from "../lib/bmad-paths.js";
import { writeSourceJson } from "./drift-detector.js";
import type { BmadPersona } from "../discovery/manifest-reader.js";
import type { GeneratedIdentity } from "./generator.js";

export interface SyncResult {
  agentId: string;
  identityDir: string;
  workspaceDir: string;
  agentDirPath: string;
  created: boolean; // false = updated existing
}

export function syncIdentity(
  agentId: string,
  persona: BmadPersona,
  identity: GeneratedIdentity,
  bmadVersion: string,
): SyncResult {
  const identityDir = agentIdentityDir(agentId);
  const workspaceDir = agentWorkspaceDir(agentId);
  const agentDirPath = agentDir(agentId);

  const created = !existsSync(identityDir);

  // Ensure directories exist
  mkdirSync(identityDir, { recursive: true });
  mkdirSync(workspaceDir, { recursive: true });
  mkdirSync(agentDirPath, { recursive: true });

  // Write identity source files (atomic)
  atomicWrite(join(identityDir, "SOUL.md"), identity.soul);
  atomicWrite(join(identityDir, "AGENTS.md"), identity.agents);

  // Write .source.json — now atomic via drift-detector
  writeSourceJson(agentId, persona, bmadVersion);

  // Seed workspace (OpenClaw loads these on session start)
  copyFileSync(join(identityDir, "SOUL.md"), join(workspaceDir, "SOUL.md"));
  copyFileSync(join(identityDir, "AGENTS.md"), join(workspaceDir, "AGENTS.md"));

  return { agentId, identityDir, workspaceDir, agentDirPath, created };
}

/**
 * Atomic write via .tmp + rename.
 * Falls back to direct write on EXDEV (cross-filesystem rename, common on Windows).
 */
export function atomicWrite(path: string, content: string): void {
  const tmp = path + ".tmp";
  writeFileSync(tmp, content, "utf-8");
  try {
    renameSync(tmp, path);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      // Cross-filesystem — fallback to non-atomic write
      writeFileSync(path, content, "utf-8");
      try { unlinkSync(tmp); } catch { /* ignore cleanup failure */ }
    } else {
      throw err;
    }
  }
}
