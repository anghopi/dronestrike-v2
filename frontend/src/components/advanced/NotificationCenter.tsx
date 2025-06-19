import React, { useState, useEffect } from 'react';
import { notificationService, Notification } from '../../services/notificationService';

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(setNotifications);
    return unsubscribe;
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      notificationService.markAsRead(notification.id);
    }
    if (notification.action) {
      notification.action.onClick();
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    notificationService.remove(id);
  };

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead();
  };

  const handleClearAll = () => {
    notificationService.clear();
    setIsOpen(false);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '•';
      case 'error':
        return '•';
      case 'warning':
        return '•';
      case 'info':
        return '•';
      default:
        return '•';
    }
  };

  const getNotificationBgColor = (type: Notification['type'], read: boolean) => {
    const opacity = read ? 'opacity-60' : '';
    switch (type) {
      case 'success':
        return `bg-green-900/40 border-green-400/50 ${opacity}`;
      case 'error':
        return `bg-red-900/40 border-red-400/50 ${opacity}`;
      case 'warning':
        return `bg-yellow-900/40 border-yellow-400/50 ${opacity}`;
      case 'info':
        return `bg-blue-900/40 border-blue-400/50 ${opacity}`;
      default:
        return `bg-gray-700/40 border-gray-500/50 ${opacity}`;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white hover:text-blue-300 hover:bg-gray-700/50 rounded-lg transition-colors border border-gray-600/50 hover:border-gray-500"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 rounded-lg shadow-2xl border border-gray-500 z-50 max-h-96 overflow-hidden backdrop-blur-md">
            {/* Header */}
            <div className="p-4 border-b border-gray-500 flex items-center justify-between bg-gray-800/80">
              <h3 className="text-lg font-semibold text-white">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm bg-red-600/20 text-red-300 px-2 py-1 rounded-full border border-red-500/30">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <span className="text-3xl block mb-2">•</span>
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-600">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 cursor-pointer hover:bg-gray-600/60 transition-colors border-l-4 ${getNotificationBgColor(notification.type, notification.read)}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <span className="text-lg flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${notification.read ? 'text-gray-300' : 'text-white'}`}>
                              {notification.title}
                            </p>
                            {notification.message && (
                              <p className={`text-xs mt-1 ${notification.read ? 'text-gray-400' : 'text-gray-200'}`}>
                                {notification.message}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {formatTimestamp(notification.timestamp)}
                            </p>
                            {notification.action && (
                              <button className="text-xs text-blue-300 hover:text-blue-200 mt-2 font-medium">
                                {notification.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleRemove(notification.id, e)}
                          className="text-gray-400 hover:text-white ml-2 p-1 hover:bg-gray-700/50 rounded transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;