import { createContext, useContext, useState, useMemo } from 'react';

// התיקון: הוספת export כדי שרכיבים כמו MapZoomTracker יוכלו לייבא את ה-Context ישירות
export const FiltersContext = createContext(null);

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    driverId: null,
    vehicleIds: [],
    bbox: null,
    zoom: null,
    viewAsCompany: null,
  });

  const patch = (partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const value = useMemo(
    () => ({ filters, setFilters, patch }),
    [filters]
  );

  return (
    <FiltersContext.Provider value={value}>
      {children}
    </FiltersContext.Provider>
  );
}

export const useFiltersContext = () => useContext(FiltersContext);