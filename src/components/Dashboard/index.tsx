import { useState, useMemo } from 'react'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { 
  useAllEmployeesAnalytics, 
  useConnectedEmployees,
  useSyncStatus,
  aggregateAnalytics,
  groupAnalyticsByWeek,
  groupAnalyticsByEmployee,
  formatSyncStatus,
} from '@/hooks/useLinkedInAnalytics'
import Filters from './Filters'
import KPICards from './KPICards'
import WeeklyChart from './WeeklyChart'
import TopEmployeesChart from './TopEmployeesChart'
import AnalyticsTable from './AnalyticsTable'
import SyncStatusBanner from './SyncStatusBanner'
import EmptyState from '../shared/EmptyState'
import './dashboard.css'

export default function Dashboard() {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [dateRange, setDateRange] = useState(() => ({
    start: startOfWeek(subWeeks(new Date(), 8)),
    end: endOfWeek(new Date()),
  }))
  const [viewMode, setViewMode] = useState<'weekly' | 'employees'>('weekly')

  // Query parameters
  const queryDateRange = useMemo(() => ({
    start: format(dateRange.start, 'yyyy-MM-dd'),
    end: format(dateRange.end, 'yyyy-MM-dd'),
  }), [dateRange])

  // Fetch analytics from DynamoDB
  const { data: analyticsData, isLoading: analyticsLoading } = useAllEmployeesAnalytics(queryDateRange)
  const { data: employeeData } = useConnectedEmployees()
  const { data: syncData } = useSyncStatus()

  // Process analytics data
  const analytics = analyticsData?.analytics || []
  const employees = employeeData?.employees || []

  // Filter by selected employees
  const filteredAnalytics = useMemo(() => {
    if (selectedEmployees.length === 0) return analytics
    return analytics.filter(a => selectedEmployees.includes(a.mondayUserId))
  }, [analytics, selectedEmployees])

  // Aggregated KPIs
  const aggregated = useMemo(() => aggregateAnalytics(filteredAnalytics), [filteredAnalytics])
  
  // Chart data
  const weeklyChartData = useMemo(() => groupAnalyticsByWeek(filteredAnalytics), [filteredAnalytics])
  const employeeRanking = useMemo(() => groupAnalyticsByEmployee(filteredAnalytics), [filteredAnalytics])

  // Sync status
  const syncStatus = formatSyncStatus(syncData?.latestSync || null)

  // KPI cards data
  const kpiData = useMemo(() => ({
    impressions: aggregated.totalImpressions,
    reach: aggregated.uniqueViews,
    engagements: aggregated.totalEngagements,
    engagementRate: aggregated.totalImpressions > 0 
      ? ((aggregated.totalEngagements / aggregated.totalImpressions) * 100).toFixed(2)
      : '0.00',
    employeeCount: aggregated.employeeCount,
    avgImpressions: aggregated.avgImpressionsPerEmployee,
  }), [aggregated])

  // Transform employees for filter dropdown
  const employeeOptions = useMemo(() => 
    employees.map(e => ({
      id: e.mondayUserId,
      name: e.displayName,
      profilePicture: e.profilePicture,
    })),
    [employees]
  )

  const hasData = filteredAnalytics.length > 0
  const isLoading = analyticsLoading

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>LinkedIn Analytics</h1>
          <p className="dashboard-subtitle">
            Track employee performance and engagement metrics
          </p>
        </div>
        <SyncStatusBanner 
          status={syncStatus.label}
          color={syncStatus.color}
          lastSyncAgo={syncStatus.lastSyncAgo}
        />
      </header>

      <Filters
        employees={employeeOptions}
        selectedEmployees={selectedEmployees}
        onEmployeesChange={setSelectedEmployees}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {isLoading ? (
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>Loading analytics data...</p>
        </div>
      ) : !hasData ? (
        <EmptyState
          title="No analytics data yet"
          description="Connect LinkedIn accounts and sync data to see analytics here. Visit the Admin page to get started."
          icon="📊"
        />
      ) : (
        <>
          <KPICards data={kpiData} />

          <div className="charts-grid">
            <WeeklyChart data={weeklyChartData} />
            <TopEmployeesChart employees={employeeRanking.slice(0, 5)} />
          </div>

          <div className="tables-section">
            {viewMode === 'weekly' ? (
              <AnalyticsTable
                title="Weekly Breakdown"
                data={weeklyChartData}
                type="weekly"
              />
            ) : (
              <AnalyticsTable
                title="Employee Analytics"
                data={employeeRanking}
                type="employees"
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

