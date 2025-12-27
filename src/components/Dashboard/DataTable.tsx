import type { WeeklyTotal, PostAnalytics } from '@/types/analytics'
import './data-table.css'

interface DataTableProps {
  title: string
  type: 'weekly' | 'posts'
  data: WeeklyTotal[] | PostAnalytics[]
}

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function formatPercent(num: number): string {
  return (num * 100).toFixed(2) + '%'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function DataTable({ title, type, data }: DataTableProps) {
  if (data.length === 0) {
    return (
      <div className="table-card">
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
        </div>
        <div className="table-empty">
          <p>No data available</p>
        </div>
      </div>
    )
  }

  if (type === 'weekly') {
    const weeklyData = data as WeeklyTotal[]
    return (
      <div className="table-card animate-slide-up stagger-4">
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          <span className="record-count">{weeklyData.length} records</span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Week</th>
                <th className="num">Impressions</th>
                <th className="num">Reach</th>
                <th className="num">Engagements</th>
                <th className="num">Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((row) => (
                <tr key={row.id}>
                  <td className="employee-cell">{row.employeeName}</td>
                  <td className="date-cell">
                    {formatDate(row.weekStart)} - {formatDate(row.weekEnd)}
                  </td>
                  <td className="num">{formatNumber(row.impressions)}</td>
                  <td className="num">{formatNumber(row.membersReached)}</td>
                  <td className="num">{formatNumber(row.engagements)}</td>
                  <td className="num">{formatPercent(row.engagementRate)}</td>
                  <td>
                    <span className={`status-badge status-${row.syncStatus?.toLowerCase() || 'ok'}`}>
                      {row.syncStatus || 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Posts table
  const postsData = data as PostAnalytics[]
  return (
    <div className="table-card animate-slide-up stagger-4">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        <span className="record-count">{postsData.length} records</span>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Post</th>
              <th>Date Range</th>
              <th className="num">Impressions</th>
              <th className="num">Reach</th>
              <th className="num">Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {postsData.map((row) => (
              <tr key={row.id}>
                <td className="employee-cell">{row.employeeName}</td>
                <td className="post-cell">
                  {row.postUrl ? (
                    <a href={row.postUrl} target="_blank" rel="noopener noreferrer">
                      View Post ↗
                    </a>
                  ) : (
                    <span className="no-link">No link</span>
                  )}
                </td>
                <td className="date-cell">
                  {formatDate(row.rangeStart)} - {formatDate(row.rangeEnd)}
                </td>
                <td className="num">{formatNumber(row.impressions)}</td>
                <td className="num">{formatNumber(row.membersReached)}</td>
                <td className="num">{formatPercent(row.engagementRate)}</td>
                <td>
                  <span className={`status-badge status-${row.syncStatus?.toLowerCase() || 'ok'}`}>
                    {row.syncStatus || 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

