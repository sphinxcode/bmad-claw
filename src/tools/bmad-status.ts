/**
 * bmad_status tool — always available.
 * Returns current BMAD installation state and mode.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { detectBmad } from "../discovery/bmad-detect.js";
import { readPluginConfig } from "../config/writer.js";

export function registerBmadStatusTool(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "bmad_status",
    description:
      "Check if BMAD is installed and what mode agents are running in. " +
      "Use this when the user asks about BMAD setup or before routing to bmad_workflow.",
    parameters: { type: "object", properties: {}, additionalProperties: false } as never,
    async execute(_id, _params) {
      const pluginConf = readPluginConfig();
      const sharedBmadHome = pluginConf.sharedBmadHome ?? null;
      const boundAgents = pluginConf.boundAgents ?? [];

      const ctx = detectBmad({ sharedBmadHome, cwd: process.cwd() });

      const result = {
        mode: ctx.mode,
        bmadPath: ctx.detection?.path ?? null,
        detectionSource: ctx.detection?.source ?? null,
        modules: ctx.versions,
        workflowsAvailable: ctx.mode === "full",
        boundAgents,
        fallbackVersion: ctx.fallbackVersion ?? null,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  });
}
