import { useState } from "react";
import { useContracts } from "./useContracts";
import { useSearchApplications, useVersions } from "@/features/applications";
import { DataTable, JsonViewer, AsyncComboBox, ComboBox } from "@/shared/components";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/shared/components/ui";
import type { ContractResponse } from "@/api/types";

export default function ContractsPage() {
  const searchApps = useSearchApplications();
  const [selectedApp, setSelectedApp] = useState("");
  const [version, setVersion] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const { data: versions } = useVersions(selectedApp);
  const {
    data: pageData,
    isLoading,
    error: contractsError,
  } = useContracts(selectedApp, version, page, pageSize);

  const expandedContract = pageData?.content.find((c) => c.id === expandedId);

  const columns = [
    {
      key: "contractName",
      header: "Contract",
      render: (c: ContractResponse) => (
        <button
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          onClick={() => {
            setExpandedId(expandedId === c.id ? null : c.id);
          }}
        >
          {c.contractName}
        </button>
      ),
    },
    { key: "contentType", header: "Type" },
    {
      key: "createdAt",
      header: "Created",
      render: (c: ContractResponse) => (
        <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Contracts
        </h2>
        <p className="text-muted-foreground mt-1">Browse published contracts and stubs</p>
      </div>

      <div className="flex gap-4">
        <AsyncComboBox
          fetchOptions={searchApps}
          value={selectedApp}
          onChange={(val) => {
            setSelectedApp(val);
            setVersion("");
            setExpandedId(null);
            setPage(0);
          }}
          placeholder="Select application"
          className="w-[220px]"
        />
        <ComboBox
          options={versions ?? []}
          value={version}
          onChange={(val) => {
            setVersion(val);
            setExpandedId(null);
            setPage(0);
          }}
          placeholder={
            !selectedApp
              ? "Select app first"
              : versions?.length
                ? "Select version"
                : "No versions found"
          }
          disabled={!selectedApp || !versions?.length}
          className="w-[200px]"
        />
      </div>

      {contractsError && <p className="text-red-600">Failed to load contracts</p>}
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {pageData && (
        <>
          <DataTable
            data={pageData.content}
            columns={columns}
            keyFn={(c) => c.id}
            pagination={{
              page,
              pageSize,
              totalElements: pageData.totalElements,
              totalPages: pageData.totalPages,
              onPageChange: setPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(0);
              },
            }}
          />
          {expandedContract && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-foreground">{expandedContract.contractName}</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="content">
                  <TabsList>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  </TabsList>
                  <TabsContent value="content">
                    <JsonViewer content={expandedContract.content} />
                  </TabsContent>
                  <TabsContent value="metadata">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="text-foreground">{expandedContract.contractName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Content Type</span>
                        <span className="text-foreground">{expandedContract.contentType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created</span>
                        <span className="text-foreground">
                          {new Date(expandedContract.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
