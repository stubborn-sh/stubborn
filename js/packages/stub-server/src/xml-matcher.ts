import { DOMParser, XMLSerializer, type Document, type Element, type Node } from "@xmldom/xmldom";
import xpath from "xpath";
import { javaFullMatchRegex } from "./java-regex.js";

/**
 * XML support for WireMock's `matchesXPath` and `equalToXml` body patterns, following WireMock
 * 3.13.2 (which uses JAXP XPath 1.0 and XMLUnit). Everything here is internal: no DOM type leaves
 * this module.
 *
 * Parsing is strict (a malformed document never matches) and never resolves external entities.
 * Internal DOCTYPE entities are not expanded either (WireMock expands them); a body that uses one
 * does not match.
 */

const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;
const XMLNS_URI = "http://www.w3.org/2000/xmlns/";

/** Parse `text` strictly. Returns `null` for anything that is not a well-formed document. */
export function parseXml(text: string): Document | null {
  if (text.trim() === "") return null;
  try {
    return new DOMParser({
      onError: (level: string, message: string) => {
        if (level !== "warning") throw new Error(message);
      },
    }).parseFromString(text, "text/xml");
  } catch {
    return null;
  }
}

/**
 * Copy of `doc` with every namespace removed (elements and attributes keep their local name).
 * WireMock evaluates an XPath without `xPathNamespaces` this way: `/test` matches `<n:test>`.
 */
export function stripNamespaces(doc: Document): Document {
  const root = doc.documentElement;
  const target = new DOMParser().parseFromString("<_/>", "text/xml");
  if (root === null) return target;
  const copy = (source: Node, parent: Node): void => {
    if (source.nodeType === ELEMENT_NODE) {
      const element = source as Element;
      const created = target.createElement(element.localName ?? element.nodeName);
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes.item(i);
        if (attr === null || isNamespaceDeclaration(attr)) continue;
        created.setAttribute(attr.localName ?? attr.nodeName, attr.value);
      }
      for (let child = element.firstChild; child !== null; child = child.nextSibling) {
        copy(child, created);
      }
      parent.appendChild(created);
    } else {
      parent.appendChild(target.importNode(source, true));
    }
  };
  const placeholder = target.documentElement;
  if (placeholder !== null) target.removeChild(placeholder);
  copy(root, target);
  return target;
}

/** Result of an XPath evaluation: selected nodes, or a string/number/boolean value. */
export type XPathOutcome =
  | { readonly kind: "nodes"; readonly nodes: readonly Node[] }
  | { readonly kind: "value"; readonly value: string | number | boolean };

/** Evaluate an XPath 1.0 expression. Throws when the expression is invalid. */
export function evaluateXPath(
  doc: Document,
  expression: string,
  namespaces: Readonly<Record<string, string>> | undefined,
): XPathOutcome {
  const select = namespaces === undefined ? xpath.select : xpath.useNamespaces({ ...namespaces });
  const result = select(expression, doc as unknown as globalThis.Node);
  if (Array.isArray(result)) {
    return { kind: "nodes", nodes: result as unknown as Node[] };
  }
  if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
    return { kind: "value", value: result };
  }
  return { kind: "nodes", nodes: result === null ? [] : [result as unknown as Node] };
}

/**
 * The text WireMock compares a selected node by: the value of a text or attribute node, and the
 * serialized XML (pretty-printed, as JAXP's transformer does) of anything else.
 */
export function nodeText(node: Node): string {
  if (node.nodeType === TEXT_NODE || node.nodeType === ATTRIBUTE_NODE) {
    return node.nodeValue ?? "";
  }
  if (node.nodeType === ELEMENT_NODE) {
    return `${prettyElement(node as Element, 0)}\n`;
  }
  return new XMLSerializer().serializeToString(node);
}

/** Text of an XPath value result: numbers without a trailing `.0`, booleans as `true`/`false`. */
export function valueText(value: string | number | boolean): string {
  return String(value);
}

