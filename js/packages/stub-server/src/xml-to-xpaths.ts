import type { Attr, Document, Element, Node } from "@xmldom/xmldom";
import xpath from "xpath";
import { isBlank } from "./java-values.js";
import { parseXmlDocument } from "./xml-matcher.js";

/**
 * A port of the JVM's `XmlToXPathsConverter`: an XML request body becomes one `matchesXPath`
 * equality per text node and attribute, with the JVM's XPath shapes (`/a/b[2]/text()`,
 * `/a/@id`, `*[local-name()='a' and namespace-uri()='urn']` under a default namespace).
 */

const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const DOCUMENT_TYPE_NODE = 10;
const NOTATION_NODE = 12;

/** An XPath with the value its node holds. */
export interface XPathEquality {
  readonly xPath: string;
  readonly value: string;
}

export class XmlConversionError extends Error {}

export function parseContractXml(text: string): Document {
  const doc = parseXmlDocument(text);
  if (doc === null) throw new XmlConversionError(`Not well-formed XML: ${text}`);
  return doc;
}

function isValueNode(node: Node): boolean {
  const t = node.nodeType;
  return (
    t === TEXT_NODE ||
    t === CDATA_SECTION_NODE ||
    t === COMMENT_NODE ||
    t === DOCUMENT_TYPE_NODE ||
    t === PROCESSING_INSTRUCTION_NODE ||
    t === NOTATION_NODE
  );
}

function childNodes(node: Node): Node[] {
  const out: Node[] = [];
  for (let child = node.firstChild; child !== null; child = child.nextSibling) out.push(child);
  return out;
}

/** Attributes in Xerces' order: sorted by name. */
function attributes(node: Node): Attr[] {
  if (node.nodeType !== ELEMENT_NODE) return [];
  const map = (node as Element).attributes;
  const out: Attr[] = [];
  for (let i = 0; i < map.length; i++) {
    const attr = map.item(i);
    if (attr !== null) out.push(attr);
  }
  return out.sort((a, b) => (a.nodeName < b.nodeName ? -1 : a.nodeName > b.nodeName ? 1 : 0));
}

function withParents(node: Node): Node[] {
  const list: Node[] = [node];
  let current: Node | null =
    node.nodeType === ATTRIBUTE_NODE ? (node as Attr).ownerElement : node.parentNode;
  while (current !== null && current.nodeType !== DOCUMENT_NODE) {
    list.push(current);
    current = current.parentNode;
  }
  return list;
}

/** `XmlToXPathsConverter.mapToMatchers`. */
export function xmlEqualities(doc: Document): XPathEquality[] {
  const valueNodes: Node[][] = [];
  const attrs: Attr[] = [];
  const addValueNodes = (node: Node): void => {
    for (const child of childNodes(node)) {
      attrs.push(...attributes(child));
      if (isValueNode(child) && !isBlank(child.nodeValue)) valueNodes.push(withParents(child));
      else addValueNodes(child);
    }
  };
  addValueNodes(doc);
  for (const attr of attrs) valueNodes.push(withParents(attr));

  const counters: { names: string; counter: number }[] = [];
  const result: XPathEquality[] = [];
  for (const nodes of valueNodes) {
    const names = nodes
      .slice(1)
      .map((n) => n.nodeName)
      .join("\u0000");
    let counter = counters.find((c) => c.names === names);
    if (counter === undefined) {
      counter = { names, counter: 1 };
      counters.push(counter);
    } else counter.counter++;
    const first = nodes[0] as Node;
    if (first.nodeType === ATTRIBUTE_NODE && first.nodeName === "xmlns") continue;
    result.push({
      xPath: buildXPath([...nodes].reverse(), counter.counter),
      value: first.nodeValue ?? "",
    });
  }
  return result;
}

function defaultNamespaceOn(node: Node): string | null {
  if (node.nodeType !== ELEMENT_NODE) return null;
  const attr = (node as Element).getAttributeNode("xmlns");
  return attr === null ? null : attr.value;
}

