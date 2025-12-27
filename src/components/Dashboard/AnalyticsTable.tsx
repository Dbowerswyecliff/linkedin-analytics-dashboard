/**
 * Analytics Table
 * Displays weekly or employee analytics in a table format
 */

interface WeeklyData {
  week: string;
  impressions: number;
  engagements: number;
  reactions: number;
  comments: number;
  shares: number;
}

interface EmployeeData {
  mondayUserId: string;
  displayName: string;
  profilePicture?: string;
  totalImpressions: number;
  totalEngagements: number;
  latestSync: number;
}

interface AnalyticsTableProps {
  title: string;
  data: WeeklyData[] | EmployeeData[];
  type: 'weekly' | 'employees';
}

export default function AnalyticsTable({ title, data, type }: AnalyticsTableProps) {
  if (data.length === 0) {
    return (
      <div className="table-card">
        <h3 className="table-title">{title}</h3>
        <div className="table-empty">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-card">
      <h3 className="table-title">{title}</h3>
      <div className="table-scroll">
        {type === 'weekly' ? (
          <WeeklyTable data={data as WeeklyData[]} />
        ) : (
          <EmployeeTable data={data as EmployeeData[]} />
        )}
      </div>
    </div>
  );
}

function WeeklyTable({ data }: { data: WeeklyData[] }) {
  return (
    <table className="analytics-table">
      <thead>
        <tr>
          <th>Week</th>
          <th className="num-col">Impressions</th>
          <th className="num-col">Engagements</th>
          <th className="num-col">Reactions</th>
          <th className="num-col">Comments</th>
          <th className="num-col">Shares</th>
          <th className="num-col">Eng. Rate</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => {
          const engRate = row.impressions > 0 
            ? ((row.engagements / row.impressions) * 100).toFixed(2) 
            : '0.00';
          return (
            <tr key={row.week}>
              <td>{formatWeek(row.week)}</td>
              <td className="num-col">{formatNumber(row.impressions)}</td>
              <td className="num-col">{formatNumber(row.engagements)}</td>
              <td className="num-col">{formatNumber(row.reactions)}</td>
              <td className="num-col">{formatNumber(row.comments)}</td>
              <td className="num-col">{formatNumber(row.shares)}</td>
              <td className="num-col">
                <span className={`rate-badge ${parseFloat(engRate) > 3 ? 'good' : ''}`}>
                  {engRate}%
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EmployeeTable({ data }: { data: EmployeeData[] }) {
  return (
    <table className="analytics-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th className="num-col">Impressions</th>
          <th className="num-col">Engagements</th>
          <th className="num-col">Eng. Rate</th>
          <th>Last Synced</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => {
          const engRate = row.totalImpressions > 0 
            ? ((row.totalEngagements / row.totalImpressions) * 100).toFixed(2) 
            : '0.00';
          return (
            <tr key={row.mondayUserId}>
              <td>
                <div className="employee-cell">
                  <div className="employee-avatar-small">
                    {row.profilePicture ? (
                      <img src={row.profilePicture} alt={row.displayName} />
                    ) : (
                      <div className="avatar-placeholder-small">
                        {row.displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span>{row.displayName}</span>
                </div>
              </td>
              <td className="num-col">{formatNumber(row.totalImpressions)}</td>
              <td className="num-col">{formatNumber(row.totalEngagements)}</td>
              <td className="num-col">
                <span className={`rate-badge ${parseFloat(engRate) > 3 ? 'good' : ''}`}>
                  {engRate}%
                </span>
              </td>
              <td className="date-col">{formatDate(row.latestSync)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
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

function formatWeek(dateStr: string): string {
  const date = new Date(dateStr);
  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 7) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  return 'Just now';
}

