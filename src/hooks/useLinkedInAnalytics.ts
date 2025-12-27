/**
 * React Query hooks for LinkedIn Analytics
 * Fetches analytics data from DynamoDB via Lambda
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const LINKEDIN_AUTH_URL = import.meta.env.VITE_LINKEDIN_AUTH_FUNCTION_URL || '';
const LINKEDIN_SYNC_URL = import.meta.env.VITE_LINKEDIN_SYNC_URL || '';

// ============================================
// Types
// ============================================

export interface AnalyticsRecord {
  id: string;
  mondayUserId: string;
  linkedInId: string;
  syncedAt: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  profileFirstName?: string;
  profileLastName?: string;
  profileHeadline?: string;
  profilePicture?: string;
  totalImpressions: number;
  totalEngagements: number;
  totalReactions: number;
  totalComments: number;
  totalShares: number;
  uniqueViews: number;
}

export interface SyncLogRecord {
  id: string;
  syncJobId: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'partial' | 'failed';
  triggerType: 'scheduled' | 'manual';
  totalUsers: number;
  successCount: number;
  errorCount: number;
  errors?: string[];
  successDetails?: string[];
}

export interface EmployeeRecord {
  mondayUserId: string;
  linkedInId?: string;
  profileFirstName?: string;
  profileLastName?: string;
  profileHeadline?: string;
  profilePicture?: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  isExpired: boolean;
  displayName: string;
}

export interface AnalyticsQueryParams {
  mondayUserId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  limit?: number;
}

export interface AggregatedAnalytics {
  totalImpressions: number;
  totalEngagements: number;
  totalReactions: number;
  totalComments: number;
  totalShares: number;
  uniqueViews: number;
  employeeCount: number;
  avgImpressionsPerEmployee: number;
  avgEngagementsPerEmployee: number;
}

// ============================================
// API Functions
// ============================================

async function fetchAnalytics(params: AnalyticsQueryParams): Promise<{
  analytics: AnalyticsRecord[];
  count: number;
}> {
  const response = await fetch(LINKEDIN_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'query',
      ...params,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch analytics' }));
    throw new Error(error.error || 'Failed to fetch analytics');
  }

  return response.json();
}

async function fetchSyncStatus(): Promise<{
  latestSync: SyncLogRecord | null;
  recentSyncs: SyncLogRecord[];
}> {
  const response = await fetch(LINKEDIN_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'syncStatus' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch sync status' }));
    throw new Error(error.error || 'Failed to fetch sync status');
  }

  return response.json();
}

async function fetchAllEmployees(): Promise<{
  employees: EmployeeRecord[];
  count: number;
  connectedCount: number;
}> {
  const response = await fetch(LINKEDIN_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'allEmployees' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch employees' }));
    throw new Error(error.error || 'Failed to fetch employees');
  }

  return response.json();
}

async function triggerManualSync(): Promise<{
  success: boolean;
  syncJobId: string;
  totalUsers: number;
  successCount: number;
  errorCount: number;
}> {
  const response = await fetch(LINKEDIN_SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'manual' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to trigger sync' }));
    throw new Error(error.error || 'Failed to trigger sync');
  }

  return response.json();
}

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch analytics for a specific employee
 */
