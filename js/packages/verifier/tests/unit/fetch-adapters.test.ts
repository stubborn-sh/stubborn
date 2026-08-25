import { describe, it, expect, vi } from "vitest";
import { fetchFromHandler } from "../../src/fetch-adapters.js";
import { executeRequest } from "../../src/request-executor.js";
import type { ParsedContract } from "@stubborn-sh/stub-server";

function contract(overrides?: Partial<ParsedContract["request"]>): ParsedContract {
  return {
    name: "test",
    request: { method: "GET", urlPath: "/api/test", ...overrides },
    response: { status: 200 },
  };
}

describe("fetchFromHandler", () => {
  it("should_pass_the_full_url_through_to_the_handler", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("{}"));
    await fetchFromHandler(handler)("http://sut/api/test");

    expect(handler.mock.calls[0]?.[0].url).toBe("http://sut/api/test");
  });

  it("should_pass_the_method_through", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("{}"));
    await fetchFromHandler(handler)("http://sut/api/test", { method: "DELETE" });

    expect(handler.mock.calls[0]?.[0].method).toBe("DELETE");
  });

  it("should_pass_headers_through", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("{}"));
    await fetchFromHandler(handler)("http://sut/api/test", {
      headers: { "X-Token": "abc" },
    });

    expect(handler.mock.calls[0]?.[0].headers.get("x-token")).toBe("abc");
  });

  it("should_pass_the_request_body_through", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("{}"));
    await fetchFromHandler(handler)("http://sut/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"ada"}',
    });

    expect(await handler.mock.calls[0]?.[0].text()).toBe('{"name":"ada"}');
  });

  it("should_return_the_handlers_response_untouched", async () => {
    const response = new Response('{"ok":true}', {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
    const result = await fetchFromHandler(() => response)("http://sut/api/test");

    expect(result.status).toBe(201);
    expect(await result.text()).toBe('{"ok":true}');
  });

  it("should_accept_a_synchronous_handler", async () => {
    const result = await fetchFromHandler(() => new Response("hi", { status: 202 }))(
      "http://sut/api/test",
    );

    expect(result.status).toBe(202);
  });

  it("should_propagate_a_handler_failure", async () => {
    const failing = fetchFromHandler(() => {
      throw new Error("handler blew up");
    });

    await expect(failing("http://sut/api/test")).rejects.toThrow("handler blew up");
  });

  // The point of the adapter: it has to satisfy what executeRequest actually
  // needs of a fetch, not just look like one.
  it("should_drive_a_real_contract_through_executeRequest", async () => {
    const handler = (request: Request): Response =>
      new Response(JSON.stringify({ path: new URL(request.url).pathname }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await executeRequest("http://sut", contract(), fetchFromHandler(handler));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ path: "/api/test" });
    expect(result.headers["content-type"]).toContain("application/json");
  });

  it("should_carry_a_posted_contract_body_to_the_handler", async () => {
    const handler = async (request: Request): Promise<Response> =>
      new Response(await request.text(), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await executeRequest(
      "http://sut",
      contract({ method: "POST", body: { name: "ada" } }),
      fetchFromHandler(handler),
    );

    expect(result.body).toEqual({ name: "ada" });
  });
});
