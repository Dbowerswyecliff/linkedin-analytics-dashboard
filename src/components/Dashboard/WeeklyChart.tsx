import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import './charts.css'

interface WeeklyData {
  week: string;
  impressions: number;
  engagements: number;
  reactions: number;
  comments: number;
  shares: number;
}

interface WeeklyChartProps {
  data: WeeklyData[]
}

function formatYAxis(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K'
  return value.toString()
}

function formatWeekLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  if (data.length === 0) {
    return (
      <div className="chart-card">
        <div className="card-header">
          <h3 className="card-title">Impressions by Week</h3>
        </div>
        <div className="chart-empty">
          <p>No weekly data available</p>
        </div>
      </div>
    )
  }

  // Transform data for chart
  const chartData = data.map(d => ({
    ...d,
    label: formatWeekLabel(d.week),
  }))

  return (
    <div className="chart-card animate-slide-up stagger-2">
      <div className="card-header">
        <h3 className="card-title">Impressions by Week</h3>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" />
            <XAxis 
              dataKey="label" 
              stroke="var(--dash-text-muted)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="var(--dash-text-muted)"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatYAxis}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--dash-surface-elevated)',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--dash-text)',
              }}
              labelStyle={{ color: 'var(--dash-text)', fontWeight: 600 }}
              formatter={(value: number) => formatYAxis(value)}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
            />
            <Line
              type="monotone"
              dataKey="impressions"
              name="Impressions"
              stroke="#667eea"
              strokeWidth={3}
              dot={{ fill: '#667eea', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#667eea', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="engagements"
              name="Engagements"
              stroke="#4facfe"
              strokeWidth={2}
              dot={{ fill: '#4facfe', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: '#4facfe', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

