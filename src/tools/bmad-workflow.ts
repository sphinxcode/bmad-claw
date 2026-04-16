/**
 * bmad_workflow tool — available in full mode (BMAD installed).
 * Resolves a workflow by trigger code or name and returns invocation context.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { detectBmad } from "../discovery/bmad-detect.js";
import { readPluginConfig } from "../config/writer.js";
import type { BmadWorkflowEntry } from "../discovery/manifest-reader.js";

export function registerBmadWorkflowTool(api: OpenClawPluginApi): void {
  api.registerTool(
    {
      name: "bmad_workflow",
      description:
        "Run a BMAD workflow. Use when the user explicitly asks to run a workflow, " +
        "create a document (PRD, architecture, brief), or perform a BMAD process. " +
        "Pass the menu code (e.g. MR, CP, CA) or workflow name as trigger.",
      parameters: {
        type: "object",
        properties: {
          trigger: {
            type: "string",
            description: "Menu code (e.g. MR, CP, BS) or workflow name (e.g. market-research)",
          },
          context: {
            type: "string",
            description: "Optional additional context to pass to the workflow",
          },
        },
        required: ["trigger"],
        additionalProperties: false,
      } as never,
      async execute(_id, params: { trigger: string; context?: string }) {
        const pluginConf = readPluginConfig();
        const bmadHome = (pluginConf["bmadHome"] as string | null) ?? null;
        const ctx = detectBmad({ bmadHome, cwd: process.cwd() });

        if (ctx.mode !== "full" || !ctx.detection) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  "BMAD is not installed. Use bmad_install_guide to get setup instructions, " +
                  "or run: openclaw bmad install-bmad",
              },
            ],
          };
        }

        const workflow = resolveWorkflow(params.trigger, ctx.workflows);

        if (!workflow) {
          const available = ctx.workflows
            .filter((w) => w.menuCode)
            .map((w) => `${w.menuCode} — ${w.displayName}`)
            .slice(0, 15)
            .join("\n");
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `Workflow "${params.trigger}" not found.\n\nAvailable workflows:\n${available}`,
              },
            ],
          };
        }

        const contextNote = params.context
          ? `\n\nAdditional context: ${params.context}`
          : "";

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Activating workflow: ${workflow.displayName} (${workflow.menuCode})\n` +
                `Skill: ${workflow.skill}\n` +
                `Description: ${workflow.description}` +
                contextNote +
                `\n\nInvoke the skill: ${workflow.skill}` +
                (params.context ? ` with context: ${params.context}` : ""),
            },
          ],
        };
      },
    },
    { optional: true }, // user must add to allowlist for side-effect workflows
  );
}

function resolveWorkflow(
  trigger: string,
  workflows: BmadWorkflowEntry[],
): BmadWorkflowEntry | null {
  const t = trigger.trim().toUpperCase();

  // Exact menu code match
  const byCode = workflows.find((w) => w.menuCode.toUpperCase() === t);
  if (byCode) return byCode;

  // Skill name match
  const tLower = trigger.toLowerCase();
  const bySkill = workflows.find((w) => w.skill.toLowerCase() === tLower);
  if (bySkill) return bySkill;

  // Fuzzy: trigger is substring of displayName or description
  const fuzzy = workflows.find(
    (w) =>
      w.displayName.toLowerCase().includes(tLower) ||
      w.description.toLowerCase().includes(tLower),
  );
  return fuzzy ?? null;
}
