import { useQuery } from '@tanstack/react-query';
import { getLookups } from '../api/services/lookupsApi';
import { QUERY_KEYS } from '../utils/queryKeys';
import { useFilters } from './useFilters';

export function useLookups(filters) {
    return useQuery({
      queryKey: [QUERY_KEYS.LOOKUPS, filters],
      queryFn: () => getLookups(filters)
    })
  }
// ─────────────────────────────────────────────
// hooks/useLookups.js — drivers + vehicles dropdowns
// Reference: README §8.5
// ─────────────────────────────────────────────

// TODO: export function useDrivers()  { ... }   // queryKey: ['drivers']
// TODO: export function useVehicles() { ... }   // queryKey: ['vehicles']

//maayan
//2026-05-27