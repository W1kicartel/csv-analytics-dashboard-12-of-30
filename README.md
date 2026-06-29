# CSV Analytics Dashboard — Tool 12 of 30

An in-browser data-analytics dashboard. Drop a **CSV or TSV** file and the app
parses it, infers each column's type, computes descriptive statistics, and
renders an appropriate chart — no server, no upload, your data never leaves the
page.

Built with **React 18 + TypeScript (strict) + Vite + Chart.js**. This is the
12th tool in a *building-in-public* series. The design deliberately separates a
**pure, fully-tested logic core** (CSV parsing + statistics) from the typed
React UI.

## What it does

- **Parse** comma / tab / semicolon / pipe-separated files (delimiter is
  auto-detected; you can also paste data or load a built-in sample).
- **Infer column types** — `number`, `date`, `boolean`, or `string` — from the
  actual cell values, with a tolerance so a few stray cells don't derail an
  otherwise-numeric column.
- **Summarise each column**:
  - Numeric → count, missing, min, max, mean, median, standard deviation, sum,
    plus a **histogram**.
  - Categorical → unique count, missing count, and a **frequency bar chart** of
    the most common values.
- **Preview** the first 50 rows in a scrollable table with the selected column
  highlighted.

## Why it's interesting (the engineering)

- **Hand-written CSV parser** (`src/csv.ts`) — a small state machine, not a
  library. Correctly handles quoted fields, escaped quotes (`""`), and
  delimiters / newlines embedded inside quotes, plus CRLF/LF endings, a UTF-8
  BOM, and ragged rows (padded/truncated to the header width).
- **Statistics engine** (`src/analyze.ts`) — pure functions for type inference,
  numeric summaries, even-width histogram binning, and categorical frequency
  tables. Number parsing tolerates thousands separators and currency signs.
- **Clean UI/logic boundary** — the core modules have zero DOM/React
  dependencies, so they run in Node and are unit-tested directly.

## Project structure

```
src/
  csv.ts          # CSV/TSV parser (state machine) + delimiter detection
  csv.test.ts     # 18 assertions
  analyze.ts      # type inference + numeric/categorical statistics
  analyze.test.ts # 44 assertions
  types.ts        # shared domain types
  App.tsx         # dashboard UI (Chart.js histograms + bar charts)
  main.tsx        # React entry point
  styles.css      # light theme
index.html
vite.config.ts
tsconfig.json
```

## Run it

| Command | What it does |
| --- | --- |
| `npm install` | install dependencies |
| `npm run dev` | start the Vite dev server (prints a local URL) |
| `npm run build` | type-check and build a production bundle to `dist/` |
| `npm run preview` | serve the production build locally |
| `npm test` | run both test suites (62 assertions) with `tsx` |

```bash
npm install
npm run dev
```

## Tests

The logic core is verified with two dependency-free suites run via
[`tsx`](https://github.com/privatenumber/tsx):

```bash
npm test
# csv.test.ts — 18 passed, 0 failed
# analyze.test.ts — 44 passed, 0 failed
```

Coverage includes quoted/escaped CSV fields, embedded newlines, CRLF and BOM
handling, ragged-row normalisation, delimiter detection, number/date parsing,
the 90%-threshold type inference, mean/median/stddev/sum, missing-value
handling, histogram binning (including the constant-series edge case), and the
categorical frequency table.

## License

MIT
