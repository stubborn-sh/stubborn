import { describe, it, expect } from "vitest";
import { matchRequest } from "../../src/request-matcher.js";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

type Headers = Record<string, string[]>;

/**
 * `matchesXPath` / `equalToXml` verdicts recorded from WireMock 3.13.2, each mapping loaded on
 * its own (`POST /x` with the given body patterns): `true` means WireMock answered 200, `false`
 * 404. Covers the shapes Stubborn Contract generates (`{ expression: "/a/b/text()", equalTo |
 * matches }`, attributes, positions, wildcards, `equalToXml`) and XPath / XMLUnit edge cases.
 */
const WIREMOCK_VERDICTS: readonly (readonly [
  bodyPatterns: unknown[],
  body: string,
  headers: Headers,
  matches: boolean,
])[] = [
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck type='xtype'>124</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck type='xtype'> 123 </duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test/>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "not xml",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", matches: "[0-9]{3}" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", matches: "[0-9]{3}" } }],
    "<test><duck type='xtype'>12</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/@type", equalTo: "xtype" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/@type", equalTo: "xtype" } }],
    "<test><duck type='y'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/list/elem/text()", equalTo: "b" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/list/elem/text()", equalTo: "b" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>z</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/list/elem[2]/text()", equalTo: "b" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/list/elem[2]/text()", equalTo: "b" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/*/complex/text()", equalTo: "foo" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/missing/text()", absent: true } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/missing/text()", absent: true } }],
    "<test><missing>x</missing></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck", equalTo: "123" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/key", equalTo: "foo" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/key", equalTo: "foo" } }],
    "<test><key>\n  <complex>foo</complex>\n</key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [
      {
        matchesXPath: { expression: "/test/key", equalToXml: "<key><complex>foo</complex></key>" },
      },
    ],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/alpha/text()", contains: "b" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/alpha/text()", doesNotMatch: "[0-9]+" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "count(/test/list/elem)", equalTo: "3" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["text/plain"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    {},
    true,
  ],
  [
    [{ matchesXPath: "/test[duck='123']" }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: "/test[duck='123']" }],
    "<test><duck type='xtype'>1</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: "/test/list/elem" }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: "/test/list/elem" }],
    "<test><list/></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: "count(/test/list/elem) = 3" }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: "count(/test/list/elem) = 3" }],
    "<test/>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: "/test/nothing" }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: "/test/@missing" }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: "/test/duck/text()" }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: "/test/duck/text()" }],
    "<test><duck/></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: "string(/test/duck)" }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: "string(/test/duck)" }],
    "<test><duck/></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    '<?xml version="1.0" encoding="UTF-8"?>\n<test><duck>123</duck></test>',
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    '<test xmlns="urn:x"><duck>123</duck></test>',
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    '<n:test xmlns:n="urn:x"><n:duck>123</n:duck></n:test>',
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [
      {
        matchesXPath: {
          expression: "/n:test/n:duck/text()",
          equalTo: "123",
          xPathNamespaces: { n: "urn:x" },
        },
      },
    ],
    '<n:test xmlns:n="urn:x"><n:duck>123</n:duck></n:test>',
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [
      {
        matchesXPath: {
          expression: "/n:test/n:duck/text()",
          equalTo: "123",
          xPathNamespaces: { n: "urn:x" },
        },
      },
    ],
    '<test xmlns="urn:x"><duck>123</duck></test>',
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [
      {
        matchesXPath: {
          expression: "/n:test/n:duck/text()",
          equalTo: "123",
          xPathNamespaces: { n: "urn:x" },
        },
      },
    ],
    "<test><duck>123</duck></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: "/n:test", xPathNamespaces: { n: "urn:x" } }],
    '<test xmlns="urn:x"/>',
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: "/n:test", xPathNamespaces: { n: "urn:x" } }],
    "<test/>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "<x>" } }],
    "<test><duck>&lt;x&gt;</duck></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "<x>" } }],
    "<test><duck><![CDATA[<x>]]></duck></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo>\n  <name>Jozo</name>\n  <jobId>1234567890</jobId>\n</foo>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo><jobId>1234567890</jobId><name>Jozo</name></foo>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo><name>Jozo</name><jobId>1</jobId></foo>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo><name>Jozo</name><jobId>1234567890</jobId><x/></foo>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo><name> Jozo </name><jobId>1234567890</jobId></foo>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo><!-- c --><name>Jozo</name><jobId>1234567890</jobId></foo>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    '<?xml version="1.0"?><foo><name>Jozo</name><jobId>1234567890</jobId></foo>',
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "<foo><name><![CDATA[Jozo]]></name><jobId>1234567890</jobId></foo>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "not xml",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>1234567890</jobId></foo>" }],
    "",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>&lt;test&gt;</jobId></foo>" }],
    "<foo><name>Jozo</name><jobId>&lt;test&gt;</jobId></foo>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<foo><name>Jozo</name><jobId>&lt;test&gt;</jobId></foo>" }],
    "<foo><name>Jozo</name><jobId><![CDATA[<test>]]></jobId></foo>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a x='1' y='2'><b/></a>" }],
    "<a y='2' x='1'><b/></a>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<a x='1' y='2'><b/></a>" }],
    "<a x='1'><b/></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a x='1' y='2'><b/></a>" }],
    "<a x='1' y='2'><b></b></a>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<a x='1' y='2'><b/></a>" }],
    "<a x='1' y='2' z='3'><b/></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a xmlns='urn:x'><b/></a>" }],
    "<p:a xmlns:p='urn:x'><p:b/></p:a>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<a xmlns='urn:x'><b/></a>" }],
    "<a><b/></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a xmlns='urn:x'><b/></a>" }],
    "<a xmlns='urn:y'><b/></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a><b>1</b><b>2</b></a>" }],
    "<a><b>2</b><b>1</b></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a><b>1</b><c>2</c></a>", ignoreOrderOfSameNode: true }],
    "<a><c>2</c><b>1</b></a>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<a><b>1</b><b>2</b></a>", ignoreOrderOfSameNode: true }],
    "<a><b>2</b><b>1</b></a>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [
      {
        equalToXml: "<a><b>${xmlunit.ignore}</b><c>${xmlunit.isNumber}</c></a>",
        enablePlaceholders: true,
      },
    ],
    "<a><b>anything</b><c>12</c></a>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [
      {
        equalToXml: "<a><b>${xmlunit.ignore}</b><c>${xmlunit.isNumber}</c></a>",
        enablePlaceholders: true,
      },
    ],
    "<a><b>x</b><c>no</c></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [
      {
        equalToXml: "<a><b>${xmlunit.ignore}</b><c>${xmlunit.isNumber}</c></a>",
        enablePlaceholders: true,
      },
    ],
    "<a><c>1</c></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a><b>${xmlunit.ignore}</b></a>" }],
    "<a><b>anything</b></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [
      {
        equalToXml: "<a><b>[[xmlunit.ignore]]</b></a>",
        enablePlaceholders: true,
        placeholderOpeningDelimiterRegex: "\\[\\[",
        placeholderClosingDelimiterRegex: "]]",
      },
    ],
    "<a><b>zz</b></a>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [[{ equalToXml: "<a>  x  </a>" }], "<a>x</a>", { "Content-Type": ["application/xml"] }, true],
  [
    [{ equalToXml: "<?xml version='1.0'?><!DOCTYPE a><a/>" }],
    "<a/>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<a><?pi data?><b/></a>" }],
    "<a><b/></a>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck", equalTo: '<duck type="xtype">123</duck>' } }],
    "<test><duck type='xtype'>123</duck><alpha>abc</alpha><list><elem>a</elem><elem>b</elem><elem>c</elem></list><key><complex>foo</complex></key></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck", equalTo: "<duck type='xtype'>123</duck>" } }],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/key", equalTo: "<key><complex>foo</complex></key>" } }],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [
      {
        matchesXPath: {
          expression: "/test/key",
          equalTo: "<key>\n  <complex>foo</complex>\n</key>\n",
        },
      },
    ],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/key", matches: "(?s).*complex.*" } }],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "count(/test/list/elem) div 4", equalTo: "0.5" } }],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "count(/test/list/elem) = 2", equalTo: "true" } }],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "sum(/test/duck)", equalTo: "123" } }],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck>123</duck>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck>123</duck></test><extra/>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck/text()", equalTo: "123" } }],
    "<test><duck a='1' a='2'>123</duck></test>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ equalToXml: "<a xmlns:p='urn:p' p:x='1'/>" }],
    "<a xmlns:q='urn:p' q:x='1'/>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
  [
    [{ equalToXml: "<a xmlns:p='urn:p' p:x='1'/>" }],
    "<a x='1'/>",
    { "Content-Type": ["application/xml"] },
    false,
  ],
  [
    [{ matchesXPath: { expression: "/test/duck", equalTo: '<duck type="xtype">123</duck>\n' } }],
    "<test><duck type='xtype'>123</duck><key><complex>foo</complex></key><list><elem>a</elem><elem>b</elem></list></test>",
    { "Content-Type": ["application/xml"] },
    true,
  ],
];

