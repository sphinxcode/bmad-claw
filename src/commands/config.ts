/**
 * openclaw bmad config <subcommand>
 * Currently: set-home <path>
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { writePluginConfig } from "../config/writer.js";

export async function configCommand(args: string[]): Promise<void> {
  const sub = args[0];

  if (sub === "set-home") {
    const rawPath = args[1];
    if (!rawPath) {
      console.error("Usage: openclaw bmad config set-home <path-to-_bmad>");
      process.exit(1);
    }

    const bmadPath = resolve(rawPath);
    const manifestPath = join(bmadPath, "_config", "manifest.yaml");

    if (!existsSync(manifestPath)) {
      console.error(
        `[bmad-claw] Invalid BMAD path: ${bmadPath}\n` +
        `Expected to find: ${manifestPath}`,
      );
      process.exit(1);
    }

    writePluginConfig({ bmadHome: bmadPath });
    console.log(`✓ BMAD home set to: ${bmadPath}`);
    console.log("Run 'openclaw bmad sync' to refresh agent identities.");
  } else {
    console.log("Available config commands:");
    console.log("  openclaw bmad config set-home <path>   Set BMAD install path");
  }
}
