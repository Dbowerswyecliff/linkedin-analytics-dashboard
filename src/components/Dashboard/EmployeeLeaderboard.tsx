/**
 * Employee Leaderboard
 * Displays all employees ranked by impressions with trophy/medal icons for top performers
 */

interface Employee {
  mondayUserId: string;
  displayName: string;
  profilePicture?: string;
  totalImpressions: number;
  totalEngagements: number;
}

interface EmployeeLeaderboardProps {
  employees: Employee[];
}

// Position indicators for top 3
const POSITION_ICONS: Record<number, string> = {
  1: '🏆',
  2: '🥈',
  3: '🥉',
};

// Colors for top 3 positions
const POSITION_COLORS: Record<number, string> = {
  1: '#FFD700', // Gold
  2: '#C0C0C0', // Silver
  3: '#CD7F32', // Bronze
};

export default function EmployeeLeaderboard({ employees }: EmployeeLeaderboardProps) {
  if (employees.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Employee Leaderboard</h3>
        <div className="chart-empty">
          <p>No employee data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card leaderboard-card">
      <h3 className="chart-title">Employee Leaderboard</h3>
      <div className="leaderboard-list">
        {employees.map((employee, index) => {
          const position = index + 1;
          const isTopThree = position <= 3;
          const positionIcon = POSITION_ICONS[position];
          
          return (
            <div 
              key={employee.mondayUserId} 
              className={`leaderboard-item ${isTopThree ? `top-${position}` : ''}`}
            >
              <div 
                className={`leaderboard-position ${isTopThree ? 'has-icon' : ''}`}
                style={isTopThree ? { color: POSITION_COLORS[position] } : undefined}
              >
                {positionIcon || position}
              </div>
              
              <div className="leaderboard-avatar">
                {employee.profilePicture ? (
                  <img 
                    src={employee.profilePicture} 
                    alt={employee.displayName}
                  />
                ) : (
                  <div 
                    className="avatar-placeholder"
                    style={{ 
                      backgroundColor: isTopThree 
                        ? POSITION_COLORS[position] 
                        : getAvatarColor(employee.displayName) 
                    }}
                  >
                    {employee.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="leaderboard-info">
                <span className="leaderboard-name">{employee.displayName}</span>
                <span className="leaderboard-stats">
                  {formatNumber(employee.totalImpressions)} impressions
                  <span className="stats-separator">•</span>
                  {formatNumber(employee.totalEngagements)} engagements
                </span>
              </div>
              
              <div className="leaderboard-value">
                {formatNumber(employee.totalImpressions)}
              </div>
            </div>
          );
        })}
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

// Generate a consistent color based on name
function getAvatarColor(name: string): string {
  const colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#f97316'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

