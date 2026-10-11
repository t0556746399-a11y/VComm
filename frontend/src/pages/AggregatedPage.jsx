import React, { useState } from 'react';

// יבוא ה-Hook הייעודי לניהול נתונים
import { useAggregations } from '../hooks/useAggregations';

// פונקציית עזר פנימית לחילוץ בטוח של רכיב מודול מיובא באופן סינכרוני
const safeResolve = (reqContext, fallbackName) => {
  try {
    if (!reqContext) return () => <div className="text-rose-500">שגיאת טעינה</div>;
    // תמיכה ב-Default Export
    if (reqContext.default) return reqContext.default;
    // תמיכה ב-Named Export לפי השם המצופה
    if (reqContext[fallbackName]) return reqContext[fallbackName];
    // פולבק - מציאת הפונקציה הראשונה שמיוצאת מהקובץ
    const firstExport = Object.values(reqContext).find(val => typeof val === 'function');
    return firstExport || (() => <div className="text-rose-500">רכיב לא נמצא</div>);
  } catch (e) {
    return () => <div className="text-rose-500">שגיאה בהפעלת רכיב</div>;
  }
};

// יבוא בטוח וסינכרוני של כל רכיבי המשנה
const MapContainer = safeResolve(require('../components/maps/MapContainer'), 'MapContainer');
const HeatmapLayer = safeResolve(require('../components/maps/HeatmapLayer'), 'HeatmapLayer');
const MapZoomTracker = safeResolve(require('../components/maps/MapZoomTracker'), 'MapZoomTracker');
const MetricsGrid = safeResolve(require('../components/metrics/MetricsGrid'), 'MetricsGrid');
const FiltersPanel = safeResolve(require('../components/filters/FiltersPanel'), 'FiltersPanel');
const ViolationsSummary = safeResolve(require('../components/violations/ViolationsSummary'), 'ViolationsSummary');

/**
 * AggregatedPage - דשבורד נתונים מרוכזים ואנליטיקה (Team B)
 */
export default function AggregatedPage() {
  /* ==========================================================================
     1. STATE & FILTERS
     ========================================================================== */
  const [filters, setFilters] = useState({
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    driverId: '',
    sortBy: 'violations_desc'
  });

  /* ==========================================================================
     2. DATA FETCHING VIA HOOKS
     ========================================================================== */
  const { data, isLoading, isError, error } = useAggregations(filters);

  /* ==========================================================================
     3. RENDER STATES
     ========================================================================== */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center" dir="rtl">
        <div className="text-lg font-bold text-slate-600 animate-pulse">
          ⏳ טוען נתוני אנליטיקה ומפות...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-right" dir="rtl">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl font-medium">
          ❌ שגיאה בטעינת הנתונים: {error?.message || 'אנא נסה שוב מאוחר יותר.'}
        </div>
      </div>
    );
  }

  // חילוץ המידע עם ערכי ברירת מחדל בטוחים
  const totals = data?.totals || {
    total_drives: 0,
    active_drivers: 0,
    total_violations: 0,
    avg_score: 100,
  };

  /* ==========================================================================
     4. MAIN LAYOUT
     ========================================================================== */
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 text-right" dir="rtl">
      
      {/* כותרת הדשבורד ופאנל סינון עליון */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📊 נתונים מרוכזים ואנליטיקה
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            מערכת ניהול בטיחות וצי רכב - VComm
          </p>
        </div>
        
        {/* רכיב הפילטרים */}
        <FiltersPanel filters={filters} setFilters={setFilters} />
      </header>

      {/* גריד מדדים מרכזי (KPIs) */}
      <section className="mb-8">
        <MetricsGrid totals={totals} loading={isLoading} />
      </section>

      {/* אזור גיאוגרפי ואנליטי מפוצל */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start w-full">
        
        {/* מפת חום */}
        <section className="lg:col-span-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 h-[450px] relative">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            🗺️ פריסת אירועי בטיחות ומפת חום
          </h3>
          <div className="w-full h-[380px] rounded-xl overflow-hidden border border-slate-200">
            <MapContainer>
              <HeatmapLayer filters={filters} />
              <MapZoomTracker />
            </MapContainer>
          </div>
        </section>

        {/* טבלת ריכוז הפרות */}
        <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 h-[450px] overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            🏅 סיכום הפרות ורמת סיכון
          </h3>
          <div className="flex-1 overflow-y-auto">
            <ViolationsSummary summary={data?.violations_summary || data?.violations || {}} />
          </div>
        </section>

      </div>
    </div>
  );
}