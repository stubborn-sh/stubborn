import { useState } from "react";
import {
  useMavenImportSources,
  useRegisterMavenSource,
  useDeleteMavenSource,
  useImportMavenJar,
} from "./useMavenImport";
import { DataTable } from "@/shared/components";
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
import type { MavenImportSourceResponse } from "@/api/types";

export default function MavenImportPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const { data: pageData, isLoading, error } = useMavenImportSources(page, pageSize);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  if (error) return <p className="text-red-600">Failed to load Maven import sources</p>;

  const columns = [
    {
      key: "repositoryUrl",
      header: "Repository URL",
      render: (s: MavenImportSourceResponse) => (
        <span className="text-foreground font-mono text-xs">{s.repositoryUrl}</span>
      ),
    },
    {
      key: "groupId",
      header: "Group ID",
      render: (s: MavenImportSourceResponse) => (
        <span className="text-foreground font-mono text-xs">{s.groupId}</span>
      ),
    },
    {
      key: "artifactId",
      header: "Artifact ID",
      render: (s: MavenImportSourceResponse) => (
        <span className="text-foreground font-mono text-xs">{s.artifactId}</span>
      ),
    },
    {
      key: "syncEnabled",
      header: "Sync Enabled",
      render: (s: MavenImportSourceResponse) => (
        <Badge variant={s.syncEnabled ? "success" : "failed"}>{s.syncEnabled ? "YES" : "NO"}</Badge>
      ),
    },
    {
      key: "lastSyncedVersion",
      header: "Last Synced Version",
      render: (s: MavenImportSourceResponse) => (
        <span className="text-muted-foreground text-xs">{s.lastSyncedVersion ?? "Never"}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (s: MavenImportSourceResponse) => <DeleteSourceButton id={s.id} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
            Maven Import
          </h2>
          <p className="text-muted-foreground mt-1">Import contracts from Maven repositories</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showImportForm ? "outline" : "default"}
            onClick={() => {
              setShowImportForm(!showImportForm);
              if (!showImportForm) setShowRegisterForm(false);
            }}
          >
            {showImportForm ? "Cancel" : "Import JAR"}
          </Button>
          <Button
            variant={showRegisterForm ? "outline" : "default"}
            onClick={() => {
              setShowRegisterForm(!showRegisterForm);
              if (!showRegisterForm) setShowImportForm(false);
            }}
          >
            {showRegisterForm ? "Cancel" : "Register Source"}
          </Button>
        </div>
      </div>

      {showRegisterForm && (
        <RegisterSourceForm
          onSuccess={() => {
            setShowRegisterForm(false);
          }}
        />
      )}

      {showImportForm && <ImportJarForm />}

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          data={pageData?.content ?? []}
          columns={columns}
          keyFn={(s) => s.id}
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

function RegisterSourceForm({ onSuccess }: { onSuccess: () => void }) {
  const registerSource = useRegisterMavenSource();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [groupId, setGroupId] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(true);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    registerSource.mutate(
      {
        repositoryUrl,
        groupId,
        artifactId,
        username: username || undefined,
        encryptedPassword: password || undefined,
        syncEnabled,
      },
      { onSuccess },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Register Maven Source</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Repository URL</Label>
              <Input
                type="url"
                value={repositoryUrl}
                onChange={(e) => {
                  setRepositoryUrl(e.target.value);
                }}
                placeholder="https://repo.maven.apache.org/maven2"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Group ID</Label>
              <Input
                type="text"
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                }}
                placeholder="com.example"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Artifact ID</Label>
              <Input
                type="text"
                value={artifactId}
                onChange={(e) => {
                  setArtifactId(e.target.value);
                }}
                placeholder="my-contracts"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Username (optional)</Label>
              <Input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                }}
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password (optional)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                placeholder="Password"
              />
            </div>
            <div className="space-y-2">
              <Label>Sync Enabled</Label>
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  checked={syncEnabled}
                  onChange={(e) => {
                    setSyncEnabled(e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-foreground">
                  {syncEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
          <Button
            type="submit"
            disabled={!repositoryUrl || !groupId || !artifactId || registerSource.isPending}
          >
            {registerSource.isPending ? "Registering..." : "Register"}
          </Button>
          {registerSource.isError && (
            <p className="text-red-600 dark:text-red-400 text-sm">Failed to register source</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function ImportJarForm() {
  const importJar = useImportMavenJar();
  const [applicationName, setApplicationName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [groupId, setGroupId] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const [version, setVersion] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    importJar.mutate({
      applicationName,
      repositoryUrl,
      groupId,
      artifactId,
      version,
      username: username || undefined,
      password: password || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Import JAR</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Application Name</Label>
              <Input
                type="text"
                value={applicationName}
                onChange={(e) => {
                  setApplicationName(e.target.value);
                }}
                placeholder="my-service"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Repository URL</Label>
              <Input
                type="url"
                value={repositoryUrl}
                onChange={(e) => {
                  setRepositoryUrl(e.target.value);
                }}
                placeholder="https://repo.maven.apache.org/maven2"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input
                type="text"
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                }}
                placeholder="1.0.0"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Group ID</Label>
              <Input
                type="text"
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                }}
                placeholder="com.example"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Artifact ID</Label>
              <Input
                type="text"
                value={artifactId}
                onChange={(e) => {
                  setArtifactId(e.target.value);
                }}
                placeholder="my-contracts"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username (optional)</Label>
              <Input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                }}
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password (optional)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                placeholder="Password"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={
              !applicationName ||
              !repositoryUrl ||
              !groupId ||
              !artifactId ||
              !version ||
              importJar.isPending
            }
          >
            {importJar.isPending ? "Importing..." : "Import"}
          </Button>
          {importJar.isError && (
            <p className="text-red-600 dark:text-red-400 text-sm">Failed to import JAR</p>
          )}
          {importJar.data && (
            <div className="flex gap-2 items-center">
              <Badge variant="success">{importJar.data.published} published</Badge>
              <Badge variant="pending">{importJar.data.skipped} skipped</Badge>
              <span className="text-sm text-muted-foreground">({importJar.data.total} total)</span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function DeleteSourceButton({ id }: { id: string }) {
  const deleteSource = useDeleteMavenSource();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            deleteSource.mutate(id, {
              onSuccess: () => {
                setConfirming(false);
              },
            });
          }}
          disabled={deleteSource.isPending}
        >
          {deleteSource.isPending ? "..." : "Confirm"}
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
