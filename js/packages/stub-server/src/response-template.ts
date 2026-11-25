import { parseJaywayDocument, readJsonPath } from "./json-path.js";

/**
 * WireMock response templating (`"transformers": ["response-template"]`), limited to the
 * Handlebars subset that Stubborn Contract / Spring Cloud Contract generate for `fromRequest()`:
 *
 *   - `{{ … }}`, `{{{ … }}}` and `{{& … }}` (WireMock does not HTML-escape, so all three render the
 *     same), `{{! comments }}`, `\{{` literals and `~` whitespace control
 *   - `request.url`, `request.path`, `request.path.[n]`, `request.pathSegments.[n]`,
 *     `request.query.<name>[.[n]]`, `request.headers.<name>[.[n]]` (case-insensitive),
 *     `request.cookies.<name>[.[n]]`, `request.method`, `request.body`
 *   - `jsonPath request.body '<path>'` (also the lowercase `jsonpath`), and the Stubborn Contract
 *     helper's legacy `jsonpath this '<path>'`
 *   - `escapejsonbody` (the Stubborn Contract helper: the request body, JSON-escaped)
 *
 * Anything else (block helpers, partials, other helpers, unknown `request` fields) throws a
 * {@link ResponseTemplateError} instead of being served as text.
 */

/** The request a response template is rendered against. */
export interface TemplateRequest {
  readonly method: string;
  /** Path and query string exactly as sent, e.g. `/items/1?q=a%20b`. */
  readonly url: string;
  /** Header values by name. Lookup is case-insensitive. */
  readonly headers: Readonly<Record<string, string | readonly string[]>>;
  /** Raw request body ("" when there is none). */
  readonly body: string;
}

/** Thrown when a response template cannot be parsed or uses something that is not supported. */
export class ResponseTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResponseTemplateError";
  }
}

type Part = string | Mustache;

interface Mustache {
  /** Expression tokens: paths/helper names (`kind: "id"`) and string literals. */
  readonly tokens: readonly Token[];
  readonly source: string;
}

interface Token {
  readonly kind: "id" | "string";
  readonly text: string;
}

const compiled = new Map<string, readonly Part[]>();

/** Whether `text` contains anything a Handlebars engine would interpret. */
export function isTemplate(text: string): boolean {
  return text.includes("{{");
}

/** Render `template` against `request`. Throws {@link ResponseTemplateError} on unsupported syntax. */
export function renderTemplate(template: string, request: TemplateRequest): string {
  let parts = compiled.get(template);
  if (parts === undefined) {
    parts = compile(template);
    if (compiled.size >= 1000) compiled.clear();
    compiled.set(template, parts);
  }
  const model = new RequestModel(request);
  let output = "";
  for (const part of parts) {
    output += typeof part === "string" ? part : evaluate(part, model);
  }
  return output;
}

// ---------------------------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------------------------

