/**
 * Adapters that let {@link ContractVerifier} drive a producer in process.
 *
 * The verifier fires each contract through an injectable `fetch`, so verifying
 * a Node producer does not need a booted server on a real port: the app can be
 * driven directly, with its dependencies mocked at the boundary, in a plain
 * unit test. That mirrors the consumer side, where `setupStubs` already runs in
 * process.
 *
 * Only the part of the `fetch` contract the verifier actually uses has to be
 * honoured — the status, the headers (`get` and `forEach`) and `text()`.
 */

/**
 * A WHATWG handler: one that takes a `Request` and answers with a `Response`.
 * Hono, Elysia, Next route handlers, `Bun.serve` and `Deno.serve` all expose
 * this shape.
 */
export type RequestHandler = (request: Request) => Response | Promise<Response>;

// Derived from fetch itself: this TypeScript configuration exposes Request and
// Response but not the RequestInfo/BodyInit aliases, and deriving keeps the
// adapters honest if the signature ever moves.
type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

/**
 * Drive a WHATWG handler in process.
 *
 * No adapting is needed on the way back: a `Response` is already exactly what
 * the verifier expects, so this only has to build the `Request`.
 *
 * ```ts
 * await new ContractVerifier({
 *   contractsDir,
 *   providerBaseUrl: "http://sut",
 *   fetch: fetchFromHandler(app.fetch),
 * }).verify();
 * ```
 */
export function fetchFromHandler(handler: RequestHandler): typeof globalThis.fetch {
  return (async (input: FetchInput, init: FetchInit): Promise<Response> => {
    const request = new Request(input, init);
    return await handler(request);
  }) as typeof globalThis.fetch;
}
