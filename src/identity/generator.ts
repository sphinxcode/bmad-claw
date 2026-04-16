/**
 * Fills SOUL.md and AGENTS.md templates from BMAD persona data + user config.
 * Asserts no unfilled {placeholder} tokens remain in output.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BmadPersona, BmadWorkflowEntry } from "../discovery/manifest-reader.js";
import type { BmadMode } from "../discovery/bmad-detect.js";

const TMPL_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "templates",
);

export interface GenerateInput {
  persona: BmadPersona;
  workflows: BmadWorkflowEntry[]; // all workflows — will be filtered to this agent's module
  mode: BmadMode;
  userName: string;
  language: string;
}

export interface GeneratedIdentity {
  soul: string;
  agents: string;
}

export function generateIdentity(input: GenerateInput): GeneratedIdentity {
  const soul = generateSoul(input);
  const agents = generateAgents(input);

  assertNoPlaceholders("SOUL.md", soul);
  assertNoPlaceholders("AGENTS.md", agents);

  return { soul, agents };
}

function generateSoul(input: GenerateInput): string {
  const tmpl = readFileSync(join(TMPL_DIR, "SOUL.md.tmpl"), "utf-8");
  const modeBSection =
    input.mode === "persona-only"
      ? readFileSync(join(TMPL_DIR, "SOUL.md.mode-b.tmpl"), "utf-8")
      : "";

  return fill(tmpl, {
    displayName: input.persona.displayName,
    title: input.persona.title,
    icon: input.persona.icon,
    role: input.persona.role,
    identity: input.persona.identity,
    communicationStyle: input.persona.communicationStyle,
    principles: input.persona.principles,
    userName: input.userName,
    language: input.language,
    bmadModeSection: modeBSection,
  });
}

function generateAgents(input: GenerateInput): string {
  const tmpl = readFileSync(join(TMPL_DIR, "AGENTS.md.tmpl"), "utf-8");

  // Get menu codes for this agent's module workflows
  const agentWorkflows = input.workflows.filter(
    (w) => w.module === input.persona.module || w.module === "BMad Method",
  );
  const menuCodes = agentWorkflows
    .filter((w) => w.menuCode)
    .map((w) => w.menuCode)
    .join(", ") || "none configured";

  const caps = input.persona.capabilities.trim();
  const capabilitiesSection = caps
    ? `Stay within your domain: ${caps}.\n\n`
    : "";

  return fill(tmpl, {
    displayName: input.persona.displayName,
    title: input.persona.title,
    language: input.language,
    menuCodes,
    capabilitiesSection,
  });
}

/**
 * Escape literal curly braces in a persona field value before template substitution.
 * Prevents persona content like "{Team}" from being mistaken for an unfilled placeholder.
 * Uses Unicode lookalike chars (U+FF5B/U+FF5D) — invisible to LLMs, safe in markdown.
 */
function escapeFieldValue(val: string): string {
  // Replace { and } that are NOT part of a template var (i.e. not {key} we're inserting)
  // We escape all { and } in the value since template vars are in the template, not in values.
  return val.replace(/\{/g, "\uFF5B").replace(/\}/g, "\uFF5D");
}

function fill(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, escapeFieldValue(value));
  }
  return result;
}

function assertNoPlaceholders(name: string, content: string): void {
  const remaining = content.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g);
  if (remaining && remaining.length > 0) {
    throw new Error(
      `[bmad-claw] ${name} has unfilled placeholders: ${remaining.join(", ")}`,
    );
  }
}