function buildXPath(nodes: readonly Node[], index: number): string {
  const buffer: string[] = ["", "/"];
  for (const node of nodes.slice(0, -1)) {
    const name = node.nodeName;
    if (name.includes(":")) {
      buffer.push(name, "/");
      continue;
    }
    const own = defaultNamespaceOn(node);
    let inherited: string | null = null;
    for (let p = node.parentNode; p !== null && inherited === null; p = p.parentNode) {
      inherited = defaultNamespaceOn(p);
    }
    if (own !== null) {
      buffer.push(
        `*[local-name()='${name}'${own.trim() !== "" ? ` and namespace-uri()='${own}'` : ""}]`,
        "/",
      );
    } else if (inherited !== null) {
      buffer.push(`*[local-name()='${name}']`, "/");
    } else {
      buffer.push(name, "/");
    }
  }
  const closing = nodes[nodes.length - 1] as Node;
  if (closing.nodeType === ATTRIBUTE_NODE) {
    // The JVM computes an index here and drops it.
    const name = closing.nodeName;
    buffer.push(name.startsWith("xmlns:") ? `namespace::${name.slice(6)}` : `@${name}`);
  } else {
    if (index !== 1) {
      if (buffer[buffer.length - 1] === "/") buffer.pop();
      buffer.push(`[${index}]`, "/");
    }
    buffer.push("text()");
  }
  return buffer.filter((part, i) => !(i === buffer.length - 1 && part === "/")).join("");
}

/** `DOMNamespaceContext`: every `xmlns:` prefix, the deepest declaration first. */
function namespaces(doc: Document): Record<string, string> {
  const map: Record<string, string> = {};
  const visit = (node: Node): void => {
    for (const child of childNodes(node)) if (child.nodeType === ELEMENT_NODE) visit(child);
    for (const attr of attributes(node)) {
      const local = attr.localName;
      if (attr.prefix === "xmlns" && local !== null && !(local in map)) map[local] = attr.value;
    }
  };
  if (doc.documentElement !== null) visit(doc.documentElement);
  return map;
}

/** `XmlToXPathsConverter.removeMatchingXPaths`: drops the text the body matchers cover. */
export function removeMatchingXPaths(doc: Document, paths: readonly string[]): void {
  const root = doc.documentElement;
  if (root === null) return;
  const ns = namespaces(doc);
  for (const path of paths) {
    let nodes: unknown;
    try {
      nodes = xpath.useNamespaces(ns)(path, root as unknown as globalThis.Node);
    } catch (err: unknown) {
      throw new XmlConversionError(`Invalid XPath [${path}]: ${String(err)}`);
    }
    if (!Array.isArray(nodes)) continue;
    for (const node of nodes as Node[]) removeNode(node);
  }
  normalize(doc);
}

function removeNode(node: Node | null): void {
  if (node === null) return;
  if (isValueNode(node)) node.parentNode?.removeChild(node);
  else removeNode(node.nodeType === ATTRIBUTE_NODE ? null : node.parentNode);
}

/** `Document.normalizeDocument()`: merges adjacent text nodes and drops empty ones. */
function normalize(node: Node): void {
  for (let child = node.firstChild; child !== null;) {
    const next: Node | null = child.nextSibling;
    if (child.nodeType === TEXT_NODE) {
      if (next !== null && next.nodeType === TEXT_NODE) {
        (child as unknown as { appendData(d: string): void }).appendData(next.nodeValue ?? "");
        node.removeChild(next);
        continue;
      }
      if ((child.nodeValue ?? "") === "") {
        node.removeChild(child);
        child = next;
        continue;
      }
    } else normalize(child);
    child = next;
  }
}

/** `XPath.evaluate(path, documentElement)` as a string (`retrieveValueFromBody`). */
export function xPathString(doc: Document, path: string): string {
  const root = doc.documentElement;
  if (root === null) return "";
  try {
    return String(
      xpath.useNamespaces(namespaces(doc))(
        `string(${path})`,
        root as unknown as globalThis.Node,
        true,
      ),
    );
  } catch (err: unknown) {
    throw new XmlConversionError(`Invalid XPath [${path}]: ${String(err)}`);
  }
}
