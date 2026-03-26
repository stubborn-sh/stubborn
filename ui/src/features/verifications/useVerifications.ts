import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useVerifications(search?: string, page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ["verifications", search ?? "", page, pageSize],
    queryFn: () => api.verifications.list({ search, page, size: pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.verifications.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["verifications"] }),
  });
}
