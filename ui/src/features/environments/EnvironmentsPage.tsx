import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useEnvironmentList,
  useDeployments,
  useCreateDeployment,
  useCreateEnvironment,
  useDeleteEnvironment,
  useDeploymentMatrix,
} from "./useEnvironments";
import { useSearchApplications, useVersions } from "@/features/applications";
import { DataTable, AsyncComboBox, ComboBox } from "@/shared/components";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Badge,
} from "@/shared/components/ui";
import type { DeploymentResponse } from "@/api/types";
import { Plus, Trash2 } from "lucide-react";

export default function EnvironmentsPage() {
  const navigate = useNavigate();
  const { data: environments } = useEnvironmentList();
  const envNames = useMemo(() => environments?.map((e) => e.name) ?? [], [environments]);
  const [userSelectedEnv, setUserSelectedEnv] = useState("");
  const selectedEnv = userSelectedEnv || envNames[0] || "";
  const setSelectedEnv = setUserSelectedEnv;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const {
    data: pageData,
    isLoading,
    error: deploymentsError,
  } = useDeployments(selectedEnv, page, pageSize);
  const [showForm, setShowForm] = useState(false);
  const [showEnvForm, setShowEnvForm] = useState(false);
  const [deployApp, setDeployApp] = useState("");
  const [deployVersion, setDeployVersion] = useState("");
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvDesc, setNewEnvDesc] = useState("");
  const [newEnvProd, setNewEnvProd] = useState(false);
  const searchApps = useSearchApplications();
  const { data: versions } = useVersions(deployApp);
  const createDeployment = useCreateDeployment(selectedEnv);
  const createEnvironment = useCreateEnvironment();
  const deleteEnvironment = useDeleteEnvironment();
  const { matrix, isLoading: matrixLoading } = useDeploymentMatrix(environments);

  const handleDeploy = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!deployApp || !deployVersion) return;
    createDeployment.mutate(
      { applicationName: deployApp, version: deployVersion },
      {
        onSuccess: () => {
          setShowForm(false);
          setDeployApp("");
          setDeployVersion("");
        },
      },
    );
  };

  const handleEnvChange = (env: string) => {
    setSelectedEnv(env);
    setPage(0);
  };

  const handleCreateEnv = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newEnvName.trim()) return;
    createEnvironment.mutate(
      {
        name: newEnvName.trim(),
        description: newEnvDesc.trim() || undefined,
        displayOrder: envNames.length,
        production: newEnvProd,
      },
      {
        onSuccess: () => {
          setNewEnvName("");
          setNewEnvDesc("");
          setNewEnvProd(false);
          setShowEnvForm(false);
        },
      },
    );
  };

  const handleDeleteEnv = (name: string) => {
    if (!confirm(`Delete environment "${name}"?`)) return;
    deleteEnvironment.mutate(name, {
      onSuccess: () => {
        if (selectedEnv === name) {
          setUserSelectedEnv("");
        }
      },
    });
  };

  const columns = [
    {
      key: "applicationName",
      header: "Application",
      render: (d: DeploymentResponse) => (
        <button
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          onClick={() =>
            void navigate(`/applications?search=${encodeURIComponent(d.applicationName)}`)
          }
        >
          {d.applicationName}
        </button>
      ),
    },
    { key: "version", header: "Version" },
    { key: "environment", header: "Environment" },
    {
      key: "deployedAt",
      header: "Deployed At",
      render: (d: DeploymentResponse) => (
        <span className="text-muted-foreground">{new Date(d.deployedAt).toLocaleString()}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
            Environments
          </h2>
          <p className="text-muted-foreground mt-1">Application deployments by environment</p>
        </div>
        <Button
          variant={showForm ? "outline" : "default"}
          onClick={() => {
            setShowForm(!showForm);
          }}
        >
          {showForm ? "Cancel" : "Record Deployment"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Record Deployment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeploy}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Application</Label>
                  <AsyncComboBox
                    fetchOptions={searchApps}
                    value={deployApp}
                    onChange={(val) => {
                      setDeployApp(val);
                      setDeployVersion("");
                    }}
                    placeholder="Select..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Version</Label>
                  <ComboBox
                    options={versions ?? []}
                    value={deployVersion}
                    onChange={setDeployVersion}
                    placeholder={
                      !deployApp
                        ? "Select app first"
                        : versions?.length
                          ? "Select version"
                          : "No versions found"
                    }
                    disabled={!deployApp || !versions?.length}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <select
                    value={selectedEnv}
                    disabled
                    className="flex h-9 w-full items-center rounded-md border bg-input-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value={selectedEnv}>{selectedEnv}</option>
                  </select>
                </div>
              </div>
              <Button
                type="submit"
                disabled={!deployApp || !deployVersion || createDeployment.isPending}
              >
                {createDeployment.isPending ? "Recording..." : "Record"}
              </Button>
              {createDeployment.isError && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                  Failed to record deployment
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {environments && environments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Deployment Overview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Application versions across all environments
            </p>
          </CardHeader>
          <CardContent>
            {matrixLoading ? (
              <p className="text-muted-foreground text-sm">Loading matrix...</p>
            ) : matrix.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deployments recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">
                        Application
                      </th>
                      {environments
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .map((env) => (
                          <th
                            key={env.name}
                            className="text-left py-2 text-muted-foreground font-medium"
                          >
                            {env.name}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row) => {
                      const sortedEnvs = environments
                        .slice()
                        .sort((a, b) => a.displayOrder - b.displayOrder);
                      const deployedVersions = sortedEnvs
                        .map((env) => row.versions[env.name])
                        .filter(Boolean);
                      const allSame =
                        deployedVersions.length > 0 &&
                        deployedVersions.every((v) => v === deployedVersions[0]);
                      return (
                        <tr
                          key={row.applicationName}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-2 text-foreground font-medium">
                            {row.applicationName}
                          </td>
                          {sortedEnvs.map((env) => {
                            const version = row.versions[env.name];
                            return (
                              <td key={env.name} className="py-2">
                                {version ? (
                                  <Badge variant={allSame ? "success" : "default"}>{version}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {environments?.map((env) => (
          <div key={env.name} className="flex items-center gap-1">
            <Button
              variant={selectedEnv === env.name ? "default" : "outline"}
              size="sm"
              onClick={() => {
                handleEnvChange(env.name);
              }}
            >
              {env.name}
              {env.production && (
                <Badge variant="default" className="ml-1 text-[10px] px-1 py-0">
                  PROD
                </Badge>
              )}
            </Button>
            <button
              onClick={() => {
                handleDeleteEnv(env.name);
              }}
              className="text-muted-foreground hover:text-red-500 p-1"
              title={`Delete ${env.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowEnvForm(!showEnvForm);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
        {envNames.length === 0 && !showEnvForm && (
          <p className="text-muted-foreground text-sm">No environments configured</p>
        )}
      </div>

      {showEnvForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Create Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateEnv}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <input
                    type="text"
                    value={newEnvName}
                    onChange={(e) => {
                      setNewEnvName(e.target.value);
                    }}
                    placeholder="e.g. staging"
                    className="flex h-9 w-full rounded-md border bg-input-background px-3 py-2 text-sm ring-offset-background dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <input
                    type="text"
                    value={newEnvDesc}
                    onChange={(e) => {
                      setNewEnvDesc(e.target.value);
                    }}
                    placeholder="Optional description"
                    className="flex h-9 w-full rounded-md border bg-input-background px-3 py-2 text-sm ring-offset-background dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="block">Production</Label>
                  <label className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      checked={newEnvProd}
                      onChange={(e) => {
                        setNewEnvProd(e.target.checked);
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-muted-foreground">Mark as production</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={!newEnvName.trim() || createEnvironment.isPending}>
                  {createEnvironment.isPending ? "Creating..." : "Create"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEnvForm(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {createEnvironment.isError && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                  Failed to create environment
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}
      {deploymentsError && <p className="text-red-600">Failed to load deployments</p>}
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          data={pageData?.content ?? []}
          columns={columns}
          keyFn={(d) => d.id}
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
