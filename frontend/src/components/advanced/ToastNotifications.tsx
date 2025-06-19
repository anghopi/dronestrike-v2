import React, { useState, useEffect } from 'react';
import { notificationService, Notification } from '../../services/notificationService';

const ToastNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((allNotifications) => {
      // Only show notifications that should auto-remove (toasts)
      const toastNotifications = allNotifications.filter(n => n.autoRemove);
      setNotifications(toastNotifications);
    });
    return unsubscribe;
  }, []);

  const handleRemove = (id: string) => {
    notificationService.remove(id);
  };

  const getToastStyle = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600 text-white';
      case 'error':
        return 'bg-red-500 border-red-600 text-white';
      case 'warning':
        return 'bg-yellow-500 border-yellow-600 text-white';
      case 'info':
        return 'bg-blue-500 border-blue-600 text-white';
      default:
        return 'bg-gray-500 border-gray-600 text-white';
    }
  };

  const getToastIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'i';
      default:
        return '•';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            ${getToastStyle(notification.type)}
            border rounded-lg shadow-lg p-4 transform transition-all duration-300 ease-in-out
            animate-slide-in-right
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-sm font-bold">
                {getToastIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {notification.title}
                </p>
                {notification.message && (
                  <p className="text-xs mt-1 opacity-90">
                    {notification.message}
                  </p>
                )}
                {notification.action && (
                  <button
                    onClick={() => {
                      notification.action?.onClick();
                      handleRemove(notification.id);
                    }}
                    className="text-xs underline mt-2 hover:no-underline"
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => handleRemove(notification.id)}
              className="ml-4 text-white hover:text-gray-200 flex-shrink-0"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastNotifications;