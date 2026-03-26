import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useMatrix(provider?: string, consumer?: string) {
  return useQuery({
    queryKey: ["matrix", provider, consumer],
    queryFn: () => api.matrix.query(provider, consumer),
  });
}
