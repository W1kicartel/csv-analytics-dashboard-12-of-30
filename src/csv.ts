/**
 * csv.ts — a dependency-free, RFC 4180-style CSV/TSV parser.
 *
 * Why hand-written? It demonstrates real parsing logic rather than reaching
 * for a library: a small state machine that correctly handles quoted fields,
 * escaped quotes (""), and delimiters / newlines embedded inside quotes.
 *
 * Runs in the browser AND in Node (plain ES module, no DOM dependency).
 */

export type Delimiter = "," | "\t" | ";" | "|";

export interface ParsedCsv {
  /** Column headers (first row). */
  headers: string[];
  /** Data rows; every row is padded/truncated to headers.length. */
  rows: string[][];
  /** The delimiter that was used to parse. */
  delimiter: Delimiter;
}

/**
 * Detect the most likely delimiter by scanning the first non-empty line and
 * picking the candidate with the highest count. Ties prefer comma.
 */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r\n|\r|\n/).find((l) => l.trim() !== "") ?? "";
  const candidates: Delimiter[] = [",", "\t", ";", "|"];
  let best: Delimiter = ",";
  let bestCount = -1;
  for (const d of candidates) {
    // Count only delimiters that are NOT inside quotes on this sample line.
    const count = countUnquoted(firstLine, d);
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Count occurrences of `delim` in `line` that are not inside double quotes. */
function countUnquoted(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delim) {
      count++;
    }
  }
  return count;
}

/**
 * Parse CSV/TSV text into a structured table.
 *
 * @param text       Raw file contents.
 * @param delimiter  Optional explicit delimiter; auto-detected when omitted.
 */
export function parseCsv(text: string, delimiter?: Delimiter): ParsedCsv {
  // Strip a UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const delim = delimiter ?? detectDelimiter(text);
  const records = tokenize(text, delim);

  if (records.length === 0) {
    return { headers: [], rows: [], delimiter: delim };
  }

  const headers = records[0].map((h, i) => (h.trim() === "" ? `Column ${i + 1}` : h.trim()));
  const width = headers.length;

  const rows: string[][] = [];
  for (let r = 1; r < records.length; r++) {
    const rec = records[r];
    // Skip fully-empty trailing rows.
    if (rec.length === 1 && rec[0] === "") continue;
    // Normalise width so downstream code can index safely.
    const row = rec.slice(0, width);
    while (row.length < width) row.push("");
    rows.push(row);
  }

  return { headers, rows, delimiter: delim };
}

/**
 * Core state machine: split raw text into records of fields, honouring quotes.
 * A quote inside a quoted field is escaped by doubling it ("").
 */
function tokenize(text: string, delim: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      // Treat \r\n and lone \r as a single line break.
      pushRecord();
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      pushRecord();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush the final record (file may not end with a newline).
  if (field !== "" || record.length > 0) pushRecord();

  return records;
}
