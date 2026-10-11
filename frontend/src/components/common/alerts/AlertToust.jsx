import React, { useEffect, useState } from 'react';
import { useAlerts } from '../../context/AlertsContext';

export default function AlertToast() {
  const { alerts } = useAlerts();
  const [visible, setVisible] = useState(false);
  const latestAlert = alerts[0];

  useEffect(() => {
    if (latestAlert) {
      setVisible(true);
      // ה-Toast ייעלם אחרי 5 שניות
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [latestAlert]);

  if (!visible || !latestAlert) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: '80px', 
      right: '20px', 
      zIndex: 9999,
      backgroundColor: '#333', 
      color: '#fff', 
      padding: '16px', 
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <strong>התראה חדשה:</strong> {latestAlert.message || "יש לך עדכון חדש!"}
    </div>
  );
}