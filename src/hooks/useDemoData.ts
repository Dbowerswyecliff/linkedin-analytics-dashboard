/**
 * Demo data hooks
 * 
 * Provides demo data when VITE_DEMO_MODE=true environment variable is set.
 * In demo mode, only mock data is used -- no live API calls are made.
 */

import { useQuery } from '@tanstack/react-query';
import { mockEmployees, mockAnalytics, mockSyncStatus } from '@/data/mockDemoData';
import type { AnalyticsRecord, EmployeeRecord, SyncLogRecord } from './useLinkedInAnalytics';

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Hook to determine if demo mode should be active
 */
export function useIsDemoMode(): boolean {
  return IS_DEMO_MODE;
}

/**
 * Hook to get employees - returns mock data in demo mode
 */
export function useDemoEmployees() {
  const isDemoMode = useIsDemoMode();

  return useQuery({
    queryKey: ['demoEmployees', isDemoMode],
    queryFn: () => Promise.resolve({
      employees: mockEmployees,
      count: mockEmployees.length,
      connectedCount: mockEmployees.length,
    }),
    enabled: isDemoMode,
    staleTime: Infinity, // Demo data never goes stale
  });
}

/**
 * Hook to get analytics - returns mock data in demo mode
 */
export function useDemoAnalytics(dateRange?: { start: string; end: string }) {
  const isDemoMode = useIsDemoMode();

  return useQuery({
    queryKey: ['demoAnalytics', isDemoMode, dateRange],
    queryFn: () => {
      let filteredAnalytics = mockAnalytics;
      
      if (dateRange?.start) {
        filteredAnalytics = filteredAnalytics.filter(
          a => a.dateRangeStart >= dateRange.start
        );
      }
      if (dateRange?.end) {
        filteredAnalytics = filteredAnalytics.filter(
          a => a.dateRangeEnd <= dateRange.end
        );
      }
      
      return Promise.resolve({
        analytics: filteredAnalytics,
        count: filteredAnalytics.length,
      });
    },
    enabled: isDemoMode,
    staleTime: Infinity,
  });
}

/**
 * Hook to get sync status - returns mock data in demo mode
 */
export function useDemoSyncStatus() {
  const isDemoMode = useIsDemoMode();

  return useQuery({
    queryKey: ['demoSyncStatus', isDemoMode],
    queryFn: () => Promise.resolve(mockSyncStatus),
    enabled: isDemoMode,
    staleTime: Infinity,
  });
}

// Re-export types for convenience
export type { AnalyticsRecord, EmployeeRecord, SyncLogRecord };

