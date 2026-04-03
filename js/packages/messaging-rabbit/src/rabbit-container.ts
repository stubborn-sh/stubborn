/**
 * Testcontainers-based RabbitMQ setup for contract testing.
 * Equivalent of Java's {@code StubbornRabbitContainerConfiguration} with {@code @ServiceConnection}.
 *
 * Requires peer dependencies: testcontainers, @testcontainers/rabbitmq
 */

export interface RabbitContainerConfig {
  /** RabbitMQ Docker image. Defaults to "rabbitmq:4.0-management". */
  readonly image?: string;
  /** Startup timeout in milliseconds. Defaults to 60000. */
  readonly startupTimeoutMs?: number;
}

export interface StartedRabbitContext {
  /** AMQP connection URL (e.g., "amqp://localhost:55001"). */
  readonly amqpUrl: string;
  /** Stop the container. */
  stop(): Promise<void>;
}

/**
 * Start a RabbitMQ container via Testcontainers.
 * Returns AMQP URL for connecting amqplib.
 *
 * @throws if @testcontainers/rabbitmq is not installed
 */
export async function startRabbitContainer(
  config?: RabbitContainerConfig,
): Promise<StartedRabbitContext> {
  // Dynamic import — @testcontainers/rabbitmq is an optional peer dependency
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod: { RabbitMQContainer: new (image: string) => RabbitContainerLike } = await import(
    "@testcontainers/rabbitmq" as string
  );

  const image = config?.image ?? "rabbitmq:4.0-management";
  const timeout = config?.startupTimeoutMs ?? 60_000;

  const container = await new mod.RabbitMQContainer(image).withStartupTimeout(timeout).start();

  const amqpUrl = container.getAmqpUrl();

  return {
    amqpUrl,
    async stop() {
      await container.stop();
    },
  };
}

/** Minimal type surface for the Testcontainers RabbitMQContainer. */
interface RabbitContainerLike {
  withStartupTimeout(ms: number): RabbitContainerLike;
  start(): Promise<StartedRabbitContainerLike>;
}

interface StartedRabbitContainerLike {
  getAmqpUrl(): string;
  stop(): Promise<void>;
}
