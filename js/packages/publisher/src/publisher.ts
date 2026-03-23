import type { BrokerClient, ContractResponse } from "@stubborn-sh/broker-client";
import type { ScannedContract } from "./scanner.js";
import { scanContracts } from "./scanner.js";

/** Options for publishing contracts. */
export interface PublishOptions {
  /** Application name to publish contracts for. */
  readonly applicationName: string;
  /** Version of the application. */
  readonly version: string;
  /** Directory containing contract files. */
  readonly contractsDir: string;
}

/** Result of a publish operation. */
export interface PublishResult {
  readonly published: readonly ContractResponse[];
  readonly errors: readonly PublishError[];
}

/** A single contract publish failure. */
export interface PublishError {
  readonly contractName: string;
  readonly error: Error;
}

/** Publishes contracts from a directory to the broker. */
export class ContractPublisher {
  private readonly client: BrokerClient;

  constructor(client: BrokerClient) {
    this.client = client;
  }

  /**
   * Scan a directory for contracts and publish them to the broker.
   * Returns published contracts and any errors encountered.
   */
  async publish(options: PublishOptions): Promise<PublishResult> {
    const scanned = await scanContracts(options.contractsDir);

    if (scanned.length === 0) {
      return { published: [], errors: [] };
    }

    const published: ContractResponse[] = [];
    const errors: PublishError[] = [];

    for (const contract of scanned) {
      try {
        const result = await this.client.publishContract(options.applicationName, options.version, {
          contractName: contract.contractName,
          content: contract.content,
          contentType: contract.contentType,
        });
        published.push(result);
      } catch (err: unknown) {
        errors.push({
          contractName: contract.contractName,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    return { published, errors };
  }

  /**
   * Publish a single pre-scanned contract.
   */
  async publishOne(
    applicationName: string,
    version: string,
    contract: ScannedContract,
  ): Promise<ContractResponse> {
    return this.client.publishContract(applicationName, version, {
      contractName: contract.contractName,
      content: contract.content,
      contentType: contract.contentType,
    });
  }
}
