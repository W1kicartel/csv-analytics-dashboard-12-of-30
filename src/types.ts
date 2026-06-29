/** Shared domain types for the dashboard UI. */
import type { Delimiter } from "./csv";

export interface Dataset {
  /** Display name (file name or "Pasted data"). */
  name: string;
  headers: string[];
  rows: string[][];
  delimiter: Delimiter;
}
