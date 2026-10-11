import React, { useState } from 'react';
import { useAlerts } from '../../context/AlertsContext';
import NotificationItem from './NotificationItem';
import './NotificationBell.css';

export default function NotificationBell() {
  const { alerts, unreadCount, socketConnected, socketError } = useAlerts();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bell-container relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        title={socketConnected ? 'מחובר' : 'לא מחובר'}
        className="p-2 transition"
      >
        🔔
        {socketError && <span style={{ color: 'red' }}>×</span>}
        {unreadCount > 0 && (
          <span className="notification-badge bg-red-500 text-white text-xs rounded-full px-1">
            {unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="notification-panel absolute right-0 mt-2 w-64 bg-white shadow-lg p-4 border border-gray-200 rounded-lg z-50">
          <h3 className="font-bold mb-2">התראות</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500">אין הודעות</p>
          ) : (
            alerts.map(alert => (
              <NotificationItem
                key={alert.id}
                alert={alert}
                onRead={() => console.log('read', alert.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}