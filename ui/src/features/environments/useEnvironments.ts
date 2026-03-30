import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/api/client";
import type { EnvironmentResponse } from "@/api/types";

export function useEnvironmentList() {
  return useQuery({
    queryKey: ["environments"],
    queryFn: () => api.environments.list(),
  });
}

export interface DeploymentMatrixRow {
  applicationName: string;
  versions: Record<string, string | null>;
}

export function useDeploymentMatrix(environments: EnvironmentResponse[] | undefined) {
  const envNames = environments?.map((e) => e.name) ?? [];
  const queries = useQueries({
    queries: envNames.map((env) => ({
      queryKey: ["deployments", env, 0, 100],
      queryFn: () => api.environments.listDeployments(env, { page: 0, size: 100 }),
      enabled: envNames.length > 0,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  let matrix: DeploymentMatrixRow[] = [];
  if (!isLoading && !isError && queries.length > 0) {
    const appVersions = new Map<string, Record<string, string | null>>();
    envNames.forEach((env, idx) => {
      // idx is a numeric loop index bounded by envNames.length — safe array access
      // eslint-disable-next-line security/detect-object-injection
      const deployments = queries[idx]?.data?.content ?? [];
      for (const d of deployments) {
        if (!appVersions.has(d.applicationName)) {
          const record: Record<string, string | null> = {};
          // env comes from envNames (server-controlled list), not raw user input
          // eslint-disable-next-line security/detect-object-injection
          for (const e of envNames) record[e] = null;
          appVersions.set(d.applicationName, record);
        }
        const row = appVersions.get(d.applicationName);
        if (row) {
          // env comes from envNames (server-controlled list), not raw user input
          // eslint-disable-next-line security/detect-object-injection
          row[env] = d.version;
        }
      }
    });
    matrix = Array.from(appVersions.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([applicationName, versions]) => ({ applicationName, versions }));
  }

  return { matrix, isLoading, isError, environments: environments ?? [] };
}

export function useDeployments(environment: string, page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ["deployments", environment, page, pageSize],
    queryFn: () => api.environments.listDeployments(environment, { page, size: pageSize }),
    enabled: !!environment,
    placeholderData: keepPreviousData,
  });
}

export function useCreateDeployment(environment: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { applicationName: string; version: string }) =>
      api.environments.deploy(environment, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deployments", environment] }),
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      displayOrder: number;
      production: boolean;
    }) => api.environments.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.environments.delete(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}
