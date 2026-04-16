/**
 * Build-time snapshot script.
 * Reads BMAD-METHOD open-source repo CSVs → normalizes → writes assets/fallback/.
 *
 * Usage: node scripts/snapshot-bmad.mjs [--bmad-repo <path>]
 *
 * Default BMAD repo path: E:/AI-Terminal/sphinxcode/open-source/BMAD-METHOD
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const ASSETS_DIR = resolve(join(__dirname, "..", "assets", "fallback"));

// Default BMAD repo — override with --bmad-repo
const DEFAULT_BMAD_REPO = resolve("E:/AI-Terminal/sphinxcode/open-source/BMAD-METHOD");

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function parseRow(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      fields.push(current); current = "";
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

function main() {
  const args = process.argv.slice(2);
  const repoFlagIdx = args.indexOf("--bmad-repo");
  const bmadRepo = repoFlagIdx >= 0 ? resolve(args[repoFlagIdx + 1]) : DEFAULT_BMAD_REPO;

  if (!existsSync(bmadRepo)) {
    console.error(`BMAD repo not found at: ${bmadRepo}`);
    console.error("Pass --bmad-repo <path> or clone BMAD-METHOD locally.");
    process.exit(1);
  }

  mkdirSync(ASSETS_DIR, { recursive: true });

  // 1. Persona snapshot from default-party.csv
  const partyPath = join(bmadRepo, "src", "bmm", "teams", "default-party.csv");
  if (!existsSync(partyPath)) {
    console.error(`default-party.csv not found at: ${partyPath}`);
    process.exit(1);
  }

  const partyRows = parseCsv(readFileSync(partyPath, "utf-8"));
  const agents = partyRows
    .filter((r) => r.name && r.displayName)
    .map((r) => ({
      name: r.name ?? "",
      displayName: r.displayName ?? "",
      title: r.title ?? "",
      icon: r.icon ?? "",
      capabilities: r.capabilities ?? "",
      role: r.role ?? "",
      identity: r.identity ?? "",
      communicationStyle: r.communicationStyle ?? "",
      principles: r.principles ?? "",
      module: r.module ?? "",
      path: r.path ?? "",
      canonicalId: r.canonicalId ?? "",
    }));

  writeFileSync(
    join(ASSETS_DIR, "agents.json"),
    JSON.stringify(agents, null, 2),
    "utf-8",
  );
  console.log(`✓ agents.json: ${agents.length} personas`);

  // 2. Workflow catalog from module-help.csv files
  const moduleHelpCandidates = [
    join(bmadRepo, "src", "bmm", "module-help.csv"),
    join(bmadRepo, "src", "gds", "module-help.csv"),
    join(bmadRepo, "src", "cis", "module-help.csv"),
    join(bmadRepo, "src", "tea", "module-help.csv"),
  ];

  const workflows = [];
  for (const csvPath of moduleHelpCandidates) {
    if (!existsSync(csvPath)) continue;
    const rows = parseCsv(readFileSync(csvPath, "utf-8"));
    for (const r of rows) {
      // Handle both source-repo format (command/name/code) and installed format (skill/display-name/menu-code)
      const skill = r["command"] ?? r["skill"] ?? "";
      if (!skill || skill.startsWith("_")) continue;
      workflows.push({
        module: r["module"] ?? "",
        skill,
        displayName: r["name"] ?? r["display-name"] ?? r["displayName"] ?? "",
        menuCode: r["code"] ?? r["menu-code"] ?? r["menuCode"] ?? "",
        description: r["description"] ?? "",
      });
    }
    console.log(`✓ workflows from ${csvPath.split("/").pop()}: ${rows.length} entries`);
  }

  writeFileSync(
    join(ASSETS_DIR, "workflows-catalog.json"),
    JSON.stringify(workflows, null, 2),
    "utf-8",
  );
  console.log(`✓ workflows-catalog.json: ${workflows.length} workflows`);

  // 3. Read BMAD version from package.json
  const pkgPath = join(bmadRepo, "package.json");
  let bmadVersion = "unknown";
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    bmadVersion = pkg.version ?? "unknown";
  }

  const versionStr = `bmad-method@${bmadVersion} snapshot @ ${new Date().toISOString().split("T")[0]}`;
  writeFileSync(join(ASSETS_DIR, "VERSION"), versionStr, "utf-8");
  console.log(`✓ VERSION: ${versionStr}`);
  console.log("\nSnapshot complete. Commit assets/fallback/ to the repo.");
}

main();
