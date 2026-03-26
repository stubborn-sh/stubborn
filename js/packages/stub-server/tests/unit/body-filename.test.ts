import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

let filesDir: string;

beforeEach(async () => {
  filesDir = join(tmpdir(), `scc-files-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(filesDir, { recursive: true });
});

afterEach(async () => {
  await rm(filesDir, { recursive: true, force: true });
});

function mapping(bodyFileName: string): string {
  return JSON.stringify({
    request: { method: "GET", urlPath: "/api/test" },
    response: { status: 200, bodyFileName },
  });
}

describe("bodyFileName resolution", () => {
  it("should_resolve_json_file_to_parsed_object", async () => {
    await writeFile(join(filesDir, "order.json"), '{"id":"1","status":"CREATED"}');

    const contract = parseWireMockMapping("test.json", mapping("order.json"), { filesDir });

    expect(contract.response.body).toEqual({ id: "1", status: "CREATED" });
  });

  it("should_resolve_nested_path", async () => {
    await mkdir(join(filesDir, "responses"), { recursive: true });
    await writeFile(join(filesDir, "responses", "large-payload.json"), '{"data":"large content"}');

    const contract = parseWireMockMapping("test.json", mapping("responses/large-payload.json"), {
      filesDir,
    });

    expect(contract.response.body).toEqual({ data: "large content" });
  });

  it("should_resolve_plain_text_file_as_string", async () => {
    await writeFile(join(filesDir, "report.txt"), "Hello, World!");

    const contract = parseWireMockMapping("test.json", mapping("report.txt"), { filesDir });

    expect(contract.response.body).toBe("Hello, World!");
  });

  it("should_resolve_xml_file_as_string", async () => {
    await writeFile(join(filesDir, "response.xml"), "<order><id>1</id></order>");

    const contract = parseWireMockMapping("test.json", mapping("response.xml"), { filesDir });

    expect(contract.response.body).toBe("<order><id>1</id></order>");
  });

  it("should_resolve_html_file_as_string", async () => {
    await writeFile(join(filesDir, "page.html"), "<html><body>Hello</body></html>");

    const contract = parseWireMockMapping("test.json", mapping("page.html"), { filesDir });

    expect(contract.response.body).toBe("<html><body>Hello</body></html>");
  });

  it("should_return_not_found_placeholder_when_file_missing", () => {
    const contract = parseWireMockMapping("test.json", mapping("nonexistent.json"), { filesDir });

    expect(contract.response.body).toBe("[bodyFileName not found: nonexistent.json]");
  });

  it("should_return_placeholder_when_no_filesDir_provided", () => {
    const contract = parseWireMockMapping("test.json", mapping("order.json"));

    expect(contract.response.body).toBe("[bodyFileName: order.json]");
  });

  it("should_prefer_jsonBody_over_bodyFileName_even_with_filesDir", async () => {
    await writeFile(join(filesDir, "fallback.json"), '{"source":"file"}');

    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api" },
      response: {
        status: 200,
        jsonBody: { source: "inline" },
        bodyFileName: "fallback.json",
      },
    });

    const contract = parseWireMockMapping("test.json", json, { filesDir });

    expect(contract.response.body).toEqual({ source: "inline" });
  });

  it("should_prefer_body_string_over_bodyFileName_even_with_filesDir", async () => {
    await writeFile(join(filesDir, "fallback.json"), '{"source":"file"}');

    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api" },
      response: {
        status: 200,
        body: '{"source":"inline"}',
        bodyFileName: "fallback.json",
      },
    });

    const contract = parseWireMockMapping("test.json", json, { filesDir });

    expect(contract.response.body).toEqual({ source: "inline" });
  });
});
