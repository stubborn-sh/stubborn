import { DOMParser, type Attr, type Document, type Element, type Node } from "@xmldom/xmldom";
import xpath from "xpath";
import { javaRegex } from "./java-regex.js";

/**
 * XML support for WireMock's `matchesXPath` and `equalToXml` body patterns, reproducing WireMock
 * 3.13.2 (Xerces + JAXP XPath 1.0 + XMLUnit 2, configured as in WireMock's `Xml`,
 * `MatchesXPathPattern` and `EqualToXmlPattern`). No DOM type leaves this module.
 *
 * Request bodies are untrusted: parsing is strict, external entities are never resolved, internal
 * DOCTYPE subsets are refused (WireMock would apply their entities and default attributes), the
 * JDK secure-processing limits apply, and nothing recurses over the request document.
 */

const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const XMLNS_URI = "http://www.w3.org/2000/xmlns/";
const XML_URI = "http://www.w3.org/XML/1998/namespace";
const XSI_URI = "http://www.w3.org/2001/XMLSchema-instance";
/** Namespace given to prefixes a body uses without declaring (namespace-unaware view only). */
const UNBOUND_PREFIX_URI = "urn:x-stub-server:unbound-prefix:";

/** JDK `FEATURE_SECURE_PROCESSING` limits WireMock's parser enforces. */
const MAX_ATTRIBUTES_PER_ELEMENT = 10_000;
const MAX_NAME_LENGTH = 1000;
/**
 * Deeper documents never match. Real XML is nowhere near this; the limit bounds the cost of
 * pathological bodies and keeps the XPath library's own recursion (string(), for one, overflows
 * between 4000 and 5000 levels) in bounds.
 */
const MAX_ELEMENT_DEPTH = 2000;

// --- parsing -----------------------------------------------------------------------------------

type ParseResult =
  { readonly doc: Document } | { readonly doc: null; readonly unboundPrefix: boolean };

function parseOnce(source: string): ParseResult {
  try {
    const doc = new DOMParser({
      // XML 1.0 line-end handling, as Xerces: xmldom's default also rewrites U+2028 and U+0085.
      normalizeLineEndings: (input: string) => input.replace(/\r\n?/g, "\n"),
      // xmldom reports several well-formedness errors only as warnings: all are fatal here.
      onError: (_level: string, message: string) => {
        throw new Error(message);
      },
    }).parseFromString(source, "text/xml");
    return doc.documentElement === null ? { doc: null, unboundPrefix: false } : { doc };
  } catch (err: unknown) {
    return {
      doc: null,
      unboundPrefix: err instanceof Error && err.message.includes("NamespaceError"),
    };
  }
}

/**
 * Parse `text` as WireMock's Xerces would; `null` for anything that is not a well-formed document.
 * With `allowUnboundPrefixes` (WireMock's namespace-unaware parse, used for XPath without
 * `xPathNamespaces`) prefixes used without a declaration are accepted.
 */
function parseDocument(text: string, allowUnboundPrefixes: boolean): Document | null {
  if (text.trim() === "" || !isWellFormedText(text)) return null;
  const first = parseOnce(text);
  if (first.doc !== null || !allowUnboundPrefixes || !first.unboundPrefix) return first.doc;
  const declared = declareUnboundPrefixes(text);
  return declared === null ? null : parseOnce(declared).doc;
}

/**
 * Checks xmldom does not make: characters outside the XML `Char` production and references to
 * them, a bare `&`, `]]>` in character data, and internal DTD subsets.
 */
function isWellFormedText(text: string): boolean {
  let i = 0;
  let inTag = false;
  let quote = "";
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(i + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return false;
      i += 2;
      continue;
    }
    if (!isXmlChar(code)) return false;
    const ch = text.charAt(i);
    if (!inTag) {
      const skip = skipMarkup(text, i);
      if (skip === -1) return false;
      if (skip > i) {
        i = skip;
        continue;
      }
      if (ch === "<") inTag = true;
      else if (ch === "]" && text.startsWith("]]>", i)) return false;
    } else if (quote !== "") {
      if (ch === quote) quote = "";
      else if (ch === "<") return false;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      inTag = false;
    }
    if (ch === "&") {
      const ref = /^&(?:#([0-9]+)|#x([0-9a-fA-F]+)|([A-Za-z_:][\w.:-]*));/.exec(
        text.slice(i, i + 256),
      );
      if (ref === null) return false;
      if (ref[1] !== undefined || ref[2] !== undefined) {
        const value =
          ref[1] !== undefined ? Number.parseInt(ref[1], 10) : Number.parseInt(ref[2] ?? "", 16);
        if (!isXmlCodePoint(value)) return false;
      }
      i += ref[0].length;
      continue;
    }
    i++;
  }
  return true;
}

