import { useSyncStatus, useManualSync, formatSyncStatus } from '@/hooks/useLinkedInAnalytics'
import './sync-status.css'

export default function SyncStatus() {
  const { data: syncData, isLoading: statusLoading, refetch } = useSyncStatus()
  const manualSync = useManualSync()

  const latestSync = syncData?.latestSync ?? null
  const syncStatus = formatSyncStatus(latestSync)

  const handleSyncNow = async () => {
    try {
      await manualSync.mutateAsync()
      refetch()
    } catch (err) {
      console.error('Manual sync failed:', err)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const errors = latestSync?.errors ?? []

  return (
    <div className="sync-status">
      <div className="sync-header">
        <div className="sync-info">
          <h3>LinkedIn Analytics Sync</h3>
          <p>Sync fetches post analytics for all connected employees</p>
        </div>
        <button 
          onClick={handleSyncNow} 
          className="sync-now-btn"
          disabled={manualSync.isPending}
        >
          {manualSync.isPending ? '⏳ Syncing...' : '🔄 Sync Now'}
        </button>
      </div>

      {/* Sync Error Display */}
      {manualSync.isError && (
        <div className="sync-error-banner">
          <span className="error-icon">⚠️</span>
          <div className="error-content">
            <strong>Sync Failed</strong>
            <p>{manualSync.error?.message || 'Unknown error occurred'}</p>
            <p className="error-hint">
              Make sure VITE_LINKEDIN_SYNC_URL is configured. 
              Find the URL in AWS Console → Lambda → linkedin-sync → Configuration → Function URL.
            </p>
          </div>
        </div>
      )}

      {/* Sync Success Display */}
      {manualSync.isSuccess && manualSync.data && (
        <div className="sync-success-banner">
          <span className="success-icon">✅</span>
          <div className="success-content">
            <strong>Sync Complete</strong>
            <p>
              {manualSync.data.successCount} of {manualSync.data.totalUsers} employees synced successfully
            </p>
          </div>
        </div>
      )}

      <div className="status-cards">
        <div className="status-card">
          <div className={`status-icon ${syncStatus.color}`}>
            {syncStatus.color === 'success' ? '✓' : 
             syncStatus.color === 'error' ? '✗' : 
             syncStatus.color === 'warning' ? '!' : '○'}
          </div>
          <div className="status-content">
            <span className="status-value">{syncStatus.label}</span>
            <span className="status-label">{syncStatus.lastSyncAgo}</span>
          </div>
        </div>
        
        {latestSync && (
          <>
            <div className="status-card">
              <div className="status-icon info">{latestSync.successCount || 0}</div>
              <div className="status-content">
                <span className="status-value">Synced</span>
                <span className="status-label">of {latestSync.totalUsers || 0} employees</span>
              </div>
            </div>
            <div className="status-card">
              <div className={`status-icon ${(latestSync.errorCount || 0) > 0 ? 'error' : 'success'}`}>
                {latestSync.errorCount || 0}
              </div>
              <div className="status-content">
                <span className="status-value">Errors</span>
                <span className="status-label">Need attention</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sync Details */}
      {latestSync && (
        <div className="sync-details">
          <h4>Last Sync Details</h4>
          <dl className="details-list">
            <div className="detail-item">
              <dt>Started</dt>
              <dd>{formatTimestamp(latestSync.startedAt)}</dd>
            </div>
            {latestSync.completedAt && (
              <div className="detail-item">
                <dt>Completed</dt>
                <dd>{formatTimestamp(latestSync.completedAt)}</dd>
              </div>
            )}
            <div className="detail-item">
              <dt>Trigger</dt>
              <dd>{latestSync.triggerType === 'scheduled' ? '⏰ Scheduled' : '👆 Manual'}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Errors Section */}
      <div className="errors-section">
        <div className="errors-header">
          <h4>Sync Errors</h4>
          {errors.length > 0 && (
            <span className="error-count">{errors.length} issues found</span>
          )}
        </div>

        {statusLoading ? (
          <div className="errors-loading">
            <div className="loading-spinner" />
            <span>Loading sync status...</span>
          </div>
        ) : errors.length === 0 ? (
          <div className="no-errors">
            <span className="check-icon">✅</span>
            <p>No sync errors found</p>
            <span className="hint">All connected employees synced successfully</span>
          </div>
        ) : (
          <div className="errors-list">
            <ul className="error-messages">
              {errors.map((error, idx) => (
                <li key={idx} className="error-item">
                  <span className="error-bullet">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* LinkedIn API Requirements */}
      <div className="api-requirements">
        <h4>📋 LinkedIn API Requirements</h4>
        <p>For analytics sync to work, verify your LinkedIn app has these scopes enabled:</p>
        <ul className="requirements-list">
          <li>
            <code>r_basicprofile</code> - Read basic profile info (name, photo, headline)
          </li>
          <li>
            <code>r_member_postAnalytics</code> - Read post analytics (impressions, engagements)
          </li>
        </ul>
        <p className="requirements-note">
          Check in <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer">
            LinkedIn Developer Portal
          </a> → Your App → Products tab → Community Management API
        </p>
      </div>
    </div>
  )
}
