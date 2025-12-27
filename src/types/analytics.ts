// Board column IDs will be set after board creation
export interface WeeklyTotal {
  id: string
  itemId: string
  employeeId: string
  employeeName: string
  personUrn: string
  weekStart: string
  weekEnd: string
  weekKey: string
  impressions: number
  membersReached: number
  reactions: number
  comments: number
  reshares: number
  engagements: number
  engagementRate: number
  syncedAt: string
  syncStatus: 'OK' | 'Partial' | 'Error'
  syncNotes: string
}

export interface PostAnalytics {
  id: string
  itemId: string
  employeeId: string
  employeeName: string
  personUrn: string
  postUrn: string
  postUrl: string
  postDate: string
  rangeStart: string
  rangeEnd: string
  postKey: string
  impressions: number
  membersReached: number
  reactions: number
  comments: number
  reshares: number
  engagements: number
  engagementRate: number
  syncedAt: string
  syncStatus: 'OK' | 'Partial' | 'Error'
  syncNotes: string
}

export interface Employee {
  id: string
  name: string
  personUrn: string
  linkedInConnected: boolean
  lastSyncedAt?: string
}

export interface DateRange {
  start: Date
  end: Date
}

export interface DashboardFilters {
  employeeIds: string[]
  dateRange: DateRange
  viewMode: 'weekly' | 'posts'
}

export interface KPIData {
  totalImpressions: number
  totalReach: number
  totalEngagements: number
  engagementRate: number
  impressionsTrend: number // percentage change from previous period
  reachTrend: number
  engagementsTrend: number
  rateTrend: number
}

export interface ChartDataPoint {
  date: string
  label: string
  impressions: number
  reach: number
  engagements: number
}

export interface TopPost {
  postUrl: string
  employeeName: string
  postDate: string
  impressions: number
  engagements: number
  engagementRate: number
}

export interface SyncError {
  itemId: string
  employeeName: string
  boardName: string
  error: string
  timestamp: string
}

// Monday board configuration
export interface BoardConfig {
  weeklyTotalsBoardId: string | null
  postAnalyticsBoardId: string | null
}

// LinkedIn OAuth
export interface LinkedInTokens {
  accessToken: string
  expiresAt: number
  refreshToken?: string
}

export interface LinkedInProfile {
  id: string
  firstName: string
  lastName: string
  profilePicture?: string
  urn: string
}

