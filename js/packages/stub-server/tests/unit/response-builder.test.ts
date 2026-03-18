import { describe, it, expect } from "vitest";
import { buildResponse } from "../../src/response-builder.js";
import type { ContractResponse } from "../../src/contract-parser.js";

describe("buildResponse", () => {
  it("should_build_response_with_json_body", () => {
    const contractResponse: ContractResponse = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { id: "1", name: "test" },
    };
    const result = buildResponse(contractResponse);
    expect(result.status).toBe(200);
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.body).toBe(JSON.stringify({ id: "1", name: "test" }));
  });

  it("should_build_response_with_string_body", () => {
    const result = buildResponse({ status: 200, body: "plain text" });
    expect(result.body).toBe("plain text");
  });

  it("should_build_response_with_no_body", () => {
    const result = buildResponse({ status: 204 });
    expect(result.body).toBeNull();
    expect(result.status).toBe(204);
  });

  it("should_auto_set_content_type_for_object_body", () => {
    const result = buildResponse({ status: 200, body: { key: "value" } });
    expect(result.headers["Content-Type"]).toBe("application/json");
  });

  it("should_not_override_explicit_content_type", () => {
    const result = buildResponse({
      status: 200,
      headers: { "Content-Type": "text/xml" },
      body: { key: "value" },
    });
    expect(result.headers["Content-Type"]).toBe("text/xml");
  });

  it("should_preserve_all_headers", () => {
    const result = buildResponse({
      status: 200,
      headers: { "X-Custom": "value", "X-Other": "other" },
    });
    expect(result.headers["X-Custom"]).toBe("value");
    expect(result.headers["X-Other"]).toBe("other");
  });
});
