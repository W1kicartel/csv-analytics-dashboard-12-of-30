/**
 * csv.test.ts — dependency-free test runner for the CSV parser.
 * Run with:  npx tsx src/csv.test.ts
 */
import { parseCsv, detectDelimiter } from "./csv";

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

// --- delimiter detection ---------------------------------------------------
eq(detectDelimiter("a,b,c\n1,2,3"), ",", "detect comma");
eq(detectDelimiter("a\tb\tc"), "\t", "detect tab");
eq(detectDelimiter("a;b;c"), ";", "detect semicolon");
eq(detectDelimiter("a|b|c"), "|", "detect pipe");
eq(detectDelimiter('"a,b",c\n1,2'), ",", "delimiter detection ignores quoted commas");

// --- basic parsing ---------------------------------------------------------
{
  const r = parseCsv("name,age\nAlice,30\nBob,25");
  eq(r.headers, ["name", "age"], "headers parsed");
  eq(r.rows, [["Alice", "30"], ["Bob", "25"]], "rows parsed");
  eq(r.delimiter, ",", "delimiter recorded");
}

// --- quoted fields ---------------------------------------------------------
{
  const r = parseCsv('a,b\n"hello, world",2');
  eq(r.rows, [["hello, world", "2"]], "comma inside quotes preserved");
}
{
  const r = parseCsv('a,b\n"she said ""hi""",2');
  eq(r.rows, [['she said "hi"', "2"]], "escaped double-quote");
}
{
  const r = parseCsv('a,b\n"line1\nline2",2');
  eq(r.rows, [["line1\nline2", "2"]], "newline inside quotes");
}

// --- line endings & BOM ----------------------------------------------------
{
  const r = parseCsv("a,b\r\n1,2\r\n3,4");
  eq(r.rows, [["1", "2"], ["3", "4"]], "CRLF line endings");
}
{
  const r = parseCsv("﻿a,b\n1,2");
  eq(r.headers, ["a", "b"], "BOM stripped from header");
}

// --- ragged rows are normalised to header width ----------------------------
{
  const r = parseCsv("a,b,c\n1,2\n4,5,6,7");
  eq(r.rows, [["1", "2", ""], ["4", "5", "6"]], "short row padded, long row truncated");
}

// --- empty trailing line is ignored ----------------------------------------
{
  const r = parseCsv("a,b\n1,2\n");
  eq(r.rows, [["1", "2"]], "trailing newline does not create empty row");
}

// --- TSV --------------------------------------------------------------------
{
  const r = parseCsv("a\tb\n1\t2");
  eq(r.delimiter, "\t", "tsv delimiter");
  eq(r.rows, [["1", "2"]], "tsv rows");
}

// --- blank header gets a generated name ------------------------------------
{
  const r = parseCsv("a,,c\n1,2,3");
  eq(r.headers, ["a", "Column 2", "c"], "blank header named");
}

console.log(`\ncsv.test.ts — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
