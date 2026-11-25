import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { contractFileReader } from "../../src/directory-loader.js";
import { parseContracts } from "../../src/contract-parser.js";

/**
 * The WireMock mappings the JVM (`YamlContractConverter` + `DslToWireMockClientConverter`, as the
 * Maven/Gradle plugins run them) generates for every YAML file under
 * `fixtures/yaml-to-wiremock/`: the stubborn-contract test and docs contracts (`scc/`) and a
 * feature corpus (`cases/`). `mappings` has one entry per HTTP contract, `null` for one it
 * generates no stub for (an ignored contract); `error` is set when the JVM rejects the file.
 */
type JvmResult =
  { readonly mappings: readonly (Record<string, unknown> | null)[] } | { readonly error: string };

const ROOT = new URL("../fixtures/yaml-to-wiremock/", import.meta.url);
const jvm = JSON.parse(readFileSync(new URL("jvm-mappings.json", ROOT), "utf8")) as Record<
  string,
  JvmResult
>;

function convert(file: string) {
  const path = fileURLToPath(new URL(file, ROOT));
  return parseContracts(file.split("/").pop() ?? file, readFileSync(path, "utf8"), {
    readFile: contractFileReader(path),
  });
}

/**
 * The normalizations, each of a difference that is not semantic:
 * - `id` and `uuid` are random UUIDs the JVM generates for each run.
 * - `request.cookies` is compared without regard to the order of its members: the JVM keeps a
 *   contract's cookies in a `HashSet` whose iteration order follows `Pattern` identity hash codes
 *   (so it changes between runs), and WireMock reads the object into a map.
 * Everything else, member order included, must be what the JVM writes.
 */
function normalize(mapping: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, uuid: _uuid, ...rest } = mapping;
  const request = rest["request"] as Record<string, unknown> | undefined;
  const cookies = request?.["cookies"] as Record<string, unknown> | undefined;
  if (request === undefined || cookies === undefined) return rest;
  const sorted = Object.fromEntries(Object.entries(cookies).sort(([a], [b]) => a.localeCompare(b)));
  return { ...rest, request: { ...request, cookies: sorted } };
}

const files = Object.keys(jvm).sort();

describe("YAML to WireMock: the mapping the JVM generates", () => {
  it("covers the whole corpus", () => {
    expect(files.length).toBeGreaterThanOrEqual(99);
  });

  const generated = files.filter((f) => "mappings" in (jvm[f] as JvmResult));
  it.each(generated)("%s", (file) => {
    const expected = (jvm[file] as { mappings: readonly (Record<string, unknown> | null)[] })
      .mappings;
    const contracts = convert(file);
    const actual = contracts.map((c) => c.wireMockMapping ?? null);
    expect(JSON.stringify(actual.map((m) => (m === null ? null : normalize(m))))).toBe(
      JSON.stringify(expected.map((m) => (m === null ? null : normalize(m)))),
    );
    // A contract the JVM generates no stub for is reported, so stub-server never serves it.
    contracts.forEach((contract, i) => {
      if (expected[i] === null)
        expect(contract.unsupportedMatchers?.length ?? 0).toBeGreaterThan(0);
    });
  });

  const rejected = files.filter((f) => "error" in (jvm[f] as JvmResult));
  it.each(rejected)("%s: rejected by the JVM, so stub-server serves no stub for it", (file) => {
    let contracts: ReturnType<typeof convert>;
    try {
      contracts = convert(file);
    } catch {
      return; // stub-server rejects the file too
    }
    // At least one contract of the file is reported unsupported (the JVM fails the whole build,
    // naming one contract), and none of the reported ones carries a mapping.
    const reported = contracts.filter((c) => (c.unsupportedMatchers?.length ?? 0) > 0);
    if (contracts.length > 0) expect(reported.length).toBeGreaterThan(0);
    for (const c of reported) expect(c.wireMockMapping).toBeUndefined();
  });
});
