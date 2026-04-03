import amqplib from "amqplib";
import type { ChannelModel } from "amqplib";
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
import { RabbitSender } from "./rabbit-sender.js";
import { RabbitReceiver } from "./rabbit-receiver.js";
import {
  startRabbitContainer,
  type RabbitContainerConfig,
  type StartedRabbitContext,
} from "./rabbit-container.js";

/** Full context returned by {@link setupRabbitStubs}. */
export interface RabbitStubContext {
  /** AMQP connection URL. */
  readonly amqpUrl: string;
  /** Sender for publishing messages to queues. */
  readonly sender: RabbitSender;
  /** Receiver for consuming messages from queues. */
  readonly receiver: RabbitReceiver;
  /** Parsed messaging contracts loaded from the broker. */
  readonly contracts: readonly MessagingContract[];
  /**
   * Trigger a messaging contract by label.
   * Sends the contract's body and headers to its destination queue.
   */
  trigger(label: string): Promise<void>;
}

/** Configuration for RabbitMQ stub setup. */
export interface SetupRabbitStubsConfig extends MessagingStubConfig {
  /** Skip Testcontainers and connect to an existing RabbitMQ. */
  readonly amqpUrl?: string;
  /** RabbitMQ container configuration (ignored if amqpUrl is provided). */
  readonly containerConfig?: RabbitContainerConfig;
}

let context: RabbitStubContext | null = null;
let containerContext: StartedRabbitContext | null = null;
let channelModel: ChannelModel | null = null;

/**
 * Set up RabbitMQ stubs for messaging contract tests.
 *
 * 1. Starts a RabbitMQ container (or connects to an existing one)
 * 2. Fetches messaging contracts from the broker
 * 3. Creates a RabbitSender + RabbitReceiver
 * 4. Returns a context with a `trigger(label)` method
 *
 * Call in `beforeAll`. Pair with {@link teardownRabbitStubs} in `afterAll`.
 */
export async function setupRabbitStubs(config: SetupRabbitStubsConfig): Promise<RabbitStubContext> {
  let amqpUrl: string;

  if (config.amqpUrl !== undefined) {
    amqpUrl = config.amqpUrl;
  } else {
    containerContext = await startRabbitContainer(config.containerConfig);
    amqpUrl = containerContext.amqpUrl;
  }

  channelModel = await amqplib.connect(amqpUrl);
  const channel = await channelModel.createChannel();

  const contracts = await loadMessagingContracts(config);
  const sender = new RabbitSender(channel);
  const receiver = new RabbitReceiver(channel);

  context = {
    amqpUrl,
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

/** Tear down RabbitMQ stubs. Closes connection and stops the container. */
export async function teardownRabbitStubs(ctx?: RabbitStubContext): Promise<void> {
  const target = ctx ?? context;
  if (target !== null) {
    await target.receiver.close();
  }
  if (channelModel !== null) {
    await channelModel.close();
    channelModel = null;
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
