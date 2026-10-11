import { useQuery } from '@tanstack/react-query';

export function useApi(queryKey, apiFn, options = {}) {
  return useQuery({
    queryKey,
queryFn: async () => {
  const result = await apiFn();
  return result ?? null;
},
    ...options,
  });
}