function compile(template: string): Part[] {
  const parts: Part[] = [];
  let text = "";
  let pos = 0;
  let stripLeadingWhitespace = false;

  const pushText = (value: string): void => {
    text += stripLeadingWhitespace ? value.replace(/^\s+/, "") : value;
    if (value !== "") stripLeadingWhitespace = false;
  };

  while (pos < template.length) {
    const open = template.indexOf("{{", pos);
    if (open === -1) {
      pushText(template.slice(pos));
      break;
    }
    if (open > 0 && template.charAt(open - 1) === "\\") {
      // `\{{` renders a literal `{{`.
      pushText(template.slice(pos, open - 1) + "{{");
      pos = open + 2;
      continue;
    }
    pushText(template.slice(pos, open));

    const triple = template.startsWith("{{{", open);
    if (template.startsWith("{{{{", open)) {
      fail(template, open, "raw blocks ({{{{ … }}}}) are not supported");
    }
    const close = triple ? "}}}" : "}}";
    let contentStart = open + (triple ? 3 : 2);
    const end = findClose(template, contentStart, close);
    if (end === -1) {
      // Like WireMock, an unclosed mustache is plain text.
      pushText(template.slice(open));
      break;
    }
    if (template.charAt(end + close.length) === "}") {
      fail(
        template,
        end,
        `found "${close}}" but expected "${close}" (Handlebars, like WireMock, rejects this; put a space before the extra "}")`,
      );
    }
    let contentEnd = end;
    if (template.charAt(contentStart) === "~") {
      text = text.replace(/\s+$/, "");
      contentStart += 1;
    }
    let stripAfter = false;
    if (contentEnd > contentStart && template.charAt(contentEnd - 1) === "~") {
      stripAfter = true;
      contentEnd -= 1;
    }
    const content = template.slice(contentStart, contentEnd);
    const source = template.slice(open, end + close.length);
    pos = end + close.length;

    if (!triple && content.startsWith("!")) {
      // Comment: `{{! … }}` or `{{!-- … --}}` — renders nothing.
      if (content.startsWith("!--") && !content.endsWith("--")) {
        const commentEnd = template.indexOf("--}}", contentStart);
        if (commentEnd === -1) fail(template, open, 'missing closing "--}}"');
        pos = commentEnd + 4;
      }
    } else {
      let expression = content;
      if (!triple && expression.startsWith("&")) {
        expression = expression.slice(1);
      } else if (!triple && /^[#/^>]/.test(expression)) {
        fail(template, open, `block helpers and partials are not supported: ${source}`);
      }
      if (text !== "") {
        parts.push(text);
        text = "";
      }
      parts.push({ tokens: tokenize(template, open, expression), source });
    }
    stripLeadingWhitespace = stripAfter;
  }
  if (text !== "") parts.push(text);
  return parts;
}

/** Find `close`, skipping over quoted strings inside the mustache. */
function findClose(template: string, from: number, close: string): number {
  let quote: string | undefined;
  for (let i = from; i < template.length; i++) {
    const ch = template.charAt(i);
    if (quote !== undefined) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = undefined;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (template.startsWith(close, i)) {
      return i;
    }
  }
  return -1;
}

function tokenize(template: string, position: number, expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression.charAt(i);
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "'" || ch === '"') {
      let value = "";
      let j = i + 1;
      for (; j < expression.length && expression.charAt(j) !== ch; j++) {
        if (expression.charAt(j) === "\\" && j + 1 < expression.length) j++;
        value += expression.charAt(j);
      }
      if (j >= expression.length) fail(template, position, "unterminated string literal");
      tokens.push({ kind: "string", text: value });
      i = j + 1;
    } else if (ch === "(" || ch === ")") {
      fail(template, position, `sub-expressions are not supported: {{${expression}}}`);
    } else {
      let j = i;
      while (j < expression.length && !/[\s'"()]/.test(expression.charAt(j))) j++;
      const word = expression.slice(i, j);
      if (word.includes("=")) {
        fail(template, position, `hash arguments are not supported: ${word}`);
      }
      tokens.push({ kind: "id", text: word });
      i = j;
    }
  }
  if (tokens.length === 0) fail(template, position, "empty expression");
  return tokens;
}

function fail(template: string, position: number, reason: string): never {
  throw new ResponseTemplateError(
    `Invalid or unsupported response template at position ${position}: ${reason}\n${template}`,
  );
}

// ---------------------------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------------------------

const HELPERS = ["jsonPath", "jsonpath", "escapejsonbody"];

function evaluate(mustache: Mustache, model: RequestModel): string {
  const [head, ...args] = mustache.tokens;
  if (head === undefined || head.kind !== "id") {
    throw new ResponseTemplateError(`Unsupported response template expression ${mustache.source}`);
  }

  if (head.text === "jsonPath" || head.text === "jsonpath") {
    const [context, path, ...rest] = args;
    if (context === undefined || path === undefined || rest.length > 0) {
      throw new ResponseTemplateError(
        `${mustache.source}: jsonPath takes exactly two arguments, e.g. {{jsonPath request.body '$.id'}}`,
      );
    }
    if (head.text === "jsonpath" && context.kind === "id" && context.text === "this") {
      const expression =
        path.kind === "string" ? path.text : renderValue(model.lookup(path.text, mustache));
      return renderLegacyJsonPath(model.body, expression, mustache);
    }
    const json =
      context.kind === "string" ? context.text : renderValue(model.lookup(context.text, mustache));
    const expression =
      path.kind === "string" ? path.text : renderValue(model.lookup(path.text, mustache));
    return renderJsonPathResult(json, expression, mustache);
  }

  if (head.text === "escapejsonbody") {
    if (args.length > 0) {
      throw new ResponseTemplateError(`${mustache.source}: escapejsonbody takes no arguments`);
    }
    return escapeJson(model.body);
  }

  if (args.length > 0 || !isRequestPath(head.text)) {
    throw new ResponseTemplateError(
      `${mustache.source}: unsupported helper or variable "${head.text}". ` +
        `Supported: ${HELPERS.join(", ")} and request.{url,path,pathSegments,query,headers,cookies,method,body}`,
    );
  }
  return renderValue(model.lookup(head.text, mustache));
}

function isRequestPath(text: string): boolean {
  return text === "request" || text.startsWith("request.");
}

function renderJsonPathResult(json: string, expression: string, mustache: Mustache): string {
  // Read leniently (trailing text after the object is ignored, as Jackson's reader does).
  const parsed = parseJaywayDocument(json);
  // WireMock renders nothing when the context is not JSON (e.g. an empty or text body).
  if (parsed === undefined) return "";
  let value: unknown;
  try {
    value = readJsonPath(parsed.value, expression, { leafToNull: true });
  } catch (err: unknown) {
    throw new ResponseTemplateError(
      `${mustache.source}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return prettyJson(value, 0);
  return scalarText(value);
}

/**
 * The Stubborn Contract helper's legacy form, `{{{jsonpath this '<path>'}}}`
 * (`HandlebarsJsonPathHelper` given the template model): Jayway reads the path from the request
 * body. A body that is not JSON, or a path that selects nothing, fails the template (WireMock
 * answers 500); `null` renders empty, objects and lists as json-smart writes them.
 */
function renderLegacyJsonPath(body: string, expression: string, mustache: Mustache): string {
  const fail = (reason: string): never => {
    throw new ResponseTemplateError(`${mustache.source}: ${reason}`);
  };
  const parsed = parseJaywayDocument(body);
  if (parsed === undefined) return fail("the request body is not JSON");
  let value: unknown;
  try {
    value = readJsonPath(parsed.value, expression);
  } catch (err: unknown) {
    return fail(err instanceof Error ? err.message : String(err));
  }
  if (value === undefined) return fail(`no results for path ${expression}`);
  if (value === null) return "";
  // json-smart's JSONObject/JSONArray toString(): compact, with "/" escaped.
  if (typeof value === "object") return JSON.stringify(value).replaceAll("/", "\\/");
  return scalarText(value);
}

/** Multi-valued request data (query, headers, cookies) renders its first value, like WireMock. */
function renderValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.length === 0 ? "" : renderValue(value[0]);
  if (typeof value === "object") return JSON.stringify(value);
  return scalarText(value);
}

function scalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** Jackson's default pretty printer, which WireMock uses when `jsonPath` selects an object. */
function prettyJson(value: unknown, depth: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[ ]";
    return `[ ${value.map((v) => prettyJson(v, depth)).join(", ")} ]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{ }";
    const indent = "  ".repeat(depth + 1);
    const body = entries
      .map(([k, v]) => `${indent}${JSON.stringify(k)} : ${prettyJson(v, depth + 1)}`)
      .join(",\n");
    return `{\n${body}\n${"  ".repeat(depth)}}`;
  }
  return JSON.stringify(value);
}

/**
 * Apache Commons Text `StringEscapeUtils.escapeJson`, as used by the `escapejsonbody` helper:
 * escapes `"`, `\`, `/`, control characters and everything outside printable ASCII.
 */
export function escapeJson(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const code = text.charCodeAt(i);
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "/":
        out += "\\/";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\f":
        out += "\\f";
        break;
      case "\r":
        out += "\\r";
        break;
      default:
        out +=
          code < 32 || code > 0x7f ? `\\u${code.toString(16).toUpperCase().padStart(4, "0")}` : ch;
    }
  }
  return out;
}

