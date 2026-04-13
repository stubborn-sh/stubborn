import type { DependencyEdge, MessagingEdge } from "@/api/types";

export interface InferredMessagingEdges {
  publishers: MessagingEdge[];
  subscribers: MessagingEdge[];
}

/**
 * Separate messaging edges into publishers (from API) and inferred subscribers.
 *
 * If consumer A has a successful verification against provider B,
 * and B publishes to topic T, then A is inferred as a subscriber to T.
 *
 * This is a contract-level inference — it shows which services depend on
 * which topics based on their verified contract relationships, not actual
 * runtime message consumption.
 */
export function inferSubscribers(
  httpEdges: DependencyEdge[],
  messagingEdges: MessagingEdge[],
): InferredMessagingEdges {
  // Build a map: provider → topics they publish to
  const providerTopics = new Map<string, Set<string>>();
  for (const me of messagingEdges) {
    const topics = providerTopics.get(me.applicationName) ?? new Set<string>();
    topics.add(me.topicName);
    providerTopics.set(me.applicationName, topics);
  }

  // Build a set of existing publisher edges for dedup
  const existing = new Set(messagingEdges.map((e) => `${e.applicationName}:${e.topicName}`));

  // Infer subscribers from successful verifications
  const subscribers: MessagingEdge[] = [];
  for (const edge of httpEdges) {
    if (edge.status !== "SUCCESS") continue;
    if (edge.consumerName === edge.providerName) continue;

    const topics = providerTopics.get(edge.providerName);
    if (!topics) continue;

    for (const topic of topics) {
      const key = `${edge.consumerName}:${topic}`;
      if (!existing.has(key)) {
        existing.add(key);
        subscribers.push({
          applicationName: edge.consumerName,
          topicName: topic,
          version: edge.consumerVersion,
        });
      }
    }
  }

  return { publishers: messagingEdges, subscribers };
}
