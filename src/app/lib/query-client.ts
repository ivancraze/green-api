import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

// Локальное представление query.error, mutate(..., { onError }) и catch
// требует meta: { errorHandling: 'local' }, чтобы не показывать ошибку дважды.
export function createQueryClient(reportError: (error: unknown) => void) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.errorHandling !== 'local') reportError(error)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (!mutation.options.onError && mutation.meta?.errorHandling !== 'local') {
          reportError(error)
        }
      },
    }),
  })
}
