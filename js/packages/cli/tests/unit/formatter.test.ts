import { describe, it, expect } from "vitest";
import { formatOutput, formatSingle } from "../../src/formatter.js";

describe("formatOutput", () => {
  it("should_format_as_json", () => {
    const data = [{ name: "app1", owner: "team-a" }];
    const result = formatOutput(data, "json");
    expect(JSON.parse(result)).toEqual(data);
  });

  it("should_format_as_table", () => {
    const data = [
      { name: "app1", owner: "team-a" },
      { name: "app2", owner: "team-b" },
    ];
    const result = formatOutput(data, "table");
    expect(result).toContain("name");
    expect(result).toContain("owner");
    expect(result).toContain("app1");
    expect(result).toContain("team-a");
    expect(result).toContain("app2");
  });

  it("should_handle_empty_data", () => {
    const result = formatOutput([], "table");
    expect(result).toContain("no results");
  });

  it("should_handle_null_values_in_table", () => {
    const data = [{ name: "app1", description: null }];
    const result = formatOutput(data, "table");
    expect(result).toContain("app1");
  });
});

describe("formatSingle", () => {
  it("should_format_as_json", () => {
    const data = { name: "app1", owner: "team-a" };
    const result = formatSingle(data, "json");
    expect(JSON.parse(result)).toEqual(data);
  });

  it("should_format_as_key_value", () => {
    const data = { name: "app1", owner: "team-a" };
    const result = formatSingle(data, "table");
    expect(result).toContain("name");
    expect(result).toContain("app1");
    expect(result).toContain("owner");
    expect(result).toContain("team-a");
  });
});
