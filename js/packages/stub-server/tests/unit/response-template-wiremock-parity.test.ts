import { describe, it, expect } from "vitest";
import { buildResponse } from "../../src/response-builder.js";
import { ResponseTemplateError, type TemplateRequest } from "../../src/response-template.js";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

interface Case {
  readonly name: string;
  /** WireMock mapping `response` fields (status and transformers are added below). */
  readonly response: Readonly<Record<string, unknown>>;
  readonly request: TemplateRequest;
  /** WireMock's rendered body and headers; `null` when WireMock answered 500. */
  readonly expected: { readonly body: string; readonly headers?: Record<string, string> } | null;
}

/**
 * Responses recorded from WireMock 3.13.2 serving the same mapping (with
 * `"transformers": ["response-template", "stubborn-contract"]`) to the same request
 * (stubborn-sh/stubborn#165). Request URLs keep the per-mapping `/tN` prefix used when recording.
 */
const CASES: readonly Case[] = [
  {
    name: "jsonPath [*] renders a JSON list",
    response: { body: "{\"ids\":{{{ jsonPath request.body '$.items[*].id' }}} }" },
    request: {
      method: "POST",
      url: "/t0/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[{"id":"1"},{"id":"2"}]}',
    },
    expected: { body: '{"ids":["1","2"] }' },
  },
  {
    name: "jsonPath [*] with one match is still a list",
    response: { body: "{\"ids\":{{{ jsonPath request.body '$.items[*].id' }}} }" },
    request: {
      method: "POST",
      url: "/t1/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[{"id":"1"}]}',
    },
    expected: { body: '{"ids":["1"] }' },
  },
  {
    name: "jsonPath [*] with no match is an empty list",
    response: { body: "{\"ids\":{{{ jsonPath request.body '$.items[*].id' }}} }" },
    request: {
      method: "POST",
      url: "/t2/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[]}',
    },
    expected: { body: '{"ids":[] }' },
  },
  {
    name: "}}}} is rejected, as in WireMock",
    response: { body: "{\"ids\":{{{ jsonPath request.body '$.items[*].id' }}}}" },
    request: {
      method: "POST",
      url: "/t3/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[{"id":"1"},{"id":"2"}]}',
    },
    expected: null,
  },
  {
    name: "{{ }} does not HTML-escape",
    response: { body: "{{ jsonPath request.body '$.items[*].id' }}" },
    request: {
      method: "POST",
      url: "/t4/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[{"id":"<&\\"x"}]}',
    },
    expected: { body: '["<&\\"x"]' },
  },
  {
    name: "the template Stubborn Contract generates for fromRequest()",
    response: {
      body: '{"url":"{{{request.url}}}","path":"{{{request.path}}}","pathIndex":"{{{request.path.[1]}}}","param":"{{{request.query.foo.[0]}}}","paramIndex":"{{{request.query.foo.[1]}}}","authorization":"{{{request.headers.Authorization.[0]}}}","authorization2":"{{{request.headers.Authorization.[1]}}}","responseFoo":"{{{jsonPath request.body \'$.foo\'}}}","responseBaz":{{{jsonPath request.body \'$.baz\'}}} ,"responseBaz2":"Bla bla {{{jsonPath request.body \'$.foo\'}}} bla bla","rawUrl":"{{request.url}}","rawPath":"{{request.path}}","rawPathIndex":"{{request.path.[1]}}","rawParam":"{{request.query.foo.[0]}}","rawParamIndex":"{{request.query.foo.[1]}}","rawAuthorization":"{{request.headers.Authorization.[0]}}","rawAuthorization2":"{{request.headers.Authorization.[1]}}","rawResponseFoo":"{{jsonPath request.body \'$.foo\'}}","rawResponseBaz":{{jsonPath request.body \'$.baz\'}} ,"rawResponseBaz2":"Bla bla {{jsonPath request.body \'$.foo\'}} bla bla"}',
    },
    request: {
      method: "POST",
      url: "/t5/foo/bar/baz?foo=a%20b&foo=c",
      headers: { "Content-Type": ["application/json"], Authorization: ["secret", "secret2"] },
      body: '{"foo":"bar","baz":5}',
    },
    expected: {
      body: '{"url":"/t5/foo/bar/baz?foo=a%20b&foo=c","path":"/t5/foo/bar/baz","pathIndex":"foo","param":"a b","paramIndex":"c","authorization":"secret","authorization2":"secret2","responseFoo":"bar","responseBaz":5 ,"responseBaz2":"Bla bla bar bla bla","rawUrl":"/t5/foo/bar/baz?foo=a%20b&foo=c","rawPath":"/t5/foo/bar/baz","rawPathIndex":"foo","rawParam":"a b","rawParamIndex":"c","rawAuthorization":"secret","rawAuthorization2":"secret2","rawResponseFoo":"bar","rawResponseBaz":5 ,"rawResponseBaz2":"Bla bla bar bla bla"}',
    },
  },
  {
    name: "jsonPath object renders like Jackson's pretty printer",
    response: { body: "{{{ jsonPath request.body '$.o' }}}" },
    request: {
      method: "POST",
      url: "/t6/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"o":{"a":{"b":1,"c":[]},"d":[{"x":1},{}],"e":{},"s":"q\\"\\n","u":"ü"}}',
    },
    expected: {
      body: '{\n  "a" : {\n    "b" : 1,\n    "c" : [ ]\n  },\n  "d" : [ {\n    "x" : 1\n  }, { } ],\n  "e" : { },\n  "s" : "q\\"\\n",\n  "u" : "ü"\n}',
    },
  },
  {
    name: "jsonPath root, list and scalar",
    response: {
      body: "{{{ jsonPath request.body '$' }}}|{{{ jsonPath request.body '$.items' }}}|{{{ jsonPath request.body '$.items[0].id' }}}",
    },
    request: {
      method: "POST",
      url: "/t7/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[{"id":"1"},{"id":"2"}]}',
    },
    expected: {
      body: '{\n  "items" : [ {\n    "id" : "1"\n  }, {\n    "id" : "2"\n  } ]\n}|[{"id":"1"},{"id":"2"}]|1',
    },
  },
  {
    name: "jsonPath scalars, null and missing",
    response: {
      body: "{{{ jsonPath request.body '$.n' }}}|{{{ jsonPath request.body '$.f' }}}|{{{ jsonPath request.body '$.b' }}}|[{{{ jsonPath request.body '$.nul' }}}]|[{{{ jsonPath request.body '$.nope' }}}]",
    },
    request: {
      method: "POST",
      url: "/t8/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"n":12,"f":1.5,"b":true,"nul":null}',
    },
    expected: { body: "12|1.5|true|[]|[]" },
  },
  {
    name: "jsonPath filter and deep scan",
    response: {
      body: "{{{ jsonPath request.body \"$.items[?(@.id == '2')].id\" }}}|{{{ jsonPath request.body '$..id' }}}",
    },
    request: {
      method: "POST",
      url: "/t9/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[{"id":"1"},{"id":"2"}]}',
    },
    expected: { body: '["2"]|[null,"1","2"]' },
  },
  {
    name: "jsonPath with no body",
    response: { body: "[{{{ jsonPath request.body '$.x' }}}]" },
    request: { method: "GET", url: "/t10/x", headers: {}, body: "" },
    expected: { body: "[]" },
  },
  {
    name: "jsonPath with a non-JSON body",
    response: { body: "[{{{ jsonPath request.body '$.x' }}}]" },
    request: {
      method: "POST",
      url: "/t11/x",
      headers: { "Content-Type": ["text/plain"] },
      body: "not json",
    },
    expected: { body: "[]" },
  },
  {
    name: "request url, path, path segments, query and method",
    response: {
      body: "{{{request.url}}}|{{{request.path}}}|{{{request.path.[0]}}}|{{{request.path.[1]}}}|{{{request.path.[9]}}}|{{{request.pathSegments.[1]}}}|{{{request.query.q}}}|{{{request.query.q.[1]}}}|[{{{request.query.none}}}]|{{{request.method}}}",
    },
    request: { method: "PUT", url: "/t12/a%20b/c%2Fd?q=x%20y&q=z", headers: {}, body: "" },
    expected: { body: "/t12/a%20b/c%2Fd?q=x%20y&q=z|/t12/a b/c/d|t12|a b||a b|x y|z|[]|PUT" },
  },
  {
    name: "request headers (case-insensitive, multi-valued) and cookies",
    response: {
      body: "{{{request.headers.X-Id}}}|{{{request.headers.x-id.[1]}}}|[{{{request.headers.Nope}}}]|{{{request.cookies.c}}}|{{{request.cookies.d}}}",
    },
    request: {
      method: "GET",
      url: "/t13/x",
      headers: { "X-Id": ["a", "b"], Cookie: ["c=1; d=two"] },
      body: "",
    },
    expected: { body: "a|b|[]|1|two" },
  },
  {
    name: "request.body",
    response: { body: "{{{request.body}}}#{{request.body}}" },
    request: {
      method: "POST",
      url: "/t14/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"a":"<x>"}',
    },
    expected: { body: '{"a":"<x>"}#{"a":"<x>"}' },
  },
  {
    name: "comments, \\\\{{ literals, ~ whitespace control and {{&",
    response: {
      body: "a{{! comment }}b{{!-- long }} --}}c\\{{request.url}}[{{~request.method~}}]  {{& request.method}}",
    },
    request: { method: "GET", url: "/t15/x", headers: {}, body: "" },
    expected: { body: "abc{{request.url}}[GET]  GET" },
  },
  {
    name: "templated response headers",
    response: {
      body: "ok",
      headers: {
        "X-Echo": "{{{request.headers.X-Id}}}",
        Location: "/items/{{{ jsonPath request.body '$.id' }}}",
      },
    },
    request: {
      method: "POST",
      url: "/t16/x",
      headers: { "Content-Type": ["application/json"], "X-Id": ["zz"] },
      body: '{"id":"7"}',
    },
    expected: { body: "ok", headers: { "X-Echo": "zz", Location: "/items/7" } },
  },
  {
    name: "templated jsonBody",
    response: {
      jsonBody: {
        id: "{{{ jsonPath request.body '$.id' }}}",
        n: "{{{ jsonPath request.body '$.n' }}}",
      },
    },
    request: {
      method: "POST",
      url: "/t17/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"id":"7","n":3}',
    },
    expected: { body: '{"id":"7","n":"3"}' },
  },
  {
    name: "no response-template transformer: served verbatim",
    response: { body: "{{{request.url}}}", transformers: [] },
    request: { method: "GET", url: "/t18/plain", headers: {}, body: "" },
    expected: { body: "{{{request.url}}}" },
  },
  {
    name: "}}} after {{ is rejected, as in WireMock",
    response: { body: '{"a":{{request.method}}}' },
    request: { method: "GET", url: "/t19/x", headers: {}, body: "" },
    expected: null,
  },
  {
    name: "unknown helper is a 500",
    response: { body: "{{{ nosuchhelper request.body }}}" },
    request: { method: "GET", url: "/t20/x", headers: {}, body: "" },
    expected: null,
  },
  {
    name: "block helpers: WireMock renders them, stub-server rejects them",
    response: { body: "{{#if request.body}}yes{{/if}}" },
    request: { method: "POST", url: "/t21/x", headers: {}, body: "x" },
    // WireMock renders "yes"; block helpers are deliberately not supported here.
    expected: null,
  },
  {
    name: "raw blocks are rejected",
    response: { body: "{{{{ raw }}}}" },
    request: { method: "GET", url: "/t22/x", headers: {}, body: "" },
    expected: null,
  },
  {
    name: "an unclosed mustache is plain text",
    response: {
      body: "{{{ jsonPath request.body '$.items[*].id' }}} and {{{request.url}}} with no closing {{ request.url",
    },
    request: { method: "GET", url: "/t23/x", headers: {}, body: "" },
    expected: { body: " and /t23/x with no closing {{ request.url" },
  },
  {
    name: "jsonPath leaf-to-null for a missing final member",
    response: {
      body: "{{{ jsonPath request.body '$.items[*].name' }}}|{{{ jsonPath request.body '$..name' }}}|{{{ jsonPath request.body '$.items[0].name' }}}|{{{ jsonPath request.body '$.items[?(@.id == \"2\")].name' }}}",
    },
    request: {
      method: "POST",
      url: "/t24/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"items":[{"id":"1","name":"a"},{"id":"2"}]}',
    },
    expected: { body: '["a",null]|[null,"a",null]|a|[null]' },
  },
  {
    name: "jsonPath deep scan with leaf-to-null",
    response: { body: "{{{ jsonPath request.body '$..id' }}}|{{{ jsonPath request.body '$.*' }}}" },
    request: {
      method: "POST",
      url: "/t25/x",
      headers: { "Content-Type": ["application/json"] },
      body: '{"x":{"y":{"id":1}},"z":[{"id":2},{"k":3}]}',
    },
    expected: { body: '[null,null,1,2,null]|[{"y":{"id":1}},[{"id":2},{"k":3}]]' },
  },
];

describe("response templating parity with WireMock 3.13.2", () => {
  it.each(CASES)("$name", ({ name, response, request, expected }) => {
    const mapping = {
      request: { method: request.method, urlPathPattern: "/t[0-9]+(/.*)?" },
      response: {
        status: 200,
        transformers: ["response-template", "stubborn-contract"],
        ...response,
      },
    };
    const contract = parseWireMockMapping(`${name}.json`, JSON.stringify(mapping));
    if (expected === null) {
      expect(() => buildResponse(contract.response, request)).toThrow(ResponseTemplateError);
      return;
    }
    const built = buildResponse(contract.response, request);
    expect(built.body).toBe(expected.body);
    for (const [header, value] of Object.entries(expected.headers ?? {})) {
      expect(built.headers[header]).toBe(value);
    }
  });
});
