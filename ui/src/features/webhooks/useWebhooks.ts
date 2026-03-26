import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useWebhooks(search?: string, page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ["webhooks", search ?? "", page, pageSize],
    queryFn: () => api.webhooks.list({ search, page, size: pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      applicationName?: string;
      eventType: string;
      url: string;
      headers?: string;
      bodyTemplate?: string;
    }) => api.webhooks.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        eventType: string;
        url: string;
        headers?: string;
        bodyTemplate?: string;
        enabled: boolean;
      };
    }) => api.webhooks.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.webhooks.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useWebhookExecutions(id: string) {
  return useQuery({
    queryKey: ["webhooks", id, "executions"],
    queryFn: () => api.webhooks.executions(id),
    enabled: !!id,
  });
}
