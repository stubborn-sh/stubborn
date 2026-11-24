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

/**
 * xpath 0.0.34 dedupes node-set insertions with a linear scan, which makes every wide node set
 * (`//b`, `/a/b` over 250k siblings) quadratic: 16 s on a 1 MB body. Same semantics, with a Set.
 * Its only other writer of the node array is the constructor.
 */
const XNodeSetPrototype = (
  xpath as unknown as {
    XNodeSet: {
      prototype: { add(n: unknown): void; nodes: unknown[]; size: number; tree: unknown };
    };
  }
).XNodeSet.prototype;
const nodeSetMembers = new WeakMap<object, Set<unknown>>();
XNodeSetPrototype.add = function (this: typeof XNodeSetPrototype, n: unknown): void {
  let members = nodeSetMembers.get(this);
  if (members === undefined) {
    members = new Set(this.nodes);
    nodeSetMembers.set(this, members);
  }
  if (members.has(n)) return;
  members.add(n);
  this.tree = null;
  this.nodes.push(n);
  this.size += 1;
};

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
    if (doc.documentElement === null) return { doc: null, unboundPrefix: false };
    // Only comments, processing instructions and XML whitespace may surround the root.
    for (let child = doc.firstChild; child !== null; child = child.nextSibling) {
      const type = child.nodeType;
      if (type === TEXT_NODE && /^[ \t\r\n]*$/.test(child.nodeValue ?? "")) continue;
      if (
        type !== ELEMENT_NODE &&
        type !== PROCESSING_INSTRUCTION_NODE &&
        type !== COMMENT_NODE &&
        type !== 10
      ) {
        return { doc: null, unboundPrefix: false };
      }
    }
    return { doc };
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
/**
 * How strictly namespaces are checked: `"none"` for WireMock's namespace-unaware XPath parse,
 * `"xpath"` for its namespace-aware re-parse (xPathNamespaces), `"equality"` for equalToXml.
 */
type NamespaceChecks = "none" | "xpath" | "equality";

function parseDocument(text: string, checks: NamespaceChecks): Document | null {
  const allowUnboundPrefixes = checks === "none";
  if (text.trim() === "" || !isWellFormedText(text, checks)) return null;
  // xmldom drops empty CDATA sections, which XPath sees as text nodes: mark them, and restore
  // them as empty when preparing the view.
  const source = text.replaceAll("<![CDATA[]]>", `<![CDATA[${EMPTY_CDATA}]]>`);
  const first = parseOnce(source);
  if (first.doc !== null || !allowUnboundPrefixes || !first.unboundPrefix) return first.doc;
  const declared = declareUnboundPrefixes(source);
  return declared === null ? null : parseOnce(declared).doc;
}

/**
 * Marks an empty CDATA section, which xmldom would otherwise drop. xmldom validates CDATA
 * content, so the marker must be valid XML: a Private Use Area sequence no real CDATA section
 * consists of.
 */
const EMPTY_CDATA = "\uE000\uF8FF\uE001";

/**
 * Checks xmldom does not make: characters outside the XML `Char` production and references to
 * them, a bare `&`, `]]>` in character data, internal DTD subsets, anything but XML whitespace,
 * comments and processing instructions around the root element (xmldom silently drops it), and
 * — for a namespace-aware parse — reserved namespace bindings and two attributes with the same
 * expanded name (xmldom silently keeps one).
 */