/** Skip CDATA, comments, processing instructions and a DOCTYPE; -1 when malformed. */
function skipMarkup(text: string, at: number): number {
  const sections: readonly (readonly [string, string])[] = [
    ["<![CDATA[", "]]>"],
    ["<!--", "-->"],
    ["<?", "?>"],
  ];
  for (const [open, close] of sections) {
    if (text.startsWith(open, at)) {
      const end = text.indexOf(close, at + open.length);
      if (end === -1 || !allXmlChars(text, at + open.length, end)) return -1;
      return end + close.length;
    }
  }
  if (text.startsWith("<!DOCTYPE", at)) {
    const end = text.indexOf(">", at);
    if (end === -1 || text.slice(at, end).includes("[")) return -1;
    return end + 1;
  }
  return at;
}

function allXmlChars(text: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      i++;
      continue;
    }
    if (!isXmlChar(code)) return false;
  }
  return true;
}

function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd)
  );
}

function isXmlCodePoint(value: number): boolean {
  return isXmlChar(value) || (value >= 0x10000 && value <= 0x10ffff);
}

/** Add declarations, on the root element, for prefixes used without one. */
function declareUnboundPrefixes(text: string): string | null {
  const used = new Set<string>();
  for (const match of text.matchAll(/[<\s]\/?([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*/g)) {
    const prefix = match[1] ?? "";
    if (prefix !== "xml" && prefix !== "xmlns") used.add(prefix);
  }
  const masked = text.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, (m) =>
    " ".repeat(m.length),
  );
  const root = /<([A-Za-z_][\w.:-]*)/.exec(masked);
  if (root === null || used.size === 0) return null;
  const rootTagEnd = root.index + root[0].length;
  const rootTag = text.slice(root.index, text.indexOf(">", rootTagEnd) + 1);
  const declarations = [...used]
    .filter((prefix) => !rootTag.includes(`xmlns:${prefix}=`))
    .map((prefix) => ` xmlns:${prefix}="${UNBOUND_PREFIX_URI}${prefix}"`)
    .join("");
  return text.slice(0, rootTagEnd) + declarations + text.slice(rootTagEnd);
}

/** Java `String.trim()`: strips code points up to U+0020 only. */
function javaTrim(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text.charCodeAt(start) <= 0x20) start++;
  while (end > start && text.charCodeAt(end - 1) <= 0x20) end--;
  return text.slice(start, end);
}

function isNamespaceDeclaration(attr: Node): boolean {
  return (
    attr.namespaceURI === XMLNS_URI ||
    attr.nodeName === "xmlns" ||
    attr.nodeName.startsWith("xmlns:")
  );
}

// --- XPath views -------------------------------------------------------------------------------

/** A parsed body prepared for XPath evaluation the way WireMock evaluates it. */
export interface XPathDocument {
  readonly namespaceAware: boolean;
}

interface ViewState {
  readonly doc: Document;
  /** Namespace declarations of each element, hidden from the XPath attribute axis. */
  readonly declarations: WeakMap<Node, readonly Attr[]>;
}

const views = new WeakMap<XPathDocument, ViewState>();

/**
 * Parse `text` for XPath. Without `namespaceAware` the document is namespace-unaware like
 * WireMock's default parser: names keep their prefixes (`name()` is `p:a`), name tests match the
 * local part, `namespace-uri()` is empty. With it, the document is namespace-aware, as WireMock
 * re-parses it when `xPathNamespaces` is given. `null` when WireMock would not parse the body,
 * including when it does not start with `<` (WireMock checks that first).
 */
export function parseForXPath(text: string, namespaceAware: boolean): XPathDocument | null {
  if (!javaTrim(text).startsWith("<")) return null;
  const doc = parseDocument(text, !namespaceAware);
  if (doc === null) return null;
  const declarations = new WeakMap<Node, readonly Attr[]>();
  if (!prepareView(doc, namespaceAware, declarations)) return null;
  const view: XPathDocument = { namespaceAware };
  views.set(view, { doc, declarations });
  return view;
}

/**
 * One iterative pass over the document: enforces the JDK limits; assigns document order with an
 * O(1) `compareDocumentPosition` (the xpath library sorts node sets with it, and xmldom's is
 * linear, which made wide documents quadratic); hides namespace declarations from the attribute
 * axis; makes the view namespace-unaware if asked; and disables `id()` (no DTD, so WireMock finds
 * no ID attributes).
 */
