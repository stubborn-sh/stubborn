import { http, HttpResponse } from "msw";

export const mockApplications = [
  {
    id: "1",
    name: "order-service",
    description: "Order management",
    owner: "team-orders",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "2",
    name: "payment-service",
    description: "Payment processing",
    owner: "team-payments",
    createdAt: "2026-01-16T10:00:00Z",
  },
];

export const mockVerifications = [
  {
    id: "1",
    providerName: "order-service",
    providerVersion: "1.0.0",
    consumerName: "payment-service",
    consumerVersion: "2.0.0",
    status: "SUCCESS",
    details: null,
    verifiedAt: "2026-02-01T10:00:00Z",
  },
  {
    id: "2",
    providerName: "order-service",
    providerVersion: "1.0.0",
    consumerName: "notification-service",
    consumerVersion: "1.5.0",
    status: "FAILED",
    details: null,
    verifiedAt: "2026-02-02T10:00:00Z",
  },
];

export const mockContracts = [
  {
    id: "1",
    applicationName: "order-service",
    version: "1.0.0",
    contractName: "create-order",
    content: '{"request":{"method":"POST","url":"/orders"},"response":{"status":201}}',
    contentType: "application/json",
    createdAt: "2026-01-20T10:00:00Z",
  },
  {
    id: "2",
    applicationName: "order-service",
    version: "1.0.0",
    contractName: "get-order",
    content: "request:\n  method: GET\n  url: /orders/1",
    contentType: "application/x-spring-cloud-contract+yaml",
    createdAt: "2026-01-21T10:00:00Z",
  },
];

export const mockDeployments = [
  {
    id: "1",
    applicationName: "order-service",
    version: "1.0.0",
    environment: "staging",
    deployedAt: "2026-02-10T10:00:00Z",
  },
  {
    id: "2",
    applicationName: "payment-service",
    version: "2.0.0",
    environment: "staging",
    deployedAt: "2026-02-11T10:00:00Z",
  },
];

export const mockDeploymentsDev = [
  {
    id: "3",
    applicationName: "order-service",
    version: "1.1.0-SNAPSHOT",
    environment: "dev",
    deployedAt: "2026-02-12T10:00:00Z",
  },
];

export const mockDeploymentsProduction = [
  {
    id: "4",
    applicationName: "order-service",
    version: "0.9.0",
    environment: "production",
    deployedAt: "2026-02-05T10:00:00Z",
  },
];

export const mockGraphNodes = [
  { applicationId: "1", applicationName: "order-service", owner: "team-orders" },
  { applicationId: "2", applicationName: "payment-service", owner: "team-payments" },
];

export const mockGraphEdges = [
  {
    providerName: "order-service",
    providerVersion: "1.0.0",
    consumerName: "payment-service",
    consumerVersion: "2.0.0",
    status: "SUCCESS" as const,
    verifiedAt: "2026-02-01T10:00:00Z",
  },
  {
    providerName: "order-service",
    providerVersion: "1.0.0",
    consumerName: "notification-service",
    consumerVersion: "1.5.0",
    status: "FAILED" as const,
    verifiedAt: "2026-02-02T10:00:00Z",
  },
];

export const mockWebhooks = [
  {
    id: "wh-1",
    applicationId: "1",
    applicationName: "order-service",
    eventType: "CONTRACT_PUBLISHED",
    url: "https://hooks.example.com/contract",
    headers: null,
    bodyTemplate: null,
    enabled: true,
    createdAt: "2026-02-20T10:00:00Z",
    updatedAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "wh-2",
    applicationId: null,
    applicationName: null,
    eventType: "VERIFICATION_FAILED",
    url: "https://hooks.example.com/verification",
    headers: '{"X-Custom":"value"}',
    bodyTemplate: null,
    enabled: false,
    createdAt: "2026-02-21T10:00:00Z",
    updatedAt: "2026-02-21T10:00:00Z",
  },
];