function isWellFormedText(text: string, checks: NamespaceChecks): boolean {
  const scopes: Map<string, string>[] = [new Map([["xml", XML_URI]])];
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(i + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff) || depth === 0) return false;
      i += 2;
      continue;
    }
    if (!isXmlChar(code)) return false;
    const ch = text.charAt(i);
    if (ch === "<") {
      if (depth === 0 && text.startsWith("<![CDATA[", i)) return false; // CDATA outside the root
      const skip = skipMarkup(text, i);
      if (skip === -1) return false;
      if (skip > i) {
        i = skip;
        continue;
      }
      const end = tagEnd(text, i);
      if (end === -1 || !allXmlChars(text, i, end)) return false;
      const tag = text.slice(i, end + 1);
      if (tag.startsWith("</")) {
        depth--;
        scopes.pop();
        if (depth < 0) return false;
      } else {
        if (/\/\s+>$|\/[^>]/.test(tag.slice(1).replace(/("[^"]*"|'[^']*')/g, ""))) return false; // "<a/ >"
        if (!checkStartTag(tag, scopes, checks)) return false;
        if (!tag.endsWith("/>")) depth++;
        else scopes.pop();
      }
      if (!checkReferences(tag)) return false;
      i = end + 1;
      continue;
    }
    if (depth === 0 && !/[ \t\r\n]/.test(ch)) return false; // only XML whitespace outside the root
    if (ch === "]" && text.startsWith("]]>", i)) return false;
    if (ch === "&") {
      const length = referenceLength(text, i);
      if (length === -1) return false;
      i += length;
      continue;
    }
    i++;
  }
  return true;
}

/** Index of the ">" closing the tag that starts at `at` (quotes respected); -1 if none. */
function tagEnd(text: string, at: number): number {
  let quote = "";
  for (let i = at + 1; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quote !== "") {
      if (ch === quote) quote = "";
      else if (ch === "<") return -1;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ">") return i;
    else if (ch === "<") return -1;
  }
  return -1;
}

function checkReferences(tag: string): boolean {
  for (let i = tag.indexOf("&"); i !== -1; i = tag.indexOf("&", i + 1)) {
    if (referenceLength(tag, i) === -1) return false;
  }
  return true;
}

/** Length of the entity or character reference at `at`; -1 when it is not a valid one. */
function referenceLength(text: string, at: number): number {
  const ref = /^&(?:#([0-9]+)|#x([0-9a-fA-F]+)|([A-Za-z_:][\w.:-]*));/.exec(
    text.slice(at, at + 256),
  );
  if (ref === null) return -1;
  if (ref[1] !== undefined || ref[2] !== undefined) {
    const value =
      ref[1] !== undefined ? Number.parseInt(ref[1], 10) : Number.parseInt(ref[2] ?? "", 16);
    if (!isXmlCodePoint(value)) return -1;
  }
  return ref[0].length;
}

/**
 * Push the start tag's namespace scope and, in a namespace-aware parse, reject what Xerces
 * rejects there: binding xmlns, binding xml to another namespace, binding a prefix (or the
 * default namespace) to the xml or xmlns namespace, and two attributes with one expanded name.
 */
