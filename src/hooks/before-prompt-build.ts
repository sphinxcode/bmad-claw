/**
 * before_prompt_build hook — thin context injection.
 * Only fires for bound agents. Only injects if BMAD is found via resolution chain.
 * Returns {} on any error — never crashes the session.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { discoverBmadCandidates, selectActiveBmadCandidate } from "../lib/bmad-paths.js";
import { readModuleVersions, formatModuleBanner } from "../discovery/manifest-reader.js";
import { readPluginConfig } from "../config/writer.js";

export function registerBeforePromptBuildHook(api: OpenClawPluginApi): void {
  api.registerHook(
    "before_prompt_build",
    async (ctx: { agentId?: string; cwd?: string }) => {
      try {
        const pluginConf = readPluginConfig();
        const boundAgents = pluginConf.boundAgents ?? [];
        const sharedBmadHome = pluginConf.sharedBmadHome ?? null;

        // Only inject for BMAD-bound agents
        if (!ctx.agentId || !boundAgents.includes(ctx.agentId)) return {};

        // Resolve BMAD using full candidate chain (project-local wins)
        const candidates = discoverBmadCandidates({
          sharedBmadHome,
          cwd: ctx.cwd ?? process.cwd(),
        });
        const active = selectActiveBmadCandidate(candidates);

        if (!active) return {};

        const versions = readModuleVersions(active.path);
        const banner = formatModuleBanner(versions);

        return { prependSystemContext: banner };
      } catch {
        // Never crash a session
        return {};
      }
    },
  );
}
