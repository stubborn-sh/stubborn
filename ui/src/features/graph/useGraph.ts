import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useGraph(environment?: string) {
  return useQuery({
    queryKey: ["graph", environment],
    queryFn: () => api.graph.get(environment),
  });
}

export function useApplicationDependencies(name: string | null) {
  return useQuery({
    queryKey: ["graph", "app", name],
    // enabled: !!name ensures queryFn is only called when name is non-null
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    queryFn: () => api.graph.getApplicationDependencies(name!),
    enabled: !!name,
  });
}
