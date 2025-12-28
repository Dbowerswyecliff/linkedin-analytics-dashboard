/**
 * Mock data for demo mode and test sessions
 * Used when VITE_DEMO_MODE=true or when logged in with test credentials
 */

import type { AnalyticsRecord, EmployeeRecord, SyncLogRecord } from '@/hooks/useLinkedInAnalytics';

// Helper to generate dates
const weeksAgo = (weeks: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return date.toISOString().split('T')[0];
};

// Mock employees
export const mockEmployees: EmployeeRecord[] = [
  {
    mondayUserId: 'demo-user-1',
    linkedInId: 'urn:li:person:alice123',
    profileFirstName: 'Alice',
    profileLastName: 'Johnson',
    profileHeadline: 'VP of Marketing at TechCorp',
    profilePicture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    isExpired: false,
    displayName: 'Alice Johnson',
  },
  {
    mondayUserId: 'demo-user-2',
    linkedInId: 'urn:li:person:bob456',
    profileFirstName: 'Bob',
    profileLastName: 'Smith',
    profileHeadline: 'Senior Sales Director',
    profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    isExpired: false,
    displayName: 'Bob Smith',
  },
  {
    mondayUserId: 'demo-user-3',
    linkedInId: 'urn:li:person:carol789',
    profileFirstName: 'Carol',
    profileLastName: 'Davis',
    profileHeadline: 'Head of Product',
    profilePicture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    isExpired: false,
    displayName: 'Carol Davis',
  },
  {
    mondayUserId: 'demo-user-4',
    linkedInId: 'urn:li:person:david012',
    profileFirstName: 'David',
    profileLastName: 'Lee',
    profileHeadline: 'Engineering Manager',
    profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    isExpired: false,
    displayName: 'David Lee',
  },
  {
    mondayUserId: 'demo-user-5',
    linkedInId: 'urn:li:person:emma345',
    profileFirstName: 'Emma',
    profileLastName: 'Wilson',
    profileHeadline: 'Customer Success Lead',
    profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    isExpired: false,
    displayName: 'Emma Wilson',
  },
];

// Generate 8 weeks of analytics for each employee
const generateAnalyticsForEmployee = (employee: EmployeeRecord, weeksBack: number): AnalyticsRecord[] => {
  const records: AnalyticsRecord[] = [];
  
  for (let week = 0; week < weeksBack; week++) {
    const baseImpressions = Math.floor(Math.random() * 8000) + 2000;
    const engagementRate = 0.02 + Math.random() * 0.03; // 2-5% engagement rate
    const engagements = Math.floor(baseImpressions * engagementRate);
    
    records.push({
      id: `${employee.mondayUserId}-week-${week}`,
      mondayUserId: employee.mondayUserId,
      linkedInId: employee.linkedInId || '',
      syncedAt: Date.now() - week * 7 * 24 * 60 * 60 * 1000,
      dateRangeStart: weeksAgo(week + 1),
      dateRangeEnd: weeksAgo(week),
      profileFirstName: employee.profileFirstName,
      profileLastName: employee.profileLastName,
      profileHeadline: employee.profileHeadline,
      profilePicture: employee.profilePicture,
      totalImpressions: baseImpressions,
      totalEngagements: engagements,
      totalReactions: Math.floor(engagements * 0.6),
      totalComments: Math.floor(engagements * 0.25),
      totalShares: Math.floor(engagements * 0.1),
      totalClicks: Math.floor(engagements * 0.05),
      uniqueViews: Math.floor(baseImpressions * 0.7),
      postCount: Math.floor(Math.random() * 4) + 1,
    });
  }
  
  return records;
};

// Generate all analytics
export const mockAnalytics: AnalyticsRecord[] = mockEmployees.flatMap(emp => 
  generateAnalyticsForEmployee(emp, 8)
);

// Mock sync status
export const mockSyncStatus: { latestSync: SyncLogRecord | null; recentSyncs: SyncLogRecord[] } = {
  latestSync: {
    id: 'sync-demo-1',
    syncJobId: 'sync-demo-1',
    startedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    completedAt: Date.now() - 2 * 60 * 60 * 1000 + 45000, // 45 seconds later
    status: 'completed',
    triggerType: 'scheduled',
    totalUsers: 5,
    successCount: 5,
    errorCount: 0,
    errors: [],
    successDetails: [
      'Alice Johnson: 3,245 impressions synced',
      'Bob Smith: 2,891 impressions synced',
      'Carol Davis: 4,102 impressions synced',
      'David Lee: 1,876 impressions synced',
      'Emma Wilson: 2,567 impressions synced',
    ],
  },
  recentSyncs: [
    {
      id: 'sync-demo-1',
      syncJobId: 'sync-demo-1',
      startedAt: Date.now() - 2 * 60 * 60 * 1000,
      completedAt: Date.now() - 2 * 60 * 60 * 1000 + 45000,
      status: 'completed',
      triggerType: 'scheduled',
      totalUsers: 5,
      successCount: 5,
      errorCount: 0,
    },
    {
      id: 'sync-demo-2',
      syncJobId: 'sync-demo-2',
      startedAt: Date.now() - 3 * 60 * 60 * 1000,
      completedAt: Date.now() - 3 * 60 * 60 * 1000 + 52000,
      status: 'completed',
      triggerType: 'scheduled',
      totalUsers: 5,
      successCount: 5,
      errorCount: 0,
    },
    {
      id: 'sync-demo-3',
      syncJobId: 'sync-demo-3',
      startedAt: Date.now() - 4 * 60 * 60 * 1000,
      completedAt: Date.now() - 4 * 60 * 60 * 1000 + 38000,
      status: 'completed',
      triggerType: 'manual',
      totalUsers: 5,
      successCount: 5,
      errorCount: 0,
    },
  ],
};
