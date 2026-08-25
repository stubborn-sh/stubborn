/**
 * Drive an Express-style app through supertest, for producer verification that
 * does not stand up a server of its own.
 *
 * Kept on its own entry point (`@stubborn-sh/verifier/supertest`) because
 * supertest is an optional peer dependency: importing the package's main entry
 * must not require it. It is loaded on first use rather than at module scope,
 * so a consumer that never touches this file never needs it installed.
 *
 * For a handler that speaks WHATWG `Request`/`Response`, prefer
 * {@link fetchFromHandler} in the main entry point — it needs no dependency at
 * all.
 */

/** The slice of a supertest response this adapter reads. */
interface SupertestResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly text?: string;
  readonly body?: unknown;
}

/** The slice of a supertest request this adapter drives. */
interface SupertestRequest extends PromiseLike<SupertestResponse> {
  set(field: string, value: string): SupertestRequest;
  send(data: unknown): SupertestRequest;
}

/** What `require("supertest")` gives you: `request(app).get("/path")`. */
export type SupertestFactory = (app: unknown) => Record<string, (url: string) => SupertestRequest>;

// Indirection so TypeScript does not resolve the module at build time; the
// dependency is optional and may legitimately not be installed.
const SUPERTEST_MODULE = "supertest";

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

async function loadSupertest(): Promise<SupertestFactory> {
  try {
    const module = (await import(SUPERTEST_MODULE as string)) as {
      default?: SupertestFactory;
    } & SupertestFactory;
    return module.default ?? (module as SupertestFactory);
  } catch (cause) {
    throw new Error(
      "fetchFromSupertest needs the optional peer dependency 'supertest'. " +
        "Install it, or use fetchFromHandler for a WHATWG Request/Response handler.",
      { cause },
    );
  }
}

/**
 * Adapt an Express-style app to the `fetch` the verifier calls.
 *
 * ```ts
 * import { ContractVerifier } from "@stubborn-sh/verifier";
 * import { fetchFromSupertest } from "@stubborn-sh/verifier/supertest";
 *
 * await new ContractVerifier({
 *   contractsDir,
 *   providerBaseUrl: "http://sut",
 *   fetch: fetchFromSupertest(app),
 * }).verify();
 * ```
 *
 * @param app     the app to drive — whatever supertest accepts
 * @param factory supertest itself; injectable so this can be tested without
 *                installing an optional dependency
 */
export function fetchFromSupertest(
  app: unknown,
  factory?: SupertestFactory,
): typeof globalThis.fetch {
  return (async (input: FetchInput, init: FetchInit): Promise<Response> => {
    const request = factory ?? (await loadSupertest());

    // The verifier builds an absolute URL from providerBaseUrl; supertest wants
    // the path, and the host is meaningless when nothing is on the wire.
    const { pathname, search } = new URL(String(input));
    const method = (init?.method ?? "GET").toLowerCase();

    const call = request(app)[method];
    if (call === undefined) {
      throw new Error(`supertest cannot issue a ${method.toUpperCase()} request`);
    }

    let pending = call(pathname + search);
    for (const [key, value] of Object.entries(headersOf(init))) {
      pending = pending.set(key, value);
    }
    if (init?.body !== undefined && init.body !== null) {
      pending = pending.send(parseBody(init.body));
    }

    return toResponse(await pending);
  }) as typeof globalThis.fetch;
}

/** Normalise the several shapes the `headers` init can take. */
function headersOf(init: FetchInit): Record<string, string> {
  const headers = init?.headers;
  if (headers === undefined) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());

  const entries: Array<[string, string]> = Array.isArray(headers)
    ? (headers as string[][]).map((pair) => [pair[0] ?? "", String(pair[1] ?? "")])
    : Object.entries(headers as Record<string, string>).map(([key, value]) => [key, String(value)]);
  return Object.fromEntries(entries);
}

/** supertest serialises for us, so hand it an object when the body is JSON. */
function parseBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** Present a supertest response as the part of `Response` the verifier reads. */
function toResponse(response: SupertestResponse): Response {
  const text =
    response.text !== undefined && response.text !== ""
      ? response.text
      : response.body !== undefined
        ? JSON.stringify(response.body)
        : "";

  return {
    status: response.status,
    headers: new Headers(response.headers),
    text: async () => text,
  } as Response;
}
