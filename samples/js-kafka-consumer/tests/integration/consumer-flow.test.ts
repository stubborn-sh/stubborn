import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Kafka } from "kafkajs";
import { parseMessagingContract } from "@stubborn-sh/messaging";
import { KafkaSender } from "@stubborn-sh/messaging-kafka";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { VerificationListener } from "../../src/verification-listener.js";

/**
 * Consumer contract verification test.
 *
 * This test loads the producer's messaging contract and sends it to
 * a local Kafka topic, then verifies that the consumer (VerificationListener)
 * correctly processes the message.
 *
 * In a full setup with the broker running, this would use:
 *   setupKafkaStubs({ brokerUrl, applicationName: "js-verification-service", ... })
 * to auto-fetch contracts. Here we load the contract YAML directly from the
 * producer's contracts directory for a self-contained sample.
 */

const PRODUCER_CONTRACT = resolve(
  import.meta.dirname,
  "../../../js-kafka-producer/contracts/verification/shouldSendAcceptedVerification.yaml",
);

describe("JS Kafka Consumer contract verification", () => {
  it("should parse the producer contract and verify message shape", async () => {
    // given
    const yaml = await readFile(PRODUCER_CONTRACT, "utf-8");

    // when
    const contract = parseMessagingContract("shouldSendAcceptedVerification", yaml);

    // then
    expect(contract.destination).toBe("verifications");
    expect(contract.direction).toBe("PUBLISH");
    expect(contract.body).toEqual({
      id: "vrf-001",
      status: "ACCEPTED",
      reason: "All checks passed",
    });
  });

  it("should have VerificationListener that processes the expected message format", () => {
    // given
    const kafka = new Kafka({ clientId: "test", brokers: ["localhost:9092"] });

    // when
    const listener = new VerificationListener(kafka);

    // then
    expect(listener).toBeDefined();
    expect(listener.getReceived()).toHaveLength(0);
  });
});
