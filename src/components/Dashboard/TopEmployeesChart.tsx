/**
 * Top Employees Chart
 * Shows ranking of employees by impressions
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Employee {
  mondayUserId: string;
  displayName: string;
  profilePicture?: string;
  totalImpressions: number;
  totalEngagements: number;
}

interface TopEmployeesChartProps {
  employees: Employee[];
}

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981'];

export default function TopEmployeesChart({ employees }: TopEmployeesChartProps) {
  if (employees.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Top Employees</h3>
        <div className="chart-empty">
          <p>No employee data available</p>
        </div>
      </div>
    );
  }

  // Transform data for chart
  const chartData = employees.map((emp, index) => ({
    name: emp.displayName.split(' ')[0], // First name only for brevity
    fullName: emp.displayName,
    impressions: emp.totalImpressions,
    engagements: emp.totalEngagements,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="chart-card">
      <h3 className="chart-title">Top Employees by Impressions</h3>
      <div className="chart-container" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis type="number" tickFormatter={(value) => formatNumber(value)} />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={80}
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return (
                    <div className="custom-tooltip">
                      <p className="tooltip-name">{data.fullName}</p>
                      <p className="tooltip-value">
                        <span className="tooltip-label">Impressions:</span>
                        <strong>{formatNumber(data.impressions)}</strong>
                      </p>
                      <p className="tooltip-value">
                        <span className="tooltip-label">Engagements:</span>
                        <strong>{formatNumber(data.engagements)}</strong>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="impressions" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Employee Legend */}
      <div className="employee-legend">
        {employees.slice(0, 5).map((emp, index) => (
          <div key={emp.mondayUserId} className="legend-item">
            <div className="legend-avatar">
              {emp.profilePicture ? (
                <img src={emp.profilePicture} alt={emp.displayName} />
              ) : (
                <div 
                  className="avatar-placeholder" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                >
                  {emp.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="legend-info">
              <span className="legend-name">{emp.displayName}</span>
              <span className="legend-stat">{formatNumber(emp.totalImpressions)} impressions</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

