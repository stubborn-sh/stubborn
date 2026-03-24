import { useState, useMemo } from "react";
import { useTags } from "./useTags";
import { useSearchApplications, useVersions } from "@/features/applications";
import { DataTable, AsyncComboBox, ComboBox } from "@/shared/components";
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from "@/shared/components/ui";
import type { TagResponse } from "@/api/types";

const columns = [
  {
    key: "tag",
    header: "Tag",
    render: (t: TagResponse) => <span className="font-medium text-foreground">{t.tag}</span>,
  },
  {
    key: "version",
    header: "Version",
    render: (t: TagResponse) => <span className="text-foreground">{t.version}</span>,
  },
  {
    key: "createdAt",
    header: "Created At",
    render: (t: TagResponse) => (
      <span className="text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</span>
    ),
  },
];

export default function TagsPage() {
  const searchApps = useSearchApplications();
  const [appName, setAppName] = useState("");
  const [version, setVersion] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { data: versions } = useVersions(appName);

  const queryApp = submitted ? appName : "";
  const queryVersion = submitted ? version : "";

  const { data: tags, isLoading, error } = useTags(queryApp, queryVersion);

  const knownTags = useMemo(() => {
    if (!tags) return [];
    return [...new Set(tags.map((t) => t.tag))];
  }, [tags]);

  const filteredTags = useMemo(() => {
    if (!tags) return [];
    if (!tagFilter) return tags;
    return tags.filter((t) => t.tag.toLowerCase().includes(tagFilter.toLowerCase()));
  }, [tags, tagFilter]);

  const handleLookup = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Version Tags
        </h2>
        <p className="text-muted-foreground mt-1">
          Look up tags for a specific application version
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Tag Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Application</Label>
                <AsyncComboBox
                  fetchOptions={searchApps}
                  value={appName}
                  onChange={(val) => {
                    setAppName(val);
                    setVersion("");
                    setSubmitted(false);
                  }}
                  placeholder="Select application"
                />
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <ComboBox
                  options={versions ?? []}
                  value={version}
                  onChange={(val) => {
                    setVersion(val);
                    setSubmitted(false);
                  }}
                  placeholder={
                    !appName
                      ? "Select app first"
                      : versions?.length
                        ? "Select version"
                        : "No versions found"
                  }
                  disabled={!appName || !versions?.length}
                />
              </div>
            </div>
            <Button type="submit" disabled={!appName || !version}>
              Look up tags
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-red-600">Failed to load tags</p>}
      {tags && (
        <>
          {knownTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by tag:</span>
              <button
                className={`px-2 py-1 rounded text-xs ${!tagFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                onClick={() => setTagFilter("")}
              >
                All
              </button>
              {knownTags.map((t) => (
                <button
                  key={t}
                  className={`px-2 py-1 rounded text-xs ${tagFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                  onClick={() => setTagFilter(tagFilter === t ? "" : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <DataTable data={filteredTags} columns={columns} keyFn={(t) => `${t.tag}-${t.version}`} />
        </>
      )}
    </div>
  );
}
