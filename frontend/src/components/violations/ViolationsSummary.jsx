// ─────────────────────────────────────────────
// components/violations/ViolationsSummary.jsx
// Reference: README §6.1, §8.2 (violations_summary)
//
// Renders the violations_summary object from /api/aggregations as a list of
// ViolationItem rows (label + count + ratio).
// ─────────────────────────────────────────────

// TODO: export default function ViolationsSummary({ summary }) { ... }
import React from 'react';

/**
 * ViolationItem - רכיב שורה בודדת עבור הפרה
 */
function ViolationItem({ label, count, ratio }) {
  // המרת היחס לאחוזים להצגה ויזואלית
  const percentage = (ratio * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-1.5 border-b border-slate-100 pb-3 last:border-none last:pb-0" dir="rtl">
      <div className="flex justify-between items-center text-sm font-semibold text-slate-700">
        <span className="text-slate-800">{label}</span>
        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs">
          {count} מקרים
        </span>
      </div>
      
      {/* בר התקדמות ויזואלי המציג את האחוז */}
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-rose-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <div className="text-left text-xs text-slate-400 font-medium">
        {percentage}% מכלל האירועים
      </div>
    </div>
  );
}

/**
 * ViolationsSummary - רכיב ריכוז וסיכום הפרות בטיחות
 * Reference: README §6.1, §8.2
 */
export default function ViolationsSummary({ summary }) {
  // בדיקה בטיחותית במידה והמידע עדיין בטעינה או חסר
  if (!summary || Object.keys(summary).length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 font-medium text-sm" dir="rtl">
        📭 לא נמצאו נתוני הפרות לתקופה שנבחרה
      </div>
    );
  }

  // המרת אובייקט הנתונים מהשרת למערך לצורך רינדור
  // השרת מחזיר מבנה של: { speeding: { label: 'מהירות מופרזת', count: 12, ratio: 0.4 }, ... }
  const violationItems = Object.entries(summary).map(([key, value]) => ({
    id: key,
    label: value.label || key,
    count: value.count || 0,
    ratio: value.ratio || 0,
  }));

  return (
    <div className="flex flex-col gap-4 p-2">
      {violationItems.map((item) => (
        <ViolationItem
          key={item.id}
          label={item.label}
          count={item.count}
          ratio={item.ratio}
        />
      ))}
    </div>
  );
}