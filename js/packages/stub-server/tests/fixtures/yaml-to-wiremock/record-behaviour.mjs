// Records how WireMock answers requests against the mappings the JVM generates for the YAML
// corpus, for yaml-to-wiremock-behaviour.test.ts (which replays them against stub-server).
//
// usage (from js/): node packages/stub-server/tests/fixtures/yaml-to-wiremock/record-behaviour.mjs \
//   http://localhost:<port>
// with a WireMock 3.13.2 standalone server listening on <port>. For each YAML file it loads the
// file's JVM mappings (jvm-mappings.json), sends the contract's own request and variations of it
// (another method, path, header, query parameter, cookie or body field), and writes WireMock's
// answers to behaviour.json.
import { readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = dirname(fileURLToPath(import.meta.url));
const wiremock = process.argv[2];
if (wiremock === undefined) throw new Error("usage: record-behaviour.mjs <WireMock base URL>");

/** The files the behaviour test covers (each with at least one JVM mapping). */
const FILES = [
  "cases/f01_query_types.yml",
  "cases/f03_url_query.yml",
  "cases/f04_url_and_query_matchers.yml",
  "cases/f05_predefined.yml",
  "cases/f06_json_body_shapes.yml",
  "cases/f07_json_body_no_content_type.yml",
  "cases/f08_text_body.yml",
  "cases/f09_string_json_body.yml",
  "cases/f10_multi_doc.yml",
  "cases/f11_list_doc.yml",
  "cases/f12_templating.yml",
  "cases/f14_body_from_file.yml",
  "cases/f15_body_from_file_bytes.yml",
  "cases/f16_text_file_response.yml",
  "cases/f17_cookies.yml",
  "cases/f18_multipart.yml",
  "cases/f19_header_lists.yml",
  "cases/f20_form_body.yml",
  "cases/f21_xml_body.yml",
  "cases/f22_body_matchers.yml",
  "cases/f23_response_regex_body.yml",
  "cases/f26_list_body.yml",
  "cases/f30_multipart_ct_boundary.yml",
  "cases/f32_regex_url_urlpath_query.yml",
  "cases/f33_body_strings_escape.yml",
  "cases/g04_null_query_params.yml",
  "cases/g05_url_regex.yml",
  "cases/g06_dup_header_matchers.yml",
  "cases/g11_xml_ns.yml",
  "cases/g12_form_list.yml",
  "cases/g15_query_list_matcher.yml",
  "cases/g20_header_template_ct.yml",
  "cases/g22_metadata_string_list.yml",
  "cases/g26_dup_header_values.yml",
  "cases/w1/cookies_predef.yml",
  "cases/w1/header_regex_ct.yml",
  "cases/w1/query_absent.yml",
  "cases/w1/url_with_query_in_url.yml",
  "cases/w1/urlpath_regex.yml",
  "cases/w2/xml_matchers.yml",
  "cases/w2/template_strings.yml",
  "scc/docker/health.yml",
  "scc/mixed/contract.yml",
  "scc/yml/contract_from_file.yml",
  "scc/yml/contract_matchers.yml",
  "scc/yml/contract_matchers_url.yml",
  "scc/yml/contract_multipart.yml",
  "scc/yml/contract_pdf.yml",
  "scc/yml/contract_reference_request.yml",
  "scc/yml/contract_rest_named_xml.yml",
  "scc/yml/contract_rest_xml.yml",
  "scc/yml/issue1038.yml",
  "scc/yml/issue1052.yml",
  "scc/yml/multiple_contracts.yml",
  "scc/yml/scc_compat_contract.yml",
];

const jvm = JSON.parse(readFileSync(join(ROOT, "jvm-mappings.json"), "utf8"));

function send({ method, path, headers, body }) {
  return new Promise((resolve) => {
    const payload = body === undefined ? undefined : Buffer.from(body, "base64");
    const req = httpRequest(
      new URL(path, wiremock),
      {
        method,
        agent: false,
        headers: {
          ...Object.fromEntries(headers.map(([k]) => [k, headers.filter(([n]) => n === k).map(([, v]) => v)])),
          ...(payload !== undefined ? { "Content-Length": String(payload.length) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", () => resolve({ error: true }));
      },
    );
    req.on("error", () => resolve({ error: true }));
    req.end(payload);
  });
}

const text = (value) =>
  typeof value === "string" ? value : value instanceof Date ? value.toISOString() : JSON.stringify(value);

/** The request the contract describes (its test side), as the producer test would send it. */
function contractRequest(file, req, stub) {
  // A scalar value is sent as the stub expects it when the stub has an equalTo for it: the JVM
  // reads YAML 1.1 (yes is true, 1e3 is 1000.0...), which the YAML 1.2 loader used here does not.
  const as = (kind, name, v) => {
    const expected = stub?.request?.[kind]?.[name]?.equalTo;
    return typeof expected === "string" && (v === null || v instanceof Date || typeof v !== "object") ? expected : text(v);
  };
  const headers = [];
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (Array.isArray(value)) for (const v of value) headers.push([name, text(v)]);
    else headers.push([name, as("headers", name, value)]);
  }
  const cookies = Object.entries(req.cookies ?? {}).map(([k, v]) => `${k}=${as("cookies", k, v)}`);
  if (cookies.length > 0) headers.push(["Cookie", cookies.join("; ")]);
  const query = [];
  for (const [name, value] of Object.entries(req.queryParameters ?? {})) {
    if (Array.isArray(value)) {
      for (const v of value) query.push(`${encodeURIComponent(name)}=${encodeURIComponent(text(v))}`);
    } else if (value !== null) {
      query.push(`${encodeURIComponent(name)}=${encodeURIComponent(as("queryParameters", name, value))}`);
    }
  }
  const base = req.url ?? req.urlPath ?? "/";
  const path = query.length === 0 ? base : `${base}${base.includes("?") ? "&" : "?"}${query.join("&")}`;
  const contentType = headers.find(([n]) => n.toLowerCase() === "content-type")?.[1] ?? "";
  let body;
  const dir = dirname(join(ROOT, file));
  if (req.bodyFromFile !== undefined) body = readFileSync(join(dir, req.bodyFromFile));
  else if (req.bodyFromFileAsBytes !== undefined) body = readFileSync(join(dir, req.bodyFromFileAsBytes));
  else if (req.multipart !== undefined) {
    const boundary = /boundary=([^;]+)/.exec(contentType)?.[1] ?? "AaB03x";
    if (!contentType.includes("boundary=")) {
      const i = headers.findIndex(([n]) => n.toLowerCase() === "content-type");
      const value = `${i === -1 ? "multipart/form-data" : headers[i][1]};boundary=${boundary}`;
      if (i === -1) headers.push(["Content-Type", value]);
      else headers[i] = [headers[i][0], value];
    }
    let out = "";
    for (const [name, value] of Object.entries(req.multipart.params ?? {})) {
      out += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${text(value)}\r\n`;
    }
    for (const part of req.multipart.named ?? []) {
      const content =
        part.fileContent ??
        part.fileContentAsBytes ??
        (part.fileContentFromFileAsBytes !== undefined
          ? readFileSync(join(dir, part.fileContentFromFileAsBytes), "utf8")
          : "");
      out += `--${boundary}\r\nContent-Disposition: form-data; name="${part.paramName}"; filename="${part.fileName}"\r\n`;
      if (part.contentType !== undefined) out += `Content-Type: ${part.contentType}\r\n`;
      out += `\r\n${content}\r\n`;
    }
    body = Buffer.from(`${out}--${boundary}--\r\n`);
  } else if (req.body !== undefined) {
    if (typeof req.body === "string") body = Buffer.from(req.body);
    else if (contentType.includes("form-urlencoded") && typeof req.body === "object") {
      body = Buffer.from(
        Object.entries(req.body)
          .flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${encodeURIComponent(k)}=${encodeURIComponent(text(x))}`))
          .join("&"),
      );
    } else body = Buffer.from(JSON.stringify(req.body));
  }
  return { method: String(req.method ?? "GET").toUpperCase(), path, headers, ...(body !== undefined ? { body: body.toString("base64") } : {}) };
}

