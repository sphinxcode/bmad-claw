/**
 * before_prompt_build hook — thin context injection.
 * Only fires for bound agents. Only injects if BMAD is found in cwd.
 * Returns {} on any error — never crashes the session.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { resolveBmadPath } from "../lib/bmad-paths.js";
import { readModuleVersions, formatModuleBanner } from "../discovery/manifest-reader.js";
import { readPluginConfig } from "../config/writer.js";

export function registerBeforePromptBuildHook(api: OpenClawPluginApi): void {
  api.registerHook(
    "before_prompt_build",
    async (ctx: { agentId?: string; cwd?: string }) => {
      try {
        const pluginConf = readPluginConfig();
        const boundAgents = (pluginConf["boundAgents"] as string[] | undefined) ?? [];
        const bmadHome = (pluginConf["bmadHome"] as string | null) ?? null;

        // Only inject for BMAD-bound agents
        if (!ctx.agentId || !boundAgents.includes(ctx.agentId)) return {};

        // Detect BMAD in current session's cwd
        const detection = resolveBmadPath({
          bmadHome,
          cwd: ctx.cwd ?? process.cwd(),
        });

        if (!detection) return {};

        const versions = readModuleVersions(detection.path);
        const banner = formatModuleBanner(versions);

        return { prependSystemContext: banner };
      } catch {
        // Never crash a session
        return {};
      }
    },
  );
}
