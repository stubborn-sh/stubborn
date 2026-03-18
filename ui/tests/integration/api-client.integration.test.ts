import { describe, it, expect } from "vitest";

describe("API Client Integration", () => {
  // These tests require Stub Runner to be running on port 8083
  // They are skipped unless VITE_BROKER_API_URL is set
  const brokerUrl = import.meta.env.VITE_BROKER_API_URL;

  it.skipIf(!brokerUrl)("should list applications from stub runner", async () => {
    const response = await fetch(`${brokerUrl}/api/v1/applications`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty("content");
    expect(Array.isArray(data.content)).toBe(true);
  });

  it.skipIf(!brokerUrl)("should check can-i-deploy from stub runner", async () => {
    const response = await fetch(
      `${brokerUrl}/api/v1/can-i-deploy?application=test-app&version=1.0.0&environment=staging`,
    );
    expect(response.ok).toBe(true);
  });
});