export const mockMatrixEntries = [
  {
    providerName: "order-service",
    providerVersion: "1.0.0",
    consumerName: "payment-service",
    consumerVersion: "2.0.0",
    status: "SUCCESS" as const,
    branch: "main",
    verifiedAt: "2026-02-01T10:00:00Z",
  },
  {
    providerName: "order-service",
    providerVersion: "1.0.0",
    consumerName: "notification-service",
    consumerVersion: "1.5.0",
    status: "FAILED" as const,
    branch: "feature/alerts",
    verifiedAt: "2026-02-02T10:00:00Z",
  },
];

export const mockMavenImportSources = [
  {
    id: "ms-1",
    repositoryUrl: "https://repo.maven.apache.org/maven2",
    groupId: "com.example",
    artifactId: "order-contracts",
    syncEnabled: true,
    lastSyncAt: "2026-03-01T10:00:00Z",
    lastSyncedVersion: "1.2.0",
    createdAt: "2026-02-20T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "ms-2",
    repositoryUrl: "https://nexus.internal.com/repository/releases",
    groupId: "com.acme",
    artifactId: "payment-stubs",
    syncEnabled: false,
    lastSyncAt: null,
    lastSyncedVersion: null,
    createdAt: "2026-02-25T10:00:00Z",
    updatedAt: "2026-02-25T10:00:00Z",
  },
];

export const mockTags = [
  { tag: "RELEASE", version: "1.0.0", createdAt: "2026-02-15T10:00:00Z" },
  { tag: "STABLE", version: "1.0.0", createdAt: "2026-02-16T10:00:00Z" },
];

export const mockEnvironments = [
  {
    name: "dev",
    description: "Development",
    displayOrder: 1,
    production: false,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
  },
  {
    name: "staging",
    description: "Pre-production",
    displayOrder: 2,
    production: false,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
  },
  {
    name: "production",
    description: "Production",
    displayOrder: 3,
    production: true,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
  },
];

export const mockGitImportSources = [
  {
    id: "gs-1",
    applicationName: "order-service",
    repositoryUrl: "https://github.com/acme/order-service.git",
    branch: "main",
    contractsDirectory: "src/test/resources/contracts",
    authType: "TOKEN",
    syncEnabled: true,
    lastSyncAt: "2026-03-01T10:00:00Z",
    lastSyncedCommit: "abc123def",
    createdAt: "2026-02-20T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "gs-2",
    applicationName: "payment-service",
    repositoryUrl: "https://github.com/acme/payment-service.git",
    branch: null,
    contractsDirectory: null,
    authType: null,
    syncEnabled: false,
    lastSyncAt: null,
    lastSyncedCommit: null,
    createdAt: "2026-02-21T10:00:00Z",
    updatedAt: "2026-02-21T10:00:00Z",
  },
];

export const mockCanIDeploySafe = {
  safe: true,
  application: "order-service",
  version: "1.0.0",
  environment: "staging",
  summary: "All consumers verified",
  consumerResults: [{ consumer: "payment-service", consumerVersion: "2.0.0", verified: true }],
};

export const mockCanIDeployUnsafe = {
  safe: false,
  application: "order-service",
  version: "2.0.0",
  environment: "production",
  summary: "1 of 2 consumer(s) missing successful verification",
  consumerResults: [
    { consumer: "payment-service", consumerVersion: "2.0.0", verified: true },
    { consumer: "notification-service", consumerVersion: "1.0.0", verified: false },
  ],
};

