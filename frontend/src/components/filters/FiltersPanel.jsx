// ─────────────────────────────────────────────
// components/filters/FiltersPanel.jsx — Team B
// Reference: README §6.1
//
// Renders DateRangePicker + DriverSelect + VehicleMultiSelect.
// Reads/writes FiltersContext via useFilters().
// ─────────────────────────────────────────────

// TODO: export default function FiltersPanel() { ... }
import React from 'react';

/**
 * FiltersPanel - פאנל סינון מרכזי עבור דשבורד האנליטיקה
 * מאפשר סינון לפי טווחי תאריכים, מזהה נהג ומיון הנתונים.
 */
export default function FiltersPanel({ filters, setFilters }) {
  
  // עדכון שדה בודד בתוך ה-State המרכזי
  const handleChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4 w-full lg:w-auto" dir="rtl">
      
      {/* סינון לפי תאריך התחלה */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500">תאריך התחלה</label>
        <input 
          type="date" 
          value={filters.startDate || ''} 
          onChange={(e) => handleChange('startDate', e.target.value)}
          className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* סינון לפי תאריך סיום */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500">תאריך סיום</label>
        <input 
          type="date" 
          value={filters.endDate || ''} 
          onChange={(e) => handleChange('endDate', e.target.value)}
          className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* סינון לפי מזהה נהג */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500">מזהה נהג</label>
        <input 
          type="text" 
          placeholder="חפש לפי מזהה..." 
          value={filters.driverId || ''} 
          onChange={(e) => handleChange('driverId', e.target.value)}
          className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-indigo-500 placeholder-slate-400 w-40 transition-colors"
        />
      </div>

      {/* מיון נתונים */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500">מיון לפי</label>
        <select 
          value={filters.sortBy || 'violations_desc'} 
          onChange={(e) => handleChange('sortBy', e.target.value)}
          className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
        >
          <option value="violations_desc">הפרות (מהגבוה לנמוך)</option>
          <option value="violations_asc">הפרות (מהנמוך לגבוה)</option>
          <option value="score_desc">ציון בטיחות גבוה</option>
          <option value="score_asc">ציון בטיחות נמוך</option>
        </select>
      </div>

    </div>
  );
}