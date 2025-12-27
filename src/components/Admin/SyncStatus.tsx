import './sync-status.css'

interface SyncError {
  boardName: string
  itemId: string
  employeeName: string
  error: string
  timestamp: string
}

interface SyncStatusProps {
  errors: SyncError[]
  isLoading: boolean
}

export default function SyncStatus({ errors, isLoading }: SyncStatusProps) {
  const handleSyncNow = () => {
    // In a real app, this would trigger a sync
    alert('Sync functionality requires LinkedIn API integration. Use Manual Upload for now.')
  }

  const handleRetry = (itemId: string) => {
    console.log('Retrying sync for item:', itemId)
  }

  return (
    <div className="sync-status">
      <div className="sync-header">
        <div className="sync-info">
          <h3>Sync Status</h3>
          <p>Monitor data synchronization between LinkedIn and Monday boards</p>
        </div>
        <button onClick={handleSyncNow} className="sync-now-btn">
          🔄 Sync Now
        </button>
      </div>

      <div className="status-cards">
        <div className="status-card">
          <div className="status-icon success">✓</div>
          <div className="status-content">
            <span className="status-value">--</span>
            <span className="status-label">Last Successful Sync</span>
          </div>
        </div>
        <div className="status-card">
          <div className="status-icon error">{errors.length}</div>
          <div className="status-content">
            <span className="status-value">Errors</span>
            <span className="status-label">Need attention</span>
          </div>
        </div>
      </div>

      <div className="errors-section">
        <div className="errors-header">
          <h4>Sync Errors</h4>
          {errors.length > 0 && (
            <span className="error-count">{errors.length} issues found</span>
          )}
        </div>

        {isLoading ? (
          <div className="errors-loading">
            <div className="loading-spinner" />
            <span>Checking for errors...</span>
          </div>
        ) : errors.length === 0 ? (
          <div className="no-errors">
            <span className="check-icon">✅</span>
            <p>No sync errors found</p>
            <span className="hint">All data is synchronized correctly</span>
          </div>
        ) : (
          <div className="errors-list">
            <table className="errors-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Board</th>
                  <th>Error</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((error, idx) => (
                  <tr key={`${error.itemId}-${idx}`}>
                    <td className="employee-cell">{error.employeeName}</td>
                    <td className="board-cell">{error.boardName}</td>
                    <td className="error-cell">{error.error}</td>
                    <td className="time-cell">{error.timestamp || '-'}</td>
                    <td className="action-cell">
                      <button 
                        onClick={() => handleRetry(error.itemId)}
                        className="retry-btn"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

