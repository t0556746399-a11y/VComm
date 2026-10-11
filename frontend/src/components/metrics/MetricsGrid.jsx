import React from 'react';

export default function MetricsGrid({
  totals,
  previousTotals,
  loading,
}) {
  // =========================
  // LOADING STATE
  // =========================
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          width: '100%',
          marginBottom: '20px',
        }}
        dir="rtl"
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              flex: '1',
              minWidth: '180px',
              textAlign: 'center',
              color: '#A0AEC0',
            }}
          >
            🔄 טוען נתונים...
          </div>
        ))}
      </div>
    );
  }

  // =========================
  // EMPTY STATE
  // =========================
  if (!totals) {
    return (
      <div
        style={{
          padding: '20px',
          backgroundColor: '#FFFAF0',
          border: '1px solid #FEEBC8',
          borderRadius: '12px',
          color: '#DD6B20',
          textAlign: 'center',
          fontWeight: 'bold',
          marginBottom: '20px',
        }}
        dir="rtl"
      >
        ℹ️ לא נמצאו נתונים זמינים לטווח התאריכים שנבחר.
      </div>
    );
  }

  // =========================
  // TREND CALC
  // =========================
  const renderTrend = (
    current,
    previous,
    isViolations = false
  ) => {
    if (!previous) return null;

    const diff = ((current - previous) / previous) * 100;
    const arrow = diff > 0 ? '▲' : '▼';
    const absDiff = Math.abs(diff).toFixed(1);

    const isGood = isViolations
      ? diff < 0
      : diff > 0;

    return (
      <div
        style={{
          display: 'inline-block',
          fontSize: '13px',
          fontWeight: 'bold',
          color:
            diff === 0
              ? '#718096'
              : isGood
              ? '#38A169'
              : '#E53E3E',
          backgroundColor:
            diff === 0
              ? '#EDF2F7'
              : isGood
              ? '#F0FFF4'
              : '#FFF5F5',
          padding: '2px 6px',
          borderRadius: '4px',
          marginTop: '6px',
        }}
      >
        {arrow} {absDiff}% {isGood ? 'שיפור' : 'מגמה שלילית'}
      </div>
    );
  };

  // =========================
  // STYLES
  // =========================
  const cardStyle = {
    backgroundColor: 'white',
    padding: '18px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    flex: '1',
    minWidth: '200px',
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  };

  const labelStyle = {
    fontSize: '13px',
    color: '#718096',
  };

  const valueStyle = {
    fontSize: '26px',
    fontWeight: 'bold',
    marginTop: '6px',
    color: '#2D3748',
  };

  const prevStyle = {
    fontSize: '12px',
    color: '#A0AEC0',
    marginTop: '8px',
    borderTop: '1px dashed #EDF2F7',
    paddingTop: '6px',
  };

  // =========================
  // UI
  // =========================
  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        width: '100%',
        marginBottom: '20px',
      }}
      dir="rtl"
    >
      {/* נסיעות */}
      <div style={cardStyle}>
        <div>
          <div style={labelStyle}>🚗 סך הכל נסיעות</div>
          <div style={valueStyle}>
            {totals.total_drives || 0}
          </div>
          {renderTrend(
            totals.total_drives,
            previousTotals?.total_drives,
            false
          )}
        </div>
        <div style={prevStyle}>
          תקופה קודמת:{' '}
          <b>{previousTotals?.total_drives || 0}</b>
        </div>
      </div>

      {/* עבירות */}
      <div style={cardStyle}>
        <div>
          <div style={labelStyle}>🚨 סך הכל עבירות</div>
          <div style={{ ...valueStyle, color: '#E53E3E' }}>
            {totals.total_violations || 0}
          </div>
          {renderTrend(
            totals.total_violations,
            previousTotals?.total_violations,
            true
          )}
        </div>
        <div style={prevStyle}>
          תקופה קודמת:{' '}
          <b style={{ color: '#E53E3E' }}>
            {previousTotals?.total_violations || 0}
          </b>
        </div>
      </div>

      {/* ממוצע ציונים */}
      <div style={cardStyle}>
        <div>
          <div style={labelStyle}>
            📈 ממוצע ציונים היסטורי
          </div>
          <div
            style={{ ...valueStyle, color: '#38A169' }}
          >
            {totals.avg_score
              ? Number(totals.avg_score).toFixed(1)
              : '100'}
          </div>
          {renderTrend(
            totals.avg_score,
            previousTotals?.avg_score,
            false
          )}
        </div>
        <div style={prevStyle}>
          תקופה קודמת:{' '}
          <b>{previousTotals?.avg_score || 0}</b>
        </div>
      </div>

      {/* נהגים */}
      <div style={cardStyle}>
        <div>
          <div style={labelStyle}>
            👥 נהגים פעילים בצי
          </div>
          <div style={valueStyle}>
            {totals.active_drivers || 0}
          </div>
          {renderTrend(
            totals.active_drivers,
            previousTotals?.active_drivers,
            false
          )}
        </div>
        <div style={prevStyle}>
          תקופה קודמת:{' '}
          <b>
            {previousTotals?.active_drivers || 0}
          </b>
        </div>
      </div>

      {/* נהג מסוכן */}
      <div
        style={{
          ...cardStyle,
          borderRight: '4px solid #E53E3E',
        }}
      >
        <div>
          <div style={labelStyle}>
            🔥 נהג מסוכן ביותר בטווח
          </div>
          <div
            style={{
              ...valueStyle,
              fontSize: '16px',
              color: '#E53E3E',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {totals.most_dangerous_driver ||
              'אין נתונים'}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#718096',
              marginTop: '12px',
            }}
          >
            ⚠️ דורש התערבות מנהל צי
          </div>
        </div>
        <div style={prevStyle}>
          מחושב לפי שכיחות עבירות חמורות
        </div>
      </div>
    </div>
  );
}