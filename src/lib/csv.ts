/**
 * Lightweight CSV parser for BMAD manifest files.
 * Handles quoted fields, commas inside quotes, and empty fields.
 * Keeps it simple — no external deps.
 */

export type CsvRow = Record<string, string>;

export function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseRow(lines[0] ?? "");
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i] ?? "");
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j] ?? `col${j}`;
      row[key] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}
