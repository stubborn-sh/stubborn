import type {
  ApplicationResponse,
  BrokerInfoResponse,
  ContractResponse,
  VerificationResponse,
  DeploymentResponse,
  EnvironmentResponse,
  CanIDeployResponse,
  DependencyGraphResponse,
  ApplicationDependenciesResponse,
  WebhookResponse,
  WebhookExecutionResponse,
  MatrixEntry,
  TagResponse,
  CleanupResult,
  ResolvedContract,
  PageResponse,
  GitImportSourceResponse,
  GitImportResultResponse,
  ImportGitRequest,
  RegisterGitSourceRequest,
  MavenImportSourceResponse,
  MavenImportResultResponse,
  TopicTopologyResponse,
  TopicNode,
} from "./types";
import { getAuthHeader, clearCredentials } from "@/shared/auth/auth-store";

const BASE_URL = (import.meta.env.VITE_BROKER_API_URL as string | undefined) ?? "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeader = getAuthHeader();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  if (init?.headers) {
    const initHeaders = init.headers as Record<string, string>;
    Object.assign(headers, initHeaders);
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 401) {
    clearCredentials();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(`API error: ${String(response.status)} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

interface ListParams {
  search?: string;
  page?: number;
  size?: number;
}

interface PageParams {
  page?: number;
  size?: number;
}

export const api = {
  applications: {
    list: (params?: ListParams) => {
      const urlParams = new URLSearchParams();
      urlParams.set("size", String(params?.size ?? 20));
      urlParams.set("page", String(params?.page ?? 0));
      urlParams.set("sort", "createdAt,desc");
      if (params?.search) urlParams.set("search", params.search);
      return fetchJson<PageResponse<ApplicationResponse>>(
        `/api/v1/applications?${urlParams.toString()}`,
      );
    },
    searchNames: async (query: string, size = 20): Promise<string[]> => {
      const params = new URLSearchParams({ size: String(size), sort: "name,asc" });
      if (query) params.set("search", query);
      const page = await fetchJson<PageResponse<ApplicationResponse>>(
        `/api/v1/applications?${params.toString()}`,
      );
      return page.content.map((a) => a.name);
    },
    get: (name: string) => fetchJson<ApplicationResponse>(`/api/v1/applications/${name}`),
    create: (data: { name: string; description: string; owner: string; repositoryUrl?: string }) =>
      fetchJson<ApplicationResponse>("/api/v1/applications", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (name: string) => {
      const authH = getAuthHeader();
      return fetch(`${BASE_URL}/api/v1/applications/${name}`, {
        method: "DELETE",
        headers: authH ? { Authorization: authH } : {},
      });
    },
    versions: (name: string) => fetchJson<string[]>(`/api/v1/applications/${name}/versions`),
  },
  contracts: {
    list: (appName: string, version: string, params?: PageParams) => {
      const urlParams = new URLSearchParams();
      urlParams.set("size", String(params?.size ?? 20));
      urlParams.set("page", String(params?.page ?? 0));
      urlParams.set("sort", "createdAt,desc");
      return fetchJson<PageResponse<ContractResponse>>(
        `/api/v1/applications/${appName}/versions/${version}/contracts?${urlParams.toString()}`,
      );
    },
    create: (
      appName: string,
      version: string,
      data: { contractName: string; content: string; contentType: string },
    ) =>
      fetchJson<ContractResponse>(`/api/v1/applications/${appName}/versions/${version}/contracts`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  verifications: {
    list: (params?: ListParams) => {
      const urlParams = new URLSearchParams();
      urlParams.set("size", String(params?.size ?? 20));
      urlParams.set("page", String(params?.page ?? 0));
      urlParams.set("sort", "verifiedAt,desc");
      if (params?.search) urlParams.set("search", params.search);
      return fetchJson<PageResponse<VerificationResponse>>(
        `/api/v1/verifications?${urlParams.toString()}`,
      );
    },
    create: (data: {
      providerName: string;
      providerVersion: string;
      consumerName: string;
      consumerVersion: string;
      status: string;
    }) =>
      fetchJson<VerificationResponse>("/api/v1/verifications", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  environments: {
    list: () => fetchJson<EnvironmentResponse[]>("/api/v1/environments"),
    create: (data: {
      name: string;
      description?: string;
      displayOrder: number;
      production: boolean;
    }) =>
      fetchJson<EnvironmentResponse>("/api/v1/environments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      name: string,
      data: { description?: string; displayOrder: number; production: boolean },
    ) =>
      fetchJson<EnvironmentResponse>(`/api/v1/environments/${encodeURIComponent(name)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (name: string) => {
      const authH = getAuthHeader();
      return fetch(`${BASE_URL}/api/v1/environments/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: authH ? { Authorization: authH } : {},
      });
    },
    listDeployments: (env: string, params?: PageParams) => {
      const urlParams = new URLSearchParams();
      urlParams.set("size", String(params?.size ?? 20));
      urlParams.set("page", String(params?.page ?? 0));
      urlParams.set("sort", "deployedAt,desc");
      return fetchJson<PageResponse<DeploymentResponse>>(
        `/api/v1/environments/${env}/deployments?${urlParams.toString()}`,
      );
    },
    deploy: (env: string, data: { applicationName: string; version: string }) =>
      fetchJson<DeploymentResponse>(`/api/v1/environments/${env}/deployments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  canIDeploy: {
    check: (application: string, version: string, environment: string) =>
      fetchJson<CanIDeployResponse>(
        `/api/v1/can-i-deploy?application=${encodeURIComponent(application)}&version=${encodeURIComponent(version)}&environment=${encodeURIComponent(environment)}`,
      ),
  },
  graph: {
    get: (environment?: string) => {
      const params = environment ? `?environment=${encodeURIComponent(environment)}` : "";
      return fetchJson<DependencyGraphResponse>(`/api/v1/graph${params}`);
    },
    getApplicationDependencies: (name: string) =>
      fetchJson<ApplicationDependenciesResponse>(
        `/api/v1/graph/applications/${encodeURIComponent(name)}`,
      ),
  },
  topics: {
    list: () => fetchJson<TopicTopologyResponse>("/api/v1/topics"),
    getByName: (topicName: string) =>
      fetchJson<TopicNode>(`/api/v1/topics/${encodeURIComponent(topicName)}`),
    getForApplication: (appName: string) =>
      fetchJson<TopicTopologyResponse>(
        `/api/v1/topics/applications/${encodeURIComponent(appName)}`,
      ),
  },
  webhooks: {
    list: (params?: ListParams) => {
      const urlParams = new URLSearchParams();
      urlParams.set("size", String(params?.size ?? 20));
      urlParams.set("page", String(params?.page ?? 0));
      urlParams.set("sort", "createdAt,desc");
      if (params?.search) urlParams.set("search", params.search);
      return fetchJson<PageResponse<WebhookResponse>>(`/api/v1/webhooks?${urlParams.toString()}`);
    },
    get: (id: string) => fetchJson<WebhookResponse>(`/api/v1/webhooks/${id}`),
    create: (data: {
      applicationName?: string;
      eventType: string;
      url: string;
      headers?: string;
      bodyTemplate?: string;
    }) =>
      fetchJson<WebhookResponse>("/api/v1/webhooks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        eventType: string;
        url: string;
        headers?: string;
        bodyTemplate?: string;
        enabled: boolean;
      },
    ) =>
      fetchJson<WebhookResponse>(`/api/v1/webhooks/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) => {
      const authH = getAuthHeader();
      return fetch(`${BASE_URL}/api/v1/webhooks/${id}`, {
        method: "DELETE",
        headers: authH ? { Authorization: authH } : {},
      });
    },
    executions: async (id: string) => {
      const page = await fetchJson<PageResponse<WebhookExecutionResponse>>(
        `/api/v1/webhooks/${id}/executions`,
      );
      return page.content;
    },
  },
  matrix: {
    query: (provider?: string, consumer?: string) => {
      const params = new URLSearchParams();
      if (provider) params.set("provider", provider);
      if (consumer) params.set("consumer", consumer);
      const qs = params.toString();
      return fetchJson<MatrixEntry[]>(`/api/v1/matrix${qs ? `?${qs}` : ""}`);
    },
  },
  tags: {
    list: (appName: string, version: string) =>
      fetchJson<TagResponse[]>(`/api/v1/applications/${appName}/versions/${version}/tags`),
    add: (appName: string, version: string, tag: string) =>
      fetchJson<TagResponse>(
        `/api/v1/applications/${appName}/versions/${version}/tags/${encodeURIComponent(tag)}`,
        { method: "PUT" },
      ),
    remove: (appName: string, version: string, tag: string) => {
      const authH = getAuthHeader();
      return fetch(
        `${BASE_URL}/api/v1/applications/${appName}/versions/${version}/tags/${encodeURIComponent(tag)}`,
        { method: "DELETE", headers: authH ? { Authorization: authH } : {} },
      );
    },
    latest: (appName: string, tag: string) =>
      fetchJson<{ version: string }>(
        `/api/v1/applications/${appName}/versions/latest?tag=${encodeURIComponent(tag)}`,
      ),
  },
  selectors: {
    resolve: (selectors: Record<string, unknown>[]) =>
      fetchJson<ResolvedContract[]>("/api/v1/selectors/resolve", {
        method: "POST",
        body: JSON.stringify({ selectors }),
      }),
  },
  cleanup: {
    run: (data: {
      applicationName?: string;
      keepLatestVersions: number;
      protectedEnvironments?: string[];
    }) =>
      fetchJson<CleanupResult>("/api/v1/maintenance/cleanup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  broker: {
    info: () => fetchJson<BrokerInfoResponse>("/api/v1/broker/info"),
  },
  gitImport: {
    listSources: (params?: PageParams) => {
      const urlParams = new URLSearchParams();
      urlParams.set("size", String(params?.size ?? 20));
      urlParams.set("page", String(params?.page ?? 0));
      urlParams.set("sort", "createdAt,desc");
      return fetchJson<PageResponse<GitImportSourceResponse>>(
        `/api/v1/import/git-sources?${urlParams.toString()}`,
      );
    },
    registerSource: (data: RegisterGitSourceRequest) =>
      fetchJson<GitImportSourceResponse>("/api/v1/import/git-sources", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteSource: (id: string) => {
      const authH = getAuthHeader();
      return fetch(`${BASE_URL}/api/v1/import/git-sources/${id}`, {
        method: "DELETE",
        headers: authH ? { Authorization: authH } : {},
      });
    },
    importFromGit: (data: ImportGitRequest) =>
      fetchJson<GitImportResultResponse>("/api/v1/import/git", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  mavenImport: {
    listSources: (params?: PageParams) => {
      const urlParams = new URLSearchParams();
      urlParams.set("size", String(params?.size ?? 20));
      urlParams.set("page", String(params?.page ?? 0));
      urlParams.set("sort", "createdAt,desc");
      return fetchJson<PageResponse<MavenImportSourceResponse>>(
        `/api/v1/import/sources?${urlParams.toString()}`,
      );
    },
    registerSource: (data: {
      repositoryUrl: string;
      groupId: string;
      artifactId: string;
      username?: string;
      encryptedPassword?: string;
      syncEnabled: boolean;
    }) =>
      fetchJson<MavenImportSourceResponse>("/api/v1/import/sources", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteSource: (id: string) => {
      const authH = getAuthHeader();
      return fetch(`${BASE_URL}/api/v1/import/sources/${id}`, {
        method: "DELETE",
        headers: authH ? { Authorization: authH } : {},
      });
    },
    importJar: (data: {
      applicationName: string;
      repositoryUrl: string;
      groupId: string;
      artifactId: string;
      version: string;
      username?: string;
      password?: string;
    }) =>
      fetchJson<MavenImportResultResponse>("/api/v1/import/maven-jar", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
