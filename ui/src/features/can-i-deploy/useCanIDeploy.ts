import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useCanIDeploy(application: string, version: string, environment: string) {
  return useQuery({
    queryKey: ["can-i-deploy", application, version, environment],
    queryFn: () => api.canIDeploy.check(application, version, environment),
    enabled: !!application && !!version && !!environment,
  });
}
