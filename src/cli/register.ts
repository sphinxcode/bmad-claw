/**
 * CLI command registration for the `openclaw bmad` command tree.
 */

import { installCommand } from "../commands/install.js";
import { installBmadCommand } from "../commands/install-bmad.js";
import { syncCommand } from "../commands/sync.js";
import { statusCommand } from "../commands/status.js";
import { configCommand } from "../commands/config.js";

interface Commander {
  command: (name: string) => CommanderCommand;
}

interface CommanderCommand {
  description: (desc: string) => CommanderCommand;
  argument: (name: string, desc?: string) => CommanderCommand;
  option: (flags: string, desc?: string) => CommanderCommand;
  action: (fn: (...args: unknown[]) => Promise<void> | void) => CommanderCommand;
  addCommand: (cmd: CommanderCommand) => CommanderCommand;
  command: (name: string) => CommanderCommand;
}

export function registerBmadCli(program: Commander): void {
  const bmad = program.command("bmad").description(
    "BMAD Claw — manage BMAD agents and bridge",
  ) as CommanderCommand;

  bmad
    .command("install")
    .description("Scaffold BMAD agents into OpenClaw (idempotent)")
    .option("--auto", "Install default selection without prompts")
    .action(async (opts: { auto?: boolean }) => {
      await installCommand(opts.auto ? ["--auto"] : []);
    });

  bmad
    .command("install-bmad")
    .description("Install BMAD via npx bmad-method@latest (--yes, minimal prompts)")
    .argument("[directory]", "Target directory (default: cwd)")
    .action(async (dir?: string) => {
      await installBmadCommand(dir ? [dir] : []);
    });

  bmad
    .command("sync")
    .description("Refresh agent identities (re-generate drifted SOUL.md/AGENTS.md)")
    .action(async () => {
      await syncCommand();
    });

  bmad
    .command("status")
    .description("Show BMAD detection, bound agents, and mode")
    .action(async () => {
      await statusCommand();
    });

  bmad
    .command("config")
    .description("Plugin configuration")
    .argument("<subcommand>", "e.g. set-home <path>")
    .argument("[value]", "Value for subcommand")
    .action(async (sub: string, val?: string) => {
      await configCommand(val ? [sub, val] : [sub]);
    });
}
