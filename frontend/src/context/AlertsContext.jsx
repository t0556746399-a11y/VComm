import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const AlertsContext = createContext(null);

const SOCKET_URL = process.env.REACT_APP_API_BASE_URL;
export const AlertsProvider = ({ children }) => {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setSocketConnected(false);
      setSocketError(null);
      return undefined;
    }

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      setSocketError(null);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('connect_error', (error) => {
      setSocketError(error.message || 'Socket connection error');
    });

    socket.on('new_alert', (alertData) => {
      setAlerts((prevAlerts) => [
        { ...alertData, read: false, id: alertData.id ?? `${Date.now()}` },
        ...prevAlerts,
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const markAsRead = (id) => {
    setAlerts((prevAlerts) =>
      prevAlerts.map((alert) =>
        alert.id === id ? { ...alert, read: true } : alert
      )
    );
  };

  const markAllRead = () => {
    setAlerts((prevAlerts) => prevAlerts.map((alert) => ({ ...alert, read: true })));
  };

  const unreadCount = useMemo(
    () => alerts.filter((alert) => !alert.read).length,
    [alerts]
  );

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        unreadCount,
        socketConnected,
        socketError,
        markAsRead,
        markAllRead,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => useContext(AlertsContext);
