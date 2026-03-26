import { useState, useDeferredValue } from "react";
import {
  useWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useWebhookExecutions,
} from "./useWebhooks";
import { useSearchApplications } from "@/features/applications";
import { DataTable, SearchInput, AsyncComboBox, AppLink } from "@/shared/components";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/shared/components/ui";
import type { WebhookResponse } from "@/api/types";

const EVENT_TYPES = [
  "CONTRACT_PUBLISHED",
  "VERIFICATION_SUCCEEDED",
  "VERIFICATION_FAILED",
  "DEPLOYMENT_RECORDED",
];

export default function WebhooksPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const {
    data: pageData,
    isLoading,
    error,
  } = useWebhooks(deferredSearch || undefined, page, pageSize);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  if (error) return <p className="text-red-600">Failed to load webhooks</p>;

  const columns = [
    {
      key: "applicationName",
      header: "Application",
      render: (w: WebhookResponse) =>
        w.applicationName ? (
          <AppLink name={w.applicationName} />
        ) : (
          <span className="font-medium text-muted-foreground">Global</span>
        ),
    },
    {
      key: "eventType",
      header: "Event Type",
      render: (w: WebhookResponse) => <Badge variant="default">{w.eventType}</Badge>,
    },
    {
      key: "url",
      header: "URL",
      render: (w: WebhookResponse) => (
        <span className="text-foreground font-mono text-xs">{w.url}</span>
      ),
    },
    {
      key: "enabled",
      header: "Enabled",
      render: (w: WebhookResponse) => (
        <Badge variant={w.enabled ? "success" : "failed"}>{w.enabled ? "YES" : "NO"}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (w: WebhookResponse) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExpandedId(expandedId === w.id ? null : w.id);
            }}
          >
            {expandedId === w.id ? "Hide" : "Details"}
          </Button>
          <DeleteWebhookButton id={w.id} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
            Webhooks
          </h2>
          <p className="text-muted-foreground mt-1">Manage webhook subscriptions for events</p>
        </div>
        <Button
          variant={showForm ? "outline" : "default"}
          onClick={() => {
            setShowForm(!showForm);
          }}
        >
          {showForm ? "Cancel" : "Create Webhook"}
        </Button>
      </div>

      {showForm && (
        <CreateWebhookForm
          onSuccess={() => {
            setShowForm(false);
          }}
        />
      )}

      <SearchInput value={search} onChange={handleSearchChange} placeholder="Search webhooks..." />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          <DataTable
            data={pageData?.content ?? []}
            columns={columns}
            keyFn={(w) => w.id}
            pagination={
              pageData
                ? {
                    page,
                    pageSize,
                    totalElements: pageData.totalElements,
                    totalPages: pageData.totalPages,
                    onPageChange: setPage,
                    onPageSizeChange: (size) => {
                      setPageSize(size);
                      setPage(0);
                    },
                  }
                : undefined
            }
          />
          {expandedId && <WebhookDetail id={expandedId} />}
        </>
      )}
    </div>
  );
}

function CreateWebhookForm({ onSuccess }: { onSuccess: () => void }) {
  const searchApps = useSearchApplications();
  const createWebhook = useCreateWebhook();
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [headers, setHeaders] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    createWebhook.mutate(
      {
        eventType,
        url,
        applicationName: appName || undefined,
        headers: headers || undefined,
        bodyTemplate: bodyTemplate || undefined,
      },
      { onSuccess },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Create Webhook</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <select
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value);
                }}
                className="flex h-9 w-full items-center rounded-md border bg-input-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                {EVENT_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Application (optional)</Label>
              <AsyncComboBox
                fetchOptions={searchApps}
                value={appName}
                onChange={setAppName}
                placeholder="Global (all applications)"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
              }}
              placeholder="https://hooks.example.com/webhook"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Custom Headers (JSON, optional)</Label>
            <Input
              type="text"
              value={headers}
              onChange={(e) => {
                setHeaders(e.target.value);
              }}
              placeholder='{"X-Custom-Header": "value"}'
            />
          </div>
          <div className="space-y-2">
            <Label>Body Template (optional)</Label>
            <Input
              type="text"
              value={bodyTemplate}
              onChange={(e) => {
                setBodyTemplate(e.target.value);
              }}
              placeholder="Custom body template..."
            />
          </div>
          <Button type="submit" disabled={!url || createWebhook.isPending}>
            {createWebhook.isPending ? "Creating..." : "Create"}
          </Button>
          {createWebhook.isError && (
            <p className="text-red-600 dark:text-red-400 text-sm">Failed to create webhook</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function DeleteWebhookButton({ id }: { id: string }) {
  const deleteWebhook = useDeleteWebhook();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            deleteWebhook.mutate(id, {
              onSuccess: () => {
                setConfirming(false);
              },
            });
          }}
          disabled={deleteWebhook.isPending}
        >
          {deleteWebhook.isPending ? "..." : "Confirm"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setConfirming(false);
          }}
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setConfirming(true);
      }}
    >
      Delete
    </Button>
  );
}

function WebhookDetail({ id }: { id: string }) {
  const { data: executions, isLoading } = useWebhookExecutions(id);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-foreground">Execution History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Loading executions...</p>}
        {executions?.length === 0 && (
          <p className="text-muted-foreground text-sm">No executions recorded yet</p>
        )}
        {executions && executions.length > 0 && (
          <div className="space-y-2">
            {executions.map((exec) => (
              <div
                key={exec.id}
                className="flex items-center gap-3 text-sm border-b border-border pb-2 last:border-0"
              >
                <Badge variant={exec.success ? "success" : "failed"}>
                  {exec.responseStatus != null ? String(exec.responseStatus) : "ERR"}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(exec.executedAt).toLocaleString()}
                </span>
                {exec.errorMessage && (
                  <span className="text-red-600 dark:text-red-400 text-xs">
                    {exec.errorMessage}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
