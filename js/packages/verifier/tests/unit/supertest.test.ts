import { describe, it, expect, vi } from "vitest";
import { fetchFromSupertest } from "../../src/supertest.js";
import { executeRequest } from "../../src/request-executor.js";
import type { SupertestFactory } from "../../src/supertest.js";
import type { ParsedContract } from "@stubborn-sh/stub-server";

/**
 * A stand-in for supertest. The real thing is an optional peer dependency, so
 * the adapter takes it as an argument and the tests never need it installed.
 */
function fakeSupertest(
  response: {
    status?: number;
    headers?: Record<string, string>;
    text?: string;
    body?: unknown;
  } = {},
): { factory: SupertestFactory; calls: Record<string, unknown> } {
  const calls: Record<string, unknown> = { headers: {} };

  const pending = {
    set(field: string, value: string) {
      (calls.headers as Record<string, string>)[field] = value;
      return pending;
    },
    send(data: unknown) {
      calls.body = data;
      return pending;
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        status: response.status ?? 200,
        headers: response.headers ?? { "content-type": "application/json" },
        text: response.text,
        body: response.body,
      }).then(resolve),
  };

  const factory = ((app: unknown) => {
    calls.app = app;
    return new Proxy({} as Record<string, (url: string) => typeof pending>, {
      get: (_target, method: string) => (url: string) => {
        calls.method = method;
        calls.url = url;
        return pending;
      },
    });
  }) as unknown as SupertestFactory;

  return { factory, calls };
}

function contract(overrides?: Partial<ParsedContract["request"]>): ParsedContract {
  return {
    name: "test",
    request: { method: "GET", urlPath: "/api/test", ...overrides },
    response: { status: 200 },
  };
}

describe("fetchFromSupertest", () => {
  it("should_hand_supertest_the_app_it_was_given", async () => {
    const app = { marker: true };
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest(app, factory)("http://sut/api/test");

    expect(calls.app).toBe(app);
  });

  it("should_reduce_the_absolute_url_to_a_path", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/api/test");

    expect(calls.url).toBe("/api/test");
  });

  it("should_keep_the_query_string", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/api/test?page=2&size=10");

    expect(calls.url).toBe("/api/test?page=2&size=10");
  });

  it("should_lowercase_the_method_for_supertest", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/x", { method: "POST" });

    expect(calls.method).toBe("post");
  });

  it("should_default_to_GET", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/x");

    expect(calls.method).toBe("get");
  });

  it("should_forward_headers", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/x", {
      headers: { "X-Token": "abc" },
    });

    expect(calls.headers).toEqual({ "X-Token": "abc" });
  });

  it("should_forward_headers_given_as_a_Headers_instance", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/x", {
      headers: new Headers({ "X-Token": "abc" }),
    });

    expect(calls.headers).toEqual({ "x-token": "abc" });
  });

  it("should_send_a_json_body_as_an_object_because_supertest_serialises_it", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/x", {
      method: "POST",
      body: '{"name":"ada"}',
    });

    expect(calls.body).toEqual({ name: "ada" });
  });

  it("should_send_a_non_json_body_unchanged", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/x", {
      method: "POST",
      body: "plain text",
    });

    expect(calls.body).toBe("plain text");
  });

  it("should_not_send_a_body_when_there_is_none", async () => {
    const { factory, calls } = fakeSupertest();
    await fetchFromSupertest({}, factory)("http://sut/x");

    expect(calls.body).toBeUndefined();
  });

  it("should_expose_the_status", async () => {
    const { factory } = fakeSupertest({ status: 404 });
    const result = await fetchFromSupertest({}, factory)("http://sut/x");

    expect(result.status).toBe(404);
  });

  it("should_expose_headers_by_get_and_forEach", async () => {
    const { factory } = fakeSupertest({ headers: { "content-type": "application/json" } });
    const result = await fetchFromSupertest({}, factory)("http://sut/x");

    expect(result.headers.get("content-type")).toBe("application/json");

    const seen: Record<string, string> = {};
    result.headers.forEach((value, key) => {
      seen[key] = value;
    });
    expect(seen["content-type"]).toBe("application/json");
  });

  it("should_prefer_the_raw_text_body", async () => {
    const { factory } = fakeSupertest({ text: '{"raw":true}', body: { parsed: true } });
    const result = await fetchFromSupertest({}, factory)("http://sut/x");

    expect(await result.text()).toBe('{"raw":true}');
  });

  it("should_fall_back_to_serialising_the_parsed_body", async () => {
    const { factory } = fakeSupertest({ body: { parsed: true } });
    const result = await fetchFromSupertest({}, factory)("http://sut/x");

    expect(await result.text()).toBe('{"parsed":true}');
  });

  it("should_give_an_empty_body_when_there_is_neither", async () => {
    const { factory } = fakeSupertest({});
    const result = await fetchFromSupertest({}, factory)("http://sut/x");

    expect(await result.text()).toBe("");
  });

  it("should_reject_a_method_supertest_cannot_issue", async () => {
    const factory = (() => ({})) as unknown as SupertestFactory;
    await expect(
      fetchFromSupertest({}, factory)("http://sut/x", { method: "PURGE" }),
    ).rejects.toThrow("supertest cannot issue a PURGE request");
  });

  it("should_explain_itself_when_supertest_is_not_installed", async () => {
    // No factory given, and supertest is not a dependency of this package.
    await expect(fetchFromSupertest({})("http://sut/x")).rejects.toThrow(
      /optional peer dependency 'supertest'/,
    );
  });

  it("should_drive_a_real_contract_through_executeRequest", async () => {
    const { factory } = fakeSupertest({
      status: 200,
      headers: { "content-type": "application/json" },
      text: '{"ok":true}',
    });

    const result = await executeRequest("http://sut", contract(), fetchFromSupertest({}, factory));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });
});
