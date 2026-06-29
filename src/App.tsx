import { useMemo, useRef, useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { parseCsv } from "./csv";
import { analyzeTable, histogram, parseNumber } from "./analyze";
import type { Dataset } from "./types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SAMPLE = `region,product,units,revenue,date,returned
North,Widget,120,2400.50,2024-01-05,false
South,Gadget,80,3200.00,2024-01-07,true
East,Widget,95,1900.00,2024-01-09,false
West,Gizmo,200,8000.00,2024-01-12,false
North,Gadget,60,2400.00,2024-01-15,true
South,Widget,150,3000.00,2024-01-18,false
East,Gizmo,175,7000.00,2024-01-21,false
West,Widget,110,2200.00,2024-01-24,true
North,Gizmo,90,3600.00,2024-01-27,false
South,Gadget,130,5200.00,2024-01-30,false`;

const TYPE_COLORS: Record<string, string> = {
  number: "#1a73e8",
  date: "#9334e6",
  boolean: "#e8710a",
  string: "#188038",
};

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Remember the last dataset name across reloads (lightweight persistence demo).
  useEffect(() => {
    if (dataset) localStorage.setItem("lastDatasetName", dataset.name);
  }, [dataset]);

  function loadText(text: string, name: string) {
    try {
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("No tabular data found — check the file has a header row and at least one data row.");
        return;
      }
      setDataset({ name, ...parsed });
      setSelected(0);
      setError("");
    } catch (e) {
      setError("Failed to parse: " + (e as Error).message);
    }
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result), file.name);
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsText(file);
  }

  const analyses = useMemo(
    () => (dataset ? analyzeTable(dataset.headers, dataset.rows) : []),
    [dataset]
  );
  const current = analyses[selected];

  // Build chart data for the selected column.
  const chart = useMemo(() => {
    if (!dataset || !current) return null;
    const colValues = dataset.rows.map((r) => r[current.index] ?? "");

    if (current.type === "number") {
      const nums = colValues
        .map(parseNumber)
        .filter((n): n is number => n !== null);
      const bins = histogram(nums, 12);
      return {
        title: `Distribution of "${current.name}"`,
        data: {
          labels: bins.map((b) => `${fmt(b.start)}–${fmt(b.end)}`),
          datasets: [
            {
              label: "Frequency",
              data: bins.map((b) => b.count),
              backgroundColor: "#1a73e8",
              borderRadius: 4,
            },
          ],
        },
      };
    }

    const cats = current.categories ?? [];
    return {
      title: `Top values of "${current.name}"`,
      data: {
        labels: cats.map((c) => c.value),
        datasets: [
          {
            label: "Count",
            data: cats.map((c) => c.count),
            backgroundColor: TYPE_COLORS[current.type],
            borderRadius: 4,
          },
        ],
      },
    };
  }, [dataset, current]);

  return (
    <div className="app">
      <header>
        <h1>CSV Analytics Dashboard</h1>
        <p className="sub">
          Drop a CSV/TSV file to parse it, infer column types, and explore
          per-column statistics and charts — all in the browser.
        </p>
      </header>

      {!dataset && (
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
        >
          <p>Drag &amp; drop a .csv / .tsv file here</p>
          <div className="dz-actions">
            <button onClick={() => fileInput.current?.click()}>Choose file</button>
            <button className="ghost" onClick={() => setPasteOpen((v) => !v)}>
              Paste data
            </button>
            <button className="ghost" onClick={() => loadText(SAMPLE, "sample-sales.csv")}>
              Load sample
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {pasteOpen && (
            <div className="paste">
              <textarea
                value={pasteText}
                placeholder="Paste CSV/TSV here…"
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button onClick={() => loadText(pasteText, "Pasted data")}>Parse</button>
            </div>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {dataset && (
        <div className="workspace">
          <div className="toolbar">
            <span className="badge-file">{dataset.name}</span>
            <span className="meta">
              {dataset.rows.length} rows · {dataset.headers.length} columns ·
              delimiter “{dataset.delimiter === "\t" ? "TAB" : dataset.delimiter}”
            </span>
            <button className="ghost" onClick={() => setDataset(null)}>
              Load another
            </button>
          </div>

          <div className="grid">
            <aside className="columns">
              <h2>Columns</h2>
              {analyses.map((a) => (
                <button
                  key={a.index}
                  className={"col-item" + (a.index === selected ? " active" : "")}
                  onClick={() => setSelected(a.index)}
                >
                  <span className="col-name">{a.name}</span>
                  <span className="type-badge" style={{ background: TYPE_COLORS[a.type] }}>
                    {a.type}
                  </span>
                </button>
              ))}
            </aside>

            <section className="detail">
              {current && (
                <>
                  <h2>
                    {current.name}{" "}
                    <span className="type-badge" style={{ background: TYPE_COLORS[current.type] }}>
                      {current.type}
                    </span>
                  </h2>

                  <div className="stats">
                    <Stat label="Unique" value={current.uniqueCount} />
                    <Stat label="Missing" value={current.missing} />
                    {current.numeric && (
                      <>
                        <Stat label="Min" value={fmt(current.numeric.min)} />
                        <Stat label="Max" value={fmt(current.numeric.max)} />
                        <Stat label="Mean" value={fmt(current.numeric.mean)} />
                        <Stat label="Median" value={fmt(current.numeric.median)} />
                        <Stat label="Std dev" value={fmt(current.numeric.stddev)} />
                        <Stat label="Sum" value={fmt(current.numeric.sum)} />
                      </>
                    )}
                  </div>

                  {chart && (
                    <div className="chart">
                      <Bar
                        data={chart.data}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false },
                            title: { display: true, text: chart.title },
                          },
                          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          <section className="preview">
            <h2>Data preview (first 50 rows)</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {dataset.headers.map((h, i) => (
                      <th key={i} className={i === selected ? "active" : ""}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.rows.slice(0, 50).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className={ci === selected ? "active" : ""}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

/** Format a number compactly for display. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
