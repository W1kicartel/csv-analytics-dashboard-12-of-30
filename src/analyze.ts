/**
 * analyze.ts — column type inference + descriptive statistics.
 *
 * Given a parsed table this module:
 *   1. infers each column's type (number | date | boolean | string),
 *   2. computes type-appropriate statistics (numeric summary, categorical
 *      frequency table, histogram binning),
 * all as PURE functions with no DOM/library dependency, so the logic is fully
 * unit-testable and reusable on the server.
 */

export type ColumnType = "number" | "date" | "boolean" | "string";

export interface NumericStats {
  count: number;
  missing: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  sum: number;
}

export interface CategoryCount {
  value: string;
  count: number;
}

export interface HistogramBin {
  /** Inclusive lower bound of the bin. */
  start: number;
  /** Exclusive upper bound (inclusive for the final bin). */
  end: number;
  count: number;
}

export interface ColumnAnalysis {
  name: string;
  index: number;
  type: ColumnType;
  /** Numeric summary (only when type === "number"). */
  numeric?: NumericStats;
  /** Top categories by frequency (for non-numeric columns). */
  categories?: CategoryCount[];
  /** Distinct non-empty values. */
  uniqueCount: number;
  /** Count of empty / missing cells. */
  missing: number;
}

const BOOLISH = new Set(["true", "false", "yes", "no", "y", "n", "0", "1"]);

/** Is this cell empty / missing? */
function isBlank(v: string): boolean {
  return v == null || v.trim() === "";
}

/** Parse a number allowing thousands separators and a leading currency sign. */
export function parseNumber(v: string): number | null {
  const cleaned = v.trim().replace(/^[$€£¥]/, "").replace(/,/g, "");
  if (cleaned === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) {
    return null;
  }
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

/** Recognise a handful of common, unambiguous date formats. */
export function parseDate(v: string): number | null {
  const s = v.trim();
  // ISO: 2024-01-31 or 2024-01-31T10:00:00
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  // US/EU slashes: 01/31/2024 or 31/01/2024 (4-digit year required to avoid noise)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Infer a column's type from its values. A column is classified as the most
 * specific type that (almost) all of its non-blank cells satisfy. We allow a
 * small tolerance so a few stray cells don't derail a clearly-numeric column.
 */
export function inferType(values: string[]): ColumnType {
  const nonBlank = values.filter((v) => !isBlank(v));
  if (nonBlank.length === 0) return "string";

  let numeric = 0;
  let date = 0;
  let bool = 0;
  for (const v of nonBlank) {
    if (parseNumber(v) !== null) numeric++;
    if (parseDate(v) !== null) date++;
    if (BOOLISH.has(v.trim().toLowerCase())) bool++;
  }

  const n = nonBlank.length;
  const threshold = 0.9; // 90% of cells must match

  // Order matters: prefer the more specific interpretation.
  // Booleans only when values are NOT all 0/1 numbers masquerading as bools
  // — but pure 0/1 columns read better as numbers, so check date/number first.
  if (date / n >= threshold) return "date";
  if (numeric / n >= threshold) return "number";
  if (bool / n >= threshold) return "boolean";
  return "string";
}

function numericStats(nums: number[], missing: number): NumericStats {
  const sorted = [...nums].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = count ? sum / count : 0;
  const variance = count
    ? sorted.reduce((a, b) => a + (b - mean) * (b - mean), 0) / count
    : 0;
  const median = count
    ? count % 2
      ? sorted[(count - 1) / 2]
      : (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : 0;
  return {
    count,
    missing,
    min: count ? sorted[0] : 0,
    max: count ? sorted[count - 1] : 0,
    mean,
    median,
    stddev: Math.sqrt(variance),
    sum,
  };
}

/** Build evenly-spaced histogram bins for a numeric series. */
export function histogram(nums: number[], binCount = 10): HistogramBin[] {
  if (nums.length === 0) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) {
    return [{ start: min, end: max, count: nums.length }];
  }
  const k = Math.max(1, Math.floor(binCount));
  const width = (max - min) / k;
  const bins: HistogramBin[] = Array.from({ length: k }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }));
  for (const x of nums) {
    let idx = Math.floor((x - min) / width);
    if (idx >= k) idx = k - 1; // the max value falls into the last bin
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return bins;
}

/** Frequency table for categorical values, sorted most-common first. */
export function topCategories(values: string[], limit = 12): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (isBlank(v)) continue;
    const key = v.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

/** Analyse a single column given its raw cell values. */
export function analyzeColumn(name: string, index: number, values: string[]): ColumnAnalysis {
  const type = inferType(values);
  const missing = values.filter(isBlank).length;
  const unique = new Set(values.filter((v) => !isBlank(v)).map((v) => v.trim()));

  const base: ColumnAnalysis = {
    name,
    index,
    type,
    uniqueCount: unique.size,
    missing,
  };

  if (type === "number") {
    const nums: number[] = [];
    for (const v of values) {
      if (isBlank(v)) continue;
      const n = parseNumber(v);
      if (n !== null) nums.push(n);
    }
    base.numeric = numericStats(nums, missing);
  } else {
    base.categories = topCategories(values);
  }

  return base;
}

/** Analyse every column of a table (headers + row-major data). */
export function analyzeTable(headers: string[], rows: string[][]): ColumnAnalysis[] {
  return headers.map((name, col) =>
    analyzeColumn(
      name,
      col,
      rows.map((r) => r[col] ?? "")
    )
  );
}
