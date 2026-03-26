import { describe, it, expect, vi } from "vitest";
import { BrokerClient } from "../../src/client.js";
import {
  BrokerAuthError,
  BrokerNotFoundError,
  BrokerConflictError,
  BrokerValidationError,
  BrokerForbiddenError,
  BrokerConnectionError,
  BrokerApiError,
} from "../../src/errors.js";

function mockFetch(status: number, body: unknown = {}, ok?: boolean): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    statusText: "OK",
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as typeof globalThis.fetch;
}

function mockFetchNoBody(status: number): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "No Content",
    json: vi.fn().mockRejectedValue(new Error("no body")),
  }) as unknown as typeof globalThis.fetch;
}

function client(fetchFn: typeof globalThis.fetch): BrokerClient {
  return new BrokerClient({
    baseUrl: "http://localhost:8080",
    fetch: fetchFn,
  });
}

function clientWithAuth(fetchFn: typeof globalThis.fetch): BrokerClient {
  return new BrokerClient({
    baseUrl: "http://localhost:8080",
    username: "admin",
    password: "secret",
    fetch: fetchFn,
  });
}

describe("BrokerClient", () => {
  // ── Applications ────────────────────────────────────────────────────

  describe("applications", () => {
    it("should_list_applications", async () => {
      const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      const fetchFn = mockFetch(200, page);
      const result = await client(fetchFn).listApplications();
      expect(result).toEqual(page);
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications?"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should_list_applications_with_search", async () => {
      const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      const fetchFn = mockFetch(200, page);
      await client(fetchFn).listApplications({ search: "myapp", page: 1, size: 10 });
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("search=myapp");
      expect(url).toContain("page=1");
      expect(url).toContain("size=10");
    });

    it("should_get_application_by_name", async () => {
      const app = { id: "1", name: "my-app", owner: "team-a" };
      const fetchFn = mockFetch(200, app);
      const result = await client(fetchFn).getApplication("my-app");
      expect(result).toEqual(app);
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("/api/v1/applications/my-app");
    });

    it("should_register_application", async () => {
      const app = { id: "1", name: "new-app", owner: "team-a" };
      const fetchFn = mockFetch(201, app);
      const result = await client(fetchFn).registerApplication({
        name: "new-app",
        owner: "team-a",
      });
      expect(result).toEqual(app);
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]?.method).toBe("POST");
      expect(call?.[1]?.body).toBe(JSON.stringify({ name: "new-app", owner: "team-a" }));
    });

    it("should_update_application", async () => {
      const app = { id: "1", name: "my-app", mainBranch: "develop" };
      const fetchFn = mockFetch(200, app);
      const result = await client(fetchFn).updateApplication("my-app", {
        mainBranch: "develop",
      });
      expect(result).toEqual(app);
    });

    it("should_delete_application", async () => {
      const fetchFn = mockFetchNoBody(204);
      await client(fetchFn).deleteApplication("my-app");
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("/api/v1/applications/my-app");
    });

    it("should_list_versions", async () => {
      const versions = ["1.0.0", "2.0.0"];
      const fetchFn = mockFetch(200, versions);
      const result = await client(fetchFn).listVersions("my-app");
      expect(result).toEqual(versions);
    });

    it("should_encode_application_name_with_special_chars", async () => {
      const fetchFn = mockFetch(200, {});
      await client(fetchFn).getApplication("app/with spaces");
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("app%2Fwith%20spaces");
    });
  });

  // ── Contracts ───────────────────────────────────────────────────────

  describe("contracts", () => {
    it("should_list_contracts", async () => {
      const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      const fetchFn = mockFetch(200, page);
      const result = await client(fetchFn).listContracts("my-app", "1.0.0");
      expect(result).toEqual(page);
    });

    it("should_get_contract", async () => {
      const contract = { id: "1", contractName: "shouldCreate" };
      const fetchFn = mockFetch(200, contract);
      const result = await client(fetchFn).getContract("my-app", "1.0.0", "shouldCreate");
      expect(result).toEqual(contract);
    });

    it("should_publish_contract", async () => {
      const contract = { id: "1", contractName: "test.yaml" };
      const fetchFn = mockFetch(201, contract);
      const result = await client(fetchFn).publishContract("my-app", "1.0.0", {
        contractName: "test.yaml",
        content: "request:\n  method: GET",
        contentType: "application/x-yaml",
      });
      expect(result).toEqual(contract);
    });

    it("should_delete_contract", async () => {
      const fetchFn = mockFetchNoBody(204);
      await client(fetchFn).deleteContract("my-app", "1.0.0", "test.yaml");
      expect(fetchFn).toHaveBeenCalled();
    });
  });

  // ── Verifications ───────────────────────────────────────────────────

  describe("verifications", () => {
    it("should_list_verifications", async () => {
      const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      const fetchFn = mockFetch(200, page);
      const result = await client(fetchFn).listVerifications();
      expect(result).toEqual(page);
    });

    it("should_record_verification", async () => {
      const verification = { id: "1", status: "SUCCESS" };
      const fetchFn = mockFetch(201, verification);
      const result = await client(fetchFn).recordVerification({
        providerName: "provider",
        providerVersion: "1.0.0",
        consumerName: "consumer",
        consumerVersion: "2.0.0",
        status: "SUCCESS",
      });
      expect(result).toEqual(verification);
    });
  });

  // ── Environments ────────────────────────────────────────────────────

  describe("environments", () => {
    it("should_list_environments", async () => {
      const envs = [{ name: "prod", production: true }];
      const fetchFn = mockFetch(200, envs);
      const result = await client(fetchFn).listEnvironments();
      expect(result).toEqual(envs);
    });

    it("should_get_environment", async () => {
      const env = { name: "staging", production: false };
      const fetchFn = mockFetch(200, env);
      const result = await client(fetchFn).getEnvironment("staging");
      expect(result).toEqual(env);
    });

    it("should_create_environment", async () => {
      const env = { name: "qa", production: false };
      const fetchFn = mockFetch(201, env);
      const result = await client(fetchFn).createEnvironment({
        name: "qa",
        displayOrder: 1,
        production: false,
      });
      expect(result).toEqual(env);
    });

    it("should_update_environment", async () => {
      const env = { name: "qa", production: true };
      const fetchFn = mockFetch(200, env);
      const result = await client(fetchFn).updateEnvironment("qa", {
        displayOrder: 2,
        production: true,
      });
      expect(result).toEqual(env);
    });

    it("should_delete_environment", async () => {
      const fetchFn = mockFetchNoBody(204);
      await client(fetchFn).deleteEnvironment("qa");
      expect(fetchFn).toHaveBeenCalled();
    });
  });

  // ── Deployments ─────────────────────────────────────────────────────

  describe("deployments", () => {
    it("should_list_deployments", async () => {
      const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      const fetchFn = mockFetch(200, page);
      const result = await client(fetchFn).listDeployments("prod");
      expect(result).toEqual(page);
    });

    it("should_get_deployment", async () => {
      const dep = { id: "1", applicationName: "my-app", environment: "prod" };
      const fetchFn = mockFetch(200, dep);
      const result = await client(fetchFn).getDeployment("prod", "my-app");
      expect(result).toEqual(dep);
    });

    it("should_record_deployment", async () => {
      const dep = { id: "1", applicationName: "my-app" };
      const fetchFn = mockFetch(201, dep);
      const result = await client(fetchFn).recordDeployment("prod", {
        applicationName: "my-app",
        version: "1.0.0",
      });
      expect(result).toEqual(dep);
    });
  });

  // ── Safety ──────────────────────────────────────────────────────────

  describe("canIDeploy", () => {
    it("should_check_deployment_safety", async () => {
      const result = { safe: true, application: "my-app", version: "1.0.0", environment: "prod" };
      const fetchFn = mockFetch(200, result);
      const response = await client(fetchFn).canIDeploy("my-app", "1.0.0", "prod");
      expect(response).toEqual(result);
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("application=my-app");
      expect(url).toContain("version=1.0.0");
      expect(url).toContain("environment=prod");
    });
  });

  // ── Graph ───────────────────────────────────────────────────────────

  describe("graph", () => {
    it("should_get_dependency_graph", async () => {
      const graph = { nodes: [], edges: [] };
      const fetchFn = mockFetch(200, graph);
      const result = await client(fetchFn).getDependencyGraph();
      expect(result).toEqual(graph);
    });

    it("should_get_dependency_graph_with_environment_filter", async () => {
      const fetchFn = mockFetch(200, { nodes: [], edges: [] });
      await client(fetchFn).getDependencyGraph("prod");
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("environment=prod");
    });

    it("should_get_application_dependencies", async () => {
      const deps = { applicationName: "my-app", providers: [], consumers: [] };
      const fetchFn = mockFetch(200, deps);
      const result = await client(fetchFn).getApplicationDependencies("my-app");
      expect(result).toEqual(deps);
    });
  });

  // ── Webhooks ────────────────────────────────────────────────────────

  describe("webhooks", () => {
    it("should_list_webhooks", async () => {
      const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      const fetchFn = mockFetch(200, page);
      const result = await client(fetchFn).listWebhooks();
      expect(result).toEqual(page);
    });

    it("should_get_webhook", async () => {
      const webhook = { id: "abc", eventType: "CONTRACT_PUBLISHED" };
      const fetchFn = mockFetch(200, webhook);
      const result = await client(fetchFn).getWebhook("abc");
      expect(result).toEqual(webhook);
    });

    it("should_create_webhook", async () => {
      const webhook = { id: "abc" };
      const fetchFn = mockFetch(201, webhook);
      const result = await client(fetchFn).createWebhook({
        eventType: "CONTRACT_PUBLISHED",
        url: "https://example.com/hook",
      });
      expect(result).toEqual(webhook);
    });

    it("should_update_webhook", async () => {
      const webhook = { id: "abc", enabled: false };
      const fetchFn = mockFetch(200, webhook);
      const result = await client(fetchFn).updateWebhook("abc", {
        eventType: "CONTRACT_PUBLISHED",
        url: "https://example.com/hook2",
        enabled: false,
      });
      expect(result).toEqual(webhook);
    });

    it("should_delete_webhook", async () => {
      const fetchFn = mockFetchNoBody(204);
      await client(fetchFn).deleteWebhook("abc");
      expect(fetchFn).toHaveBeenCalled();
    });

    it("should_list_webhook_executions", async () => {
      const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      const fetchFn = mockFetch(200, page);
      const result = await client(fetchFn).listWebhookExecutions("abc");
      expect(result).toEqual(page);
    });
  });

  // ── Matrix ──────────────────────────────────────────────────────────

  describe("matrix", () => {
    it("should_query_matrix_without_filters", async () => {
      const fetchFn = mockFetch(200, []);
      const result = await client(fetchFn).queryMatrix();
      expect(result).toEqual([]);
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("/api/v1/matrix");
      expect(url).not.toContain("provider=");
    });

    it("should_query_matrix_with_filters", async () => {
      const fetchFn = mockFetch(200, []);
      await client(fetchFn).queryMatrix("providerA", "consumerB");
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toContain("provider=providerA");
      expect(url).toContain("consumer=consumerB");
    });
  });

  // ── Selectors ───────────────────────────────────────────────────────

  describe("selectors", () => {
    it("should_resolve_selectors", async () => {
      const resolved = [{ consumerName: "c", version: "1.0" }];
      const fetchFn = mockFetch(200, resolved);
      const result = await client(fetchFn).resolveSelectors([{ mainBranch: true }]);
      expect(result).toEqual(resolved);
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(call?.[1]?.body as string)).toEqual({
        selectors: [{ mainBranch: true }],
      });
    });
  });

  // ── Tags ────────────────────────────────────────────────────────────

  describe("tags", () => {
    it("should_list_tags", async () => {
      const tags = [{ tag: "v1", version: "1.0.0" }];
      const fetchFn = mockFetch(200, tags);
      const result = await client(fetchFn).listTags("my-app", "1.0.0");
      expect(result).toEqual(tags);
    });

    it("should_add_tag", async () => {
      const tag = { tag: "v1", version: "1.0.0" };
      const fetchFn = mockFetch(200, tag);
      const result = await client(fetchFn).addTag("my-app", "1.0.0", "v1");
      expect(result).toEqual(tag);
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]?.method).toBe("PUT");
    });

    it("should_remove_tag", async () => {
      const fetchFn = mockFetchNoBody(204);
      await client(fetchFn).removeTag("my-app", "1.0.0", "v1");
      expect(fetchFn).toHaveBeenCalled();
    });

    it("should_get_latest_version_by_tag", async () => {
      const fetchFn = mockFetch(200, { version: "2.0.0" });
      const result = await client(fetchFn).getLatestVersionByTag("my-app", "latest");
      expect(result).toEqual({ version: "2.0.0" });
    });
  });

  // ── Maintenance ─────────────────────────────────────────────────────

  describe("cleanup", () => {
    it("should_run_cleanup", async () => {
      const result = { deletedCount: 5, deletedContracts: ["a", "b"] };
      const fetchFn = mockFetch(200, result);
      const response = await client(fetchFn).runCleanup({
        keepLatestVersions: 3,
        applicationName: "my-app",
        protectedEnvironments: ["prod"],
      });
      expect(response).toEqual(result);
    });
  });

  // ── Authentication ──────────────────────────────────────────────────

  describe("authentication", () => {
    it("should_send_basic_auth_header", async () => {
      const fetchFn = mockFetch(200, {});
      await clientWithAuth(fetchFn).listEnvironments();
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]?.headers?.Authorization).toBe(`Basic ${btoa("admin:secret")}`);
    });

    it("should_send_bearer_token_header", async () => {
      const fetchFn = mockFetch(200, {});
      const c = new BrokerClient({
        baseUrl: "http://localhost:8080",
        token: "my-jwt",
        fetch: fetchFn,
      });
      await c.listEnvironments();
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]?.headers?.Authorization).toBe("Bearer my-jwt");
    });

    it("should_not_send_auth_header_when_no_credentials", async () => {
      const fetchFn = mockFetch(200, {});
      await client(fetchFn).listEnvironments();
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]?.headers?.Authorization).toBeUndefined();
    });
  });

  // ── Error handling ──────────────────────────────────────────────────

  describe("error handling", () => {
    it("should_throw_BrokerValidationError_on_400", async () => {
      const errorBody = {
        code: "VALIDATION",
        message: "name required",
        traceId: "",
        timestamp: "",
        details: {},
      };
      const fetchFn = mockFetch(400, errorBody, false);
      await expect(client(fetchFn).registerApplication({ name: "", owner: "" })).rejects.toThrow(
        BrokerValidationError,
      );
    });

    it("should_throw_BrokerAuthError_on_401", async () => {
      const fetchFn = mockFetch(401, {}, false);
      await expect(client(fetchFn).listApplications()).rejects.toThrow(BrokerAuthError);
    });

    it("should_throw_BrokerForbiddenError_on_403", async () => {
      const fetchFn = mockFetch(403, {}, false);
      await expect(client(fetchFn).runCleanup({ keepLatestVersions: 1 })).rejects.toThrow(
        BrokerForbiddenError,
      );
    });

    it("should_throw_BrokerNotFoundError_on_404", async () => {
      const fetchFn = mockFetch(404, {}, false);
      await expect(client(fetchFn).getApplication("nonexistent")).rejects.toThrow(
        BrokerNotFoundError,
      );
    });

    it("should_throw_BrokerConflictError_on_409", async () => {
      const fetchFn = mockFetch(409, {}, false);
      await expect(
        client(fetchFn).registerApplication({ name: "dup", owner: "a" }),
      ).rejects.toThrow(BrokerConflictError);
    });

    it("should_throw_BrokerApiError_on_500", async () => {
      const fetchFn = mockFetch(500, {}, false);
      await expect(client(fetchFn).listApplications()).rejects.toThrow(BrokerApiError);
    });

    it("should_throw_BrokerApiError_with_error_response_details", async () => {
      const errorBody = {
        code: "NOT_FOUND",
        message: "App not found",
        traceId: "trace-1",
        timestamp: "2026-01-01",
        details: { field: "name" },
      };
      const fetchFn = mockFetch(404, errorBody, false);
      try {
        await client(fetchFn).getApplication("x");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BrokerNotFoundError);
        const e = err as BrokerNotFoundError;
        expect(e.errorResponse?.code).toBe("NOT_FOUND");
        expect(e.errorResponse?.message).toBe("App not found");
        expect(e.message).toBe("App not found");
      }
    });

    it("should_throw_BrokerConnectionError_on_network_failure", async () => {
      const fetchFn = vi
        .fn()
        .mockRejectedValue(new TypeError("fetch failed")) as unknown as typeof globalThis.fetch;
      await expect(client(fetchFn).listApplications()).rejects.toThrow(BrokerConnectionError);
    });

    it("should_handle_non_json_error_response", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: vi.fn().mockRejectedValue(new Error("not JSON")),
      }) as unknown as typeof globalThis.fetch;
      await expect(client(fetchFn).listApplications()).rejects.toThrow(BrokerApiError);
      try {
        await client(fetchFn).listApplications();
      } catch (err) {
        const e = err as BrokerApiError;
        expect(e.errorResponse).toBeNull();
        expect(e.message).toContain("502");
      }
    });
  });

  // ── URL construction ────────────────────────────────────────────────

  describe("url construction", () => {
    it("should_strip_trailing_slashes_from_base_url", async () => {
      const fetchFn = mockFetch(200, []);
      const c = new BrokerClient({
        baseUrl: "http://localhost:8080///",
        fetch: fetchFn,
      });
      await c.listEnvironments();
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(url).toBe("http://localhost:8080/api/v1/environments");
    });

    it("should_set_content_type_for_POST_requests", async () => {
      const fetchFn = mockFetch(201, {});
      await client(fetchFn).registerApplication({ name: "a", owner: "b" });
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]?.headers?.["Content-Type"]).toBe("application/json");
    });

    it("should_not_set_content_type_for_GET_requests", async () => {
      const fetchFn = mockFetch(200, []);
      await client(fetchFn).listEnvironments();
      const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call?.[1]?.headers?.["Content-Type"]).toBeUndefined();
    });
  });
});
