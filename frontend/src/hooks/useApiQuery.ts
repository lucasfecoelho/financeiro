import { type DependencyList, useEffect, useState } from "react";

type ApiQueryState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

export function useApiQuery<T>(
  load: () => Promise<T>,
  dependencies: DependencyList = [],
): ApiQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refetch() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await load();
      setData(result);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel carregar os dados.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, error, isLoading, refetch };
}
