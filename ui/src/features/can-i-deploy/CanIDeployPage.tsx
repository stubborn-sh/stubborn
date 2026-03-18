import { useState } from "react";
import { useCanIDeploy } from "./useCanIDeploy";
import { useSearchApplications, useVersions } from "@/features/applications";
import { useEnvironmentList } from "@/features/environments";
import { AsyncComboBox, ComboBox } from "@/shared/components";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
} from "@/shared/components/ui";

export default function CanIDeployPage() {
  const searchApps = useSearchApplications();
  const { data: environments } = useEnvironmentList();
  const envNames = environments?.map((e) => e.name) ?? [];
  const [application, setApplication] = useState("");
  const [version, setVersion] = useState("");
  const [environment, setEnvironment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { data: versions } = useVersions(application);

  const queryApp = submitted ? application : "";
  const queryVersion = submitted ? version : "";
  const queryEnv = submitted ? environment : "";

  const { data: result, isLoading, error } = useCanIDeploy(queryApp, queryVersion, queryEnv);

  const handleCheck = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const errorMessage = error instanceof Error ? error.message : "Failed to check deployment safety";

  return (
    <div className="space-y-6">
      <div>
        <h2 data-testid="page-heading" className="text-2xl font-bold text-foreground">
          Can I Deploy?
        </h2>
        <p className="text-muted-foreground mt-1">
          Check if it&apos;s safe to deploy an application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Deployment Check</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheck}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="cid-application">Application</Label>
                <AsyncComboBox
                  fetchOptions={searchApps}
                  value={application}
                  onChange={(val) => {
                    setApplication(val);
                    setVersion("");
                    setSubmitted(false);
                  }}
                  placeholder="Select..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cid-version">Version</Label>
                <ComboBox
                  options={versions ?? []}
                  value={version}
                  onChange={(val) => {
                    setVersion(val);
                    setSubmitted(false);
                  }}
                  placeholder={
                    !application
                      ? "Select app first"
                      : versions?.length
                        ? "Select version"
                        : "No versions found"
                  }
                  disabled={!application || !versions?.length}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cid-environment">Environment</Label>
                <select
                  id="cid-environment"
                  value={environment}
                  onChange={(e) => {
                    setEnvironment(e.target.value);
                    setSubmitted(false);
                  }}
                  className="flex h-9 w-full items-center rounded-md border bg-input-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="">Select...</option>
                  {envNames.map((env) => (
                    <option key={env} value={env}>
                      {env}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" disabled={!application || !version || !environment}>
              Check
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && <p className="text-muted-foreground">Checking...</p>}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400 text-sm">{errorMessage}</p>
          </CardContent>
        </Card>
      )}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <CardTitle className="text-foreground">Result</CardTitle>
              <Badge variant={result.safe ? "safe" : "unsafe"}>
                {result.safe ? "SAFE" : "UNSAFE"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {result.application} v{result.version} to {result.environment}
            </p>
            {result.consumers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Consumer Results:</p>
                {result.consumers.map((c) => (
                  <div key={c.consumerName} className="flex items-center gap-3 text-sm">
                    <Badge variant={c.verified ? "success" : "failed"}>
                      {c.verified ? "SUCCESS" : "FAILED"}
                    </Badge>
                    <span className="text-foreground">{c.consumerName}</span>
                    {c.version && <span className="text-muted-foreground">v{c.version}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