function verdict(bodyPatterns: unknown[], body: string, headers: Headers = {}): boolean {
  const mapping = {
    request: { method: "POST", urlPath: "/x", bodyPatterns },
    response: { status: 200 },
  };
  const contract = parseWireMockMapping("mapping.json", JSON.stringify(mapping));
  return matchRequest("POST", "/x", headers, undefined, [contract], body).matched;
}

describe("XML body matching parity with WireMock 3.13.2", () => {
  it.each(WIREMOCK_VERDICTS)("%j against %j", (bodyPatterns, body, headers, matches) => {
    expect(verdict(bodyPatterns, body, headers)).toBe(matches);
  });

  it("should_match_identical_mixed_content_unlike_wiremock", () => {
    // Deliberate difference: WireMock 3.13.2 (XMLUnit) never matches equalToXml on mixed content
    // such as <a>x<b/>y</a>, not even against an identical body.
    expect(verdict([{ equalToXml: "<a>x<b/>y</a>" }], "<a>x<b/>y</a>")).toBe(true);
    expect(verdict([{ equalToXml: "<a>x<b/>y</a>" }], "<a>xy<b/></a>")).toBe(false);
  });

  it("should_not_expand_internal_doctype_entities", () => {
    // Deliberate difference: WireMock expands internal entities; stub-server parses without them
    // (and never resolves external ones), so a body that relies on one does not match.
    const body = '<!DOCTYPE r [<!ENTITY e "v">]><r>&e;</r>';
    expect(verdict([{ matchesXPath: { expression: "/r/text()", equalTo: "v" } }], body)).toBe(
      false,
    );
  });

  it("should_never_resolve_external_entities", () => {
    const body = '<!DOCTYPE r [<!ENTITY e SYSTEM "file:///etc/hostname">]><r>&e;</r>';
    expect(verdict([{ matchesXPath: "/r" }], body)).toBe(false);
  });

  it("should_report_unsupported_xml_options_instead_of_ignoring_them", () => {
    const parse = (pattern: unknown) =>
      parseWireMockMapping(
        "m.json",
        JSON.stringify({
          request: { method: "POST", urlPath: "/x", bodyPatterns: [pattern] },
          response: { status: 200 },
        }),
      ).unsupportedMatchers;
    expect(parse({ equalToXml: "<a/>", exemptedComparisons: ["ELEMENT_TAG_NAME"] })).toEqual([
      "bodyPatterns[0].equalToXml.exemptedComparisons",
    ]);
    expect(
      parse({ equalToXml: "<a>${xmlunit.isDateTime}</a>", enablePlaceholders: true })?.[0],
    ).toContain("unsupported XMLUnit placeholder(s): isDateTime");
    expect(parse({ matchesXPath: "/a[" })?.[0]).toContain("invalid XPath");
    expect(parse({ equalToXml: "<a>" })?.[0]).toContain("not well-formed XML");
  });
});
