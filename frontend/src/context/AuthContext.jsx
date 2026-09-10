import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('dev');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);

  const refreshSession = async () => {
    try {
      const session = await api('/auth/session');
      setUser(session.user);
      setAuthMode(session.authMode || 'dev');

      if (session.user) {
        const [notifs, myReqs] = await Promise.all([
          api('/notifications').catch(() => []),
          api('/leave/requests').catch(() => []),
        ]);
        setNotifications(notifs || []);
        setWithdrawalRequests((myReqs || []).filter(r => r.status === 'REJECTED_PENDING_WITHDRAWAL'));
      }
    } catch (err) {
      console.error('Session load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
    api('/auth/users')
      .then(setAvailableUsers)
      .catch(() => []);
  }, []);

  const signIn = async (userId) => {
    setLoading(true);
    try {
      const res = await api('/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      await refreshSession();
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setNotifications([]);
      setWithdrawalRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev =>
        prev.map(n => n.notification_id === id ? { ...n, is_read: 1 } : n)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        authMode,
        loading,
        notifications,
        unreadCount,
        availableUsers,
        withdrawalRequests,
        signIn,
        signOut,
        refreshSession,
        markNotificationRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
