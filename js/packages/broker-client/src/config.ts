/** Configuration for the BrokerClient. */
export interface BrokerClientConfig {
  /** Base URL of the broker API (e.g., "http://localhost:8080"). */
  readonly baseUrl: string;

  /** Username for basic auth (optional). */
  readonly username?: string;

  /** Password for basic auth (optional). */
  readonly password?: string;

  /** Bearer token for JWT auth (optional, takes precedence over basic auth). */
  readonly token?: string;

  /** Custom fetch implementation (defaults to global fetch). */
  readonly fetch?: typeof globalThis.fetch;

  /** Default page size for paginated requests. */
  readonly defaultPageSize?: number;

  /** Request timeout in milliseconds (default: 30000). */
  readonly timeoutMs?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TIMEOUT_MS = 30_000;

/** Resolve a BrokerClientConfig with defaults applied. */
export function resolveConfig(
  config: BrokerClientConfig,
): Required<Pick<BrokerClientConfig, "baseUrl" | "defaultPageSize" | "timeoutMs">> &
  BrokerClientConfig {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error(`Invalid baseUrl scheme: "${baseUrl}". Must start with http:// or https://`);
  }
  return {
    ...config,
    baseUrl,
    defaultPageSize:
      config.defaultPageSize !== undefined && config.defaultPageSize > 0
        ? config.defaultPageSize
        : DEFAULT_PAGE_SIZE,
    timeoutMs:
      config.timeoutMs !== undefined && config.timeoutMs > 0
        ? config.timeoutMs
        : DEFAULT_TIMEOUT_MS,
  };
}

/** Build the Authorization header value from config. */
export function buildAuthHeader(config: BrokerClientConfig): string | undefined {
  if (config.token !== undefined && config.token !== "") {
    return `Bearer ${config.token}`;
  }
  if (config.username !== undefined && config.username !== "") {
    const encoded = Buffer.from(`${config.username}:${config.password ?? ""}`).toString("base64");
    return `Basic ${encoded}`;
  }
  return undefined;
}
