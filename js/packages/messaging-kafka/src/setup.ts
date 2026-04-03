import { Kafka } from "kafkajs";
import {
  type MessagingStubConfig,
  type MessagingContract,
  parseMessagingContract,
  isMessagingContract,
} from "@stubborn-sh/messaging";
import {
  BrokerClient,
  fetchAllPages,
  type PageParams,
  type ContractResponse,
} from "@stubborn-sh/broker-client";
import { KafkaSender } from "./kafka-sender.js";
import { KafkaReceiver } from "./kafka-receiver.js";
import {
  startKafkaContainer,
  type KafkaContainerConfig,
  type StartedKafkaContext,
} from "./kafka-container.js";

/** Full context returned by {@link setupKafkaStubs}. */
export interface KafkaStubContext {
  /** Kafka bootstrap servers address. */
  readonly bootstrapServers: string;
  /** kafkajs client instance, pre-configured with bootstrap servers. */
  readonly kafka: Kafka;
  /** Sender for publishing messages to topics. */
  readonly sender: KafkaSender;
  /** Receiver for consuming messages from topics. */
  readonly receiver: KafkaReceiver;
  /** Parsed messaging contracts loaded from the broker. */
  readonly contracts: readonly MessagingContract[];
  /**
   * Trigger a messaging contract by label.
   * Sends the contract's body and headers to its destination topic.
   * Equivalent of SCC's triggeredBy mechanism.
   */
  trigger(label: string): Promise<void>;
}

/** Configuration for Kafka stub setup. */
export interface SetupKafkaStubsConfig extends MessagingStubConfig {
  /** Skip Testcontainers and connect to an existing Kafka. */
  readonly bootstrapServers?: string;
  /** Kafka container configuration (ignored if bootstrapServers is provided). */
  readonly containerConfig?: KafkaContainerConfig;
  /** Consumer group ID. Defaults to "stubborn-test". */
  readonly groupId?: string;
}

let context: KafkaStubContext | null = null;
let containerContext: StartedKafkaContext | null = null;

/**
 * Set up Kafka stubs for messaging contract tests.
 *
 * 1. Starts a Kafka container (or connects to an existing one)
 * 2. Fetches messaging contracts from the broker
 * 3. Creates a KafkaSender + KafkaReceiver
 * 4. Returns a context with a `trigger(label)` method
 *
 * Call in `beforeAll`. Pair with {@link teardownKafkaStubs} in `afterAll`.
 */
export async function setupKafkaStubs(config: SetupKafkaStubsConfig): Promise<KafkaStubContext> {
  let bootstrapServers: string;

  if (config.bootstrapServers !== undefined) {
    bootstrapServers = config.bootstrapServers;
  } else {
    containerContext = await startKafkaContainer(config.containerConfig);
    bootstrapServers = containerContext.bootstrapServers;
  }

  const kafka = new Kafka({
    clientId: "stubborn-test",
    brokers: [bootstrapServers],
  });

  const contracts = await loadMessagingContracts(config);
  const groupId = config.groupId ?? "stubborn-test";
  const sender = new KafkaSender(kafka);
  const receiver = new KafkaReceiver(kafka, groupId);

  context = {
    bootstrapServers,
    kafka,
    sender,
    receiver,
    contracts,
    async trigger(label: string): Promise<void> {
      const contract = contracts.find((c) => c.label === label);
      if (contract === undefined) {
        const available = contracts.map((c) => c.label).join(", ");
        throw new Error(
          `No messaging contract found with label "${label}". Available: [${available}]`,
        );
      }
      await sender.send(contract.destination, contract.body, contract.headers);
    },
  };

  return context;
}

/** Tear down Kafka stubs. Disconnects clients and stops the container. */
export async function teardownKafkaStubs(ctx?: KafkaStubContext): Promise<void> {
  const target = ctx ?? context;
  if (target !== null) {
    await target.sender.close();
    await target.receiver.close();
  }
  if (containerContext !== null) {
    await containerContext.stop();
    containerContext = null;
  }
  context = null;
}

async function loadMessagingContracts(config: MessagingStubConfig): Promise<MessagingContract[]> {
  const client = new BrokerClient({
    baseUrl: config.brokerUrl,
    username: config.username,
    password: config.password,
    token: config.token,
  });

  const contractResponses = await fetchAllPages((params: PageParams) =>
    client.listContracts(config.applicationName, config.version, params),
  );

  return contractResponses
    .filter((c: ContractResponse) => c.contentType === "application/x-yaml")
    .filter((c: ContractResponse) => isMessagingContract(c.content))
    .map((c: ContractResponse) => parseMessagingContract(c.contractName, c.content));
}
