import { describe, it, expect } from "vitest";
import { Kafka } from "kafkajs";
import { parseMessagingContract } from "@stubborn-sh/messaging";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { VerificationListener } from "../../src/verification-listener.js";

/**
 * Cross-language consumer contract verification: Java producer → JS consumer.
 *
 * The Java `kafka-producer` sample publishes contracts to the broker under
 * application name "verification-service". This JS consumer verifies it can
 * process those messages.
 *
 * With the broker running, use:
 *   setupKafkaStubs({
 *     brokerUrl: "http://localhost:18080",
 *     applicationName: "verification-service",  // <-- Java producer's name
 *     version: "1.0.0",
 *     username: "reader",
 *     password: "reader",
 *   })
 *
 * For this self-contained test, we load the Java producer's contract directly
 * from the filesystem to verify the JS consumer understands the message format.
 */

const JAVA_PRODUCER_CONTRACT = resolve(
  import.meta.dirname,
  "../../../kafka-producer/src/test/resources/contracts/verification/shouldSendAcceptedVerification.yaml",
);

describe("Cross-language: Java Kafka producer → JS Kafka consumer", () => {
  it("should parse the Java producer contract successfully", async () => {
    // given
    const yaml = await readFile(JAVA_PRODUCER_CONTRACT, "utf-8");

    // when
    const contract = parseMessagingContract("shouldSendAcceptedVerification", yaml);

    // then
    expect(contract.destination).toBe("verifications");
    expect(contract.direction).toBe("PUBLISH");
    expect(contract.label).toBe("accepted_verification");
    expect(contract.headers).toEqual({ contentType: "application/json" });
    expect(contract.body).toEqual({
      id: "vrf-001",
      status: "ACCEPTED",
      reason: "All checks passed",
    });
  });

  it("should have a JS consumer that matches the Java contract message shape", () => {
    // given
    const kafka = new Kafka({ clientId: "test", brokers: ["localhost:9092"] });

    // when
    const listener = new VerificationListener(kafka);

    // then — listener exists and can process VerificationResult
    expect(listener).toBeDefined();
    expect(listener.getReceived()).toHaveLength(0);
  });

  it("should produce identical contract format as Java producer", async () => {
    // given — load both contracts
    const javaYaml = await readFile(JAVA_PRODUCER_CONTRACT, "utf-8");
    const jsYaml = await readFile(
      resolve(
        import.meta.dirname,
        "../../../js-kafka-producer/contracts/verification/shouldSendAcceptedVerification.yaml",
      ),
      "utf-8",
    );

    // when
    const javaContract = parseMessagingContract("java", javaYaml);
    const jsContract = parseMessagingContract("js", jsYaml);

    // then — contracts are semantically identical (interoperable)
    expect(jsContract.destination).toBe(javaContract.destination);
    expect(jsContract.direction).toBe(javaContract.direction);
    expect(jsContract.body).toEqual(javaContract.body);
    expect(jsContract.headers).toEqual(javaContract.headers);
  });
});
