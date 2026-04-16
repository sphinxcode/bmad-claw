/**
 * Plugin config schema — stored under plugins.entries.bmad-claw.config
 *
 * Backward compat: legacy installs may only have `bmadHome`.
 * Readers treat absent `sharedBmadHome` + present `bmadHome` as sharedBmadHome.
 */

export interface BmadClawConfig {
  /**
   * @deprecated v0.1.x field. Kept for backward compat.
   * Treated as sharedBmadHome during reads if sharedBmadHome is absent.
   */
  bmadHome?: string | null;

  /** Absolute path to shared BMAD _bmad dir (e.g. ~/.openclaw/_bmad). */
  sharedBmadHome: string | null;

  /** How the user last installed BMAD. Null = unknown/not yet installed. */
  installMode: "shared" | "project-local" | null;

  /** Agent IDs managed by this plugin. */
  boundAgents: string[];

  /** full = BMAD workflows available; persona-only = identity only. */
  defaultMode: "full" | "persona-only";
}

export const DEFAULT_CONFIG: BmadClawConfig = {
  sharedBmadHome: null,
  installMode: null,
  boundAgents: [],
  defaultMode: "persona-only",
};

/**
 * Migrate legacy config (may have `bmadHome` but no `sharedBmadHome`).
 * Returns a normalized BmadClawConfig safe to read from.
 */
export function migrateConfig(raw: Record<string, unknown>): BmadClawConfig {
  const legacy = raw["bmadHome"] as string | null | undefined;
  const shared = raw["sharedBmadHome"] as string | null | undefined;

  return {
    bmadHome: legacy ?? null,
    sharedBmadHome: shared ?? legacy ?? null, // migrate legacy into shared
    installMode: (raw["installMode"] as BmadClawConfig["installMode"]) ?? null,
    boundAgents: (raw["boundAgents"] as string[] | undefined) ?? [],
    defaultMode: (raw["defaultMode"] as BmadClawConfig["defaultMode"]) ?? "persona-only",
  };
}