function prepareView(
  doc: Document,
  namespaceAware: boolean,
  declarations: WeakMap<Node, readonly Attr[]>,
): boolean {
  const order = new WeakMap<object, number>();
  let index = 0;
  function fastCompare(this: Node, other: Node): number {
    const a = order.get(this);
    const b = order.get(other);
    if (a === undefined || b === undefined) {
      const original = (
        Object.getPrototypeOf(this) as { compareDocumentPosition: (o: Node) => number }
      ).compareDocumentPosition;
      return original.call(this, other);
    }
    return a === b ? 0 : b < a ? 0x02 : 0x04;
  }
  const define = (target: object, key: string, value: unknown): void => {
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
  };
  const tag = (node: Node): void => {
    order.set(node, index++);
    define(node, "compareDocumentPosition", fastCompare);
  };

  tag(doc);
  define(doc, "getElementById", () => null);
  const stack: { readonly node: Node; readonly depth: number }[] = [];
  for (let child = doc.lastChild; child !== null; child = child.previousSibling) {
    stack.push({ node: child, depth: 1 });
  }
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: Node; depth: number };
    tag(node);
    if (node.nodeType !== ELEMENT_NODE) continue;
    if (depth > MAX_ELEMENT_DEPTH) return false;
    const element = node as Element;
    if (element.nodeName.length > MAX_NAME_LENGTH) return false;
    const all = element.attributes;
    if (all.length > MAX_ATTRIBUTES_PER_ELEMENT) return false;
    const kept: Attr[] = [];
    const declared: Attr[] = [];
    for (let i = 0; i < all.length; i++) {
      const attr = all.item(i);
      if (attr === null) continue;
      if (attr.nodeName.length > MAX_NAME_LENGTH) return false;
      if (isNamespaceDeclaration(attr)) {
        declared.push(attr);
        continue;
      }
      tag(attr);
      if (!namespaceAware) define(attr, "namespaceURI", null);
      kept.push(attr);
    }
    if (declared.length > 0) {
      declarations.set(element, declared);
      define(element, "attributes", attributeList(kept));
    }
    if (!namespaceAware) define(element, "namespaceURI", null);
    for (let child = element.lastChild; child !== null; child = child.previousSibling) {
      stack.push({ node: child, depth: depth + 1 });
    }
  }
  return true;
}

interface AttributeList {
  readonly length: number;
  item(index: number): Attr | null;
  readonly [index: number]: Attr;
}

/** A NamedNodeMap stand-in for the XPath attribute axis (which only reads length and item()). */
function attributeList(attrs: readonly Attr[]): AttributeList {
  const list: Record<number, Attr> = {};
  attrs.forEach((attr, i) => {
    list[i] = attr;
  });
  return Object.assign(list, { length: attrs.length, item: (i: number) => attrs[i] ?? null });
}

function attributesOfView(element: Element): readonly Attr[] {
  const list = element.attributes as unknown as AttributeList;
  const result: Attr[] = [];
  for (let i = 0; i < list.length; i++) {
    const attr = list.item(i);
    if (attr !== null && !isNamespaceDeclaration(attr)) result.push(attr);
  }
  return result;
}

/** Result of an XPath evaluation: selected nodes, or a string/number/boolean value. */
export type XPathOutcome =
  | { readonly kind: "nodes"; readonly nodes: readonly Node[] }
  | { readonly kind: "value"; readonly value: string | number | boolean };

/** Evaluate an XPath 1.0 expression. Throws when the expression is invalid. */
export function evaluateXPath(
  view: XPathDocument,
  expression: string,
  namespaces: Readonly<Record<string, string>> | undefined,
): XPathOutcome {
  const state = views.get(view);
  if (state === undefined) throw new Error("unknown XPath document");
  return evaluateOn(state.doc, expression, namespaces);
}

/** Validate an expression against an empty document; throws when it is invalid. */
export function checkXPath(
  expression: string,
  namespaces: Readonly<Record<string, string>> | undefined,
): void {
  evaluateOn(new DOMParser().parseFromString("<_/>", "text/xml"), expression, namespaces);
}

function evaluateOn(
  doc: Document,
  expression: string,
  namespaces: Readonly<Record<string, string>> | undefined,
): XPathOutcome {
  let select = xpath.select;
  if (namespaces !== undefined) {
    // Null prototype: "constructor:a" must not resolve through Object.prototype.
    const map = Object.assign(Object.create(null) as Record<string, string>, namespaces, {
      xml: XML_URI,
    });
    select = xpath.useNamespaces(map);
  }
  const result = select(expression, doc as unknown as globalThis.Node);
  if (Array.isArray(result)) return { kind: "nodes", nodes: result as unknown as Node[] };
  if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
    return { kind: "value", value: result };
  }
  return { kind: "nodes", nodes: result === null ? [] : [result as unknown as Node] };
}

// --- rendering ---------------------------------------------------------------------------------

