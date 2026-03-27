import http from "k6/http";
import { check, sleep } from "k6";
import encoding from "k6/encoding";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BROKER_URL || "http://localhost:8642";
const AUTH_USER = __ENV.BROKER_USER || "admin";
const AUTH_PASS = __ENV.BROKER_PASS || "admin";

const canIDeployErrors = new Counter("can_i_deploy_errors");
const canIDeployDuration = new Trend("can_i_deploy_duration", true);

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"],
    http_req_failed: ["rate<0.001"],
    can_i_deploy_duration: ["p(95)<200"],
  },
};

function buildAuthHeaders() {
  const token = encoding.b64encode(`${AUTH_USER}:${AUTH_PASS}`);
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

const ENVIRONMENTS = ["staging", "production", "dev", "qa", "load-test"];
const APP_COUNT = 20;

export function setup() {
  const headers = buildAuthHeaders();

  // Register applications and publish contracts so can-i-deploy has data
  const apps = [];
  for (let i = 0; i < APP_COUNT; i++) {
    const appName = `cid-load-app-${i}`;
    const payload = JSON.stringify({
      name: appName,
      description: `Can-I-Deploy load test app ${i}`,
      owner: "load-test",
    });

    const res = http.post(`${BASE_URL}/api/v1/applications`, payload, {
      headers,
    });
    if (res.status === 201 || res.status === 409) {
      apps.push(appName);
    }
  }

  // Create environments
  for (const env of ENVIRONMENTS) {
    const envPayload = JSON.stringify({
      name: env,
      description: `Load test env: ${env}`,
      displayOrder: ENVIRONMENTS.indexOf(env),
      production: env === "production",
    });
    http.post(`${BASE_URL}/api/v1/environments`, envPayload, { headers });
  }

  // Publish some contracts and record deployments to seed data
  for (let i = 0; i < APP_COUNT; i++) {
    const appName = apps[i];
    for (let v = 1; v <= 3; v++) {
      const version = `1.0.${v}`;
      const contractPayload = JSON.stringify({
        contractName: `service-contract-${i}.yaml`,
        content: JSON.stringify({
          request: { method: "GET", url: `/api/resource/${i}` },
          response: { status: 200, body: { id: i } },
        }),
        contentType: "application/yaml",
        branch: "main",
      });
      http.post(
        `${BASE_URL}/api/v1/applications/${appName}/versions/${version}/contracts`,
        contractPayload,
        { headers },
      );

      // Deploy the latest version to a random environment
      if (v === 3) {
        for (const env of ENVIRONMENTS) {
          const deployPayload = JSON.stringify({
            applicationName: appName,
            version: version,
          });
          http.post(
            `${BASE_URL}/api/v1/environments/${env}/deployments`,
            deployPayload,
            { headers },
          );
        }
      }
    }
  }

  return { apps };
}

export default function (data) {
  const headers = buildAuthHeaders();
  const appIndex = __VU % data.apps.length;
  const appName = data.apps[appIndex];
  const version = `1.0.${((__ITER % 3) + 1)}`;
  const env = ENVIRONMENTS[__ITER % ENVIRONMENTS.length];

  const url =
    `${BASE_URL}/api/v1/can-i-deploy` +
    `?application=${encodeURIComponent(appName)}` +
    `&version=${encodeURIComponent(version)}` +
    `&environment=${encodeURIComponent(env)}`;

  const res = http.get(url, { headers });

  canIDeployDuration.add(res.timings.duration);

  const success = check(res, {
    "can-i-deploy responded (200)": (r) => r.status === 200,
    "response has safe field": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.safe !== undefined;
      } catch (_e) {
        return false;
      }
    },
  });

  if (!success) {
    canIDeployErrors.add(1);
  }

  sleep(0.05 + Math.random() * 0.1);
}

export function teardown(data) {
  const headers = buildAuthHeaders();
  for (const appName of data.apps) {
    http.del(`${BASE_URL}/api/v1/applications/${appName}`, null, { headers });
  }
  for (const env of ENVIRONMENTS) {
    http.del(`${BASE_URL}/api/v1/environments/${env}`, null, { headers });
  }
}