export function useEmployeeAnalytics(
  mondayUserId: string,
  dateRange?: { start: string; end: string }
) {
  return useQuery({
    queryKey: ['employeeAnalytics', mondayUserId, dateRange],
    queryFn: () => fetchAnalytics({
      mondayUserId,
      dateRangeStart: dateRange?.start,
      dateRangeEnd: dateRange?.end,
    }),
    enabled: !!mondayUserId && !!LINKEDIN_AUTH_URL,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

/**
 * Hook to fetch analytics for all employees
 */
export function useAllEmployeesAnalytics(dateRange?: { start: string; end: string }) {
  return useQuery({
    queryKey: ['allEmployeesAnalytics', dateRange],
    queryFn: () => fetchAnalytics({
      dateRangeStart: dateRange?.start,
      dateRangeEnd: dateRange?.end,
      limit: 500,
    }),
    enabled: !!LINKEDIN_AUTH_URL,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

/**
 * Hook to get sync status
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: ['syncStatus'],
    queryFn: fetchSyncStatus,
    enabled: !!LINKEDIN_AUTH_URL,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to get all connected employees
 */
export function useConnectedEmployees() {
  return useQuery({
    queryKey: ['connectedEmployees'],
    queryFn: fetchAllEmployees,
    enabled: !!LINKEDIN_AUTH_URL,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to trigger manual sync
 */
export function useManualSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerManualSync,
    onSuccess: () => {
      // Invalidate analytics and sync status queries after successful sync
      queryClient.invalidateQueries({ queryKey: ['allEmployeesAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['employeeAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
    },
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Aggregate analytics data for dashboard display
 */
export function aggregateAnalytics(
  analytics: AnalyticsRecord[]
): AggregatedAnalytics {
  // Get the most recent analytics per employee
  const latestByEmployee = new Map<string, AnalyticsRecord>();
  
  for (const record of analytics) {
    const existing = latestByEmployee.get(record.mondayUserId);
    if (!existing || record.syncedAt > existing.syncedAt) {
      latestByEmployee.set(record.mondayUserId, record);
    }
  }

  const latestRecords = Array.from(latestByEmployee.values());
  const employeeCount = latestRecords.length;

  const totals = latestRecords.reduce(
    (acc, record) => ({
      totalImpressions: acc.totalImpressions + record.totalImpressions,
      totalEngagements: acc.totalEngagements + record.totalEngagements,
      totalReactions: acc.totalReactions + record.totalReactions,
      totalComments: acc.totalComments + record.totalComments,
      totalShares: acc.totalShares + record.totalShares,
      uniqueViews: acc.uniqueViews + record.uniqueViews,
    }),
    {
      totalImpressions: 0,
      totalEngagements: 0,
      totalReactions: 0,
      totalComments: 0,
      totalShares: 0,
      uniqueViews: 0,
    }
  );

  return {
    ...totals,
    employeeCount,
    avgImpressionsPerEmployee: employeeCount > 0 
      ? Math.round(totals.totalImpressions / employeeCount) 
      : 0,
    avgEngagementsPerEmployee: employeeCount > 0 
      ? Math.round(totals.totalEngagements / employeeCount) 
      : 0,
  };
}

/**
 * Group analytics by week for charting
 */
export function groupAnalyticsByWeek(analytics: AnalyticsRecord[]): {
  week: string;
  impressions: number;
  engagements: number;
  reactions: number;
  comments: number;
  shares: number;
}[] {
  const byWeek = new Map<string, {
    impressions: number;
    engagements: number;
    reactions: number;
    comments: number;
    shares: number;
  }>();

  for (const record of analytics) {
    const date = new Date(record.syncedAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split('T')[0];

    const existing = byWeek.get(weekKey) || {
      impressions: 0,
      engagements: 0,
      reactions: 0,
      comments: 0,
      shares: 0,
    };

    byWeek.set(weekKey, {
      impressions: existing.impressions + record.totalImpressions,
      engagements: existing.engagements + record.totalEngagements,
      reactions: existing.reactions + record.totalReactions,
      comments: existing.comments + record.totalComments,
      shares: existing.shares + record.totalShares,
    });
  }

  return Array.from(byWeek.entries())
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Group analytics by employee for ranking
 */
export function groupAnalyticsByEmployee(analytics: AnalyticsRecord[]): {
  mondayUserId: string;
  displayName: string;
  profilePicture?: string;
  totalImpressions: number;
  totalEngagements: number;
  latestSync: number;
}[] {
  const byEmployee = new Map<string, {
    displayName: string;
    profilePicture?: string;
    totalImpressions: number;
    totalEngagements: number;
    latestSync: number;
  }>();

  for (const record of analytics) {
    const existing = byEmployee.get(record.mondayUserId) || {
      displayName: record.profileFirstName 
        ? `${record.profileFirstName} ${record.profileLastName || ''}`.trim()
        : record.mondayUserId,
      profilePicture: record.profilePicture,
      totalImpressions: 0,
      totalEngagements: 0,
      latestSync: 0,
    };

    byEmployee.set(record.mondayUserId, {
      displayName: existing.displayName,
      profilePicture: record.profilePicture || existing.profilePicture,
      totalImpressions: existing.totalImpressions + record.totalImpressions,
      totalEngagements: existing.totalEngagements + record.totalEngagements,
      latestSync: Math.max(existing.latestSync, record.syncedAt),
    });
  }

  return Array.from(byEmployee.entries())
    .map(([mondayUserId, data]) => ({ mondayUserId, ...data }))
    .sort((a, b) => b.totalImpressions - a.totalImpressions);
}

/**
 * Format sync status for display
 */
export function formatSyncStatus(sync: SyncLogRecord | null): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'info';
  lastSyncAgo: string;
} {
  if (!sync) {
    return {
      label: 'Never synced',
      color: 'info',
      lastSyncAgo: 'Never',
    };
  }

  const statusColors: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
    completed: 'success',
    partial: 'warning',
    failed: 'error',
    running: 'info',
  };

  const now = Date.now();
  const syncedAgo = now - sync.startedAt;
  const minutes = Math.floor(syncedAgo / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let lastSyncAgo: string;
  if (days > 0) {
    lastSyncAgo = `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    lastSyncAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    lastSyncAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    lastSyncAgo = 'Just now';
  }

  return {
    label: sync.status === 'running' ? 'Syncing...' : 
           sync.status === 'completed' ? 'Sync complete' :
           sync.status === 'partial' ? 'Partial sync' : 'Sync failed',
    color: statusColors[sync.status] || 'info',
    lastSyncAgo,
  };
}

