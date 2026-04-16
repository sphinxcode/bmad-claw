/**
 * Plugin registration — wires all capabilities into the OpenClaw API.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { registerBmadStatusTool } from "./tools/bmad-status.js";
import { registerBmadInstallGuideTool } from "./tools/bmad-install-guide.js";
import { registerBmadWorkflowTool } from "./tools/bmad-workflow.js";
import { registerBeforePromptBuildHook } from "./hooks/before-prompt-build.js";

export function register(api: OpenClawPluginApi): void {
  // Tools — always available
  registerBmadStatusTool(api);
  registerBmadInstallGuideTool(api);

  // Tool — optional (side-effect workflow activation)
  registerBmadWorkflowTool(api);

  // Hook — session context injection
  registerBeforePromptBuildHook(api);

  // CLI subcommands — lazy-loaded
  api.registerCli(
    async ({ program }: { program: { command: (name: string) => unknown } }) => {
      const { registerBmadCli } = await import("./cli/register.js");
      registerBmadCli(program);
    },
    {
      descriptors: [
        {
          name: "bmad",
          description: "BMAD Claw — manage BMAD agents, install BMAD, sync identities",
          hasSubcommands: true,
        },
      ],
    },
  );
}
