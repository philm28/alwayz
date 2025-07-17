import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load notifications from localStorage
    const saved = localStorage.getItem('alwayz-notifications');
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotifications(parsed);
      setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
    }

    // Set up service worker for push notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 50); // Keep only last 50
      localStorage.setItem('alwayz-notifications', JSON.stringify(updated));
      return updated;
    });

    setUnreadCount(prev => prev + 1);

    // Show toast notification
    const toastOptions = {
      duration: 4000,
      position: 'top-right' as const
    };

    switch (notification.type) {
      case 'success':
        toast.success(notification.message, toastOptions);
        break;
      case 'error':
        toast.error(notification.message, toastOptions);
        break;
      case 'warning':
        toast(notification.message, { ...toastOptions, icon: '⚠️' });
        break;
      default:
        toast(notification.message, toastOptions);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      );
      localStorage.setItem('alwayz-notifications', JSON.stringify(updated));
      return updated;
    });

    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('alwayz-notifications', JSON.stringify(updated));
      return updated;
    });

    setUnreadCount(0);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem('alwayz-notifications');
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  };

  const sendPushNotification = (title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        ...options
      });
    }
  };

  // Predefined notification helpers
  const notifyPersonaReady = (personaName: string) => {
    addNotification({
      type: 'success',
      title: 'Persona Ready',
      message: `${personaName} has finished training and is ready for conversations!`,
      action: {
        label: 'Start Chat',
        onClick: () => {
          // Navigate to chat with persona
        }
      }
    });

    sendPushNotification(`${personaName} is ready!`, {
      body: 'Your AI persona has finished training and is ready for conversations.',
      tag: 'persona-ready'
    });
  };

  const notifySubscriptionExpiring = (daysLeft: number) => {
    addNotification({
      type: 'warning',
      title: 'Subscription Expiring',
      message: `Your subscription expires in ${daysLeft} days. Renew to continue using premium features.`,
      action: {
        label: 'Renew',
        onClick: () => {
          // Navigate to subscription page
        }
      }
    });
  };

  const notifyUsageLimitReached = (limitType: string) => {
    addNotification({
      type: 'warning',
      title: 'Usage Limit Reached',
      message: `You've reached your ${limitType} limit. Upgrade your plan to continue.`,
      action: {
        label: 'Upgrade',
        onClick: () => {
          // Navigate to upgrade page
        }
      }
    });
  };

  const notifyNewFeature = (feature: string, description: string) => {
    addNotification({
      type: 'info',
      title: `New Feature: ${feature}`,
      message: description,
      action: {
        label: 'Learn More',
        onClick: () => {
          // Navigate to feature documentation
        }
      }
    });
  };

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    requestPermission,
    sendPushNotification,
    // Helpers
    notifyPersonaReady,
    notifySubscriptionExpiring,
    notifyUsageLimitReached,
    notifyNewFeature
  };
}