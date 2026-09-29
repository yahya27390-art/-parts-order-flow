import { QueryClient } from '@tanstack/react-query';
import { isConfigurationError, isMissingRpcError, isPermissionError } from '@/api/errors';

const shouldNotRetry = (error) =>
  isMissingRpcError(error) || isPermissionError(error) || isConfigurationError(error);

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 20_000,
      retry: (failureCount, error) => {
        if (shouldNotRetry(error)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});
