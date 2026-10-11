import { useApi } from './useApi';
import { getEvents } from '../api/services/eventsApi';

export function useEvents(params) {
  return useApi(
    ['events', params],
    () => getEvents(params),
    { keepPreviousData: true }
  );
}