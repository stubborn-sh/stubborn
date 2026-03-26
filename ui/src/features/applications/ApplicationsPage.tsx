import { useState, useDeferredValue, useEffect } from "react";
import { useApplications, useApplication, useVersions } from "./useApplications";
import { DataTable, SearchInput } from "@/shared/components";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/shared/components/ui";
import type { ApplicationResponse } from "@/api/types";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ApplicationsPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const {
    data: pageData,
    isLoading,
    error,
  } = useApplications(deferredSearch || undefined, page, pageSize);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [autoExpandDone, setAutoExpandDone] = useState(false);

  useEffect(() => {
    if (initialSearch && pageData?.content.length === 1 && !autoExpandDone) {
      const name = pageData.content[0].name;
      const done = true;
      queueMicrotask(() => {
        setExpandedApp(name);
        setAutoExpandDone(done);
      });
    }
  }, [initialSearch, pageData, autoExpandDone]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (app: ApplicationResponse) => (
        <button
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          onClick={() => {
            setExpandedApp(expandedApp === app.name ? null : app.name);
          }}
        >
          {app.name}
        </button>
      ),
    },
    { key: "description", header: "Description" },
    { key: "owner", header: "Owner" },
    {
      key: "createdAt",
      header: "Created",
      render: (app: ApplicationResponse) => (
        <span className="text-muted-foreground">{new Date(app.createdAt).toLocaleString()}</span>
      ),
    },
  ];

  if (error) return <p className="text-red-600">Failed to load applications</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Applications
        </h2>
        <p className="text-muted-foreground mt-1">Registered applications in the broker</p>
      </div>
      <div className="max-w-md">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search applications..."
        />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          data={pageData?.content ?? []}
          columns={columns}
          keyFn={(app) => app.id}
          expandedKey={
            expandedApp ? (pageData?.content.find((a) => a.name === expandedApp)?.id ?? null) : null
          }
          renderExpandedRow={(app) => <ApplicationDetail name={app.name} />}
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
      )}
    </div>
  );
}

function ApplicationDetail({ name }: { name: string }) {
  const { data: app } = useApplication(name);
  const { data: versions } = useVersions(name);
  const navigate = useNavigate();

  if (!app) return <p className="text-muted-foreground">Loading details...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">{app.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Description</span>
            <p className="text-foreground">{app.description || "No description"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Owner</span>
            <p className="text-foreground">{app.owner}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Main Branch</span>
            <p className="text-foreground">{app.mainBranch ?? "main"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Repository</span>
            {app.repositoryUrl ? (
              <p>
                <a
                  href={app.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {app.repositoryUrl}
                </a>
              </p>
            ) : (
              <p className="text-muted-foreground">Not configured</p>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Created</span>
            <p className="text-foreground">{new Date(app.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            Published Versions ({versions?.length ?? 0})
          </p>
          {versions && versions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {versions.map((v) => (
                <button
                  key={v}
                  onClick={() =>
                    void navigate(
                      `/contracts?app=${encodeURIComponent(name)}&version=${encodeURIComponent(v)}`,
                    )
                  }
                  className="inline-block"
                >
                  <Badge variant="default">{v}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No contracts published yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
