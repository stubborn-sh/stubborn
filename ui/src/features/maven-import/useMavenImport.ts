import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useMavenImportSources(page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ["maven-import-sources", page, pageSize],
    queryFn: () => api.mavenImport.listSources({ page, size: pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useRegisterMavenSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      repositoryUrl: string;
      groupId: string;
      artifactId: string;
      username?: string;
      encryptedPassword?: string;
      syncEnabled: boolean;
    }) => api.mavenImport.registerSource(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maven-import-sources"] }),
  });
}

export function useDeleteMavenSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.mavenImport.deleteSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maven-import-sources"] }),
  });
}

export function useImportMavenJar() {
  return useMutation({
    mutationFn: (data: {
      applicationName: string;
      repositoryUrl: string;
      groupId: string;
      artifactId: string;
      version: string;
      username?: string;
      password?: string;
    }) => api.mavenImport.importJar(data),
  });
}
