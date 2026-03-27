import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ImportGitRequest, RegisterGitSourceRequest } from "@/api/types";

export function useGitImportSources(page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ["gitImportSources", page, pageSize],
    queryFn: () => api.gitImport.listSources({ page, size: pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useRegisterGitSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterGitSourceRequest) => api.gitImport.registerSource(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gitImportSources"] }),
  });
}

export function useDeleteGitSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.gitImport.deleteSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gitImportSources"] }),
  });
}

export function useImportFromGit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportGitRequest) => api.gitImport.importFromGit(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gitImportSources"] }),
  });
}