/**
 * The text WireMock compares a selected node by (`XmlDomNode.toString()`): the value of a text or
 * attribute node; the transformer output (2-space indent) of an element or the document; Xerces'
 * `toString()` (`[#comment: …]`) of anything else.
 */
export function nodeText(view: XPathDocument, node: Node): string {
  const state = views.get(view);
  switch (node.nodeType) {
    case TEXT_NODE:
    case ATTRIBUTE_NODE:
      return node.nodeValue ?? "";
    case ELEMENT_NODE:
    case DOCUMENT_NODE:
      return state === undefined ? "" : `${render(view, state, node)}\n`;
    case COMMENT_NODE:
      return `[#comment: ${node.nodeValue ?? ""}]`;
    case CDATA_SECTION_NODE:
      return `[#cdata-section: ${node.nodeValue ?? ""}]`;
    case PROCESSING_INSTRUCTION_NODE:
      return `[${node.nodeName}: ${node.nodeValue ?? ""}]`;
    default:
      return node.nodeValue ?? "";
  }
}

/** Java `NumberFormat.getInstance()` (en-US): grouping, at most three fraction digits. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
  roundingMode: "halfEven",
} as Intl.NumberFormatOptions);

/** Text of an XPath value result, as WireMock's `XmlPrimitiveNode.toString()`. */
export function valueText(value: string | number | boolean): string {
  return typeof value === "number" ? NUMBER_FORMAT.format(value) : String(value);
}

interface RenderFrame {
  readonly element: Element;
  readonly level: number;
  next: Node | null;
  childCount: number;
  buffer: { readonly cdata: boolean; readonly data: string }[];
  previousWasText: boolean;
  /** Namespace bindings written so far (namespace-aware rendering): prefix -> URI. */
  readonly scope: ReadonlyMap<string, string>;
}

function render(view: XPathDocument, state: ViewState, node: Node): string {
  if (node.nodeType !== DOCUMENT_NODE) return renderElement(view, state, node as Element);
  let out = "";
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === ELEMENT_NODE) out += renderElement(view, state, child as Element);
    else if (child.nodeType === COMMENT_NODE) out += `<!--${child.nodeValue ?? ""}-->`;
    else if (
      child.nodeType === PROCESSING_INSTRUCTION_NODE &&
      child.nodeName.toLowerCase() !== "xml"
    ) {
      out += processingInstruction(child);
    }
  }
  return out;
}

/**
 * Emulates the JDK's XSLTC serializer with `indent=yes`, `indent-number=2`, as WireMock
 * configures it: buffered character data is indented only when its parent has more than one
 * child (dropping its leading newlines), a buffer holding CDATA is never indented, child
 * elements, comments and processing instructions always are, and an end tag is indented unless
 * unindented text came right before it. Iterative, so a deep body cannot exhaust the stack.
 */
function renderElement(view: XPathDocument, state: ViewState, root: Element): string {
  let out = "";
  const indent = (level: number): string => `\n${"  ".repeat(level)}`;
  const flush = (frame: RenderFrame): void => {
    if (frame.buffer.length === 0) return;
    frame.childCount++;
    const hasCdata = frame.buffer.some((chunk) => chunk.cdata);
    let text = frame.buffer
      .map((c) => (c.cdata ? `<![CDATA[${c.data}]]>` : escapeText(c.data)))
      .join("");
    if (!hasCdata && frame.childCount > 1) {
      text = text.replace(/^\n+/, "");
      out += indent(frame.level + 1) + text;
      frame.previousWasText = false;
    } else {
      out += text;
      frame.previousWasText = true;
    }
    frame.buffer = [];
  };
  const open = (
    element: Element,
    level: number,
    scope: ReadonlyMap<string, string>,
  ): RenderFrame | null => {
    const start = startTag(view, state, element, scope);
    out += start.tag;
    if (element.firstChild === null) {
      out += "/>";
      return null;
    }
    out += ">";
    return {
      element,
      level,
      next: element.firstChild,
      childCount: 0,
      buffer: [],
      previousWasText: false,
      scope: start.scope,
    };
  };

  const stack: RenderFrame[] = [];
  const first = open(root, 0, new Map());
  if (first !== null) stack.push(first);
  while (stack.length > 0) {
    const frame = stack[stack.length - 1] as RenderFrame;
    const child = frame.next;
    if (child === null) {
      flush(frame);
      if (!frame.previousWasText) out += indent(frame.level);
      out += `</${frame.element.nodeName}>`;
      stack.pop();
      continue;
    }
    frame.next = child.nextSibling;
    if (child.nodeType === TEXT_NODE || child.nodeType === CDATA_SECTION_NODE) {
      frame.buffer.push({
        cdata: child.nodeType === CDATA_SECTION_NODE,
        data: child.nodeValue ?? "",
      });
      continue;
    }
    if (
      child.nodeType !== ELEMENT_NODE &&
      child.nodeType !== COMMENT_NODE &&
      child.nodeType !== PROCESSING_INSTRUCTION_NODE
    ) {
      continue;
    }
    frame.childCount++;
    flush(frame);
    out += indent(frame.level + 1);
    frame.previousWasText = false;
    if (child.nodeType === COMMENT_NODE) out += `<!--${child.nodeValue ?? ""}-->`;
    else if (child.nodeType === PROCESSING_INSTRUCTION_NODE) out += processingInstruction(child);
    else {
      const nested = open(child as Element, frame.level + 1, frame.scope);
      if (nested !== null) stack.push(nested);
    }
  }
  return out;
}

