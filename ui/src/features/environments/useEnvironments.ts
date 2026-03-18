import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useEnvironmentList() {
  return useQuery({
    queryKey: ["environments"],
    queryFn: () => api.environments.list(),
  });
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
