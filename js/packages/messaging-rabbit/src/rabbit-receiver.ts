import type { Channel, ConsumeMessage } from "amqplib";
import type { MessageReceiver, ReceivedMessage } from "@stubborn-sh/messaging";

/**
 * {@link MessageReceiver} implementation using amqplib.
 * Consumes messages from RabbitMQ queues.
 */
export class RabbitReceiver implements MessageReceiver {
  private readonly buffer: Map<string, ReceivedMessage[]> = new Map();
  private readonly consumingQueues: Set<string> = new Set();

  constructor(private readonly channel: Channel) {}

  async receive(destination: string, timeoutMs?: number): Promise<ReceivedMessage | null> {
    if (!this.consumingQueues.has(destination)) {
      await this.channel.assertQueue(destination, { durable: false });
      await this.channel.consume(
        destination,
        (msg: ConsumeMessage | null) => {
          if (msg === null) return;
          const received = toReceivedMessage(destination, msg);
          const queue = this.buffer.get(destination);
          if (queue !== undefined) {
            queue.push(received);
          } else {
            this.buffer.set(destination, [received]);
          }
          this.channel.ack(msg);
        },
        { noAck: false },
      );
      this.consumingQueues.add(destination);
    }

    const timeout = timeoutMs ?? 5_000;
    const deadline = Date.now() + timeout;
    const pollInterval = 100;

    while (Date.now() < deadline) {
      const queue = this.buffer.get(destination);
      if (queue !== undefined && queue.length > 0) {
        return queue.shift() ?? null;
      }
      await sleep(pollInterval);
    }

    return null;
  }

  close(): Promise<void> {
    this.buffer.clear();
    this.consumingQueues.clear();
    return Promise.resolve();
  }
}

function toReceivedMessage(destination: string, msg: ConsumeMessage): ReceivedMessage {
  const headers: Record<string, string> = {};
  if (msg.properties.headers !== undefined) {
    for (const [key, value] of Object.entries(msg.properties.headers as Record<string, unknown>)) {
      if (value !== undefined) {
        headers[key] = typeof value === "string" ? value : JSON.stringify(value);
      }
    }
  }

  let parsedPayload: unknown;
  const raw = msg.content.toString();
  try {
    parsedPayload = JSON.parse(raw);
  } catch {
    parsedPayload = raw;
  }

  return {
    destination,
    payload: parsedPayload,
    headers,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
