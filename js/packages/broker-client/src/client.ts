import type {
  ApplicationResponse,
  RegisterApplicationRequest,
  UpdateApplicationRequest,
  ContractResponse,
  PublishContractRequest,
  VerificationResponse,
  RecordVerificationRequest,
  EnvironmentResponse,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
  DeploymentResponse,
  RecordDeploymentRequest,
  CanIDeployResponse,
  DependencyGraphResponse,
  ApplicationDependenciesResponse,
  WebhookResponse,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookExecutionResponse,
  MatrixEntry,
  ConsumerVersionSelector,
  ResolvedContract,
  TagResponse,
  CleanupRequest,
  CleanupResult,
  Page,
  PageParams,
  ListParams,
  ErrorResponse,
} from "./types.js";
import type { BrokerClientConfig } from "./config.js";
import { resolveConfig, buildAuthHeader } from "./config.js";
import {
  BrokerApiError,
  BrokerAuthError,
  BrokerForbiddenError,
  BrokerNotFoundError,
  BrokerConflictError,
  BrokerValidationError,
  BrokerConnectionError,
} from "./errors.js";

const API_PREFIX = "/api/v1";

export class BrokerClient {
  private readonly baseUrl: string;
  private readonly config: BrokerClientConfig;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly defaultPageSize: number;
  private readonly timeoutMs: number;

  constructor(config: BrokerClientConfig) {
    const resolved = resolveConfig(config);
    this.baseUrl = resolved.baseUrl;
    this.config = resolved;
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultPageSize = resolved.defaultPageSize;
    this.timeoutMs = resolved.timeoutMs;
  }

  // ── Applications ──────────────────────────────────────────────────────

  async listApplications(params?: ListParams): Promise<Page<ApplicationResponse>> {
    const query = this.buildListQuery(params);
    return this.get<Page<ApplicationResponse>>(`/applications?${query}`);
  }

  async getApplication(name: string): Promise<ApplicationResponse> {
    return this.get<ApplicationResponse>(`/applications/${enc(name)}`);
  }

  async registerApplication(request: RegisterApplicationRequest): Promise<ApplicationResponse> {
    return this.post<ApplicationResponse>("/applications", request);
  }

  async updateApplication(
    name: string,
    request: UpdateApplicationRequest,
  ): Promise<ApplicationResponse> {
    return this.put<ApplicationResponse>(`/applications/${enc(name)}`, request);
  }

  async deleteApplication(name: string): Promise<void> {
    await this.delete(`/applications/${enc(name)}`);
  }

  async listVersions(applicationName: string): Promise<readonly string[]> {
    return this.get<string[]>(`/applications/${enc(applicationName)}/versions`);
  }

  // ── Contracts ─────────────────────────────────────────────────────────

  async listContracts(
    applicationName: string,
    version: string,
    params?: PageParams,
  ): Promise<Page<ContractResponse>> {
    const query = this.buildPageQuery(params);
    return this.get<Page<ContractResponse>>(
      `/applications/${enc(applicationName)}/versions/${enc(version)}/contracts?${query}`,
    );
  }

  async getContract(
    applicationName: string,
    version: string,
    contractName: string,
  ): Promise<ContractResponse> {
    return this.get<ContractResponse>(
      `/applications/${enc(applicationName)}/versions/${enc(version)}/contracts/${enc(contractName)}`,
    );
  }

  async publishContract(
    applicationName: string,
    version: string,
    request: PublishContractRequest,
  ): Promise<ContractResponse> {
    return this.post<ContractResponse>(
      `/applications/${enc(applicationName)}/versions/${enc(version)}/contracts`,
      request,
    );
  }

  async deleteContract(
    applicationName: string,
    version: string,
    contractName: string,
  ): Promise<void> {
    await this.delete(
      `/applications/${enc(applicationName)}/versions/${enc(version)}/contracts/${enc(contractName)}`,
    );
  }

  // ── Verifications ─────────────────────────────────────────────────────

  async listVerifications(params?: ListParams): Promise<Page<VerificationResponse>> {
    const query = this.buildListQuery(params);
    return this.get<Page<VerificationResponse>>(`/verifications?${query}`);
  }

