import { useApi } from './useApi';
import { listDrives } from '../api/trips';

export function useDrives(params = {}) {
  const result = useApi(['drives', params], () => listDrives(params));

   const data = Array.isArray(result.data)
    ? result.data
    : (result.data?.drives || result.data?.data || []);

  return { ...result, data };
}