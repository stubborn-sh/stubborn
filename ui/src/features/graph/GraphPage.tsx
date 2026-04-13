import { useState, useMemo } from "react";
import { useGraph, useApplicationDependencies } from "./useGraph";
import { DataTable, SearchInput, AppLink } from "@/shared/components";
import { Badge } from "@/shared/components/ui";
import type { DependencyEdge, MessagingEdge } from "@/api/types";
import { useSearchParams } from "react-router-dom";
import DependencyGraph from "./DependencyGraph";
import { inferSubscribers } from "./inferSubscribers";

const edgeColumns = [
  {
    key: "providerName",
    header: "Provider",
    render: (e: DependencyEdge) => (
      <span className="font-medium text-foreground">
        <AppLink name={e.providerName} />{" "}
        <span className="text-muted-foreground text-xs">v{e.providerVersion}</span>
      </span>
    ),
  },
  {
    key: "consumerName",
    header: "Consumer",
    render: (e: DependencyEdge) => (
      <span className="text-foreground">
        <AppLink name={e.consumerName} />{" "}
        <span className="text-muted-foreground text-xs">v{e.consumerVersion}</span>
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (e: DependencyEdge) => (
      <Badge variant={e.status === "SUCCESS" ? "success" : "failed"}>{e.status}</Badge>
    ),
  },
  {
    key: "verifiedAt",
    header: "Verified At",
    render: (e: DependencyEdge) => (
      <span className="text-muted-foreground">{new Date(e.verifiedAt).toLocaleString()}</span>
    ),
  },
];

const messagingEdgeColumns = [
  {
    key: "applicationName",
    header: "Application",
    render: (e: MessagingEdge) => (
      <span className="font-medium text-foreground">
        <AppLink name={e.applicationName} />{" "}
        <span className="text-muted-foreground text-xs">v{e.version}</span>
      </span>
    ),
  },
  {
    key: "topicName",
    header: "Topic",
    render: (e: MessagingEdge) => <span className="text-foreground">{e.topicName}</span>,
  },
];

export default function GraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "table" ? "table" : "graph";
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const { data: graph, isLoading, error } = useGraph();
  const { data: appDeps } = useApplicationDependencies(selectedApp);

  const setView = (v: "graph" | "table") => {
    setSelectedApp(null);
    setSearchParams(v === "table" ? { view: "table" } : {}, { replace: true });
  };

  const sorted = useMemo(() => {
    const filtered =
      graph?.edges.filter(
        (e) =>
          e.providerName.toLowerCase().includes(search.toLowerCase()) ||
          e.consumerName.toLowerCase().includes(search.toLowerCase()),
      ) ?? [];
    return [...filtered].sort(
      (a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime(),
    );
  }, [graph, search]);

  const totalElements = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleGraphNodeSelect = (name: string | null) => {
    setSelectedApp(name);
  };

  if (error) return <p className="text-red-600">Failed to load dependency graph</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
            Dependencies
          </h2>
          <p className="text-muted-foreground mt-1">
            Service dependency graph derived from verifications
          </p>
        </div>
        <div className="flex rounded-md border border-border" role="tablist">
          <button
            role="tab"
            aria-selected={view === "graph"}
            onClick={() => {
              setView("graph");
            }}
            className={`px-3 py-1.5 text-sm transition-colors ${
              view === "graph"
                ? "bg-emerald-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            } rounded-l-md`}
          >
            Graph
          </button>
          <button
            role="tab"
            aria-selected={view === "table"}
            onClick={() => {
              setView("table");
            }}
            className={`px-3 py-1.5 text-sm transition-colors ${
              view === "table"
                ? "bg-emerald-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            } rounded-r-md`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "graph" ? (
        <>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : graph && graph.nodes.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                This graph shows <strong>contract dependencies</strong> derived from verifications
                and published messaging contracts &mdash; not actual runtime calls.
              </p>
              <DependencyGraph
                nodes={graph.nodes}
                edges={graph.edges}
                messagingEdges={inferSubscribers(graph.edges, graph.messagingEdges ?? [])}
                onNodeSelect={handleGraphNodeSelect}
              />
              {selectedApp && appDeps && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-foreground">{selectedApp}</h3>
                    <button
                      onClick={() => {
                        setSelectedApp(null);
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear selection
                    </button>
                  </div>
                  {appDeps.providers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Depends on (providers)
                      </h4>
                      <DataTable
                        data={appDeps.providers}
                        columns={edgeColumns}
                        keyFn={(e) => `${e.providerName}-${e.providerVersion}-${e.consumerVersion}`}
                      />
                    </div>
                  )}
                  {appDeps.consumers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Depended on by (consumers)
                      </h4>
                      <DataTable
                        data={appDeps.consumers}
                        columns={edgeColumns}
                        keyFn={(e) => `${e.consumerName}-${e.consumerVersion}-${e.providerVersion}`}
                      />
                    </div>
                  )}
                  {appDeps.providers.length === 0 && appDeps.consumers.length === 0 && (
                    <p className="text-muted-foreground">
                      No dependencies found for this application.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No data available</p>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-4 items-end">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Filter by app name..."
            />
            {selectedApp && (
              <button
                onClick={() => {
                  setSelectedApp(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                Clear selection
              </button>
            )}
          </div>

          {selectedApp && appDeps ? (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground">{selectedApp}</h3>
              {appDeps.providers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Depends on (providers)
                  </h4>
                  <DataTable
                    data={appDeps.providers}
                    columns={edgeColumns}
                    keyFn={(e) => `${e.providerName}-${e.providerVersion}-${e.consumerVersion}`}
                  />
                </div>
              )}
              {appDeps.consumers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Depended on by (consumers)
                  </h4>
                  <DataTable
                    data={appDeps.consumers}
                    columns={edgeColumns}
                    keyFn={(e) => `${e.consumerName}-${e.consumerVersion}-${e.providerVersion}`}
                  />
                </div>
              )}
              {appDeps.providers.length === 0 && appDeps.consumers.length === 0 && (
                <p className="text-muted-foreground">No dependencies found for this application.</p>
              )}
            </div>
          ) : (
            <>
              {graph && graph.nodes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {graph.nodes.map((node) => (
                    <button
                      key={node.applicationId}
                      onClick={() => {
                        setSelectedApp(node.applicationName);
                      }}
                      className="px-3 py-1.5 text-sm rounded-md bg-card border border-border hover:bg-accent transition-colors"
                    >
                      {node.applicationName}
                      <span className="text-muted-foreground text-xs ml-1">({node.owner})</span>
                    </button>
                  ))}
                </div>
              )}
              {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <>
                  <DataTable
                    data={paged}
                    columns={edgeColumns}
                    keyFn={(e) =>
                      `${e.providerName}-${e.providerVersion}-${e.consumerName}-${e.consumerVersion}`
                    }
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
                  {graph?.messagingEdges && graph.messagingEdges.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">Messaging Edges</h3>
                      <DataTable
                        data={graph.messagingEdges}
                        columns={messagingEdgeColumns}
                        keyFn={(e) => `${e.applicationName}-${e.topicName}-${e.version}`}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
