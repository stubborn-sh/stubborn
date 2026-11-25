import { describe, it, expect, vi } from "vitest";
import { executeRequest } from "../../src/request-executor.js";
import { parseContracts, type ParsedContract } from "@stubborn-sh/stub-server";

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

describe("executeRequest builds the request the JVM-generated test sends", () => {
  function fromYaml(yaml: string, files: Record<string, string | Uint8Array> = {}): ParsedContract {
    const [contract] = parseContracts("contract.yml", yaml, {
      readFile: (path) => {
        const content = files[path];
        return typeof content === "string" ? new TextEncoder().encode(content) : content;
      },
    });
    if (contract === undefined) throw new Error("no contract");
    return contract;
  }

  function sent(fetchFn: typeof globalThis.fetch): { url: string; init: RequestInit } {
    const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    return { url: call[0], init: call[1] };
  }

  it("should_append_query_parameters_to_the_url_path", async () => {
    // given().queryParam("page","2").get("/items") — golden http_get_query_cookie
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(`
request:
  method: GET
  urlPath: /items
  queryParameters: { page: 2, q: "a b&c" }
response: { status: 200 }
`);
    await executeRequest("http://h", contract, fetchFn);
    expect(sent(fetchFn).url).toBe("http://h/items?page=2&q=a%20b%26c");
  });

  it("should_send_a_list_query_parameter_once_per_value", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(`
request:
  method: GET
  url: /items?sort=asc
  queryParameters: { tag: [a, b] }
response: { status: 200 }
`);
    await executeRequest("http://h", contract, fetchFn);
    expect(sent(fetchFn).url).toBe("http://h/items?sort=asc&tag=a&tag=b");
  });

  it("should_not_send_a_query_parameter_whose_matcher_is_absent", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(`
request:
  method: GET
  urlPath: /items
  queryParameters: { page: 2, debug: x }
  matchers:
    queryParameters:
      - key: debug
        type: absent
response: { status: 200 }
`);
    await executeRequest("http://h", contract, fetchFn);
    expect(sent(fetchFn).url).toBe("http://h/items?page=2");
  });

  it("should_send_cookies_in_a_cookie_header", async () => {
    // given().cookie("session", "abc123")
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(`
request:
  method: GET
  url: /c
  cookies: { session: abc123, theme: dark }
response: { status: 200 }
`);
    await executeRequest("http://h", contract, fetchFn);
    expect(sent(fetchFn).init.headers).toEqual({ Cookie: "session=abc123; theme=dark" });
  });

  it("should_add_cookies_to_a_cookie_header_the_contract_sets", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(`
request:
  method: GET
  url: /c
  headers: { cookie: a=1 }
  cookies: { b: 2 }
response: { status: 200 }
`);
    await executeRequest("http://h", contract, fetchFn);
    expect(sent(fetchFn).init.headers).toEqual({ cookie: "a=1; b=2" });
  });

  it("should_send_the_content_of_bodyFromFile", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(
      `
request:
  method: PUT
  url: /foo
  headers: { Content-Type: application/json }
  bodyFromFile: request.json
response: { status: 200 }
`,
      { "request.json": '{"a":1}' },
    );
    await executeRequest("http://h", contract, fetchFn);
    const { init } = sent(fetchFn);
    expect(new TextDecoder().decode(init.body as Uint8Array)).toBe('{"a":1}');
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("should_send_bodyFromFileAsBytes_unchanged", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(
      `
request:
  method: POST
  url: /bin
  bodyFromFileAsBytes: request.bin
response: { status: 200 }
`,
      { "request.bin": new Uint8Array([0, 159, 255]) },
    );
    await executeRequest("http://h", contract, fetchFn);
    expect(Array.from(sent(fetchFn).init.body as Uint8Array)).toEqual([0, 159, 255]);
  });

  it("should_throw_when_a_request_body_file_is_missing", async () => {
    const contract = fromYaml(`
request:
  method: POST
  url: /bin
  bodyFromFile: missing.json
response: { status: 200 }
`);
    await expect(executeRequest("http://h", contract, mockFetch(200, ""))).rejects.toThrow(
      "missing.json",
    );
  });

  it("should_not_force_a_json_content_type_onto_a_string_body", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(`
request:
  method: POST
  url: /t
  body: plain text
response: { status: 200 }
`);
    await executeRequest("http://h", contract, fetchFn);
    expect(sent(fetchFn).init).toMatchObject({ body: "plain text", headers: {} });
  });

  it("should_find_an_existing_content_type_whatever_its_case", async () => {
    const fetchFn = mockFetch(200, "");
    const contract = fromYaml(`
request:
  method: POST
  url: /j
  headers: { content-type: application/vnd.api+json }
  body: { a: 1 }
response: { status: 200 }
`);
    await executeRequest("http://h", contract, fetchFn);
    expect(sent(fetchFn).init.headers).toEqual({ "content-type": "application/vnd.api+json" });
  });

  it("should_collect_response_cookies_and_the_raw_body", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("set-cookie", "session=abc123; Path=/; HttpOnly");
    headers.append("set-cookie", "theme=dark");
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { status: 200, headers }));
    const result = await executeRequest("http://h", makeContract(), fetchFn);
    expect(result.cookies).toEqual({ session: "abc123", theme: "dark" });
    expect(result.bodyText).toBe('{"ok":true}');
    expect(new TextDecoder().decode(result.bodyBytes)).toBe('{"ok":true}');
    expect(result.body).toEqual({ ok: true });
  });
});