  async recordVerification(request: RecordVerificationRequest): Promise<VerificationResponse> {
    return this.post<VerificationResponse>("/verifications", request);
  }

  // ── Environments ──────────────────────────────────────────────────────

  async listEnvironments(): Promise<readonly EnvironmentResponse[]> {
    return this.get<EnvironmentResponse[]>("/environments");
  }

  async getEnvironment(name: string): Promise<EnvironmentResponse> {
    return this.get<EnvironmentResponse>(`/environments/${enc(name)}`);
  }

  async createEnvironment(request: CreateEnvironmentRequest): Promise<EnvironmentResponse> {
    return this.post<EnvironmentResponse>("/environments", request);
  }

  async updateEnvironment(
    name: string,
    request: UpdateEnvironmentRequest,
  ): Promise<EnvironmentResponse> {
    return this.put<EnvironmentResponse>(`/environments/${enc(name)}`, request);
  }

  async deleteEnvironment(name: string): Promise<void> {
    await this.delete(`/environments/${enc(name)}`);
  }

  // ── Deployments ───────────────────────────────────────────────────────

  async listDeployments(
    environment: string,
    params?: PageParams,
  ): Promise<Page<DeploymentResponse>> {
    const query = this.buildPageQuery(params);
    return this.get<Page<DeploymentResponse>>(
      `/environments/${enc(environment)}/deployments?${query}`,
    );
  }

  async getDeployment(environment: string, applicationName: string): Promise<DeploymentResponse> {
    return this.get<DeploymentResponse>(
      `/environments/${enc(environment)}/deployments/${enc(applicationName)}`,
    );
  }

  async recordDeployment(
    environment: string,
    request: RecordDeploymentRequest,
  ): Promise<DeploymentResponse> {
    return this.post<DeploymentResponse>(`/environments/${enc(environment)}/deployments`, request);
  }

  // ── Safety ────────────────────────────────────────────────────────────

  async canIDeploy(
    application: string,
    version: string,
    environment: string,
  ): Promise<CanIDeployResponse> {
    const params = new URLSearchParams({
      application,
      version,
      environment,
    });
    return this.get<CanIDeployResponse>(`/can-i-deploy?${params.toString()}`);
  }

  // ── Graph ─────────────────────────────────────────────────────────────

  async getDependencyGraph(environment?: string): Promise<DependencyGraphResponse> {
    const params = new URLSearchParams();
    if (environment !== undefined && environment !== "") {
      params.set("environment", environment);
    }
    const qs = params.toString();
    return this.get<DependencyGraphResponse>(`/graph${qs !== "" ? `?${qs}` : ""}`);
  }

