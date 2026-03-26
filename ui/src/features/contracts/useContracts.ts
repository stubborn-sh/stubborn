import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useContracts(appName: string, version: string, page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ["contracts", appName, version, page, pageSize],
    queryFn: () => api.contracts.list(appName, version, { page, size: pageSize }),
    enabled: !!appName && !!version,
    placeholderData: keepPreviousData,
  });
}

export function useCreateContract(appName: string, version: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { contractName: string; content: string; contentType: string }) =>
      api.contracts.create(appName, version, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts", appName, version] }),
  });
}
