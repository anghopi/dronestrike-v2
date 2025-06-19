export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoRemove?: boolean;
  duration?: number; // in milliseconds
}

class NotificationService {
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private notifications: Notification[] = [];

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.notifications]));
  }

  add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false,
      autoRemove: true,
      duration: 5000,
      ...notification,
    };

    this.notifications.unshift(newNotification);
    this.notify();

    // Auto-remove notification after duration
    if (newNotification.autoRemove && newNotification.duration) {
      setTimeout(() => {
        this.remove(newNotification.id);
      }, newNotification.duration);
    }

    return newNotification.id;
  }

  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notify();
  }

  markAsRead(id: string) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notify();
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.notify();
  }

  clear() {
    this.notifications = [];
    this.notify();
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  // Convenience methods
  success(title: string, message?: string, options?: Partial<Notification>) {
    return this.add({ type: 'success', title, message, ...options });
  }

  error(title: string, message?: string, options?: Partial<Notification>) {
    return this.add({ 
      type: 'error', 
      title, 
      message, 
      autoRemove: false, // Errors should persist until manually dismissed
      ...options 
    });
  }

  warning(title: string, message?: string, options?: Partial<Notification>) {
    return this.add({ type: 'warning', title, message, ...options });
  }

  info(title: string, message?: string, options?: Partial<Notification>) {
    return this.add({ type: 'info', title, message, ...options });
  }

  // System notifications for various actions
  csvUploadSuccess(recordCount: number, type: 'leads' | 'properties') {
    return this.success(
      'CSV Upload Successful',
      `Successfully imported ${recordCount} ${type}`,
      { duration: 8000 }
    );
  }

  csvUploadError(error: string) {
    return this.error(
      'CSV Upload Failed',
      error,
      { autoRemove: false }
    );
  }

  leadCreated(leadName: string) {
    return this.success(
      'Lead Created',
      `${leadName} has been added to your leads`,
      { duration: 4000 }
    );
  }

  leadUpdated(leadName: string) {
    return this.info(
      'Lead Updated',
      `${leadName} has been updated`,
      { duration: 3000 }
    );
  }

  workflowAdvanced(leadName: string, newStage: string) {
    return this.success(
      'Workflow Advanced',
      `${leadName} moved to ${newStage}`,
      { duration: 5000 }
    );
  }

  opportunityCreated(leadName: string, amount: number) {
    return this.success(
      'Opportunity Created',
      `Investment opportunity created for ${leadName} ($${amount.toLocaleString()})`,
      { duration: 6000 }
    );
  }

  authenticationError() {
    return this.error(
      'Authentication Required',
      'Please log in to continue',
      { autoRemove: false }
    );
  }

  networkError() {
    return this.error(
      'Network Error',
      'Unable to connect to server. Please check your connection.',
      { autoRemove: false }
    );
  }
}

export const notificationService = new NotificationService();