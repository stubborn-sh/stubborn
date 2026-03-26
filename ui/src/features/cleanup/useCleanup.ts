import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useCleanup() {
  return useMutation({
    mutationFn: (data: {
      applicationName?: string;
      keepLatestVersions: number;
      protectedEnvironments?: string[];
    }) => api.cleanup.run(data),
  });
}
