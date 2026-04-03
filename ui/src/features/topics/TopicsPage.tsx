import { useState } from "react";
import { useTopics } from "./useTopics";
import { DataTable, AppLink } from "@/shared/components";
import { Badge } from "@/shared/components/ui";
import type { TopicNode } from "@/api/types";

const topicColumns = [
  {
    key: "topicName",
    header: "Topic",
    render: (t: TopicNode) => <span className="font-medium text-foreground">{t.topicName}</span>,
  },
  {
    key: "publishers",
    header: "Publishers",
    render: (t: TopicNode) => (
      <div className="flex flex-wrap gap-1">
        {t.publishers.map((p) => (
          <Badge key={`${p.applicationName}-${p.version}`} variant="default">
            <AppLink name={p.applicationName} />
            <span className="text-xs ml-1">v{p.version}</span>
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: "publisherCount",
    header: "# Publishers",
    render: (t: TopicNode) => <span className="text-muted-foreground">{t.publishers.length}</span>,
  },
];

export default function TopicsPage() {
  const { data, isLoading, error } = useTopics();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  if (error) return <p className="text-red-600">Failed to load topics</p>;

  const topics = data?.topics ?? [];
  const totalElements = topics.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const paged = topics.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Topics
        </h2>
        <p className="text-muted-foreground mt-1">
          Messaging topic topology — which applications publish to which topics
        </p>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : topics.length > 0 ? (
        <DataTable
          data={paged}
          columns={topicColumns}
          keyFn={(t) => t.topicName}
          pagination={{
            page,
            pageSize,
            totalElements,
            totalPages,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(0);
            },
          }}
        />
      ) : (
        <p className="text-muted-foreground">
          No topics found. Publish messaging contracts to see topic topology.
        </p>
      )}
    </div>
  );
}
