/**
 * BMAD Claw — unofficial BMAD bridge for OpenClaw
 *
 * Scaffolds BMAD personas (Mary, John, Barry, etc.) as global OpenClaw agents
 * with freestyle-first identity, session hooks, and workflow tools.
 *
 * MIT License. BMAD-METHOD is MIT licensed by bmad-code-org.
 * This plugin does not bundle BMAD content — install BMAD separately.
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { register } from "./src/register.js";

export default definePluginEntry({
  id: "bmad-claw",
  name: "BMAD Claw",
  description:
    "Unofficial BMAD bridge for OpenClaw. Brings BMAD agents (Mary, John, Barry, etc.) " +
    "to life as persistent OpenClaw agents with freestyle personality and workflow access.",
  register,
});
