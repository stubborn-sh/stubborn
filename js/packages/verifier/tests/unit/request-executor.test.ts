import { describe, it, expect, vi } from "vitest";
import { executeRequest } from "../../src/request-executor.js";
import type { ParsedContract } from "@stubborn-sh/stub-server";

function makeContract(overrides?: Partial<ParsedContract["request"]>): ParsedContract {
  return {
    name: "test",
    request: {
      method: "GET",
      urlPath: "/api/test",
      ...overrides,
    },
    response: { status: 200 },
  };
}

function mockFetch(
  status: number,
  body: string,
  contentType = "application/json",
): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    status,
    headers: new Headers({ "content-type": contentType }),
    text: vi.fn().mockResolvedValue(body),
  });
}

describe("executeRequest", () => {
  it("should_send_GET_request_to_provider", async () => {
    const fetchFn = mockFetch(200, '{"ok":true}');
    const result = await executeRequest("http://localhost:8080", makeContract(), fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:8080/api/test",
      expect.objectContaining({
        method: "GET",
        headers: {},
        body: undefined,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it("should_use_url_when_urlPath_is_undefined", async () => {
    const fetchFn = mockFetch(200, "");
    await executeRequest(
      "http://localhost:8080",
      makeContract({ url: "/api/v1/items?page=0", urlPath: undefined }),
      fetchFn,
    );

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/items?page=0",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("should_send_body_for_POST_requests", async () => {
    const fetchFn = mockFetch(201, '{"id":1}');
    const contract = makeContract({
      method: "POST",
      body: { name: "test" },
    });

    const result = await executeRequest("http://localhost:8080", contract, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:8080/api/test",
      expect.objectContaining({
        method: "POST",
        body: '{"name":"test"}',
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result.status).toBe(201);
  });

  it("should_send_string_body_as_is", async () => {
    const fetchFn = mockFetch(200, "ok");
    const contract = makeContract({
      method: "POST",
      body: "raw body content",
    });

    await executeRequest("http://localhost:8080", contract, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: "raw body content" }),
    );
  });

  it("should_forward_request_headers", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = makeContract({
      headers: { Authorization: "Bearer token", Accept: "application/json" },
    });

    await executeRequest("http://localhost:8080", contract, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer token", Accept: "application/json" },
      }),
    );
  });

  it("should_not_add_content_type_when_already_set", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = makeContract({
      method: "POST",
      body: { data: true },
      headers: { "Content-Type": "text/plain" },
    });

    await executeRequest("http://localhost:8080", contract, fetchFn);

    const calledHeaders = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
      ?.headers as Record<string, string>;
    expect(calledHeaders["Content-Type"]).toBe("text/plain");
  });

  it("should_parse_json_response_body", async () => {
    const fetchFn = mockFetch(200, '{"items":[1,2,3]}');
    const result = await executeRequest("http://localhost:8080", makeContract(), fetchFn);
    expect(result.body).toEqual({ items: [1, 2, 3] });
  });

  it("should_fall_back_to_text_when_json_is_invalid", async () => {
    const fetchFn = mockFetch(200, "not valid json", "application/json");
    const result = await executeRequest("http://localhost:8080", makeContract(), fetchFn);
    expect(result.body).toBe("not valid json");
  });

  it("should_return_text_for_non_json_content_type", async () => {
    const fetchFn = mockFetch(200, "<html>hi</html>", "text/html");
    const result = await executeRequest("http://localhost:8080", makeContract(), fetchFn);
    expect(result.body).toBe("<html>hi</html>");
  });

  it("should_return_undefined_body_for_empty_response", async () => {
    const fetchFn = mockFetch(204, "", "text/plain");
    const result = await executeRequest("http://localhost:8080", makeContract(), fetchFn);
    expect(result.body).toBeUndefined();
  });

  it("should_collect_response_headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
        "x-custom": "value",
      }),
      text: vi.fn().mockResolvedValue('{"ok":true}'),
    });

    const result = await executeRequest("http://localhost:8080", makeContract(), fetchFn);
    expect(result.headers["content-type"]).toBe("application/json");
    expect(result.headers["x-custom"]).toBe("value");
  });

  it("should_default_url_to_slash_when_both_url_and_urlPath_are_undefined", async () => {
    const fetchFn = mockFetch(200, "");
    const contract: ParsedContract = {
      name: "test",
      request: { method: "GET" },
      response: { status: 200 },
    };

    await executeRequest("http://localhost:8080", contract, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:8080/", expect.any(Object));
  });
});
