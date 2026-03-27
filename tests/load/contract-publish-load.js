import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BROKER_URL || "http://localhost:8642";
const AUTH_USER = __ENV.BROKER_USER || "admin";
const AUTH_PASS = __ENV.BROKER_PASS || "admin";

const publishErrors = new Counter("contract_publish_errors");
const publishDuration = new Trend("contract_publish_duration", true);

export const options = {
  stages: [
    { duration: "30s", target: 25 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    contract_publish_duration: ["p(95)<500"],
  },
};

const credentials = `${AUTH_USER}:${AUTH_PASS}`;
const encodedCredentials = __ENV.BROKER_AUTH_HEADER
  ? __ENV.BROKER_AUTH_HEADER
  : null;

function authHeaders(extra) {
  const headers = Object.assign(
    {
      Authorization: `Basic ${
        encodedCredentials ||
        encoding.b64encode(`${AUTH_USER}:${AUTH_PASS}`)
      }`,
      "Content-Type": "application/json",
    },
    extra || {},
  );
  return headers;
}

import encoding from "k6/encoding";

function buildAuthHeaders(extra) {
  const token = encoding.b64encode(`${AUTH_USER}:${AUTH_PASS}`);
  return Object.assign(
    {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
    extra || {},
  );
}

const CONTRACT_TEMPLATE = JSON.stringify({
  request: {
    method: "GET",
    url: "/api/orders/{orderId}",
    headers: { "Content-Type": "application/json" },
  },
  response: {
    status: 200,
    body: { orderId: "abc-123", total: 99.99 },
  },
});

export function setup() {
  const headers = buildAuthHeaders();

  // Register a pool of applications used by VUs
  const apps = [];
  for (let i = 0; i < 50; i++) {
    const appName = `load-test-app-${i}`;
    const payload = JSON.stringify({
      name: appName,
      description: `Load test application ${i}`,
      owner: "load-test",
    });

    const res = http.post(`${BASE_URL}/api/v1/applications`, payload, {
      headers,
    });

    // 201 Created or 409 Conflict (already exists) are both fine
    if (res.status === 201 || res.status === 409) {
      apps.push(appName);
    }
  }

  // Create an environment and seed some deployments for can-i-deploy tests
  const envPayload = JSON.stringify({
    name: "load-test-staging",
    description: "Load test environment",
    displayOrder: 99,
    production: false,
  });
  http.post(`${BASE_URL}/api/v1/environments`, envPayload, { headers });

  return { apps };
}

export default function (data) {
  const vuId = __VU;
  const iteration = __ITER;
  const appIndex = vuId % data.apps.length;
  const appName = data.apps[appIndex];
  const version = `1.0.${iteration}`;
  const headers = buildAuthHeaders();

  // Publish a contract
  const contractName = `order-service-contract-vu${vuId}-iter${iteration}.yaml`;
  const payload = JSON.stringify({
    contractName: contractName,
    content: CONTRACT_TEMPLATE,
    contentType: "application/yaml",
    branch: "main",
  });

  const url = `${BASE_URL}/api/v1/applications/${appName}/versions/${version}/contracts`;
  const res = http.post(url, payload, { headers });

  publishDuration.add(res.timings.duration);

  const success = check(res, {
    "contract published (201)": (r) => r.status === 201,
  });

  if (!success) {
    publishErrors.add(1);
  }

  // Brief pause to simulate realistic pacing
  sleep(0.1 + Math.random() * 0.3);
}

export function teardown(data) {
  // Cleanup: delete the load-test applications
  const headers = buildAuthHeaders();
  for (const appName of data.apps) {
    http.del(`${BASE_URL}/api/v1/applications/${appName}`, null, { headers });
  }
  http.del(
    `${BASE_URL}/api/v1/environments/load-test-staging`,
    null,
    { headers },
  );
}
