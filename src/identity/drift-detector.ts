/**
 * Detects persona drift by comparing a hash of current persona data
 * against the stored .source.json in the identity directory.
 */

import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { agentIdentityDir } from "../lib/bmad-paths.js";
import type { BmadPersona } from "../discovery/manifest-reader.js";

export interface SourceJson {
  sourceHash: string;
  bmadVersion: string;
  lastSync: string; // ISO date
  agentId: string;
}

export interface DriftResult {
  drifted: boolean;
  lastSync: Date | null;
  storedHash: string | null;
  currentHash: string;
}

export function personaHash(persona: BmadPersona): string {
  // Use JSON.stringify to avoid delimiter collisions (pipe chars in field values)
  const key = JSON.stringify([
    persona.name, persona.displayName, persona.title, persona.icon,
    persona.role, persona.identity, persona.communicationStyle,
    persona.principles, persona.module, persona.capabilities,
  ]);
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function checkDrift(
  agentId: string,
  currentPersona: BmadPersona,
): DriftResult {
  const identityDir = agentIdentityDir(agentId);
  const sourcePath = join(identityDir, ".source.json");
  const currentHash = personaHash(currentPersona);

  if (!existsSync(sourcePath)) {
    return { drifted: true, lastSync: null, storedHash: null, currentHash };
  }

  try {
    const source: SourceJson = JSON.parse(readFileSync(sourcePath, "utf-8"));
    const drifted = source.sourceHash !== currentHash;
    return {
      drifted,
      lastSync: new Date(source.lastSync),
      storedHash: source.sourceHash,
      currentHash,
    };
  } catch {
    return { drifted: true, lastSync: null, storedHash: null, currentHash };
  }
}

export function writeSourceJson(
  agentId: string,
  persona: BmadPersona,
  bmadVersion: string,
): void {
  const identityDir = agentIdentityDir(agentId);
  const sourcePath = join(identityDir, ".source.json");
  const source: SourceJson = {
    sourceHash: personaHash(persona),
    bmadVersion,
    lastSync: new Date().toISOString(),
    agentId,
  };
  const json = JSON.stringify(source, null, 2);
  // Atomic write via .tmp + rename
  const tmp = sourcePath + ".tmp";
  writeFileSync(tmp, json, "utf-8");
  try {
    renameSync(tmp, sourcePath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      writeFileSync(sourcePath, json, "utf-8");
      try { unlinkSync(tmp); } catch { /* ignore */ }
    } else {
      throw err;
    }
  }
}
