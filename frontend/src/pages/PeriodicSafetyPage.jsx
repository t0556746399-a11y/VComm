// import React, { useState } from 'react';
// import { useEvents } from '../hooks/useEvents';

// export default function PeriodicSafetyPage() {

//   const [filters, setFilters] = useState({
//     start_date: '',
//     end_date: '',
//     driver_id: '',
//   });
//   const [activeFilters, setActiveFilters] = useState(null);

//   const { data, isLoading, error } = useEvents(activeFilters || {});
//   const events = data?.events || [];

//   const handleSearch = () => {
//     setActiveFilters({ ...filters });
//   };

//   const handleReset = () => {
//     setFilters({ start_date: '', end_date: '', driver_id: '' });
//     setActiveFilters(null);
//   };

//   return (
//     <div style={{ padding: '24px', direction: 'rtl' }}>
//       <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
//         בטיחות תקופתית בנהיגה
//       </h1>

//       <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
//         <div>
//           <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>תאריך התחלה</label>
//           <input type="date" value={filters.start_date}
//             onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
//             style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
//           />
//         </div>
//         <div>
//           <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>תאריך סיום</label>
//           <input type="date" value={filters.end_date}
//             onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
//             style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
//           />
//         </div>
//         <div>
//           <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>מספר נהג</label>
//           <input type="text" value={filters.driver_id} placeholder="לדוגמה: driver-1"
//             onChange={(e) => setFilters(f => ({ ...f, driver_id: e.target.value }))}
//             style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
//           />
//         </div>
//         <button onClick={handleSearch}
//           style={{ padding: '8px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
//           חפש
//         </button>
//         <button onClick={handleReset}
//           style={{ padding: '8px 24px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
//           נקה
//         </button>
//       </div>

//       {isLoading && <div style={{ textAlign: 'center', padding: '32px' }}>טוען...</div>}
//       {error && <div style={{ color: 'red', padding: '16px' }}>שגיאה: {error.message}</div>}

