/**
 * Reads BMAD manifest files — the interface boundary.
 * Only reads _bmad/_config/*.csv and manifest.yaml columns.
 * Never touches compiled .agent.yaml or workflow step file internals.
 */

import { readFileSync, existsSync } from "node:fs";
import { parseCsv } from "../lib/csv.js";
import { bmadConfigPaths } from "../lib/bmad-paths.js";

export interface BmadPersona {
  name: string;         // e.g. "bmad-agent-analyst"
  displayName: string;  // e.g. "Mary"
  title: string;        // e.g. "Business Analyst"
  icon: string;         // e.g. "📊"
  capabilities: string;
  role: string;
  identity: string;
  communicationStyle: string;
  principles: string;
  module: string;       // "bmm" | "gds" | "cis" | "tea"
  path: string;
  canonicalId: string;
}

export interface BmadWorkflowEntry {
  module: string;
  skill: string;
  displayName: string;
  menuCode: string;
  description: string;
}

export interface BmadManifestVersions {
  [module: string]: string; // module → version
}

const REQUIRED_AGENT_COLS = [
  "name", "displayName", "title", "icon", "role",
  "identity", "communicationStyle", "principles", "module",
] as const;

const REQUIRED_WORKFLOW_COLS = [
  "module", "skill", "display-name", "menu-code", "description",
] as const;

/**
 * Parse agent-manifest.csv. Returns empty array + logs warning on schema mismatch.
 */
export function readAgentManifest(bmadPath: string): BmadPersona[] {
  const paths = bmadConfigPaths(bmadPath);
  if (!existsSync(paths.agentManifestCsv)) {
    console.warn(`[bmad-claw] agent-manifest.csv not found at ${paths.agentManifestCsv}`);
    return [];
  }

  const content = readFileSync(paths.agentManifestCsv, "utf-8");
  const rows = parseCsv(content);

  if (rows.length === 0) return [];

  // Schema-validate: check required columns exist
  const firstRow = rows[0];
  if (!firstRow) return [];
  const missing = REQUIRED_AGENT_COLS.filter((col) => !(col in firstRow));
  if (missing.length > 0) {
    console.warn(
      `[bmad-claw] agent-manifest.csv schema mismatch — missing columns: ${missing.join(", ")}. ` +
      "Falling back to bundled snapshot.",
    );
    return [];
  }

  return rows.map((row) => ({
    name: row["name"] ?? "",
    displayName: row["displayName"] ?? "",
    title: row["title"] ?? "",
    icon: row["icon"] ?? "",
    capabilities: row["capabilities"] ?? "",
    role: row["role"] ?? "",
    identity: row["identity"] ?? "",
    communicationStyle: row["communicationStyle"] ?? "",
    principles: row["principles"] ?? "",
    module: row["module"] ?? "",
    path: row["path"] ?? "",
    canonicalId: row["canonicalId"] ?? "",
  })).filter((p) => p.name && p.displayName);
}

/**
 * Parse module-help.csv for workflow catalog.
 * Tries _bmad/_config/module-help.csv first (global), then _bmad/bmm/module-help.csv.
 */
export function readWorkflowCatalog(bmadPath: string): BmadWorkflowEntry[] {
  const paths = bmadConfigPaths(bmadPath);
  const candidates = [
    paths.globalModuleHelp,
    paths.moduleHelpCsv("bmm"),
    paths.moduleHelpCsv("gds"),
  ];

  const entries: BmadWorkflowEntry[] = [];

  for (const csvPath of candidates) {
    if (!existsSync(csvPath)) continue;
    const content = readFileSync(csvPath, "utf-8");
    const rows = parseCsv(content);
    if (rows.length === 0) continue;

    const firstRow = rows[0];
    if (!firstRow) continue;
    // Accept both source-repo columns (command/name/code) and installed columns (skill/display-name/menu-code)
    const hasSourceFormat = "command" in (firstRow ?? {});
    const hasInstalledFormat = "skill" in (firstRow ?? {});
    if (!hasSourceFormat && !hasInstalledFormat) continue;

    for (const row of rows) {
      const skill = row["command"] ?? row["skill"] ?? "";
      if (!skill || skill.startsWith("_")) continue;
      entries.push({
        module: row["module"] ?? "",
        skill,
        displayName: row["name"] ?? row["display-name"] ?? "",
        menuCode: row["code"] ?? row["menu-code"] ?? "",
        description: row["description"] ?? "",
      });
    }
  }

  return entries;
}

/**
 * Parse manifest.yaml for module version info.
 * Uses a simple regex — avoids a YAML dep.
 */
export function readModuleVersions(bmadPath: string): BmadManifestVersions {
  const paths = bmadConfigPaths(bmadPath);
  if (!existsSync(paths.manifestYaml)) return {};

  const content = readFileSync(paths.manifestYaml, "utf-8");
  const versions: BmadManifestVersions = {};

  // Match lines like: "  bmm: 6.3.0" or "version: 6.0.0-Beta.8"
  const moduleVersionRe = /^\s{2}(\w+):\s*(.+)$/gm;
  const topVersionRe = /^version:\s*(.+)$/m;

  let match: RegExpExecArray | null;
  while ((match = moduleVersionRe.exec(content)) !== null) {
    const [, mod, ver] = match;
    if (mod && ver) versions[mod.trim()] = ver.trim();
  }

  const topMatch = topVersionRe.exec(content);
  if (topMatch?.[1]) versions["_bmad"] = topMatch[1].trim();

  return versions;
}

/** One-liner module banner for before_prompt_build hook */
export function formatModuleBanner(versions: BmadManifestVersions): string {
  const mods = Object.entries(versions)
    .filter(([k]) => k !== "_bmad")
    .map(([k, v]) => `${k}@${v}`)
    .join(", ");
  const bmadVer = versions["_bmad"] ? ` (bmad-method ${versions["_bmad"]})` : "";
  return `BMAD active${bmadVer}: ${mods || "installed"}`;
}
