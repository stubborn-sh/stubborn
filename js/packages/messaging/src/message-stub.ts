import type { MessageSender, MessageReceiver, ReceivedMessage } from "./types.js";

/**
 * In-memory message stub that records sent messages and can replay them.
 * Useful for unit tests where no real broker is needed.
 */
export class MessageStub implements MessageSender, MessageReceiver {
  private readonly messages: Map<string, ReceivedMessage[]> = new Map();

  send(
    destination: string,
    payload: unknown,
    headers?: Readonly<Record<string, string>>,
  ): Promise<void> {
    const message: ReceivedMessage = {
      destination,
      payload,
      headers: headers ?? {},
    };
    const existing = this.messages.get(destination);
    if (existing !== undefined) {
      existing.push(message);
    } else {
      this.messages.set(destination, [message]);
    }
    return Promise.resolve();
  }

  receive(destination: string, _timeoutMs?: number): Promise<ReceivedMessage | null> {
    const queue = this.messages.get(destination);
    if (queue === undefined || queue.length === 0) {
      return Promise.resolve(null);
    }
    return Promise.resolve(queue.shift() ?? null);
  }

  close(): Promise<void> {
    this.messages.clear();
    return Promise.resolve();
  }

  /** Get all messages sent to a destination without consuming them. */
  getMessages(destination: string): readonly ReceivedMessage[] {
    return this.messages.get(destination) ?? [];
  }

  /** Get all messages across all destinations without consuming them. */
  getAllMessages(): readonly ReceivedMessage[] {
    const all: ReceivedMessage[] = [];
    for (const messages of this.messages.values()) {
      all.push(...messages);
    }
    return all;
  }

  /** Clear all recorded messages. */
  reset(): void {
    this.messages.clear();
  }
}
