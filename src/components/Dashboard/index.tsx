import { useState, useMemo } from 'react'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { useBoardConfig, useWeeklyTotals, usePostAnalytics, useEmployees } from '@/hooks/useMondayBoard'
import { useKPIData, useChartData, useTopPosts } from '@/hooks/useAnalytics'
import Filters from './Filters'
import KPICards from './KPICards'
import WeeklyChart from './WeeklyChart'
import TopPostsChart from './TopPostsChart'
import DataTable from './DataTable'
import EmptyState from '../shared/EmptyState'
import './dashboard.css'

export default function Dashboard() {
  const { data: boardConfig } = useBoardConfig()
  
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [dateRange, setDateRange] = useState(() => ({
    start: startOfWeek(subWeeks(new Date(), 8)),
    end: endOfWeek(new Date()),
  }))
  const [viewMode, setViewMode] = useState<'weekly' | 'posts'>('weekly')

  const filters = useMemo(() => ({
    employeeIds: selectedEmployees.length > 0 ? selectedEmployees : undefined,
    startDate: format(dateRange.start, 'yyyy-MM-dd'),
    endDate: format(dateRange.end, 'yyyy-MM-dd'),
  }), [selectedEmployees, dateRange])

  // Previous period for trend calculation
  const prevFilters = useMemo(() => {
    const duration = dateRange.end.getTime() - dateRange.start.getTime()
    return {
      employeeIds: selectedEmployees.length > 0 ? selectedEmployees : undefined,
      startDate: format(new Date(dateRange.start.getTime() - duration), 'yyyy-MM-dd'),
      endDate: format(new Date(dateRange.end.getTime() - duration), 'yyyy-MM-dd'),
    }
  }, [selectedEmployees, dateRange])

  const { data: employees = [] } = useEmployees(boardConfig?.weeklyTotalsBoardId ?? null)
  const { data: weeklyData = [], isLoading: weeklyLoading } = useWeeklyTotals(
    boardConfig?.weeklyTotalsBoardId ?? null,
    filters
  )
  const { data: prevWeeklyData = [] } = useWeeklyTotals(
    boardConfig?.weeklyTotalsBoardId ?? null,
    prevFilters
  )
  const { data: postsData = [], isLoading: postsLoading } = usePostAnalytics(
    boardConfig?.postAnalyticsBoardId ?? null,
    filters
  )

  const kpiData = useKPIData(weeklyData, prevWeeklyData)
  const chartData = useChartData(weeklyData)
  const topPosts = useTopPosts(postsData)

  const isLoading = weeklyLoading || postsLoading
  const hasData = weeklyData.length > 0 || postsData.length > 0

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>LinkedIn Analytics</h1>
        <p className="dashboard-subtitle">
          Track employee performance and engagement metrics
        </p>
      </header>

      <Filters
        employees={employees}
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
          title="No data for this date range"
          description="Try selecting a different date range or sync your LinkedIn data first."
          icon="📊"
        />
      ) : (
        <>
          <KPICards data={kpiData} />

          <div className="charts-grid">
            <WeeklyChart data={chartData} />
            <TopPostsChart posts={topPosts} />
          </div>

          <div className="tables-section">
            {viewMode === 'weekly' ? (
              <DataTable
                title="Weekly Totals"
                type="weekly"
                data={weeklyData}
              />
            ) : (
              <DataTable
                title="Post Analytics"
                type="posts"
                data={postsData}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

