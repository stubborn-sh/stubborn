import { useState } from "react";
import {
  useGitImportSources,
  useRegisterGitSource,
  useDeleteGitSource,
  useImportFromGit,
} from "./useGitImport";
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
import type { GitImportSourceResponse, GitImportResultResponse } from "@/api/types";

const AUTH_TYPES = ["NONE", "TOKEN", "BASIC"];

export default function GitImportPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const {
    data: pageData,
    isLoading,
    error,
  } = useGitImportSources(page, pageSize);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  if (error) return <p className="text-red-600">Failed to load Git import sources</p>;

  const columns = [
    {
      key: "applicationName",
      header: "Application",
      render: (s: GitImportSourceResponse) => (
        <span className="font-medium text-foreground">{s.applicationName}</span>
      ),
    },
    {
      key: "repositoryUrl",
      header: "Repository URL",
      render: (s: GitImportSourceResponse) => (
        <span className="text-foreground font-mono text-xs">{s.repositoryUrl}</span>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (s: GitImportSourceResponse) => (
        <span className="text-foreground">{s.branch ?? "default"}</span>
      ),
    },
    {
      key: "contractsDirectory",
      header: "Contracts Dir",
      render: (s: GitImportSourceResponse) => (
        <span className="text-foreground font-mono text-xs">{s.contractsDirectory ?? "/"}</span>
      ),
    },
    {
      key: "syncEnabled",
      header: "Sync",
      render: (s: GitImportSourceResponse) => (
        <Badge variant={s.syncEnabled ? "success" : "failed"}>
          {s.syncEnabled ? "ON" : "OFF"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (s: GitImportSourceResponse) => <DeleteSourceButton id={s.id} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
            Git Import
          </h2>
          <p className="text-muted-foreground mt-1">
            Import contracts from Git repositories
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showImportForm ? "outline" : "secondary"}
            onClick={() => {
              setShowImportForm(!showImportForm);
              if (!showImportForm) setShowRegisterForm(false);
            }}
          >
            {showImportForm ? "Cancel Import" : "Import from Git"}
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

      {showImportForm && (
        <ImportFromGitForm
          onSuccess={() => {
            setShowImportForm(false);
          }}
        />
      )}

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
  const registerSource = useRegisterGitSource();
  const [applicationName, setApplicationName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [contractsDirectory, setContractsDirectory] = useState("");
  const [authType, setAuthType] = useState("NONE");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(true);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    registerSource.mutate(
      {
        applicationName,
        repositoryUrl,
        branch: branch || undefined,
        contractsDirectory: contractsDirectory || undefined,
        authType: authType === "NONE" ? undefined : authType,
        username: username || undefined,
        encryptedToken: token || undefined,
        syncEnabled,
      },
      { onSuccess },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Register Git Source</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Application Name</Label>
              <Input
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
                value={repositoryUrl}
                onChange={(e) => {
                  setRepositoryUrl(e.target.value);
                }}
                placeholder="https://github.com/org/repo.git"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Branch (optional)</Label>
              <Input
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                }}
                placeholder="main"
              />
            </div>
            <div className="space-y-2">
              <Label>Contracts Directory (optional)</Label>
              <Input
                value={contractsDirectory}
                onChange={(e) => {
                  setContractsDirectory(e.target.value);
                }}
                placeholder="src/test/resources/contracts"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Auth Type</Label>
              <select
                value={authType}
                onChange={(e) => {
                  setAuthType(e.target.value);
                }}
                className="flex h-9 w-full items-center rounded-md border bg-input-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                {AUTH_TYPES.map((at) => (
                  <option key={at} value={at}>
                    {at}
                  </option>
                ))}
              </select>
            </div>
            {authType !== "NONE" && (
              <>
                {authType === "BASIC" && (
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                      }}
                      placeholder="git-user"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{authType === "TOKEN" ? "Token" : "Password"}</Label>
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                    }}
                    placeholder="***"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="syncEnabled"
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => {
                setSyncEnabled(e.target.checked);
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="syncEnabled">Enable automatic sync</Label>
          </div>
          <Button type="submit" disabled={!applicationName || !repositoryUrl || registerSource.isPending}>
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

function ImportFromGitForm({ onSuccess }: { onSuccess: () => void }) {
  const importFromGit = useImportFromGit();
  const [applicationName, setApplicationName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [contractsDirectory, setContractsDirectory] = useState("");
  const [version, setVersion] = useState("");
  const [authType, setAuthType] = useState("NONE");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<GitImportResultResponse | null>(null);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setResult(null);
    importFromGit.mutate(
      {
        applicationName,
        repositoryUrl,
        branch: branch || undefined,
        contractsDirectory: contractsDirectory || undefined,
        version: version || undefined,
        authType: authType === "NONE" ? undefined : authType,
        username: username || undefined,
        token: token || undefined,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          onSuccess();
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Import from Git</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Application Name</Label>
              <Input
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
                value={repositoryUrl}
                onChange={(e) => {
                  setRepositoryUrl(e.target.value);
                }}
                placeholder="https://github.com/org/repo.git"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Branch (optional)</Label>
              <Input
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                }}
                placeholder="main"
              />
            </div>
            <div className="space-y-2">
              <Label>Contracts Directory (optional)</Label>
              <Input
                value={contractsDirectory}
                onChange={(e) => {
                  setContractsDirectory(e.target.value);
                }}
                placeholder="src/test/resources/contracts"
              />
            </div>
            <div className="space-y-2">
              <Label>Version Override (optional)</Label>
              <Input
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                }}
                placeholder="1.0.0"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Auth Type</Label>
              <select
                value={authType}
                onChange={(e) => {
                  setAuthType(e.target.value);
                }}
                className="flex h-9 w-full items-center rounded-md border bg-input-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                {AUTH_TYPES.map((at) => (
                  <option key={at} value={at}>
                    {at}
                  </option>
                ))}
              </select>
            </div>
            {authType !== "NONE" && (
              <>
                {authType === "BASIC" && (
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                      }}
                      placeholder="git-user"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{authType === "TOKEN" ? "Token" : "Password"}</Label>
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                    }}
                    placeholder="***"
                  />
                </div>
              </>
            )}
          </div>
          <Button type="submit" disabled={!applicationName || !repositoryUrl || importFromGit.isPending}>
            {importFromGit.isPending ? "Importing..." : "Import"}
          </Button>
          {importFromGit.isError && (
            <p className="text-red-600 dark:text-red-400 text-sm">Failed to import from Git</p>
          )}
        </form>
        {result && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Import complete: {result.published} published, {result.skipped} skipped, {result.total} total
              (version: {result.resolvedVersion})
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteSourceButton({ id }: { id: string }) {
  const deleteSource = useDeleteGitSource();
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
