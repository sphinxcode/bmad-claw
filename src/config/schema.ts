/**
 * Plugin config schema — stored under plugins.entries.bmad-claw.config
 */

export interface BmadClawConfig {
  bmadHome: string | null;
  boundAgents: string[];
  defaultMode: "full" | "persona-only";
}

export const DEFAULT_CONFIG: BmadClawConfig = {
  bmadHome: null,
  boundAgents: [],
  defaultMode: "persona-only",
};
