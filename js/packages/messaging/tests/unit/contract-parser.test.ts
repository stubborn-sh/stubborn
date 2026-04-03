import { describe, it, expect } from "vitest";
import { isMessagingContract, parseMessagingContract } from "../../src/contract-parser.js";

describe("isMessagingContract", () => {
  it("should return true when contract has outputMessage.sentTo", () => {
    // given
    const yaml = `
description: Send verification
label: accepted_verification
input:
  triggeredBy: triggerVerification()
outputMessage:
  sentTo: verifications
  headers:
    contentType: application/json
  body:
    id: "vrf-001"
    status: "ACCEPTED"
`;

    // when
    const result = isMessagingContract(yaml);

    // then
    expect(result).toBe(true);
  });

  it("should return true when contract has input.messageFrom", () => {
    // given
    const yaml = `
description: Consume verification
input:
  messageFrom: verifications
outputMessage:
  sentTo: results
  body:
    processed: true
`;

    // when
    const result = isMessagingContract(yaml);

    // then
    expect(result).toBe(true);
  });

  it("should return false when contract is HTTP (request/response)", () => {
    // given
    const yaml = `
request:
  method: GET
  url: /api/v1/orders
response:
  status: 200
  body:
    id: "123"
`;

    // when
    const result = isMessagingContract(yaml);

    // then
    expect(result).toBe(false);
  });

  it("should return false when YAML is invalid", () => {
    // given
    const yaml = "{{invalid yaml";

    // when
    const result = isMessagingContract(yaml);

    // then
    expect(result).toBe(false);
  });

  it("should return false when content is not an object", () => {
    // given
    const yaml = "just a string";

    // when
    const result = isMessagingContract(yaml);

    // then
    expect(result).toBe(false);
  });
});

describe("parseMessagingContract", () => {
  it("should parse producer contract with outputMessage.sentTo and input.triggeredBy", () => {
    // given
    const yaml = `
description: When verification is accepted, a message is sent to the verifications topic
label: accepted_verification
input:
  triggeredBy: triggerVerification()
outputMessage:
  sentTo: verifications
  headers:
    contentType: application/json
  body:
    id: "vrf-001"
    status: "ACCEPTED"
    reason: "All checks passed"
`;

    // when
    const result = parseMessagingContract("shouldSendAcceptedVerification", yaml);

    // then
    expect(result.name).toBe("shouldSendAcceptedVerification");
    expect(result.description).toBe(
      "When verification is accepted, a message is sent to the verifications topic",
    );
    expect(result.label).toBe("accepted_verification");
    expect(result.destination).toBe("verifications");
    expect(result.direction).toBe("PUBLISH");
    expect(result.triggeredBy).toBe("triggerVerification()");
    expect(result.headers).toEqual({ contentType: "application/json" });
    expect(result.body).toEqual({
      id: "vrf-001",
      status: "ACCEPTED",
      reason: "All checks passed",
    });
  });

  it("should parse consumer contract with input.messageFrom", () => {
    // given
    const yaml = `
description: Consume events from verifications topic
label: consume_verification
input:
  messageFrom: verifications
outputMessage:
  sentTo: results
  body:
    processed: true
`;

    // when
    const result = parseMessagingContract("shouldConsumeVerification", yaml);

    // then
    expect(result.name).toBe("shouldConsumeVerification");
    expect(result.destination).toBe("verifications");
    expect(result.direction).toBe("SUBSCRIBE");
    expect(result.triggeredBy).toBeUndefined();
  });

  it("should parse contract with outputMessage.sentTo but no triggeredBy", () => {
    // given
    const yaml = `
description: Publishes event
outputMessage:
  sentTo: events
  body:
    type: "created"
`;

    // when
    const result = parseMessagingContract("shouldPublishEvent", yaml);

    // then
    expect(result.destination).toBe("events");
    expect(result.direction).toBe("PUBLISH");
    expect(result.triggeredBy).toBeUndefined();
  });

  it("should use name as label when label is missing", () => {
    // given
    const yaml = `
outputMessage:
  sentTo: events
  body:
    type: "created"
`;

    // when
    const result = parseMessagingContract("myContract", yaml);

    // then
    expect(result.label).toBe("myContract");
  });

  it("should default to empty headers when none provided", () => {
    // given
    const yaml = `
outputMessage:
  sentTo: events
  body:
    type: "created"
`;

    // when
    const result = parseMessagingContract("noHeaders", yaml);

    // then
    expect(result.headers).toEqual({});
  });

  it("should default to null body when none provided", () => {
    // given
    const yaml = `
outputMessage:
  sentTo: events
`;

    // when
    const result = parseMessagingContract("noBody", yaml);

    // then
    expect(result.body).toBeNull();
  });

  it("should throw when YAML is invalid", () => {
    // given
    const yaml = "{{invalid";

    // when/then
    expect(() => parseMessagingContract("bad", yaml)).toThrow(
      /Failed to parse YAML for messaging contract "bad"/,
    );
  });

  it("should throw when content is not an object", () => {
    // given
    const yaml = "just a string";

    // when/then
    expect(() => parseMessagingContract("bad", yaml)).toThrow(
      /Messaging contract "bad" is not a valid object/,
    );
  });

  it("should throw when neither sentTo nor messageFrom is present", () => {
    // given
    const yaml = `
description: Missing destination
input:
  triggeredBy: doSomething()
`;

    // when/then
    expect(() => parseMessagingContract("bad", yaml)).toThrow(
      /must have either "outputMessage.sentTo" or "input.messageFrom"/,
    );
  });

  it("should convert non-string header values to strings", () => {
    // given
    const yaml = `
outputMessage:
  sentTo: events
  headers:
    contentType: application/json
    priority: 5
  body:
    type: "created"
`;

    // when
    const result = parseMessagingContract("headerConversion", yaml);

    // then
    expect(result.headers).toEqual({
      contentType: "application/json",
      priority: "5",
    });
  });
});
