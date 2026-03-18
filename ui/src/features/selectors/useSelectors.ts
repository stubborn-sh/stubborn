import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface ConsumerVersionSelector {
  consumer?: string;
  mainBranch?: boolean;
  branch?: string;
  deployed?: boolean;
  environment?: string;
}

export function useSelectors() {
  return useMutation({
    mutationFn: (selectors: ConsumerVersionSelector[]) =>
      api.selectors.resolve(selectors as Record<string, unknown>[]),
  });
}