export const handlers = [
  // Applications
  http.get("/api/v1/applications", () =>
    HttpResponse.json({
      content: mockApplications,
      number: 0,
      size: 20,
      totalElements: mockApplications.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: mockApplications.length === 0,
    }),
  ),
  http.get("/api/v1/applications/:name", ({ params }) => {
    const app = mockApplications.find((a) => a.name === params.name);
    return app ? HttpResponse.json(app) : new HttpResponse(null, { status: 404 });
  }),
  http.get("/api/v1/applications/:name/versions", () => HttpResponse.json(["1.0.0", "2.0.0"])),
  http.post("/api/v1/applications", async ({ request }) => {
    const body = (await request.json()) as { name: string; description: string; owner: string };
    return HttpResponse.json(
      {
        id: "3",
        name: body.name,
        description: body.description,
        owner: body.owner,
        createdAt: "2026-02-15T10:00:00Z",
      },
      { status: 201 },
    );
  }),

  // Contracts
  http.get("/api/v1/applications/:name/versions/:version/contracts", () =>
    HttpResponse.json({
      content: mockContracts,
      number: 0,
      size: 20,
      totalElements: mockContracts.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: mockContracts.length === 0,
    }),
  ),
  http.post(
    "/api/v1/applications/:name/versions/:version/contracts",
    async ({ params, request }) => {
      const body = (await request.json()) as {
        contractName: string;
        content: string;
        contentType: string;
      };
      return HttpResponse.json(
        {
          id: "3",
          applicationName: params.name,
          version: params.version,
          contractName: body.contractName,
          content: body.content,
          contentType: body.contentType,
          createdAt: "2026-02-15T10:00:00Z",
        },
        { status: 201 },
      );
    },
  ),

  // Verifications
  http.get("/api/v1/verifications", () =>
    HttpResponse.json({
      content: mockVerifications,
      number: 0,
      size: 20,
      totalElements: mockVerifications.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: mockVerifications.length === 0,
    }),
  ),
  http.post("/api/v1/verifications", async ({ request }) => {
    const body = (await request.json()) as {
      providerName: string;
      providerVersion: string;
      consumerName: string;
      consumerVersion: string;
      status: string;
    };
    return HttpResponse.json(
      {
        id: "3",
        providerName: body.providerName,
        providerVersion: body.providerVersion,
        consumerName: body.consumerName,
        consumerVersion: body.consumerVersion,
        status: body.status,
        createdAt: "2026-02-15T10:00:00Z",
      },
      { status: 201 },
    );
  }),

  // Environments
  http.get("/api/v1/environments", () => HttpResponse.json(mockEnvironments)),
  http.post("/api/v1/environments", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        name: body.name,
        description: body.description,
        displayOrder: body.displayOrder,
        production: body.production,
        createdAt: "2026-02-22T10:00:00Z",
        updatedAt: "2026-02-22T10:00:00Z",
      },
      { status: 201 },
    );
  }),
  http.delete("/api/v1/environments/:name", () => new HttpResponse(null, { status: 204 })),
  http.get("/api/v1/environments/:env/deployments", ({ params }) => {
    const env = params.env as string;
    const data =
      env === "dev"
        ? mockDeploymentsDev
        : env === "production"
          ? mockDeploymentsProduction
          : mockDeployments;
    return HttpResponse.json({
      content: data,
      number: 0,
      size: 20,
      totalElements: data.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: data.length === 0,
    });
  }),
  http.post("/api/v1/environments/:env/deployments", async ({ params, request }) => {
    const body = (await request.json()) as { applicationName: string; version: string };
    return HttpResponse.json(
      {
        id: "5",
        applicationName: body.applicationName,
        version: body.version,
        environment: params.env,
        deployedAt: "2026-02-15T10:00:00Z",
      },
      { status: 201 },
    );
  }),

  // Graph
  http.get("/api/v1/graph", () =>
    HttpResponse.json({ nodes: mockGraphNodes, edges: mockGraphEdges }),
  ),
  http.get("/api/v1/graph/applications/:name", ({ params }) => {
    const name = params.name as string;
    return HttpResponse.json({
      applicationName: name,
      providers: mockGraphEdges.filter((e) => e.consumerName === name),
      consumers: mockGraphEdges.filter((e) => e.providerName === name),
    });
  }),

  // Can I Deploy
  http.get("/api/v1/can-i-deploy", ({ request }) => {
    const url = new URL(request.url);
    const application = url.searchParams.get("application");
    const version = url.searchParams.get("version");
    const environment = url.searchParams.get("environment");
    return HttpResponse.json({
      safe: true,
      application,
      version,
      environment,
      summary: "All consumers verified",
      consumerResults: [{ consumer: "payment-service", consumerVersion: "2.0.0", verified: true }],
    });
  }),

  // Webhooks
  http.get("/api/v1/webhooks", () =>
    HttpResponse.json({
      content: mockWebhooks,
      number: 0,
      size: 20,
      totalElements: mockWebhooks.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: false,
    }),
  ),
  http.get("/api/v1/webhooks/:id/executions", () =>
    HttpResponse.json({
      content: [
        {
          id: "exec-1",
          webhookId: "wh-1",
          eventType: "CONTRACT_PUBLISHED",
          requestUrl: "https://hooks.example.com/contract",
          requestBody: null,
          responseStatus: 200,
          responseBody: null,
          success: true,
          errorMessage: null,
          executedAt: "2026-02-22T10:00:00Z",
        },
      ],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
      empty: false,
    }),
  ),
  http.delete("/api/v1/webhooks/:id", () => new HttpResponse(null, { status: 204 })),
  http.put("/api/v1/webhooks/:id", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      ...body,
      createdAt: "2026-02-20T10:00:00Z",
      updatedAt: "2026-02-22T10:00:00Z",
    });
  }),
  http.post("/api/v1/webhooks", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: "wh-3",
        ...body,
        enabled: true,
        createdAt: "2026-02-22T10:00:00Z",
        updatedAt: "2026-02-22T10:00:00Z",
      },
      { status: 201 },
    );
  }),

  // Matrix
  http.get("/api/v1/matrix", () => HttpResponse.json(mockMatrixEntries)),

  // Tags
  http.get("/api/v1/applications/:name/versions/:version/tags", () => HttpResponse.json(mockTags)),
  http.put("/api/v1/applications/:name/versions/:version/tags/:tag", ({ params }) =>
    HttpResponse.json({
      tag: params.tag,
      version: params.version,
      createdAt: "2026-02-22T10:00:00Z",
    }),
  ),

  // Cleanup
  http.post("/api/v1/maintenance/cleanup", () =>
    HttpResponse.json({
      deletedCount: 3,
      deletedContracts: ["app:0.1.0:contract-a", "app:0.2.0:contract-b", "app:0.3.0:contract-c"],
    }),
  ),

  // Selectors
  http.post("/api/v1/selectors/resolve", () =>
    HttpResponse.json([
      {
        consumerName: "payment-service",
        version: "2.0.0",
        branch: "main",
        contractName: "create-payment",
        contentHash: "abc123",
      },
    ]),
  ),

  // Git Import
  http.get("/api/v1/import/git-sources", () =>
    HttpResponse.json({
      content: mockGitImportSources,
      number: 0,
      size: 20,
      totalElements: mockGitImportSources.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: false,
    }),
  ),
  http.post("/api/v1/import/git-sources", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: "gs-3",
        applicationName: body.applicationName,
        repositoryUrl: body.repositoryUrl,
        branch: body.branch ?? null,
        contractsDirectory: body.contractsDirectory ?? null,
        authType: body.authType ?? null,
        syncEnabled: body.syncEnabled ?? false,
        lastSyncAt: null,
        lastSyncedCommit: null,
        createdAt: "2026-03-27T10:00:00Z",
        updatedAt: "2026-03-27T10:00:00Z",
      },
      { status: 201 },
    );
  }),
  http.delete("/api/v1/import/git-sources/:id", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/v1/import/git", () =>
    HttpResponse.json({
      published: 3,
      skipped: 1,
      total: 4,
      resolvedVersion: "1.2.0",
    }),
  ),

  // Maven Import
  http.get("/api/v1/import/sources", () =>
    HttpResponse.json({
      content: mockMavenImportSources,
      number: 0,
      size: 20,
      totalElements: mockMavenImportSources.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: false,
    }),
  ),
  http.post("/api/v1/import/sources", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: "ms-3",
        repositoryUrl: body.repositoryUrl,
        groupId: body.groupId,
        artifactId: body.artifactId,
        syncEnabled: body.syncEnabled ?? false,
        lastSyncAt: null,
        lastSyncedVersion: null,
        createdAt: "2026-03-27T10:00:00Z",
        updatedAt: "2026-03-27T10:00:00Z",
      },
      { status: 201 },
    );
  }),
  http.delete("/api/v1/import/sources/:id", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/v1/import/maven-jar", () =>
    HttpResponse.json({
      published: 5,
      skipped: 2,
      total: 7,
    }),
  ),
];
