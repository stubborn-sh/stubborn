import { readFileSync } from "node:fs";
import { parseForXPath, evaluateXPath, nodeText, valueText } from "./src/xml-matcher.ts";
const c = JSON.parse(readFileSync(process.argv[2],"utf8")), w = JSON.parse(readFileSync(process.argv[3],"utf8"));
let ok = 0;
c.forEach((x: any, i: number) => {
  const v = parseForXPath(x.body, !!x.namespaces); let ours: string[] | string;
  if (v === null) ours = "error"; else
  try { const o = evaluateXPath(v, x.xpath, x.namespaces) as any; ours = o.kind === "nodes" ? o.nodes.map((n: any) => nodeText(v, n)) : [valueText(o.value)]; } catch (e) { ours = "error"; }
  const want = w[i].nodes ?? "error";
  if (JSON.stringify(ours) === JSON.stringify(want)) ok++; else console.log(JSON.stringify(x.body), x.xpath, x.namespaces ? "NS" : "", "wm", JSON.stringify(want), "ss", JSON.stringify(ours));
});
console.log(ok, "/", c.length);
