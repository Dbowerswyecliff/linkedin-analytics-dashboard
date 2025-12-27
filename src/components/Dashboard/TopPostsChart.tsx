import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { TopPost } from '@/types/analytics'
import './charts.css'

interface TopPostsChartProps {
  posts: TopPost[]
}

function formatYAxis(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K'
  return value.toString()
}

const COLORS = [
  '#667eea',
  '#764ba2',
  '#f093fb',
  '#f5576c',
  '#4facfe',
  '#00f2fe',
  '#43e97b',
  '#38f9d7',
  '#fa709a',
  '#fee140',
]

export default function TopPostsChart({ posts }: TopPostsChartProps) {
  if (posts.length === 0) {
    return (
      <div className="chart-card">
        <div className="card-header">
          <h3 className="card-title">📊 Top Posts by Impressions</h3>
        </div>
        <div className="chart-empty">
          <p>No posts data available</p>
        </div>
      </div>
    )
  }

  const chartData = posts.map((post, idx) => ({
    name: `Post ${idx + 1}`,
    employee: post.employeeName,
    impressions: post.impressions,
    engagements: post.engagements,
    url: post.postUrl,
  }))

  return (
    <div className="chart-card animate-slide-up stagger-3">
      <div className="card-header">
        <h3 className="card-title">📊 Top 10 Posts</h3>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
            <XAxis
              type="number"
              stroke="var(--dash-text-muted)"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatYAxis}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--dash-text-muted)"
              fontSize={12}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--dash-surface-elevated)',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--dash-text)',
              }}
              labelStyle={{ color: 'var(--dash-text)', fontWeight: 600 }}
              formatter={(value: number, name: string) => [
                formatYAxis(value),
                name === 'impressions' ? 'Impressions' : name,
              ]}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload
                return data?.employee || label
              }}
            />
            <Bar dataKey="impressions" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

