import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Kafka } from "kafkajs";
import { isMessagingContract, parseMessagingContract } from "@stubborn-sh/messaging";
import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

import { VerificationService, type VerificationResult } from "../../src/verification-service.js";

const CONTRACTS_DIR = resolve(import.meta.dirname, "../../contracts");

describe("JS Kafka Producer contract flow", () => {
  it("should have valid messaging contracts in contracts directory", async () => {
    // given
    const contractFiles = await findYamlFiles(CONTRACTS_DIR);

    // then
    expect(contractFiles.length).toBeGreaterThan(0);

    for (const file of contractFiles) {
      const content = await readFile(file, "utf-8");
      expect(isMessagingContract(content)).toBe(true);

      const contract = parseMessagingContract(file, content);
      expect(contract.destination).toBe("verifications");
      expect(contract.direction).toBe("PUBLISH");
      expect(contract.label).toBe("accepted_verification");
    }
  });

  it("should parse contract body matching VerificationResult shape", async () => {
    // given
    const contractFiles = await findYamlFiles(CONTRACTS_DIR);
    const content = await readFile(contractFiles[0]!, "utf-8");

    // when
    const contract = parseMessagingContract("test", content);

    // then
    const body = contract.body as VerificationResult;
    expect(body.id).toBe("vrf-001");
    expect(body.status).toBe("ACCEPTED");
    expect(body.reason).toBe("All checks passed");
  });

  it("should create VerificationService with valid Kafka client", () => {
    // given
    const kafka = new Kafka({ clientId: "test", brokers: ["localhost:9092"] });

    // when
    const service = new VerificationService(kafka);

    // then
    expect(service).toBeDefined();
  });
});

async function findYamlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findYamlFiles(fullPath)));
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      files.push(fullPath);
    }
  }
  return files;
}
