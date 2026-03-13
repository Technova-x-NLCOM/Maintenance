import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface OfflineData {
  alerts: any[];
  userSettings: any;
  lastSync: Date;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private offlineDataSubject = new BehaviorSubject<OfflineData | null>(null);

  public isOnline$ = this.isOnlineSubject.asObservable();
  public offlineData$ = this.offlineDataSubject.asObservable();

  private readonly STORAGE_KEY = 'inventory_offline_data';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeOfflineSupport();
    this.loadOfflineData();
  }

  private initializeOfflineSupport() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnlineSubject.next(true);
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnlineSubject.next(false);
    });

    // Register service worker for caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error);
        });
    }
  }

  private loadOfflineData() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        data.lastSync = new Date(data.lastSync);
        this.offlineDataSubject.next(data);
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  }

  public cacheData(alerts: any[], userSettings: any) {
    const offlineData: OfflineData = {
      alerts,
      userSettings,
      lastSync: new Date()
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(offlineData));
      this.offlineDataSubject.next(offlineData);
    } catch (error) {
      console.error('Error caching offline data:', error);
    }
  }

  public getCachedAlerts(): any[] {
    const data = this.offlineDataSubject.value;
    if (data && this.isCacheValid(data.lastSync)) {
      return data.alerts;
    }
    return [];
  }

  public getCachedUserSettings(): any | null {
    const data = this.offlineDataSubject.value;
    if (data && this.isCacheValid(data.lastSync)) {
      return data.userSettings;
    }
    return null;
  }

  public getCurrentOfflineData(): OfflineData | null {
    return this.offlineDataSubject.value;
  }

  private isCacheValid(lastSync: Date): boolean {
    const now = new Date();
    return (now.getTime() - lastSync.getTime()) < this.CACHE_DURATION;
  }

  public isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  public getOfflineCapabilities(): string[] {
    return [
      'View cached alerts',
      'View user settings',
      'Basic alert filtering',
      'Alert search (cached data)',
      'View alert analytics (cached)'
    ];
  }

  public getUnavailableFeatures(): string[] {
    return [
      'Create new alerts',
      'Acknowledge alerts',
      'Resolve alerts',
      'Update user settings',
      'Real-time data sync',
      'Bulk operations'
    ];
  }

  private syncWhenOnline() {
    // This would typically sync any pending changes when coming back online
    console.log('Back online - syncing data...');
    
    // Emit event for components to refresh their data
    window.dispatchEvent(new CustomEvent('online-sync'));
  }

  public clearCache() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.offlineDataSubject.next(null);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  public getCacheInfo(): { size: string; lastSync: Date | null; isValid: boolean } {
    const data = this.offlineDataSubject.value;
    
    if (!data) {
      return { size: '0 KB', lastSync: null, isValid: false };
    }

    const sizeInBytes = new Blob([JSON.stringify(data)]).size;
    const sizeInKB = Math.round(sizeInBytes / 1024);
    
    return {
      size: `${sizeInKB} KB`,
      lastSync: data.lastSync,
      isValid: this.isCacheValid(data.lastSync)
    };
  }
}