function checkStartTag(
  tag: string,
  scopes: Map<string, string>[],
  checks: NamespaceChecks,
): boolean {
  const namespaceAware = checks !== "none";
  const scope = new Map(scopes[scopes.length - 1]);
  const attributes: { readonly name: string; readonly value: string }[] = [];
  for (const m of tag.matchAll(/\s([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attributes.push({ name: m[1] ?? "", value: m[3] ?? m[4] ?? "" });
  }
  for (const { name, value } of attributes) {
    if (name !== "xmlns" && !name.startsWith("xmlns:")) continue;
    const prefix = name === "xmlns" ? "" : name.slice(6);
    if (namespaceAware) {
      // Binding anything to the xml or xmlns namespace is refused by both namespace-aware
      // parses; redeclaring the xml / xmlns prefixes only by equalToXml's.
      if (prefix !== "xml" && (value === XML_URI || value === XMLNS_URI)) return false;
      if (
        checks === "equality" &&
        (prefix === "xmlns" || (prefix === "xml" && value !== XML_URI))
      ) {
        return false;
      }
    }
    scope.set(prefix, value);
  }
  scopes.push(scope);
  if (!namespaceAware) return true;
  const names = new Set<string>();
  for (const { name } of attributes) {
    if (name === "xmlns" || name.startsWith("xmlns:")) continue;
    const colon = name.indexOf(":");
    const uri = colon === -1 ? "" : (scope.get(name.slice(0, colon)) ?? `?${name.slice(0, colon)}`);
    const expanded = `{${uri}}${colon === -1 ? name : name.slice(colon + 1)}`;
    if (names.has(expanded)) return false;
    names.add(expanded);
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
    const end = tagEnd(text, at);
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
  /** The real child list of each container (XPath sees adjacent text merged). */
  readonly children: WeakMap<Node, readonly Node[]>;
  /** The real value of a text node that XPath sees merged with the text after it. */
  readonly ownValue: WeakMap<Node, string>;
}

function childrenOf(state: ViewState, node: Node): readonly Node[] {
  return state.children.get(node) ?? [];
}

function ownValue(state: ViewState, node: Node): string {
  return state.ownValue.get(node) ?? node.nodeValue ?? "";
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
  const doc = parseDocument(text, namespaceAware ? "xpath" : "none");
  if (doc === null) return null;
  const state: ViewState = {
    doc,
    declarations: new WeakMap(),
    children: new WeakMap(),
    ownValue: new WeakMap(),
  };
  if (!prepareView(state, namespaceAware)) return null;
  const view: XPathDocument = { namespaceAware };
  views.set(view, state);
  return view;
}

/**
 * One iterative pass over the document: enforces the JDK limits; assigns document order with an
 * O(1) `compareDocumentPosition` (the xpath library sorts node sets with it, and xmldom's is
 * linear, which made wide documents quadratic); hides namespace declarations from the attribute
 * axis; makes the view namespace-unaware if asked; and disables `id()` (no DTD, so WireMock finds
 * no ID attributes).
 */
function prepareView(state: ViewState, namespaceAware: boolean): boolean {
  const { doc } = state;
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

  // xmldom keeps the XML declaration as a processing instruction; XPath does not see it.
  for (let child = doc.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === PROCESSING_INSTRUCTION_NODE && child.nodeName.toLowerCase() === "xml") {
      doc.removeChild(child);
      break;
    }
  }
  // Xerces keeps no text outside the root element (xmldom keeps the whitespace around it).
  for (let child = doc.firstChild; child !== null;) {
    const next = child.nextSibling;
    if (child.nodeType === TEXT_NODE) doc.removeChild(child);
    child = next;
  }
  tag(doc);
  define(doc, "getElementById", () => null);
  const stack: { readonly node: Node; readonly depth: number }[] = [{ node: doc, depth: 0 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: Node; depth: number };
    if (node !== doc) tag(node);
    if (node.nodeType === ELEMENT_NODE && !prepareElement(node as Element, depth)) return false;
    if (node.nodeType !== ELEMENT_NODE && node !== doc) continue;

    const children: Node[] = [];
    for (let child = node.firstChild; child !== null; child = child.nextSibling)
      children.push(child);
    state.children.set(node, children);
    mergeTextRuns(node, children);
    for (let i = children.length - 1; i >= 0; i--)
      stack.push({ node: children[i] as Node, depth: depth + 1 });
  }
  return true;

  function prepareElement(element: Element, depth: number): boolean {
    if (depth > MAX_ELEMENT_DEPTH || element.nodeName.length > MAX_NAME_LENGTH) return false;
    const all = element.attributes;
    if (all.length > MAX_ATTRIBUTES_PER_ELEMENT) return false;
    const kept: Attr[] = [];
    const declared: Attr[] = [];
    const names = new Set<string>();
    for (let i = 0; i < all.length; i++) {
      const attr = all.item(i);
      if (attr === null) continue;
      if (attr.nodeName.length > MAX_NAME_LENGTH) return false;
      if (isNamespaceDeclaration(attr)) {
        // Binding a prefix to the xmlns namespace itself is a namespace error.
        if (namespaceAware && attr.nodeName !== "xmlns" && attr.value === XMLNS_URI) return false;
        declared.push(attr);
        continue;
      }
      if (namespaceAware) {
        // p:b and q:b with p and q bound to one URI are the same attribute twice.
        const name = `{${attr.namespaceURI ?? ""}}${attr.localName ?? attr.nodeName}`;
        if (names.has(name)) return false;
        names.add(name);
      }
      if (!namespaceAware) define(attr, "namespaceURI", null);
      kept.push(attr);
    }
    // The JDK DOM keeps attributes sorted by name (UTF-16 order): the attribute axis, positions
    // and rendering all follow that order, not the document's.
    const byName = (a: Attr, b: Attr): number =>
      a.nodeName < b.nodeName ? -1 : a.nodeName > b.nodeName ? 1 : 0;
    kept.sort(byName);
    declared.sort(byName);
    for (const attr of kept) tag(attr);
    if (declared.length > 0) state.declarations.set(element, declared);
    if (declared.length > 0 || kept.length > 1) define(element, "attributes", attributeList(kept));
    if (!namespaceAware) define(element, "namespaceURI", null);
    return true;
  }

  /**
   * JAXP sees a run of adjacent Text/CDATA nodes as one XPath text node, represented by the first
   * DOM node and valued as the whole run. Hide the rest of the run from sibling navigation.
   */
  function mergeTextRuns(parent: Node, children: readonly Node[]): void {
    for (const child of children) {
      if (child.nodeType === CDATA_SECTION_NODE && child.nodeValue === EMPTY_CDATA) {
        define(child, "nodeValue", "");
      }
    }
    const isText = (n: Node | undefined): boolean =>
      n !== undefined && (n.nodeType === TEXT_NODE || n.nodeType === CDATA_SECTION_NODE);
    for (let i = 0; i < children.length; i++) {
      if (!isText(children[i]) || !isText(children[i + 1])) continue;
      const first = children[i] as Node;
      let value = first.nodeValue ?? "";
      let j = i + 1;
      while (isText(children[j])) {
        value += (children[j] as Node).nodeValue ?? "";
        j++;
      }
      state.ownValue.set(first, first.nodeValue ?? "");
      define(first, "nodeValue", value);
      const after = children[j] ?? null;
      define(first, "nextSibling", after);
      if (after !== null) define(after, "previousSibling", first);
      else define(parent, "lastChild", first);
      i = j - 1;
    }
  }
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
  if (state === undefined) return "";
  switch (node.nodeType) {
    case TEXT_NODE:
      return ownValue(state, node); // that DOM node's own text, not the merged XPath value
    case ATTRIBUTE_NODE:
      return node.nodeValue ?? "";
    case ELEMENT_NODE:
    case DOCUMENT_NODE:
      return `${render(view, state, node)}\n`;
    case COMMENT_NODE:
      return `[#comment: ${node.nodeValue ?? ""}]`;
    case CDATA_SECTION_NODE:
      return `[#cdata-section: ${ownValue(state, node)}]`;
    case PROCESSING_INSTRUCTION_NODE:
      return `[${node.nodeName}: ${node.nodeValue ?? ""}]`;
    default:
      return node.nodeValue ?? "";
  }
}

/** Text of an XPath value result, as WireMock's `XmlPrimitiveNode.toString()`. */
export function valueText(value: string | number | boolean): string {
  return typeof value === "number" ? formatJavaNumber(value) : String(value);
}

/**
 * Java `NumberFormat.getInstance()` (en-US): thousands grouping and at most three fraction
 * digits, rounded HALF_EVEN. Like Java's `DigitList`, the digits are the shortest representation
 * of the double, and only a tie consults its exact binary value (2.0005 is stored as
 * 2.000500000000000078… and rounds up; Intl would round the tie down).
 */
function formatJavaNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "-∞";
  const negative = value < 0 || Object.is(value, -0);
  const magnitude = Math.abs(value);
  const [intPart, fraction] = plainDigits(magnitude);
  let digits = BigInt(intPart + fraction.slice(0, 3).padEnd(3, "0"));
  const rest = fraction.slice(3);
  const first = rest.charAt(0);
  let roundUp = first > "5" || (first === "5" && rest.length > 1);
  if (first === "5" && rest.length === 1) {
    // A tie in the shortest digits: the exact value decides, and an exact tie rounds to even.
    // toFixed is exact up to 100 digits; doubles with a fraction are below 2^53.
    const beyond = magnitude.toFixed(100).split(".")[1]?.slice(4).replace(/0+$/, "") ?? "";
    const exactFirst = magnitude.toFixed(100).split(".")[1]?.charAt(3) ?? "0";
    roundUp = exactFirst > "5" || (exactFirst === "5" && (beyond !== "" || digits % 2n === 1n));
  }
  if (roundUp) digits += 1n;
  const text = digits.toString().padStart(4, "0");
  const integer = text.slice(0, -3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = text.slice(-3).replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${decimals === "" ? "" : `.${decimals}`}`;
}

/** `FloatingDecimal.insignificantDigitsNumber`, indexed by excess binary exponent. */
const INSIGNIFICANT_DIGITS = [
  0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6,
];

/**
 * The decimal digits Java's `FloatingDecimal` produces for a non-negative double, as integer and
 * fraction digits: the shortest representation, except that an integer below 2^63 takes its
 * exact value with only the digits below the double's precision rounded off (2^60 is
 * 1152921504606846980, not 1152921504606847000).
 */
function plainDigits(magnitude: number): [string, string] {
  if (Number.isInteger(magnitude) && magnitude >= 2 ** 53 && magnitude < 2 ** 63) {
    const exact = BigInt(magnitude);
    const excess = exact.toString(2).length - 1 - 54;
    const insignificant = excess > 1 ? (INSIGNIFICANT_DIGITS[excess] ?? 0) : 0;
    if (insignificant === 0) return [exact.toString(), ""];
    const scale = 10n ** BigInt(insignificant);
    let kept = exact / scale;
    if (exact % scale >= scale / 2n) kept += 1n;
    return [(kept * scale).toString(), ""];
  }
  const [mantissa = "0", exponentText = "0"] = magnitude.toExponential().split("e");
  const significand = mantissa.replace(".", "");
  const point = Number(exponentText) + 1; // digits before the decimal point
  if (point <= 0) return ["0", "0".repeat(-point) + significand];
  if (point >= significand.length)
    return [significand + "0".repeat(point - significand.length), ""];
  return [significand.slice(0, point), significand.slice(point)];
}

function render(view: XPathDocument, state: ViewState, node: Node): string {
  if (node.nodeType !== DOCUMENT_NODE) return renderElement(view, state, node as Element);
  let out = "";
  for (const child of childrenOf(state, node)) {
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
 * Emulates the JDK serializer (`ToStream`, `indent=yes`, `indent-number=2`) as WireMock drives
 * it through DOM2SAX, event for event:
 * - character data is buffered; the buffer is flushed (and counted as a child) before a child
 *   element, comment or processing instruction and at the end tag, and is indented — dropping
 *   its leading newlines — only when the element already has more than one child;
 * - a CDATA section flushes the buffer without counting it, and is itself indented only when
 *   the element already has more than one child; an empty one writes nothing;
 * - child elements, comments and processing instructions are always indented;
 * - an end tag is indented when the element had more than one child or the last output was not
 *   character data; an element with nothing written inside it is written as `<x/>`.
 * Iterative, so a deep body cannot exhaust the stack.
 */
function renderElement(view: XPathDocument, state: ViewState, root: Element): string {
  interface Frame {
    readonly element: Element;
    readonly level: number;
    readonly children: readonly Node[];
    index: number;
    childCount: number;
    /** The start tag is written but not yet closed with ">" (nothing written inside yet). */
    startTagOpen: boolean;
    readonly scope: ReadonlyMap<string, string>;
  }
  let out = "";
  let previousWasText = false;
  let buffer: string[] = [];
  const indent = (level: number): string => `\n${"  ".repeat(level)}`;
  const closeStartTag = (frame: Frame): void => {
    if (frame.startTagOpen) {
      out += ">";
      frame.startTagOpen = false;
    }
  };
  const flush = (frame: Frame, countAsChild: boolean): void => {
    if (buffer.length === 0) return;
    if (countAsChild) frame.childCount++;
    let skipNewlines = false;
    if (frame.childCount > 1) {
      out += indent(frame.level + 1);
      skipNewlines = true;
    }
    for (const chunk of buffer) {
      let text = chunk;
      if (skipNewlines) {
        text = text.replace(/^\n+/, "");
        if (text === "") continue; // all newlines: keep skipping into the next chunk
        skipNewlines = false;
      }
      out += escapeText(text);
      previousWasText = true;
    }
    buffer = [];
  };
  const open = (element: Element, level: number, scope: ReadonlyMap<string, string>): Frame => {
    const start = startTag(view, state, element, scope, level === 0);
    out += start.tag;
    previousWasText = false;
    return {
      element,
      level,
      children: childrenOf(state, element),
      index: 0,
      childCount: 0,
      startTagOpen: true,
      scope: start.scope,
    };
  };

  const stack: Frame[] = [open(root, 0, new Map())];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1] as Frame;
    const child = frame.children[frame.index];
    if (child === undefined) {
      flush(frame, true);
      if (frame.startTagOpen) out += "/>";
      else {
        if (frame.childCount > 1 || !previousWasText) out += indent(frame.level);
        out += `</${frame.element.nodeName}>`;
      }
      previousWasText = false;
      stack.pop();
      continue;
    }
    frame.index++;
    const value = ownValue(state, child);
    switch (child.nodeType) {
      case TEXT_NODE:
        if (value !== "") {
          closeStartTag(frame);
          buffer.push(value);
        }
        break;
      case CDATA_SECTION_NODE:
        flush(frame, false);
        if (value === "") break; // an empty CDATA section writes nothing
        closeStartTag(frame);
        if (frame.childCount > 1) out += indent(frame.level + 1);
        out += `<![CDATA[${value}]]>`;
        previousWasText = true;
        break;
      case COMMENT_NODE:
      case PROCESSING_INSTRUCTION_NODE:
        frame.childCount++;
        flush(frame, true);
        closeStartTag(frame);
        out += indent(frame.level + 1);
        out += child.nodeType === COMMENT_NODE ? `<!--${value}-->` : processingInstruction(child);
        break;
      case ELEMENT_NODE:
        frame.childCount++;
        flush(frame, true);
        closeStartTag(frame);
        out += indent(frame.level + 1);
        stack.push(open(child as Element, frame.level + 1, frame.scope));
        break;
      default:
        break;
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
  renderRoot: boolean,
): { readonly tag: string; readonly scope: ReadonlyMap<string, string> } {
  // Declarations come in name order, except that the rendered element itself, when prefixed,
  // declares its own prefix first.
  const colon = element.nodeName.indexOf(":");
  const ownPrefix = colon === -1 ? "" : element.nodeName.slice(0, colon);
  const declarations = (state.declarations.get(element) ?? []).filter(
    (a) => !a.value.startsWith(UNBOUND_PREFIX_URI),
  );
  const ownFirst =
    ownPrefix !== "" && renderRoot && declarations.some((d) => declaredPrefix(d) === ownPrefix);
  const own = [...declarations].sort((a, b) =>
    ownFirst
      ? Number(declaredPrefix(b) === ownPrefix) - Number(declaredPrefix(a) === ownPrefix)
      : 0,
  );
  const regular = attributesOfView(element);
  const attribute = (name: string, value: string): string => ` ${name}="${escapeAttribute(value)}"`;
  let tag = `<${element.nodeName}`;
  if (!view.namespaceAware) {
    const declared = new Map(scope);
    const written: Attr[] = [];
    for (const decl of own) {
      const prefix = declaredPrefix(decl);
      // A binding already in effect in the rendered output (xmlns="" at its root) is not repeated.
      if ((declared.get(prefix) ?? (prefix === "" ? "" : undefined)) === decl.value) continue;
      declared.set(prefix, decl.value);
      written.push(decl);
    }
    for (const attr of regular) {
      const colon = attr.nodeName.indexOf(":");
      const prefix = colon === -1 ? "" : attr.nodeName.slice(0, colon);
      // The JDK transformer refuses an attribute prefix not declared within the rendered
      // subtree, so WireMock's match fails.
      if (prefix !== "" && prefix !== "xml" && !declared.has(prefix)) {
        throw new Error(`Namespace for prefix '${prefix}' has not been declared.`);
      }
    }
    for (const decl of written) tag += attribute(decl.nodeName, decl.value);
    for (const attr of regular) tag += attribute(attr.nodeName, attr.value);
    return { tag, scope: declared };
  }
  const inner = new Map(scope);
  const bind = (prefix: string, uri: string): void => {
    tag += attribute(prefix === "" ? "xmlns" : `xmlns:${prefix}`, uri);
    inner.set(prefix, uri);
  };
  // A declaration already in effect, in the output or from the element's ancestors in the
  // document, is not repeated; the element's own namespace is bound again if the output needs it
  // — after the attributes, or first when there are none.
  const kept = own.filter((decl) => {
    const prefix = declaredPrefix(decl);
    if ((inner.get(prefix) ?? (prefix === "" ? "" : undefined)) === decl.value) return false;
    return inheritedBinding(state, element, prefix) !== decl.value;
  });
  const elementPrefix = element.prefix ?? "";
  const elementUri = element.namespaceURI ?? "";
  const boundAfterDeclarations = (): string =>
    kept.find((d) => declaredPrefix(d) === elementPrefix)?.value ?? inner.get(elementPrefix) ?? "";
  // A declaration of the element's own prefix that its ancestors already make is dropped like
  // the others, unless one of its attributes uses that prefix too.
  const ownDeclaration = declarations.find((d) => declaredPrefix(d) === ownPrefix);
  const declaresFirst =
    ownFirst &&
    (inheritedBinding(state, element, ownPrefix) !== ownDeclaration?.value ||
      regular.some((a) => (a.prefix ?? "") === ownPrefix));
  if (
    (declaresFirst || regular.length === 0) &&
    (declaresFirst ? inner.get(elementPrefix) : boundAfterDeclarations()) !== elementUri
  ) {
    bind(elementPrefix, elementUri);
  }
  for (const decl of kept) {
    if (inner.get(declaredPrefix(decl)) !== decl.value) bind(declaredPrefix(decl), decl.value);
  }
  for (const attr of regular) {
    const prefix = attr.prefix ?? "";
    const uri = attr.namespaceURI;
    if (prefix !== "" && prefix !== "xml" && uri !== null && inner.get(prefix) !== uri)
      bind(prefix, uri);
  }
  for (const attr of regular) tag += attribute(attr.nodeName, attr.value);
  if ((inner.get(elementPrefix) ?? "") !== elementUri) bind(elementPrefix, elementUri);
  return { tag, scope: inner };
}

function declaredPrefix(decl: Attr): string {
  return decl.nodeName === "xmlns" ? "" : decl.nodeName.slice(6);
}

/** The URI a prefix is bound to by the element's ancestors in the document. */
function inheritedBinding(state: ViewState, element: Element, prefix: string): string | undefined {
  for (let node = element.parentNode; node !== null; node = node.parentNode) {
    if (node.nodeType !== ELEMENT_NODE) break;
    const decl = state.declarations
      .get(node)
      ?.find((a) => declaredPrefix(a) === prefix && !a.value.startsWith(UNBOUND_PREFIX_URI));
    if (decl !== undefined) return decl.value;
  }
  return prefix === "" ? "" : undefined;
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
  return escapeWith(text, TEXT_ESCAPES);
}

function escapeAttribute(text: string): string {
  // In attribute values the JDK serializer writes DEL and C1 controls as they are.
  return escapeWith(text, ATTRIBUTE_ESCAPES, false);
}

/** The JDK serializer writes astral characters (and, in text, DEL and C1 controls) as references. */
function escapeWith(
  text: string,
  escapes: Readonly<Record<string, string>>,
  referenceControls = true,
): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const named = escapes[ch];
    if (named !== undefined) out += named;
    else if ((referenceControls && cp >= 0x7f && cp <= 0x9f) || cp > 0xffff) out += `&#${cp};`;
    else out += ch;
  }
  return out;
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
  const expectedDoc = parseDocument(expectedText, "equality");
  if (expectedDoc === null) return { unsupported: "expected value is not well-formed XML" };
  // WireMock never matches an expected document with a processing instruction outside the root
  // element (not even an identical body); report it rather than match differently.
  for (const child of Array.from(expectedDoc.childNodes)) {
    if (child.nodeType === PROCESSING_INSTRUCTION_NODE && child.nodeName.toLowerCase() !== "xml") {
      return { unsupported: "processing instruction outside the root element" };
    }
  }

  let placeholderPattern: RegExp | undefined;
  if (options.enablePlaceholders) {
    try {
      const open = options.placeholderOpeningDelimiterRegex;
      const close = options.placeholderClosingDelimiterRegex;
      // XMLUnit reads the keyword and arguments by group number: a capturing group in a
      // delimiter shifts them, and WireMock never matches.
      if (/(^|[^\\])\((?!\?)/.test(open + close)) {
        return { unsupported: "placeholder delimiters with capturing groups" };
      }
      // The delimiters are Java regexes, and XMLUnit compiles the whole pattern with Java.
      placeholderPattern =
        javaRegex(
          `\\s*${open}\\s*xmlunit\\.(?<keyword>\\w+)(?:\\((?<args>[^)]*)\\))?\\s*${close}\\s*`,
          { mode: "full", dotAll: false },
        ) ?? undefined;
    } catch {
      placeholderPattern = undefined;
    }
    if (placeholderPattern === undefined) {
      return { unsupported: "placeholder delimiters cannot be translated from Java regexes" };
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
      const name = match.groups?.["keyword"] ?? "";
      const rawArgs = match.groups?.["args"];
      const args = rawArgs === undefined ? [] : rawArgs.split(",");
      // ignore and isNumber take no arguments; XMLUnit rejects any, even empty parentheses.
      if (name === "ignore")
        result = match.groups?.["args"] === undefined ? { kind: "ignore" } : { kind: "never" };
      else if (name === "isNumber")
        result = match.groups?.["args"] === undefined ? { kind: "isNumber" } : { kind: "never" };
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
      const actualDoc = parseDocument(actualText, "equality");
      if (actualDoc === null) return false;
      const actual = comparable(actualDoc);
      // At document level the root's position relative to processing instructions counts.
      const rootIndex = (nodes: readonly CNode[]): number =>
        nodes.findIndex((n) => n.kind === "element");
      return rootIndex(expected) === rootIndex(actual) && childrenEqual(expected, actual, context);
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
          const value = child.nodeValue === EMPTY_CDATA ? "" : javaTrim(child.nodeValue ?? "");
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
  const names = new Set<string>();
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes.item(i);
    if (attr === null) continue;
    if (isNamespaceDeclaration(attr)) {
      if (attr.nodeName !== "xmlns" && attr.value === XMLNS_URI) throw new Error("namespace error");
      continue;
    }
    const name = `{${attr.namespaceURI ?? ""}}${attr.localName ?? attr.nodeName}`;
    if (names.has(name)) throw new Error("duplicate attribute");
    names.add(name);
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

  // XMLUnit's DefaultNodeMatcher: same local name, searching after the last match and wrapping
  // around; the elements left over pair up in order.
  const pairs = new Map<number, number>();
  const used = new Set<number>();
  let last = -1;
  for (const [ci, element] of controlElements.entries()) {
    for (let k = 1; k <= actualElements.length; k++) {
      const ti = (last + k) % actualElements.length;
      const candidate = actualElements[ti];
      // WireMock pairs by local name; a namespace difference is then counted (or not) below.
      if (candidate !== undefined && !used.has(ti) && candidate.local === element.local) {
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
  let missingIgnored = 0;
  for (const attr of expected.attrs) {
    const other = actualAttrs.get(`{${attr.ns ?? ""}}${attr.local}`);
    const placeholder = context.placeholderFor(attr.value);
    if (other === undefined) {
      // ${xmlunit.ignore} accepts a missing attribute.
      if (placeholder?.kind === "ignore") {
        if (!isSchemaLocation(attr)) missingIgnored++;
        continue;
      }
      return false;
    }
    if (attr.ns === XSI_URI && attr.local === "type") {
      if (!qnameEqual(attr.value, expected.dom, other.value, actual.dom)) return false;
    } else if (!valueEqual(javaTrim(attr.value), javaTrim(other.value), placeholder)) {
      return false;
    }
  }
  // XMLUnit compares attribute counts without xsi:schemaLocation / noNamespaceSchemaLocation
  // (those are only compared when expected has them); a missing ${xmlunit.ignore} is forgiven.
  const expectedCount = expected.attrs.filter((a) => !isSchemaLocation(a)).length;
  const actualCount = actual.attrs.filter((a) => !isSchemaLocation(a)).length;
  if (actualCount !== expectedCount && actualCount !== expectedCount - missingIgnored) return false;
  return childrenEqual(expected.children, actual.children, context);
}

function isSchemaLocation(attr: CAttr): boolean {
  return (
    attr.ns === XSI_URI &&
    (attr.local === "schemaLocation" || attr.local === "noNamespaceSchemaLocation")
  );
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
  if (expected.kind === actual.kind) return valueEqual(expected.value, actual.value, placeholder);
  // Text against CDATA: the node type differs, which only a placeholder can forgive — and then
  // only by the placeholder's own verdict, never by the text being equal.
  return placeholder !== null && placeholderAccepts(placeholder, actual.value);
}

function valueEqual(expected: string, actual: string, placeholder: Placeholder | null): boolean {
  // Equal text is no difference, so XMLUnit never consults the placeholder.
  if (expected === actual || placeholder === null) return expected === actual;
  return placeholderAccepts(placeholder, actual);
}

function placeholderAccepts(placeholder: Placeholder, actual: string): boolean {
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
    // xmldom resolves the default namespace for "", not for null.
    const uri = scope.lookupNamespaceURI(prefix ?? "") ?? "";
    return `{${uri}}${colon === -1 ? value : value.slice(colon + 1)}`;
  };
  return resolve(javaTrim(expected), expectedScope) === resolve(javaTrim(actual), actualScope);
}

/** Java `String.compareTo`: UTF-16 code units. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
