import http from "k6/http";
import { check, sleep } from "k6";
import encoding from "k6/encoding";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BROKER_URL || "http://localhost:8642";
const AUTH_USER = __ENV.BROKER_USER || "admin";
const AUTH_PASS = __ENV.BROKER_PASS || "admin";

const publishWithWebhookErrors = new Counter("publish_with_webhook_errors");
const publishWithWebhookDuration = new Trend(
  "publish_with_webhook_duration",
  true,
);

export const options = {
  stages: [
    { duration: "15s", target: 20 },
    { duration: "30s", target: 20 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
    publish_with_webhook_duration: ["p(95)<1000"],
  },
};

function buildAuthHeaders() {
  const token = encoding.b64encode(`${AUTH_USER}:${AUTH_PASS}`);
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

export function setup() {
  const headers = buildAuthHeaders();

  // Register applications
  const apps = [];
  for (let i = 0; i < 20; i++) {
    const appName = `webhook-load-app-${i}`;
    const payload = JSON.stringify({
      name: appName,
      description: `Webhook load test app ${i}`,
      owner: "load-test",
    });
    const res = http.post(`${BASE_URL}/api/v1/applications`, payload, {
      headers,
    });
    if (res.status === 201 || res.status === 409) {
      apps.push(appName);
    }
  }

  // Register webhooks for each application (CONTRACT_PUBLISHED event)
  // The webhook URL points to a non-routable address so dispatch is fire-and-forget
  const webhookIds = [];
  for (const appName of apps) {
    const webhookPayload = JSON.stringify({
      applicationName: appName,
      eventType: "CONTRACT_PUBLISHED",
      url: "https://httpbin.org/post",
      headers: JSON.stringify({ "X-Load-Test": "true" }),
      bodyTemplate: null,
    });
    const res = http.post(`${BASE_URL}/api/v1/webhooks`, webhookPayload, {
      headers,
    });
    if (res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        webhookIds.push(body.id);
      } catch (_e) {
        // ignore parse errors
      }
    }
  }

  return { apps, webhookIds };
}

export default function (data) {
  const headers = buildAuthHeaders();
  const vuId = __VU;
  const iteration = __ITER;
  const appIndex = vuId % data.apps.length;
  const appName = data.apps[appIndex];
  const version = `2.0.${iteration}`;

  // Publish a contract (this should trigger webhook dispatch asynchronously)
  const contractPayload = JSON.stringify({
    contractName: `webhook-contract-vu${vuId}-iter${iteration}.yaml`,
    content: JSON.stringify({
      request: {
        method: "POST",
        url: "/api/webhooks/test",
        headers: { "Content-Type": "application/json" },
        body: { event: "contract_published", vu: vuId },
      },
      response: { status: 202 },
    }),
    contentType: "application/yaml",
    branch: "main",
  });

  const url = `${BASE_URL}/api/v1/applications/${appName}/versions/${version}/contracts`;
  const res = http.post(url, contractPayload, { headers });

  publishWithWebhookDuration.add(res.timings.duration);

  const success = check(res, {
    "contract published with webhook (201)": (r) => r.status === 201,
  });

  if (!success) {
    publishWithWebhookErrors.add(1);
  }

  sleep(0.2 + Math.random() * 0.3);
}

export function teardown(data) {
  const headers = buildAuthHeaders();

  // Delete webhooks
  for (const webhookId of data.webhookIds) {
    http.del(`${BASE_URL}/api/v1/webhooks/${webhookId}`, null, { headers });
  }

  // Delete applications (cascades contracts)
  for (const appName of data.apps) {
    http.del(`${BASE_URL}/api/v1/applications/${appName}`, null, { headers });
  }
}