class RequestModel {
  private readonly parsedUrl: URL;

  constructor(private readonly request: TemplateRequest) {
    this.parsedUrl = new URL(request.url, "http://localhost");
  }

  get body(): string {
    return this.request.body;
  }

  /** Resolve `request.a.b.[0]`. Unknown `request` fields throw; missing keys render empty. */
  lookup(path: string, mustache: Mustache): unknown {
    const [root, field, ...rest] = path.split(".");
    if (root !== "request" || field === undefined) {
      throw new ResponseTemplateError(`${mustache.source}: unsupported variable "${path}"`);
    }
    let value: unknown;
    switch (field) {
      case "url":
        value = this.request.url;
        break;
      case "path":
        value = rest.length === 0 ? safeDecode(this.parsedUrl.pathname) : this.pathSegments();
        break;
      case "pathSegments":
        value = this.pathSegments();
        break;
      case "method":
        value = this.request.method.toUpperCase();
        break;
      case "body":
        value = this.request.body;
        break;
      case "query":
        value = this.query();
        break;
      case "headers":
        value = this.headers();
        break;
      case "cookies":
        value = this.cookies();
        break;
      default:
        throw new ResponseTemplateError(
          `${mustache.source}: unsupported request field "${field}". ` +
            "Supported: url, path, pathSegments, query, headers, cookies, method, body",
        );
    }
    for (const segment of rest) {
      value = step(value, segment);
    }
    return value;
  }

  private pathSegments(): string[] {
    return this.parsedUrl.pathname
      .split("/")
      .filter((s) => s !== "")
      .map(safeDecode);
  }

  private query(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const [key, value] of this.parsedUrl.searchParams) {
      result.set(key, [...(result.get(key) ?? []), value]);
    }
    return result;
  }

  private headers(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const [key, value] of Object.entries(this.request.headers)) {
      const lower = key.toLowerCase();
      const values = typeof value === "string" ? [value] : [...value];
      result.set(lower, [...(result.get(lower) ?? []), ...values]);
    }
    return new CaseInsensitiveMap(result);
  }

  private cookies(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const header of this.headers().get("cookie") ?? []) {
      for (const pair of header.split(";")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        const name = pair.slice(0, eq).trim();
        result.set(name, [...(result.get(name) ?? []), pair.slice(eq + 1).trim()]);
      }
    }
    return result;
  }
}

class CaseInsensitiveMap extends Map<string, string[]> {
  override get(key: string): string[] | undefined {
    return super.get(key.toLowerCase());
  }
}

function step(value: unknown, segment: string): unknown {
  const indexMatch = /^\[?(\d+)\]?$/.exec(segment);
  if (indexMatch !== null && Array.isArray(value)) {
    return value[Number(indexMatch[1])];
  }
  if (value instanceof Map) {
    return value.get(segment);
  }
  return undefined;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
