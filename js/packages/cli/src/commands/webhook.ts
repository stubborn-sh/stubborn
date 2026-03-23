import { Command } from "commander";
import type { BrokerClient, EventType } from "@stubborn-sh/broker-client";
import { formatOutput, formatSingle, formatSuccess } from "../formatter.js";

export function createWebhookCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("webhook").description("Manage webhooks");

  cmd
    .command("list")
    .description("List webhooks")
    .option("-s, --search <query>", "Search filter")
    .option("-p, --page <number>", "Page number", "0")
    .option("--size <number>", "Page size", "20")
    .action(async (opts: { search?: string; page: string; size: string }) => {
      const result = await getClient().listWebhooks({
        search: opts.search,
        page: parseInt(opts.page, 10),
        size: parseInt(opts.size, 10),
      });
      console.log(
        formatOutput(
          result.content.map((w) => ({
            id: w.id,
            eventType: w.eventType,
            url: w.url,
            enabled: w.enabled,
          })),
          getFormat(),
        ),
      );
    });

  cmd
    .command("get <id>")
    .description("Get webhook details")
    .action(async (id: string) => {
      const webhook = await getClient().getWebhook(id);
      console.log(formatSingle(webhook as unknown as Record<string, unknown>, getFormat()));
    });

  cmd
    .command("create")
    .description("Create a webhook")
    .requiredOption("--event <type>", "Event type")
    .requiredOption("--url <url>", "Webhook URL")
    .option("--app <name>", "Scope to application")
    .option("--headers <json>", "Headers as JSON string")
    .option("--body-template <template>", "Body template")
    .action(
      async (opts: {
        event: string;
        url: string;
        app?: string;
        headers?: string;
        bodyTemplate?: string;
      }) => {
        const webhook = await getClient().createWebhook({
          eventType: opts.event as EventType,
          url: opts.url,
          applicationName: opts.app,
          headers: opts.headers,
          bodyTemplate: opts.bodyTemplate,
        });
        console.log(formatSuccess(`Webhook "${webhook.id}" created.`));
      },
    );

  cmd
    .command("update <id>")
    .description("Update a webhook")
    .requiredOption("--event <type>", "Event type")
    .requiredOption("--url <url>", "Webhook URL")
    .option("--headers <json>", "Headers as JSON string")
    .option("--body-template <template>", "Body template")
    .option("--enabled <bool>", "Enable/disable webhook")
    .action(
      async (
        id: string,
        opts: {
          event: string;
          url: string;
          headers?: string;
          bodyTemplate?: string;
          enabled?: string;
        },
      ) => {
        await getClient().updateWebhook(id, {
          eventType: opts.event as EventType,
          url: opts.url,
          headers: opts.headers,
          bodyTemplate: opts.bodyTemplate,
          enabled: opts.enabled === undefined ? undefined : opts.enabled === "true",
        });
        console.log(formatSuccess(`Webhook "${id}" updated.`));
      },
    );

  cmd
    .command("delete <id>")
    .description("Delete a webhook")
    .action(async (id: string) => {
      await getClient().deleteWebhook(id);
      console.log(formatSuccess(`Webhook "${id}" deleted.`));
    });

  cmd
    .command("executions <id>")
    .description("List webhook executions")
    .option("-p, --page <number>", "Page number", "0")
    .option("--size <number>", "Page size", "20")
    .action(async (id: string, opts: { page: string; size: string }) => {
      const result = await getClient().listWebhookExecutions(id, {
        page: parseInt(opts.page, 10),
        size: parseInt(opts.size, 10),
      });
      console.log(
        formatOutput(
          result.content.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            success: e.success,
            responseStatus: e.responseStatus,
            executedAt: e.executedAt,
          })),
          getFormat(),
        ),
      );
    });

  return cmd;
}
