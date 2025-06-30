import { useState, useEffect, useCallback } from 'react';
import { offlineService } from '../services/offlineService';

interface OfflineStats {
  missions: number;
  targets: number;
  queuedActions: number;
  lastSync: string | null;
}

interface UseOfflineReturn {
  isOnline: boolean;
  isLoading: boolean;
  stats: OfflineStats | null;
  queueAction: (action: any) => Promise<void>;
  syncWithServer: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

export const useOffline = (): UseOfflineReturn => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<OfflineStats | null>(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Setup offline service listeners
    offlineService.setupConnectivityListeners();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load initial stats
  useEffect(() => {
    refreshStats();
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const newStats = await offlineService.getStorageStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to load offline stats:', error);
    }
  }, []);

  const queueAction = useCallback(async (action: any) => {
    try {
      setIsLoading(true);
      await offlineService.queueAction(action);
      await refreshStats();
    } catch (error) {
      console.error('Failed to queue action:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStats]);

  const syncWithServer = useCallback(async () => {
    try {
      setIsLoading(true);
      await offlineService.syncWithServer();
      await refreshStats();
    } catch (error) {
      console.error('Failed to sync with server:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStats]);

  const clearOfflineData = useCallback(async () => {
    try {
      setIsLoading(true);
      await offlineService.clearOfflineData();
      await refreshStats();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStats]);

  return {
    isOnline,
    isLoading,
    stats,
    queueAction,
    syncWithServer,
    clearOfflineData,
    refreshStats
  };
};