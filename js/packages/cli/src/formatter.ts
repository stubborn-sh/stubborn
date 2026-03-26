import chalk from "chalk";

/** Format data as a table or JSON based on the output format. */
export function formatOutput(
  data: readonly Record<string, unknown>[],
  format: "json" | "table",
): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return formatTable(data);
}

/** Format a single object as key-value pairs or JSON. */
export function formatSingle(data: Record<string, unknown>, format: "json" | "table"): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return formatKeyValue(data);
}

/** Format a success message. */
export function formatSuccess(message: string): string {
  return chalk.green(message);
}

/** Format an error message. */
export function formatError(message: string): string {
  return chalk.red(message);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatTable(data: readonly Record<string, unknown>[]): string {
  if (data.length === 0) {
    return "(no results)";
  }

  const firstRow = data[0];
  if (firstRow === undefined) {
    return "(no results)";
  }
  const columns = Object.keys(firstRow);
  const widths = columns.map((col) => {
    const maxDataWidth = data.reduce((max, row) => {
      const val = stringify(row[col]);
      return Math.max(max, val.length);
    }, 0);
    return Math.max(col.length, maxDataWidth);
  });

  const header = columns
    .map((col, i) => chalk.bold(col.padEnd(widths[i] ?? col.length)))
    .join("  ");

  const separator = widths.map((w) => "-".repeat(w)).join("  ");

  const rows = data.map((row) =>
    columns.map((col, i) => stringify(row[col]).padEnd(widths[i] ?? 0)).join("  "),
  );

  return [header, separator, ...rows].join("\n");
}

function formatKeyValue(data: Record<string, unknown>): string {
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return "(empty)";
  }
  const maxKeyLen = Math.max(...keys.map((k) => k.length));
  return Object.entries(data)
    .map(([key, value]) => `${chalk.bold(key.padEnd(maxKeyLen))}  ${stringify(value)}`)
    .join("\n");
}
