import { useState } from "react";
import { useSelectors, type ConsumerVersionSelector } from "./useSelectors";
import { useSearchApplications } from "@/features/applications";
import { useEnvironmentList } from "@/features/environments";
import { AsyncComboBox, ComboBox } from "@/shared/components";
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

type SelectorMode = "mainBranch" | "branch" | "deployed" | "consumer";

export default function SelectorsPage() {
  const [mode, setMode] = useState<SelectorMode>("mainBranch");
  const [consumer, setConsumer] = useState("");
  const [branch, setBranch] = useState("");
  const [environment, setEnvironment] = useState("");

  const searchApps = useSearchApplications();
  const { data: environments } = useEnvironmentList();
  const envNames = environments?.map((e) => e.name) ?? [];
  const { mutate, data: results, isPending, error } = useSelectors();

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const selector: ConsumerVersionSelector = {};
    switch (mode) {
      case "mainBranch":
        selector.mainBranch = true;
        break;
      case "branch":
        selector.branch = branch || undefined;
        break;
      case "deployed":
        selector.deployed = true;
        selector.environment = environment || undefined;
        break;
      case "consumer":
        selector.consumer = consumer || undefined;
        break;
    }
    mutate([selector]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Consumer Version Selectors
        </h2>
        <p className="text-muted-foreground mt-1">
          Resolve which consumer contracts a provider should verify against
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Selector Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="selector-mode">Mode</Label>
                <select
                  id="selector-mode"
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as SelectorMode);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="mainBranch">Main Branch</option>
                  <option value="branch">Branch</option>
                  <option value="deployed">Deployed</option>
                  <option value="consumer">Consumer</option>
                </select>
              </div>

              {mode === "consumer" && (
                <div className="space-y-2">
                  <Label>Consumer Name</Label>
                  <AsyncComboBox
                    id="selector-consumer"
                    fetchOptions={searchApps}
                    value={consumer}
                    onChange={setConsumer}
                    placeholder="Select consumer..."
                  />
                </div>
              )}

              {mode === "branch" && (
                <div className="space-y-2">
                  <Label htmlFor="selector-branch">Branch Name</Label>
                  <Input
                    id="selector-branch"
                    type="text"
                    value={branch}
                    onChange={(e) => {
                      setBranch(e.target.value);
                    }}
                    placeholder="e.g. feature/new-api"
                  />
                </div>
              )}

              {mode === "deployed" && (
                <div className="space-y-2">
                  <Label>Environment (optional)</Label>
                  <ComboBox
                    options={envNames}
                    value={environment}
                    onChange={setEnvironment}
                    placeholder="All environments"
                  />
                </div>
              )}
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Resolving..." : "Resolve Selectors"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-red-600">Failed to resolve selectors</p>}
      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <CardTitle className="text-foreground">Results</CardTitle>
              <Badge variant={results.length > 0 ? "success" : "pending"}>
                {results.length} contract{results.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-foreground">Consumer</th>
                      <th className="text-left py-2 px-3 font-medium text-foreground">Version</th>
                      <th className="text-left py-2 px-3 font-medium text-foreground">Branch</th>
                      <th className="text-left py-2 px-3 font-medium text-foreground">Contract</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 text-foreground">{r.consumerName}</td>
                        <td className="py-2 px-3 font-mono text-foreground">{r.version}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.branch ?? "-"}</td>
                        <td className="py-2 px-3 font-mono text-foreground">{r.contractName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No contracts matched the selector criteria.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
