/**
 * bmad_install_guide tool — always available.
 * Returns step-by-step BMAD installation instructions.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";

const GUIDE = `
# Installing BMAD

BMAD (Breakthrough Method of Agile AI-driven Development) provides the workflows that power your agents.

## Option A — One-step via BMAD Claw (recommended)

Run this OpenClaw command:

  openclaw bmad install-bmad

This will ask two optional questions (Game Development? Creative Intelligence?) and then install BMAD automatically.

## Option B — Manual installation

1. In your project folder, run:

   npx bmad-method@latest install

2. Follow the BMAD prompts to choose modules (BMM is the core team).

3. After install, connect BMAD Claw to it:

   openclaw bmad config set-home <path-to-_bmad>
   openclaw bmad sync

## What gets installed

- BMM (core team): Mary, John, Winston, Amelia, Sally, Bob, Barry, Quinn, Paige
- TEA: Murat (Master Test Architect)
- GDS (optional): Cloud Dragonborn, Samus, Link, Indie — game development team
- CIS (optional): Carson, Dr. Quinn, Maya, Victor, Sophia — creative intelligence

## After installation

Run \`openclaw bmad status\` to confirm everything is connected.
`.trim();

export function registerBmadInstallGuideTool(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "bmad_install_guide",
    description:
      "Get step-by-step instructions for installing BMAD. " +
      "Use when the user asks about installing BMAD or when bmad_status shows mode: persona-only.",
    parameters: { type: "object", properties: {}, additionalProperties: false } as never,
    async execute(_id, _params) {
      return {
        content: [{ type: "text" as const, text: GUIDE }],
      };
    },
  });
}