//       {!isLoading && !error && activeFilters && (
//         <div>
//           <p style={{ marginBottom: '16px', color: '#6b7280' }}>נמצאו {events.length} אירועים</p>
//           {events.length === 0 ? (
//             <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
//               לא נמצאו אירועים בתקופה שנבחרה
//             </div>
//           ) : (
//             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//               <thead>
//                 <tr style={{ background: '#f3f4f6' }}>
//                   <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>סוג אירוע</th>
//                   <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>זמן</th>
//                   <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>נהג</th>
//                   <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>חומרה</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {events.map((event) => (
//                   <tr key={event.event_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
//                     <td style={{ padding: '12px', border: '1px solid #e5e7eb' }}>{event.event_type}</td>
//                     <td style={{ padding: '12px', border: '1px solid #e5e7eb' }}>{new Date(event.event_ts).toLocaleString('he-IL')}</td>
//                     <td style={{ padding: '12px', border: '1px solid #e5e7eb' }}>{event.driver_id}</td>
//                     <td style={{
//   padding: '12px',
//   border: '1px solid #e5e7eb',
//   color: event.severity === 'high' ? '#dc2626' : event.severity === 'medium' ? '#d97706' : '#16a34a',
//   fontWeight: 'bold'
// }}>
//   {event.severity}
// </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
import React, { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import EventsMap from '../components/EventsMap';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

export default function PeriodicSafetyPage() {

  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    driver_id: '',
    vehicle_id: '',
  });
  const [activeFilters, setActiveFilters] = useState(null);

  const { data, isLoading, error } = useEvents(activeFilters || {});
  const events = data?.events || [];

  const handleSearch = () => {
    setActiveFilters({ ...filters });
  };

  const handleReset = () => {
    setFilters({
      start_date: '',
      end_date: '',
      start_time: '',
      end_time: '',
      driver_id: '',
      vehicle_id: '',
    });

    setActiveFilters(null);
  };

  // --- סטטיסטיקות (משימה ב') ---
  const stats = {
    total: events.length,
    bySeverity: {
      high: events.filter((e) => e.severity === 'high').length,
      medium: events.filter((e) => e.severity === 'medium').length,
      low: events.filter((e) => e.severity === 'low').length,
    },
    byType: events.reduce((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    }, {}),
  };

  const severityData = [
    { name: 'גבוה', value: stats.bySeverity.high },
    { name: 'בינוני', value: stats.bySeverity.medium },
    { name: 'נמוך', value: stats.bySeverity.low },
  ];

  const byTypeData = Object.entries(stats.byType).map(([type, count]) => ({
    name: type,
    value: count,
  }));

  return (
    <div style={{ padding: '24px', direction: 'rtl' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        בטיחות תקופתית בנהיגה
      </h1>
      {/* --- פילטרים --- */ }
  <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>תאריך התחלה</label>
      <input type="date" value={filters.start_date}
        onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
    </div>
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>תאריך סיום</label>
      <input type="date" value={filters.end_date}
        onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
    </div>
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
        שעת התחלה
      </label>
      <input
        type="time"
        value={filters.start_time}
        onChange={(e) =>
          setFilters(f => ({
            ...f,
            start_time: e.target.value,
          }))
        }
        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
    </div>

    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
        שעת סיום
      </label>
      <input
        type="time"
        value={filters.end_time}
        onChange={(e) =>
          setFilters(f => ({
            ...f,
            end_time: e.target.value,
          }))
        }
        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
    </div>
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>מספר נהג</label>
      <input type="text" value={filters.driver_id} placeholder="לדוגמה: driver-1"
        onChange={(e) => setFilters(f => ({ ...f, driver_id: e.target.value }))}
        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
    </div>
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
        מספר רכב
      </label>
      <input
        type="text"
        value={filters.vehicle_id}
        placeholder="לדוגמה: vehicle-1"
        onChange={(e) =>
          setFilters(f => ({
            ...f,
            vehicle_id: e.target.value,
          }))
        }
        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
    </div>
    <button onClick={handleSearch}
      style={{ padding: '8px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
      חפש
    </button>
    <button onClick={handleReset}
      style={{ padding: '8px 24px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
      נקה
    </button>
  </div>

  { isLoading && <div style={{ textAlign: 'center', padding: '32px' }}>טוען...</div> }
  { error && <div style={{ color: 'red', padding: '16px' }}>שגיאה: {error.message}</div> }

  {
    !isLoading && !error && activeFilters && (
      <div>
        <p style={{ marginBottom: '16px', color: '#6b7280' }}>נמצאו {events.length} אירועים</p>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
            לא נמצאו אירועים בתקופה שנבחרה
          </div>
        ) : (
          <>
            {/* --- סטטיסטיקות --- */}
            <div style={{ marginBottom: '24px', background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>סטטיסטיקות</h2>
              <p>סה״כ אירועים: {stats.total}</p>
              <p style={{ color: '#dc2626' }}>חומרה גבוהה: {stats.bySeverity.high}</p>
              <p style={{ color: '#d97706' }}>חומרה בינונית: {stats.bySeverity.medium}</p>
              <p style={{ color: '#16a34a' }}>חומרה נמוכה: {stats.bySeverity.low}</p>
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>לפי סוג אירוע:</p>
                {Object.entries(stats.byType).map(([type, count]) => (
                  <p key={type} style={{ marginRight: '12px' }}>{type}: {count}</p>
                ))}
              </div>
            </div>

            {/* --- גרף עוגה לפי חומרה --- */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>פילוח לפי חומרה</h2>
              <PieChart width={300} height={300}>
                <Pie data={severityData} dataKey="value" nameKey="name" outerRadius={100} label>
                  <Cell fill="#dc2626" />
                  <Cell fill="#d97706" />
                  <Cell fill="#16a34a" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>

            {/* --- גרף עמודות לפי סוג אירוע --- */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>פילוח לפי סוג אירוע</h2>
              <BarChart width={400} height={300} data={byTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </div>

            {/* --- מפה --- */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>מפת אירועים</h2>
              <EventsMap events={events} />
            </div>

            {/* --- טבלה --- */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>סוג אירוע</th>
                  <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>זמן</th>
                  <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>נהג</th>
                  <th style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>חומרה</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.event_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', border: '1px solid #e5e7eb' }}>{event.event_type}</td>
                    <td style={{ padding: '12px', border: '1px solid #e5e7eb' }}>{new Date(event.event_ts).toLocaleString('he-IL')}</td>
                    <td style={{ padding: '12px', border: '1px solid #e5e7eb' }}>{event.driver_id}</td>
                    <td style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      color: event.severity === 'high' ? '#dc2626' : event.severity === 'medium' ? '#d97706' : '#16a34a',
                      fontWeight: 'bold'
                    }}>
                      {event.severity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    )
  }
    </div>
  );
}