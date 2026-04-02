import { Command } from "commander";
import type { BrokerClient } from "@stubborn-sh/broker-client";
import { formatOutput, formatSingle } from "../formatter.js";

export function createTopicsCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("topics").description("Topic topology");

  cmd
    .command("list")
    .description("List all topics with publishers")
    .action(async () => {
      const topology = await getClient().getTopics();
      if (getFormat() === "json") {
        console.log(JSON.stringify(topology, null, 2));
      } else {
        const rows = topology.topics.flatMap((t) =>
          t.publishers.map((p) => ({
            topic: t.topicName,
            application: p.applicationName,
            version: p.version,
          })),
        );
        console.log(formatOutput(rows, "table"));
      }
    });

  cmd
    .command("show <topicName>")
    .description("Show a single topic with its publishers")
    .action(async (topicName: string) => {
      const topic = await getClient().getTopicByName(topicName);
      if (getFormat() === "json") {
        console.log(JSON.stringify(topic, null, 2));
      } else {
        console.log(`Topic: ${topic.topicName}\n`);
        console.log("Publishers:");
        console.log(
          formatOutput(
            topic.publishers.map((p) => ({
              application: p.applicationName,
              version: p.version,
            })),
            "table",
          ),
        );
      }
    });

  cmd
    .command("app <appName>")
    .description("Show topics for a specific application")
    .action(async (appName: string) => {
      const topology = await getClient().getTopicsForApplication(appName);
      if (getFormat() === "json") {
        console.log(JSON.stringify(topology, null, 2));
      } else {
        const rows = topology.topics.flatMap((t) =>
          t.publishers.map((p) => ({
            topic: t.topicName,
            application: p.applicationName,
            version: p.version,
          })),
        );
        console.log(formatOutput(rows, "table"));
      }
    });

  return cmd;
}
