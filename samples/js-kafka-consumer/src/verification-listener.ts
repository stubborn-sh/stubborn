import type { Consumer, Kafka, EachMessagePayload } from "kafkajs";

export interface VerificationResult {
  readonly id: string;
  readonly status: string;
  readonly reason: string;
}

/**
 * Kafka consumer that listens on the "verifications" topic.
 * Equivalent of Java's {@code @KafkaListener} VerificationListener.
 */
export class VerificationListener {
  private readonly consumer: Consumer;
  private readonly received: VerificationResult[] = [];

  constructor(kafka: Kafka) {
    this.consumer = kafka.consumer({ groupId: "verification-processor" });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "verifications", fromBeginning: true });
    await this.consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        const raw = message.value?.toString();
        if (raw === undefined) return;
        try {
          const result = JSON.parse(raw) as VerificationResult;
          console.log(`Received verification: id=${result.id}, status=${result.status}`);
          this.received.push(result);
        } catch {
          console.error("Failed to parse verification message");
        }
      },
    });
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }

  getReceived(): readonly VerificationResult[] {
    return [...this.received];
  }
}
