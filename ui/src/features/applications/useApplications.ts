import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useApplications(search?: string, page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ["applications", search ?? "", page, pageSize],
    queryFn: () => api.applications.list({ search, page, size: pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useSearchApplications(): (query: string) => Promise<string[]> {
  return (query: string) => api.applications.searchNames(query);
}

export function useApplication(name: string) {
  return useQuery({
    queryKey: ["applications", name],
    queryFn: () => api.applications.get(name),
    enabled: !!name,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.applications.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });
}

export function useVersions(appName: string) {
  return useQuery({
    queryKey: ["versions", appName],
    queryFn: () => api.applications.versions(appName),
    enabled: !!appName,
  });
}
