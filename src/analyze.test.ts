/**
 * analyze.test.ts — dependency-free tests for type inference + statistics.
 * Run with:  npx tsx src/analyze.test.ts
 */
import {
  inferType,
  parseNumber,
  parseDate,
  histogram,
  topCategories,
  analyzeColumn,
  analyzeTable,
} from "./analyze";

let passed = 0;
let failed = 0;

function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`);
  }
}
function approx(actual: number, expected: number, msg: string, eps = 1e-9): void {
  if (Math.abs(actual - expected) <= eps) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${msg}\n  expected ~${expected}, got ${actual}`);
  }
}

// --- parseNumber -----------------------------------------------------------
eq(parseNumber("42"), 42, "plain int");
eq(parseNumber("-3.14"), -3.14, "negative float");
eq(parseNumber("1,234.5"), 1234.5, "thousands separator");
eq(parseNumber("$99.99"), 99.99, "currency sign");
eq(parseNumber("1e3"), 1000, "scientific notation");
eq(parseNumber("abc"), null, "non-number rejected");
eq(parseNumber(""), null, "empty rejected");

// --- parseDate -------------------------------------------------------------
eq(parseDate("2024-01-31") !== null, true, "ISO date accepted");
eq(parseDate("01/31/2024") !== null, true, "slash date accepted");
eq(parseDate("hello") !== null, false, "garbage date rejected");
eq(parseDate("42") !== null, false, "bare number not a date");

// --- inferType -------------------------------------------------------------
eq(inferType(["1", "2", "3"]), "number", "all-number column");
eq(
  inferType(["1", "2", "3", "4", "5", "6", "7", "8", "9", "x"]),
  "number",
  "mostly-number tolerates one outlier (9/10 ≥ 90%)"
);
eq(inferType(["1", "x", "y"]), "string", "below threshold → string");
eq(inferType(["2024-01-01", "2024-02-01"]), "date", "date column");
eq(inferType(["true", "false", "yes"]), "boolean", "boolean column");
eq(inferType(["apple", "banana", "cherry"]), "string", "string column");
eq(inferType(["", "", ""]), "string", "all-blank → string");

// --- numericStats via analyzeColumn ----------------------------------------
{
  const a = analyzeColumn("v", 0, ["2", "4", "4", "4", "5", "5", "7", "9"]);
  eq(a.type, "number", "numeric column inferred");
  approx(a.numeric!.mean, 5, "mean = 5");
  approx(a.numeric!.median, 4.5, "median = 4.5");
  approx(a.numeric!.min, 2, "min = 2");
  approx(a.numeric!.max, 9, "max = 9");
  approx(a.numeric!.sum, 40, "sum = 40");
  approx(a.numeric!.stddev, 2, "population stddev = 2");
  eq(a.numeric!.count, 8, "count = 8");
}

// --- missing values handled -------------------------------------------------
{
  const a = analyzeColumn("v", 0, ["10", "", "20", "  ", "30"]);
  eq(a.missing, 2, "two blanks counted as missing");
  approx(a.numeric!.mean, 20, "mean ignores blanks");
  eq(a.numeric!.count, 3, "count excludes blanks");
}

// --- median odd count -------------------------------------------------------
{
  const a = analyzeColumn("v", 0, ["1", "2", "3"]);
  approx(a.numeric!.median, 2, "odd-count median");
}

// --- histogram --------------------------------------------------------------
{
  const bins = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  eq(bins.length, 5, "5 bins requested");
  eq(bins.reduce((s, b) => s + b.count, 0), 11, "every value lands in a bin");
  eq(bins[bins.length - 1].count >= 1, true, "max value in last bin");
}
{
  const bins = histogram([3, 3, 3]);
  eq(bins, [{ start: 3, end: 3, count: 3 }], "constant series → single bin");
}
eq(histogram([]), [], "empty histogram");

// --- topCategories ----------------------------------------------------------
{
  const cats = topCategories(["a", "b", "a", "c", "a", "b", ""]);
  eq(cats[0], { value: "a", count: 3 }, "most frequent first");
  eq(cats[1], { value: "b", count: 2 }, "second most frequent");
  eq(cats.length, 3, "blank ignored, 3 distinct");
}
{
  const cats = topCategories(["x", "y", "z", "w"], 2);
  eq(cats.length, 2, "limit respected");
}

// --- analyzeTable -----------------------------------------------------------
{
  const cols = analyzeTable(
    ["name", "age", "active"],
    [
      ["Alice", "30", "true"],
      ["Bob", "25", "false"],
      ["Cara", "35", "true"],
    ]
  );
  eq(cols.length, 3, "one analysis per column");
  eq(cols[0].type, "string", "name → string");
  eq(cols[1].type, "number", "age → number");
  eq(cols[2].type, "boolean", "active → boolean");
  eq(cols[0].uniqueCount, 3, "3 unique names");
}

console.log(`\nanalyze.test.ts — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
