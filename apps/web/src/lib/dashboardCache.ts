const CACHE_KEY = 'dashboard_prefetch_data';
const CACHE_EXPIRY = 30000; // 30 seconds - just enough for transition

export interface DashboardCacheData {
  familyData: any;
  todaysMedications: any[];
  todayTasks: any[];
  recommendations: any[];
  timestamp: number;
}

export function cacheDashboardData(data: Omit<DashboardCacheData, 'timestamp'>): void {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({
    ...data,
    timestamp: Date.now()
  }));
}

export function getCachedDashboardData(): DashboardCacheData | null {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (!cached) return null;

  try {
    const data = JSON.parse(cached) as DashboardCacheData;
    // Check if cache is still fresh
    if (Date.now() - data.timestamp > CACHE_EXPIRY) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function clearDashboardCache(): void {
  sessionStorage.removeItem(CACHE_KEY);
}
