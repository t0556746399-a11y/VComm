import { useQuery } from '@tanstack/react-query';
import { getAggregations } from '../api/services/aggregationsApi';
import { QUERY_KEYS } from '../utils/queryKeys';

/**
 * useAggregations - TanStack Query wrapper around /api/aggregations
 * Reference: README §6.2
 */
export function useAggregations(filters) {
  return useQuery({
    // מפתח השילוב של השילוט המרכזי עם הפילטרים הנוכחיים
    queryKey: [QUERY_KEYS.AGGREGATIONS, filters],
    
    // פונקציית השליפה המקבלת את הפילטרים העדכניים
    queryFn: () => getAggregations(filters),
    
    // הגדרת זמן תוקף הנתונים ל-2 דקות (2 * 60 * 1000 מילישניות) על פי ה-README
    staleTime: 2 * 60 * 1000,
    
    // הקריאה תתבצע רק כאשר קיימים תאריכי התחלה וסיום תקינים בפילטרים
    enabled: !!filters?.startDate && !!filters?.endDate,
  });
}