/** The contract's request and variations of it, each labelled. */
function variations(base, req) {
  const out = [{ label: "the contract's request", ...base }];
  const add = (label, change) => out.push({ label, ...base, ...change });
  add("another method", { method: base.method === "GET" ? "POST" : "GET" });
  add("another path", { path: base.path.replace(/^([^?]*)/, "$1/nope") });
  const q = base.path.indexOf("?");
  add("an extra query parameter", { path: `${base.path}${q === -1 ? "?" : "&"}extra=1` });
  if (q !== -1) {
    const [path, query] = [base.path.slice(0, q), base.path.slice(q + 1)];
    const params = query.split("&");
    params.forEach((p, i) => {
      const rest = params.filter((_, j) => j !== i);
      add(`without query parameter ${p.split("=")[0]}`, { path: rest.length > 0 ? `${path}?${rest.join("&")}` : path });
      add(`query parameter ${p.split("=")[0]} changed`, {
        path: `${path}?${params.map((x, j) => (j === i ? `${x}x` : x)).join("&")}`,
      });
    });
  }
  base.headers.forEach(([name], i) => {
    add(`without header ${name}`, { headers: base.headers.filter((_, j) => j !== i) });
    add(`header ${name} changed`, { headers: base.headers.map((h, j) => (j === i ? [h[0], `${h[1]}x`] : h)) });
    add(`header ${name} in lower case`, { headers: base.headers.map((h, j) => (j === i ? [h[0].toLowerCase(), h[1]] : h)) });
  });
  add("an extra header", { headers: [...base.headers, ["X-Extra", "1"]] });
  if (base.body !== undefined) {
    add("without a body", { body: undefined });
    const body = Buffer.from(base.body, "base64").toString("utf8");
    add("the body with a suffix", { body: Buffer.from(`${body}x`).toString("base64") });
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      json = undefined;
    }
    if (json !== null && typeof json === "object" && !Array.isArray(json)) {
      for (const key of Object.keys(json)) {
        const { [key]: removed, ...rest } = json;
        add(`body field ${key} removed`, { body: Buffer.from(JSON.stringify(rest)).toString("base64") });
        const changed =
          typeof removed === "string" ? `${removed}x` : typeof removed === "number" ? removed + 1 : typeof removed === "boolean" ? !removed : "x";
        add(`body field ${key} changed`, { body: Buffer.from(JSON.stringify({ ...json, [key]: changed })).toString("base64") });
      }
    }
  }
  void req;
  return out;
}