/**
 * Start tag. Namespace-unaware: the element's own declarations as written, then its attributes.
 * Namespace-aware: its own declarations and those its attributes' prefixes need, then the
 * attributes, then a declaration for the element's own namespace if not yet in scope — as the
 * JDK's DOM2SAX bridge writes them.
 */
function startTag(
  view: XPathDocument,
  state: ViewState,
  element: Element,
  scope: ReadonlyMap<string, string>,
): { readonly tag: string; readonly scope: ReadonlyMap<string, string> } {
  const own = (state.declarations.get(element) ?? []).filter(
    (a) => !a.value.startsWith(UNBOUND_PREFIX_URI),
  );
  const regular = attributesOfView(element);
  const attribute = (name: string, value: string): string => ` ${name}="${escapeAttribute(value)}"`;
  let tag = `<${element.nodeName}`;
  if (!view.namespaceAware) {
    const declared = new Map(scope);
    for (const decl of own)
      declared.set(decl.nodeName === "xmlns" ? "" : decl.nodeName.slice(6), decl.value);
    for (const attr of regular) {
      const colon = attr.nodeName.indexOf(":");
      const prefix = colon === -1 ? "" : attr.nodeName.slice(0, colon);
      // The JDK transformer refuses an attribute prefix not declared within the rendered
      // subtree, so WireMock's match fails.
      if (prefix !== "" && prefix !== "xml" && !declared.has(prefix)) {
        throw new Error(`Namespace for prefix '${prefix}' has not been declared.`);
      }
    }
    for (const decl of own) tag += attribute(decl.nodeName, decl.value);
    for (const attr of regular) tag += attribute(attr.nodeName, attr.value);
    return { tag, scope: declared };
  }
  const inner = new Map(scope);
  const bind = (prefix: string, uri: string): void => {
    tag += attribute(prefix === "" ? "xmlns" : `xmlns:${prefix}`, uri);
    inner.set(prefix, uri);
  };
  for (const decl of own) bind(decl.nodeName === "xmlns" ? "" : decl.nodeName.slice(6), decl.value);
  for (const attr of regular) {
    const prefix = attr.prefix ?? "";
    const uri = attr.namespaceURI;
    if (prefix !== "" && prefix !== "xml" && uri !== null && inner.get(prefix) !== uri)
      bind(prefix, uri);
  }
  for (const attr of regular) tag += attribute(attr.nodeName, attr.value);
  const prefix = element.prefix ?? "";
  const uri = element.namespaceURI ?? "";
  if ((inner.get(prefix) ?? "") !== uri) bind(prefix, uri);
  return { tag, scope: inner };
}

function processingInstruction(node: Node): string {
  const data = node.nodeValue ?? "";
  return `<?${node.nodeName}${data === "" ? "" : ` ${data}`}?>`;
}

const TEXT_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\r": "&#13;",
};
const ATTRIBUTE_ESCAPES: Readonly<Record<string, string>> = {
  ...TEXT_ESCAPES,
  '"': "&quot;",
  "\n": "&#10;",
  "\t": "&#9;",
};

function escapeText(text: string): string {
  return text.replace(/[&<>\r]/g, (c) => TEXT_ESCAPES[c] ?? c);
}

