import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useBrokerInfo() {
  return useQuery({
    queryKey: ["broker-info"],
    queryFn: () => api.broker.info(),
    staleTime: 5 * 60 * 1000, // broker info rarely changes
  });
}
