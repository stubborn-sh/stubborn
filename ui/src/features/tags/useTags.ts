import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useTags(appName: string, version: string) {
  return useQuery({
    queryKey: ["tags", appName, version],
    queryFn: () => api.tags.list(appName, version),
    enabled: !!appName && !!version,
  });
}
