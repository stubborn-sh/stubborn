/**
 * Testcontainers-based Kafka setup for contract testing.
 * Equivalent of Java's {@code StubbornKafkaContainerConfiguration} with {@code @ServiceConnection}.
 *
 * Requires peer dependencies: testcontainers, @testcontainers/kafka
 */

export interface KafkaContainerConfig {
  /** Kafka Docker image. Defaults to "confluentinc/cp-kafka:7.6.0". */
  readonly image?: string;
  /** Startup timeout in milliseconds. Defaults to 60000. */
  readonly startupTimeoutMs?: number;
}

export interface StartedKafkaContext {
  /** Kafka bootstrap servers address (e.g., "localhost:55000"). */
  readonly bootstrapServers: string;
  /** Stop the container. */
  stop(): Promise<void>;
}

/**
 * Start a Kafka container via Testcontainers.
 * Returns bootstrap servers address for connecting kafkajs.
 *
 * @throws if @testcontainers/kafka is not installed
 */
export async function startKafkaContainer(
  config?: KafkaContainerConfig,
): Promise<StartedKafkaContext> {
  // Dynamic import — @testcontainers/kafka is an optional peer dependency
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod: { KafkaContainer: new (image: string) => KafkaContainerLike } = await import(
    "@testcontainers/kafka" as string
  );

  const image = config?.image ?? "confluentinc/cp-kafka:7.6.0";
  const timeout = config?.startupTimeoutMs ?? 60_000;

  const container = await new mod.KafkaContainer(image)
    .withExposedPorts(9093)
    .withStartupTimeout(timeout)
    .start();

  const bootstrapServers = `${container.getHost()}:${container.getMappedPort(9093)}`;

  return {
    bootstrapServers,
    async stop() {
      await container.stop();
    },
  };
}

/** Minimal type surface for the Testcontainers KafkaContainer. */
interface KafkaContainerLike {
  withExposedPorts(port: number): KafkaContainerLike;
  withStartupTimeout(ms: number): KafkaContainerLike;
  start(): Promise<StartedKafkaContainerLike>;
}

interface StartedKafkaContainerLike {
  getHost(): string;
  getMappedPort(port: number): number;
  stop(): Promise<void>;
}