function escapeAttribute(text: string): string {
  return text.replace(/[&<>"\n\r\t]/g, (c) => ATTRIBUTE_ESCAPES[c] ?? c);
}

// --- equalToXml --------------------------------------------------------------------------------

/** `equalToXml` options stub-server supports (with WireMock's default STRICT namespace awareness). */
export interface XmlEqualityOptions {
  readonly enablePlaceholders: boolean;
  readonly placeholderOpeningDelimiterRegex: string;
  readonly placeholderClosingDelimiterRegex: string;
  readonly ignoreOrderOfSameNode: boolean;
}

type Placeholder =
  | { readonly kind: "ignore" }
  | { readonly kind: "isNumber" }
  | { readonly kind: "matchesRegex"; readonly regex: RegExp }
  /** A placeholder XMLUnit recognises but whose arguments it rejects: never matches. */
  | { readonly kind: "never" }
  /** A placeholder stub-server cannot evaluate (isDateTime, a regex JavaScript cannot compile). */
  | { readonly kind: "unsupported"; readonly reason: string };

interface CElement {
  readonly kind: "element";
  readonly ns: string | null;
  readonly local: string;
  readonly attrs: readonly CAttr[];
  readonly children: CNode[];
  readonly dom: Element;
}

/** Comparable form of a document: comments dropped, adjacent text merged, whitespace stripped. */
type CNode =
  | CElement
  | { readonly kind: "text" | "cdata"; readonly value: string }
  | { readonly kind: "pi"; readonly target: string; readonly data: string };

interface CAttr {
  readonly ns: string | null;
  readonly local: string;
  readonly value: string;
}

const XMLUNIT_IS_NUMBER = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;

/**
 * Compile an `equalToXml` comparison as WireMock 3.13.2 runs XMLUnit: whitespace and comments
 * ignored; children paired by local name (then by text content with `ignoreOrderOfSameNode`);
 * and a difference counted only when the expected side has a value — so an expected element
 * without a namespace matches one with any namespace, but not the other way round. Returns the
 * reason it cannot be supported instead of a matcher when the expected document is invalid or
 * uses an unsupported placeholder.
 *
 * Deliberate difference: WireMock never matches when an element has mixed content (its node
 * sorter throws on text nodes); here character data compares in order.
 */
export function compileXmlEquality(
  expectedText: string,
  options: XmlEqualityOptions,
): ((actualText: string) => boolean) | { readonly unsupported: string } {
  const expectedDoc = parseDocument(expectedText, false);
  if (expectedDoc === null) return { unsupported: "expected value is not well-formed XML" };

  let placeholderPattern: RegExp | undefined;
  if (options.enablePlaceholders) {
    try {
      const open = options.placeholderOpeningDelimiterRegex;
      const close = options.placeholderClosingDelimiterRegex;
      placeholderPattern = new RegExp(
        `^\\s*${open}\\s*xmlunit\\.(\\w+)(?:\\(([^)]*)\\))?\\s*${close}\\s*$`,
      );
    } catch {
      return { unsupported: "placeholder delimiters are not valid JavaScript regexes" };
    }
  }

  // XMLUnit: a text that is not exactly one placeholder, or names an unknown one, compares as
  // literal text.
  const placeholders = new Map<string, Placeholder | null>();
  const placeholderFor = (text: string): Placeholder | null => {
    if (placeholderPattern === undefined) return null;
    const cached = placeholders.get(text);
    if (cached !== undefined) return cached;
    let result: Placeholder | null = null;
    const match = placeholderPattern.exec(text);
    if (match !== null) {
      const name = match[1] ?? "";
      const args = match[2] === undefined ? [] : match[2].split(",");
      // ignore and isNumber take no arguments; XMLUnit rejects any, even empty parentheses.
      if (name === "ignore")
        result = match[2] === undefined ? { kind: "ignore" } : { kind: "never" };
      else if (name === "isNumber")
        result = match[2] === undefined ? { kind: "isNumber" } : { kind: "never" };
      else if (name === "matchesRegex") {
        if (args.length !== 1) result = { kind: "never" };
        else {
          const regex = javaRegex((args[0] ?? "").trim(), { mode: "find", dotAll: false });
          result =
            regex === null
              ? { kind: "unsupported", reason: `regex JavaScript cannot compile: ${args[0] ?? ""}` }
              : { kind: "matchesRegex", regex };
        }
      } else if (name === "isDateTime") {
        result = { kind: "unsupported", reason: "isDateTime" };
      }
    }
    placeholders.set(text, result);
    return result;
  };

  let expected: CNode[];
  try {
    expected = comparable(expectedDoc);
  } catch {
    return { unsupported: "expected value exceeds the XML parser limits" };
  }
  // Resolve every placeholder now (text, CDATA, attributes), so an unsupported one is reported
  // at load time.
  const unsupported: string[] = [];
  const stack: CNode[] = [...expected];
  while (stack.length > 0) {
    const node = stack.pop() as CNode;
    let values: readonly string[] = [];
    if (node.kind === "element") {
      values = node.attrs.map((a) => a.value);
      stack.push(...node.children);
    } else if (node.kind === "text" || node.kind === "cdata") {
      values = [node.value];
    }
    for (const value of values) {
      const placeholder = placeholderFor(value);
      if (placeholder?.kind === "unsupported")
        unsupported.push(`${value.trim()} (${placeholder.reason})`);
    }
  }
  if (unsupported.length > 0) {
    return { unsupported: `unsupported XMLUnit placeholder(s): ${unsupported.join(", ")}` };
  }

  const context: CompareContext = { options, placeholderFor };
  return (actualText) => {
    try {
      const actualDoc = parseDocument(actualText, false);
      return actualDoc !== null && childrenEqual(expected, comparable(actualDoc), context);
    } catch {
      return false;
    }
  };
}

interface CompareContext {
  readonly options: XmlEqualityOptions;
  placeholderFor(text: string): Placeholder | null;
}

/** Build the comparable tree of a document without recursion. */
function comparable(doc: Document): CNode[] {
  const top: CNode[] = [];
  const work: { readonly dom: Node; readonly into: CNode[]; readonly depth: number }[] = [
    { dom: doc, into: top, depth: 0 },
  ];
  while (work.length > 0) {
    const { dom, into, depth } = work.pop() as { dom: Node; into: CNode[]; depth: number };
    if (depth > MAX_ELEMENT_DEPTH) throw new Error("XML document too deep");
    let pendingText: string | null = null;
    const flushText = (): void => {
      if (pendingText === null) return;
      const value = javaTrim(pendingText);
      if (value !== "") into.push({ kind: "text", value });
      pendingText = null;
    };
    for (let child = dom.firstChild; child !== null; child = child.nextSibling) {
      switch (child.nodeType) {
        case TEXT_NODE:
          pendingText = (pendingText ?? "") + (child.nodeValue ?? "");
          break;
        case CDATA_SECTION_NODE: {
          flushText();
          const value = javaTrim(child.nodeValue ?? "");
          if (value !== "") into.push({ kind: "cdata", value });
          break;
        }
        case PROCESSING_INSTRUCTION_NODE:
          // xmldom keeps the XML declaration as a processing instruction; XMLUnit does not.
          if (child.nodeName.toLowerCase() === "xml") break;
          flushText();
          into.push({ kind: "pi", target: child.nodeName, data: javaTrim(child.nodeValue ?? "") });
          break;
        case ELEMENT_NODE: {
          flushText();
          const element = child as Element;
          if (element.nodeName.length > MAX_NAME_LENGTH) throw new Error("XML name too long");
          const node: CElement = {
            kind: "element",
            ns: element.namespaceURI ?? null,
            local: element.localName ?? element.nodeName,
            attrs: attributesOf(element),
            children: [],
            dom: element,
          };
          into.push(node);
          work.push({ dom: element, into: node.children, depth: depth + 1 });
          break;
        }
        default:
          break; // comments (the text around them merges), DOCTYPE
      }
    }
    flushText();
  }
  return top;
}

function attributesOf(element: Element): CAttr[] {
  if (element.attributes.length > MAX_ATTRIBUTES_PER_ELEMENT)
    throw new Error("too many attributes");
  const result: CAttr[] = [];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes.item(i);
    if (attr === null || isNamespaceDeclaration(attr)) continue;
    result.push({
      ns: attr.namespaceURI ?? null,
      local: attr.localName ?? attr.nodeName,
      value: attr.value,
    });
  }
  return result;
}

/** `Node.getTextContent()` of the stripped tree, without recursion. */
function textContent(nodes: readonly CNode[]): string {
  let out = "";
  const stack: CNode[] = [...nodes].reverse();
  while (stack.length > 0) {
    const node = stack.pop() as CNode;
    if (node.kind === "text" || node.kind === "cdata") out += node.value;
    else if (node.kind === "element")
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i] as CNode);
  }
  return out;
}