function prettyElement(element: Element, depth: number): string {
  const serializer = new XMLSerializer();
  const indent = "  ".repeat(depth);
  const children: Node[] = [];
  for (let child = element.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === TEXT_NODE && (child.nodeValue ?? "").trim() === "") continue;
    children.push(child);
  }
  const shallow = element.cloneNode(false) as Element;
  const open = serializer.serializeToString(shallow).replace(/\/>$/, ">");
  if (children.length === 0) {
    return `${indent}${open.replace(/>$/, "/>")}`;
  }
  if (children.every((c) => c.nodeType !== ELEMENT_NODE)) {
    const inner = children.map((c) => serializer.serializeToString(c)).join("");
    return `${indent}${open}${inner}</${element.nodeName}>`;
  }
  const lines = children.map((c) =>
    c.nodeType === ELEMENT_NODE
      ? prettyElement(c as Element, depth + 1)
      : `${"  ".repeat(depth + 1)}${serializer.serializeToString(c)}`,
  );
  return `${indent}${open}\n${lines.join("\n")}\n${indent}</${element.nodeName}>`;
}

// --- equalToXml --------------------------------------------------------------------------------

/** `equalToXml` options WireMock accepts. */
export interface XmlEqualityOptions {
  readonly enablePlaceholders: boolean;
  readonly placeholderOpeningDelimiterRegex: string;
  readonly placeholderClosingDelimiterRegex: string;
  readonly ignoreOrderOfSameNode: boolean;
}

/** A placeholder in an expected text or attribute value (XMLUnit `${xmlunit.…}`). */
type Placeholder =
  | { readonly kind: "ignore" }
  | { readonly kind: "isNumber" }
  | { readonly kind: "matchesRegex"; readonly regex: RegExp };

/**
 * Compile an `equalToXml` comparison. Returns the reason it cannot be supported instead of a
 * matcher when the expected document is invalid or uses an unsupported placeholder.
 */
export function compileXmlEquality(
  expectedText: string,
  options: XmlEqualityOptions,
): ((actualText: string) => boolean) | { readonly unsupported: string } {
  const expected = parseXml(expectedText);
  if (expected?.documentElement == null) {
    return { unsupported: "expected value is not well-formed XML" };
  }
  let placeholderPattern: RegExp | undefined;
  if (options.enablePlaceholders) {
    try {
      placeholderPattern = new RegExp(
        `^\\s*${options.placeholderOpeningDelimiterRegex}xmlunit\\.(.*)${options.placeholderClosingDelimiterRegex}\\s*$`,
        "s",
      );
    } catch {
      return { unsupported: "placeholder delimiters are not valid JavaScript regexes" };
    }
  }

  const placeholders = new Map<string, Placeholder>();
  const unknown: string[] = [];
  const placeholderFor = (text: string): Placeholder | undefined => {
    if (placeholderPattern === undefined) return undefined;
    const match = placeholderPattern.exec(text);
    if (match === null) return undefined;
    const body = (match[1] ?? "").trim();
    const cached = placeholders.get(body);
    if (cached !== undefined) return cached;
    let placeholder: Placeholder | undefined;
    if (body === "ignore") placeholder = { kind: "ignore" };
    else if (body === "isNumber") placeholder = { kind: "isNumber" };
    else {
      const regexMatch = /^matchesRegex\((.*)\)$/s.exec(body);
      const regex = regexMatch === null ? null : safeRegex(regexMatch[1] ?? "");
      if (regex !== null) placeholder = { kind: "matchesRegex", regex };
    }
    if (placeholder === undefined) unknown.push(body);
    else placeholders.set(body, placeholder);
    return placeholder;
  };

  // Resolve every placeholder up front so an unsupported one is reported at load time.
  const scan = (node: Node): void => {
    if (node.nodeType === ELEMENT_NODE) {
      const element = node as Element;
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes.item(i);
        if (attr !== null) placeholderFor(attr.value);
      }
    } else if (node.nodeType === TEXT_NODE) {
      placeholderFor(node.nodeValue ?? "");
    }
    for (let child = node.firstChild; child !== null; child = child.nextSibling) scan(child);
  };
  scan(expected.documentElement);
  if (unknown.length > 0) {
    return { unsupported: `unsupported XMLUnit placeholder(s): ${unknown.join(", ")}` };
  }

  const root = expected.documentElement;
  const context: CompareContext = { options, placeholderFor };
  return (actualText) => {
    const actual = parseXml(actualText);
    const actualRoot = actual?.documentElement;
    return actualRoot != null && elementsEqual(root, actualRoot, context);
  };
}

interface CompareContext {
  readonly options: XmlEqualityOptions;
  placeholderFor(text: string): Placeholder | undefined;
}

