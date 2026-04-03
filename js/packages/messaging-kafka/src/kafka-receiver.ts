import type { Consumer, Kafka, EachMessagePayload } from "kafkajs";
import type { MessageReceiver, ReceivedMessage } from "@stubborn-sh/messaging";

/**
 * {@link MessageReceiver} implementation using kafkajs Consumer.
 * Subscribes to Kafka topics and buffers received messages.
 */
export class KafkaReceiver implements MessageReceiver {
  private readonly consumer: Consumer;
  private readonly buffer: Map<string, ReceivedMessage[]> = new Map();
  private readonly subscribedTopics: Set<string> = new Set();
  private connected = false;

  constructor(kafka: Kafka, groupId: string) {
    this.consumer = kafka.consumer({ groupId });
  }

  async receive(destination: string, timeoutMs?: number): Promise<ReceivedMessage | null> {
    if (!this.connected) {
      await this.consumer.connect();
      this.connected = true;
    }

    if (!this.subscribedTopics.has(destination)) {
      await this.consumer.subscribe({ topic: destination, fromBeginning: true });
      this.subscribedTopics.add(destination);
      await this.consumer.run({
        eachMessage: (payload: EachMessagePayload) => {
          const msg = toReceivedMessage(payload);
          const queue = this.buffer.get(msg.destination);
          if (queue !== undefined) {
            queue.push(msg);
          } else {
            this.buffer.set(msg.destination, [msg]);
          }
        },
      });
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

  async close(): Promise<void> {
    if (this.connected) {
      await this.consumer.disconnect();
      this.connected = false;
    }
    this.buffer.clear();
    this.subscribedTopics.clear();
  }
}

function toReceivedMessage(payload: EachMessagePayload): ReceivedMessage {
  const headers: Record<string, string> = {};
  if (payload.message.headers !== undefined) {
    for (const [key, value] of Object.entries(payload.message.headers)) {
      if (value !== undefined) {
        headers[key] = value.toString();
      }
    }
  }

  let parsedPayload: unknown;
  const raw = payload.message.value?.toString() ?? "";
  try {
    parsedPayload = JSON.parse(raw);
  } catch {
    parsedPayload = raw;
  }

  return {
    destination: payload.topic,
    payload: parsedPayload,
    headers,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
