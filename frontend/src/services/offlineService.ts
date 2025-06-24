// Offline capability service for BOTG mobile operations
import { Mission } from '../types/mission';
import { Target } from '../types/target';

interface OfflineData {
  missions: Mission[];
  targets: Target[];
  missionUpdates: any[];
  targetUpdates: any[];
  lastSync: string;
}

interface QueuedAction {
  id: string;
  type: 'mission_update' | 'target_update' | 'mission_create' | 'target_create';
  data: any;
  timestamp: string;
  retryCount: number;
}

class OfflineService {
  private dbName = 'DroneStrikeOfflineDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('missions')) {
          const missionStore = db.createObjectStore('missions', { keyPath: 'id' });
          missionStore.createIndex('status', 'status', { unique: false });
          missionStore.createIndex('assigned_soldier_id', 'assigned_soldier.id', { unique: false });
        }

        if (!db.objectStoreNames.contains('targets')) {
          const targetStore = db.createObjectStore('targets', { keyPath: 'id' });
          targetStore.createIndex('county', 'mailing_county', { unique: false });
          targetStore.createIndex('status', 'lead_status', { unique: false });
        }

        if (!db.objectStoreNames.contains('actionQueue')) {
          const queueStore = db.createObjectStore('actionQueue', { keyPath: 'id' });
          queueStore.createIndex('type', 'type', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncData')) {
          db.createObjectStore('syncData', { keyPath: 'key' });
        }
      };
    });
  }

  // Store data for offline access
  async cacheMissions(missions: Mission[]): Promise<void> {
    if (!this.db) await this.initDB();
    
    const transaction = this.db!.transaction(['missions'], 'readwrite');
    const store = transaction.objectStore('missions');
    
    for (const mission of missions) {
      await store.put(mission);
    }
  }

  async cacheTargets(targets: Target[]): Promise<void> {
    if (!this.db) await this.initDB();
    
    const transaction = this.db!.transaction(['targets'], 'readwrite');
    const store = transaction.objectStore('targets');
    
    for (const target of targets) {
      await store.put(target);
    }
  }

  // Retrieve cached data
  async getCachedMissions(): Promise<Mission[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['missions'], 'readonly');
      const store = transaction.objectStore('missions');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedTargets(): Promise<Target[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['targets'], 'readonly');
      const store = transaction.objectStore('targets');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Queue actions for when back online
  async queueAction(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.db) await this.initDB();
    
    const queuedAction: QueuedAction = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    const transaction = this.db!.transaction(['actionQueue'], 'readwrite');
    const store = transaction.objectStore('actionQueue');
    await store.add(queuedAction);
  }

  async getQueuedActions(): Promise<QueuedAction[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actionQueue'], 'readonly');
      const store = transaction.objectStore('actionQueue');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeQueuedAction(actionId: string): Promise<void> {
    if (!this.db) await this.initDB();
    
    const transaction = this.db!.transaction(['actionQueue'], 'readwrite');
    const store = transaction.objectStore('actionQueue');
    await store.delete(actionId);
  }

  // Sync with server when online
  async syncWithServer(): Promise<void> {
    if (!navigator.onLine) {
      console.log('Still offline, skipping sync');
      return;
    }

    const queuedActions = await this.getQueuedActions();
    
    for (const action of queuedActions) {
      try {
        await this.executeAction(action);
        await this.removeQueuedAction(action.id);
      } catch (error) {
        console.error('Failed to sync action:', action, error);
        
        // Increment retry count
        action.retryCount++;
        if (action.retryCount >= 3) {
          // Remove action after 3 failed attempts
          await this.removeQueuedAction(action.id);
        } else {
          // Update retry count in storage
          const transaction = this.db!.transaction(['actionQueue'], 'readwrite');
          const store = transaction.objectStore('actionQueue');
          await store.put(action);
        }
      }
    }

    // Update last sync timestamp
    await this.updateLastSync();
  }

  private async executeAction(action: QueuedAction): Promise<void> {
    switch (action.type) {
      case 'mission_update':
        // Call mission update API
        await fetch(`/api/missions/${action.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.data)
        });
        break;
        
      case 'target_update':
        // Call target update API
        await fetch(`/api/targets/${action.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.data)
        });
        break;
        
      case 'mission_create':
        // Call mission create API
        await fetch('/api/missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.data)
        });
        break;
        
      case 'target_create':
        // Call target create API
        await fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.data)
        });
        break;
    }
  }

  async updateLastSync(): Promise<void> {
    if (!this.db) await this.initDB();
    
    const transaction = this.db!.transaction(['syncData'], 'readwrite');
    const store = transaction.objectStore('syncData');
    await store.put({
      key: 'lastSync',
      value: new Date().toISOString()
    });
  }

  async getLastSync(): Promise<string | null> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncData'], 'readonly');
      const store = transaction.objectStore('syncData');
      const request = store.get('lastSync');
      
      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Check connectivity and setup listeners
  isOnline(): boolean {
    return navigator.onLine;
  }

  setupConnectivityListeners(): void {
    window.addEventListener('online', async () => {
      console.log('Connection restored, syncing with server...');
      await this.syncWithServer();
    });

    window.addEventListener('offline', () => {
      console.log('Connection lost, switching to offline mode');
    });
  }

  // Local storage fallback for quick access
  setLocalData(key: string, data: any): void {
    try {
      localStorage.setItem(`dronestrike_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  getLocalData(key: string): any {
    try {
      const data = localStorage.getItem(`dronestrike_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  }

  // Clear all offline data
  async clearOfflineData(): Promise<void> {
    if (!this.db) await this.initDB();
    
    const transaction = this.db!.transaction(['missions', 'targets', 'actionQueue', 'syncData'], 'readwrite');
    
    await Promise.all([
      transaction.objectStore('missions').clear(),
      transaction.objectStore('targets').clear(),
      transaction.objectStore('actionQueue').clear(),
      transaction.objectStore('syncData').clear()
    ]);

    // Clear localStorage as well
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('dronestrike_')) {
        localStorage.removeItem(key);
      }
    });
  }

  // Get storage usage statistics
  async getStorageStats(): Promise<{
    missions: number;
    targets: number;
    queuedActions: number;
    lastSync: string | null;
  }> {
    const [missions, targets, queuedActions, lastSync] = await Promise.all([
      this.getCachedMissions(),
      this.getCachedTargets(),
      this.getQueuedActions(),
      this.getLastSync()
    ]);

    return {
      missions: missions.length,
      targets: targets.length,
      queuedActions: queuedActions.length,
      lastSync
    };
  }
}

export const offlineService = new OfflineService();
export default OfflineService;