function elementsEqual(expected: Element, actual: Element, context: CompareContext): boolean {
  if (expected.localName !== actual.localName) return false;
  if ((expected.namespaceURI ?? null) !== (actual.namespaceURI ?? null)) return false;
  if (!attributesEqual(expected, actual, context)) return false;

  const expectedChildren = significantChildren(expected);
  const actualChildren = significantChildren(actual);
  if (expectedChildren.length !== actualChildren.length) return false;

  // Non-element children (text, CDATA, processing instructions) compare in order.
  const expectedOther = expectedChildren.filter((c) => c.nodeType !== ELEMENT_NODE);
  const actualOther = actualChildren.filter((c) => c.nodeType !== ELEMENT_NODE);
  if (expectedOther.length !== actualOther.length) return false;
  for (const [i, node] of expectedOther.entries()) {
    const other = actualOther[i];
    if (other === undefined || !leafEqual(node, other, context)) return false;
  }

  // Elements are paired by name (XMLUnit `byName`): order between different names does not
  // matter; same-name siblings pair in order unless ignoreOrderOfSameNode is set.
  const expectedElements = expectedChildren.filter((c) => c.nodeType === ELEMENT_NODE) as Element[];
  const actualElements = actualChildren.filter((c) => c.nodeType === ELEMENT_NODE) as Element[];
  const used = new Set<number>();
  for (const element of expectedElements) {
    const candidates = actualElements
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate, index }) => !used.has(index) && sameName(element, candidate));
    let chosen = candidates[0];
    if (context.options.ignoreOrderOfSameNode) {
      chosen =
        candidates.find(({ candidate }) => elementsEqual(element, candidate, context)) ?? chosen;
    }
    if (chosen === undefined || !elementsEqual(element, chosen.candidate, context)) return false;
    used.add(chosen.index);
  }
  return true;
}

function sameName(a: Element, b: Element): boolean {
  return a.localName === b.localName && (a.namespaceURI ?? null) === (b.namespaceURI ?? null);
}

function attributesEqual(expected: Element, actual: Element, context: CompareContext): boolean {
  const expectedAttrs = realAttributes(expected);
  const actualAttrs = realAttributes(actual);
  if (expectedAttrs.size !== actualAttrs.size) return false;
  for (const [key, value] of expectedAttrs) {
    const other = actualAttrs.get(key);
    if (other === undefined || !textEqual(value, other, context)) return false;
  }
  return true;
}

function realAttributes(element: Element): Map<string, string> {
  const result = new Map<string, string>();
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes.item(i);
    if (attr === null || isNamespaceDeclaration(attr)) continue;
    result.set(`{${attr.namespaceURI ?? ""}}${attr.localName ?? attr.nodeName}`, attr.value);
  }
  return result;
}

function isNamespaceDeclaration(attr: Node): boolean {
  return (
    attr.namespaceURI === XMLNS_URI ||
    attr.nodeName === "xmlns" ||
    attr.nodeName.startsWith("xmlns:")
  );
}

/** Children that take part in the comparison: comments and whitespace-only text are ignored. */
function significantChildren(element: Element): Node[] {
  const result: Node[] = [];
  for (let child = element.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === COMMENT_NODE) continue;
    if (child.nodeType === TEXT_NODE && (child.nodeValue ?? "").trim() === "") continue;
    result.push(child);
  }
  return result;
}

function leafEqual(expected: Node, actual: Node, context: CompareContext): boolean {
  if (expected.nodeType !== actual.nodeType) return false;
  if (expected.nodeType === PROCESSING_INSTRUCTION_NODE) {
    return (
      expected.nodeName === actual.nodeName &&
      (expected.nodeValue ?? "").trim() === (actual.nodeValue ?? "").trim()
    );
  }
  if (expected.nodeType === TEXT_NODE || expected.nodeType === CDATA_SECTION_NODE) {
    return textEqual(expected.nodeValue ?? "", actual.nodeValue ?? "", context);
  }
  return false;
}

/** Whitespace-normalized text equality (WireMock ignores leading/trailing whitespace). */
function textEqual(expected: string, actual: string, context: CompareContext): boolean {
  const placeholder = context.placeholderFor(expected);
  const value = actual.trim();
  if (placeholder !== undefined) {
    if (placeholder.kind === "ignore") return true;
    if (placeholder.kind === "isNumber") return value !== "" && Number.isFinite(Number(value));
    return placeholder.regex.test(value);
  }
  return expected.trim() === value;
}

function safeRegex(pattern: string): RegExp | null {
  return javaFullMatchRegex(pattern);
}
