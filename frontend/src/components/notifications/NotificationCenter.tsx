import React, { useState } from 'react';
import { 
  BellIcon, 
  CheckIcon, 
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { MilitaryCard } from '../ui/MilitaryCard';
import { MilitaryButton } from '../ui/MilitaryButton';
import { StatusBadge } from '../ui/StatusBadge';

interface Notification {
  id: string;
  type: 'lead' | 'mission' | 'message' | 'system' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onDismiss?: (id: string) => void;
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onNotificationClick,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClasses = `w-5 h-5 ${priority === 'urgent' ? 'text-critical-red' : 
      priority === 'high' ? 'text-orange-500' : 
      priority === 'medium' ? 'text-yellow-500' : 'text-olive-green'}`;

    switch (type) {
      case 'alert':
        return <ExclamationTriangleIcon className={iconClasses} />;
      case 'system':
        return <InformationCircleIcon className={iconClasses} />;
      case 'mission':
      case 'lead':
        return <CheckCircleIcon className={iconClasses} />;
      default:
        return <BellIcon className={iconClasses} />;
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'lead': return 'New Target';
      case 'mission': return 'Mission Update';
      case 'message': return 'Message';
      case 'system': return 'System';
      case 'alert': return 'Alert';
      default: return 'Notification';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-critical-red text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
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
          <div className="absolute right-0 top-full mt-2 w-96 z-50">
            <MilitaryCard variant="elevated" padding="none" className="max-h-96 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Command Center
                  </h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <MilitaryButton
                        variant="secondary"
                        size="sm"
                        onClick={onMarkAllAsRead}
                      >
                        Mark All Read
                      </MilitaryButton>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {unreadCount > 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <BellIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                        p-4 border-b border-gray-700 last:border-b-0 cursor-pointer transition-colors
                        ${!notification.read ? 'bg-brand-color/5 border-l-4 border-l-brand-color' : ''}
                        hover:bg-navy-blue/50
                      `}
                      onClick={() => {
                        onNotificationClick?.(notification);
                        if (!notification.read) {
                          onMarkAsRead?.(notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type, notification.priority)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Type Badge and Title */}
                              <div className="flex items-center gap-2 mb-1">
                                <StatusBadge
                                  status={notification.type as any}
                                  size="sm"
                                >
                                  {getTypeLabel(notification.type)}
                                </StatusBadge>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-brand-color rounded-full" />
                                )}
                              </div>
                              
                              <h4 className="text-sm font-medium text-white mb-1">
                                {notification.title}
                              </h4>
                              
                              <p className="text-sm text-gray-400 line-clamp-2">
                                {notification.message}
                              </p>
                              
                              <p className="text-xs text-gray-500 mt-2">
                                {formatTimestamp(notification.timestamp)}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 ml-2">
                              {!notification.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkAsRead?.(notification.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-olive-green transition-colors"
                                  title="Mark as read"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </button>
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDismiss?.(notification.id);
                                }}
                                className="p-1 text-gray-400 hover:text-critical-red transition-colors"
                                title="Dismiss"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-700 text-center">
                  <button className="text-sm text-brand-color hover:text-white transition-colors">
                    View All Notifications
                  </button>
                </div>
              )}
            </MilitaryCard>
          </div>
        </>
      )}
    </div>
  );
};