function answer(response, mappings) {
  if (response.error) return { error: true };
  const id = response.headers["matched-stub-id"];
  const index = mappings.findIndex((m) => m !== null && m.id === id);
  // Not matched: WireMock's 404 (its body is a diff report, which stub-server does not mimic).
  if (index === -1 && response.status === 404) return { matched: null, status: response.status };
  // A stub failing to render (a template error): WireMock's 500 page names no stub.
  if (index === -1) return { failed: true, status: response.status };
  const declared = new Set();
  for (const m of mappings) {
    for (const name of Object.keys(m?.response?.headers ?? {})) declared.add(name.toLowerCase());
  }
  const headers = {};
  for (const name of [...declared].sort()) {
    if (response.headers[name] !== undefined) headers[name] = response.headers[name];
  }
  const utf8 = response.body.toString("utf8");
  return {
    matched: index,
    status: response.status,
    headers,
    ...(Buffer.from(utf8, "utf8").equals(response.body)
      ? { body: utf8 }
      : { bodyBase64: response.body.toString("base64") }),
  };
}

const cases = [];
for (const file of FILES) {
  const mappings = jvm[file].mappings;
  await fetch(new URL("/__admin/mappings/reset", wiremock), { method: "POST" });
  for (const m of mappings) {
    if (m === null) continue;
    const res = await fetch(new URL("/__admin/mappings", wiremock), {
      method: "POST",
      body: JSON.stringify(m).split("<fixtures>").join(ROOT),
    });
    if (!res.ok) throw new Error(`${file}: WireMock refused a mapping: ${await res.text()}`);
  }
  const requests = [];
  const contracts = yaml
    .loadAll(readFileSync(join(ROOT, file), "utf8"))
    .flatMap((d) => (Array.isArray(d) ? d : [d]))
    .filter((c) => c !== null && typeof c === "object" && c.request !== undefined);
  for (const [i, contract] of contracts.entries()) {
    const base = contractRequest(file, contract.request, mappings[i]);
    const all = variations(base, contract.request);
    // A header holding a list is one header with the list as text in the stub (the JVM's
    // List.toString()): send that too.
    const listHeaders = Object.entries(contract.request.headers ?? {}).filter(([, v]) => Array.isArray(v));
    if (listHeaders.length > 0) {
      const headers = [];
      for (const [name, value] of base.headers) {
        if (!listHeaders.some(([n]) => n === name)) headers.push([name, value]);
        else if (!headers.some(([n]) => n === name)) {
          headers.push([name, mappings[i]?.request?.headers?.[name]?.equalTo ?? value]);
        }
      }
      all.push({ label: "list headers sent as the stub's text", ...base, headers });
    }
    for (const r of all) {
      const label = contracts.length > 1 ? `contract ${i}: ${r.label}` : r.label;
      const { label: _l, ...req } = r;
      requests.push({ label, request: req, wiremock: answer(await send(req), mappings) });
    }
  }
  cases.push({ file, requests });
  console.log(file, requests.length, requests.filter((r) => r.wiremock.matched !== null).length);
}
writeFileSync(
  join(ROOT, "behaviour.json"),
  `${JSON.stringify({ source: "WireMock 3.13.2 standalone, loaded with the JVM mappings of jvm-mappings.json", cases }, null, 1)}\n`,
);
