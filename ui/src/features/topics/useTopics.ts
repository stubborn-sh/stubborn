import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { TopicTopologyResponse } from "@/api/types";

export function useTopics() {
  const [data, setData] = useState<TopicTopologyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.topics
      .list()
      .then(setData)
      .catch(setError)
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { data, isLoading, error };
}