  async getApplicationDependencies(
    applicationName: string,
  ): Promise<ApplicationDependenciesResponse> {
    return this.get<ApplicationDependenciesResponse>(`/graph/applications/${enc(applicationName)}`);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────

  async listWebhooks(params?: ListParams): Promise<Page<WebhookResponse>> {
    const query = this.buildListQuery(params);
    return this.get<Page<WebhookResponse>>(`/webhooks?${query}`);
  }

  async getWebhook(id: string): Promise<WebhookResponse> {
    return this.get<WebhookResponse>(`/webhooks/${enc(id)}`);
  }

  async createWebhook(request: CreateWebhookRequest): Promise<WebhookResponse> {
    return this.post<WebhookResponse>("/webhooks", request);
  }

  async updateWebhook(id: string, request: UpdateWebhookRequest): Promise<WebhookResponse> {
    return this.put<WebhookResponse>(`/webhooks/${enc(id)}`, request);
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.delete(`/webhooks/${enc(id)}`);
  }

  async listWebhookExecutions(
    id: string,
    params?: PageParams,
  ): Promise<Page<WebhookExecutionResponse>> {
    const query = this.buildPageQuery(params);
    return this.get<Page<WebhookExecutionResponse>>(`/webhooks/${enc(id)}/executions?${query}`);
  }

  // ── Matrix ────────────────────────────────────────────────────────────

  async queryMatrix(provider?: string, consumer?: string): Promise<readonly MatrixEntry[]> {
    const params = new URLSearchParams();
    if (provider !== undefined && provider !== "") {
      params.set("provider", provider);
    }
    if (consumer !== undefined && consumer !== "") {
      params.set("consumer", consumer);
    }
    const qs = params.toString();
    return this.get<MatrixEntry[]>(`/matrix${qs !== "" ? `?${qs}` : ""}`);
  }

  // ── Selectors ─────────────────────────────────────────────────────────

  async resolveSelectors(
    selectors: readonly ConsumerVersionSelector[],
  ): Promise<readonly ResolvedContract[]> {
    return this.post<ResolvedContract[]>("/selectors/resolve", { selectors });
  }

  // ── Tags ──────────────────────────────────────────────────────────────

  async listTags(applicationName: string, version: string): Promise<readonly TagResponse[]> {
    return this.get<TagResponse[]>(
      `/applications/${enc(applicationName)}/versions/${enc(version)}/tags`,
    );
  }

  async addTag(applicationName: string, version: string, tag: string): Promise<TagResponse> {
    return this.put<TagResponse>(
      `/applications/${enc(applicationName)}/versions/${enc(version)}/tags/${enc(tag)}`,
    );
  }

  async removeTag(applicationName: string, version: string, tag: string): Promise<void> {
    await this.delete(
      `/applications/${enc(applicationName)}/versions/${enc(version)}/tags/${enc(tag)}`,
    );
  }

  async getLatestVersionByTag(applicationName: string, tag: string): Promise<{ version: string }> {
    return this.get<{ version: string }>(
      `/applications/${enc(applicationName)}/versions/latest?tag=${enc(tag)}`,
    );
  }

  // ── Maintenance ───────────────────────────────────────────────────────

  async runCleanup(request: CleanupRequest): Promise<CleanupResult> {
    return this.post<CleanupResult>("/maintenance/cleanup", request);
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private async delete(path: string): Promise<void> {
    await this.requestRaw("DELETE", path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.requestRaw(method, path, body);
    return (await response.json()) as T;
  }

  private async requestRaw(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.baseUrl}${API_PREFIX}${path}`;
    const headers: Record<string, string> = {};

    const auth = buildAuthHeader(this.config);
    if (auth !== undefined) {
      headers["Authorization"] = auth;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(this.timeoutMs) };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    try {
      response = await this.fetchFn(url, init);
    } catch (err: unknown) {
      throw new BrokerConnectionError(
        `Failed to connect to broker at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    if (response.ok) {
      return response;
    }

    let errorResponse: ErrorResponse | null = null;
    try {
      errorResponse = (await response.json()) as ErrorResponse;
    } catch {
      // response body is not JSON — leave errorResponse as null
    }

    const message =
      errorResponse?.message ?? `${method} ${path} failed with status ${String(response.status)}`;

    switch (response.status) {
      case 400:
        throw new BrokerValidationError(message, errorResponse);
      case 401:
        throw new BrokerAuthError(message, errorResponse);
      case 403:
        throw new BrokerForbiddenError(message, errorResponse);
      case 404:
        throw new BrokerNotFoundError(message, errorResponse);
      case 409:
        throw new BrokerConflictError(message, errorResponse);
      default:
        throw new BrokerApiError(response.status, message, errorResponse);
    }
  }

  private buildPageQuery(params?: PageParams): string {
    const urlParams = new URLSearchParams();
    urlParams.set("page", String(params?.page ?? 0));
    urlParams.set("size", String(params?.size ?? this.defaultPageSize));
    if (params?.sort !== undefined && params.sort !== "") {
      urlParams.set("sort", params.sort);
    }
    return urlParams.toString();
  }

  private buildListQuery(params?: ListParams): string {
    const urlParams = new URLSearchParams();
    urlParams.set("page", String(params?.page ?? 0));
    urlParams.set("size", String(params?.size ?? this.defaultPageSize));
    if (params?.sort !== undefined && params.sort !== "") {
      urlParams.set("sort", params.sort);
    }
    if (params?.search !== undefined && params.search !== "") {
      urlParams.set("search", params.search);
    }
    return urlParams.toString();
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}