function childrenEqual(
  expected: readonly CNode[],
  actual: readonly CNode[],
  context: CompareContext,
): boolean {
  const isIgnoreText = (n: CNode): boolean =>
    (n.kind === "text" || n.kind === "cdata") && context.placeholderFor(n.value)?.kind === "ignore";
  const ignoreTexts = expected.filter(isIgnoreText).length;
  // XMLUnit compares the child counts; a missing ${xmlunit.ignore} text is forgiven.
  if (actual.length !== expected.length && actual.length !== expected.length - ignoreTexts)
    return false;

  // Character data and processing instructions compare in order; an ${xmlunit.ignore} text
  // consumes a text node if there is one, and may otherwise be absent.
  const actualOther = actual.filter((n) => n.kind !== "element");
  let j = 0;
  for (const node of expected) {
    if (node.kind === "element") continue;
    const other = actualOther[j];
    if (isIgnoreText(node)) {
      if (other !== undefined && (other.kind === "text" || other.kind === "cdata")) j++;
      continue;
    }
    if (other === undefined || !leafEqual(node, other, context)) return false;
    j++;
  }
  const control = expected;

  // Elements: stable sort by local name (then text content), as WireMock's node matcher does.
  const sort = (nodes: readonly CNode[]): CElement[] =>
    nodes
      .filter((n): n is CElement => n.kind === "element")
      .map((e, i) => ({
        e,
        i,
        text: context.options.ignoreOrderOfSameNode ? textContent(e.children) : "",
      }))
      .sort(
        (a, b) =>
          compareStrings(a.e.local, b.e.local) || compareStrings(a.text, b.text) || a.i - b.i,
      )
      .map((x) => x.e);
  const controlElements = sort(control);
  const actualElements = sort(actual);

  // XMLUnit's DefaultNodeMatcher: same qualified name, searching after the last match and
  // wrapping around; the elements left over pair up in order.
  const pairs = new Map<number, number>();
  const used = new Set<number>();
  let last = -1;
  for (const [ci, element] of controlElements.entries()) {
    for (let k = 1; k <= actualElements.length; k++) {
      const ti = (last + k) % actualElements.length;
      const candidate = actualElements[ti];
      if (
        candidate !== undefined &&
        !used.has(ti) &&
        candidate.local === element.local &&
        candidate.ns === element.ns
      ) {
        pairs.set(ci, ti);
        used.add(ti);
        last = ti;
        break;
      }
    }
  }
  const leftover = actualElements.map((_, i) => i).filter((i) => !used.has(i));
  for (const ci of controlElements.keys()) {
    if (pairs.has(ci)) continue;
    const ti = leftover.shift();
    if (ti === undefined) return false;
    pairs.set(ci, ti);
  }
  for (const [ci, ti] of pairs) {
    const a = controlElements[ci];
    const b = actualElements[ti];
    if (a === undefined || b === undefined || !elementEqual(a, b, context)) return false;
  }
  return true;
}

function elementEqual(expected: CElement, actual: CElement, context: CompareContext): boolean {
  if (expected.local !== actual.local) return false;
  if (expected.ns !== null && expected.ns !== actual.ns) return false;

  const actualAttrs = new Map(actual.attrs.map((a) => [`{${a.ns ?? ""}}${a.local}`, a]));
  let compared = 0;
  for (const attr of expected.attrs) {
    const other = actualAttrs.get(`{${attr.ns ?? ""}}${attr.local}`);
    const placeholder = context.placeholderFor(attr.value);
    if (other === undefined) {
      if (placeholder?.kind === "ignore") continue; // ${xmlunit.ignore} accepts a missing attribute
      return false;
    }
    compared++;
    if (attr.ns === XSI_URI && attr.local === "type") {
      if (!qnameEqual(attr.value, expected.dom, other.value, actual.dom)) return false;
    } else if (!valueEqual(javaTrim(attr.value), javaTrim(other.value), placeholder)) {
      return false;
    }
  }
  if (compared !== actual.attrs.length) return false;
  return childrenEqual(expected.children, actual.children, context);
}

function leafEqual(expected: CNode, actual: CNode, context: CompareContext): boolean {
  if (expected.kind === "pi") {
    return (
      actual.kind === "pi" && expected.target === actual.target && expected.data === actual.data
    );
  }
  if (expected.kind === "element" || actual.kind === "element" || actual.kind === "pi")
    return false;
  const placeholder = context.placeholderFor(expected.value);
  // A placeholder also accepts CDATA for text and vice versa; otherwise the node type counts.
  if (placeholder === null && expected.kind !== actual.kind) return false;
  return valueEqual(expected.value, actual.value, placeholder);
}

function valueEqual(expected: string, actual: string, placeholder: Placeholder | null): boolean {
  if (placeholder === null) return expected === actual;
  const value = javaTrim(actual);
  switch (placeholder.kind) {
    case "ignore":
      return true;
    case "isNumber":
      return XMLUNIT_IS_NUMBER.test(value);
    case "matchesRegex":
      return placeholder.regex.test(value);
    default:
      return false;
  }
}

/** xsi:type values compare as QNames: each prefix resolved in its own document. */
function qnameEqual(
  expected: string,
  expectedScope: Element,
  actual: string,
  actualScope: Element,
): boolean {
  const resolve = (value: string, scope: Element): string => {
    const colon = value.indexOf(":");
    const prefix = colon === -1 ? null : value.slice(0, colon);
    return `{${scope.lookupNamespaceURI(prefix) ?? ""}}${colon === -1 ? value : value.slice(colon + 1)}`;
  };
  return resolve(javaTrim(expected), expectedScope) === resolve(javaTrim(actual), actualScope);
}

/** Java `String.compareTo`: UTF-16 code units. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
