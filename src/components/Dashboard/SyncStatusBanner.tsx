/**
 * Sync Status Banner
 * Shows the current sync status in the dashboard header
 */

interface SyncStatusBannerProps {
  status: string;
  color: 'success' | 'warning' | 'error' | 'info';
  lastSyncAgo: string;
}

export default function SyncStatusBanner({ status, color, lastSyncAgo }: SyncStatusBannerProps) {
  return (
    <div className={`sync-status-banner ${color}`}>
      <div className="status-icon">
        {color === 'success' && (
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        )}
        {color === 'warning' && (
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        )}
        {color === 'error' && (
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        )}
        {color === 'info' && (
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        )}
      </div>
      <span className="status-text">{status}</span>
      <span className="status-divider">•</span>
      <span className="status-time">{lastSyncAgo}</span>
    </div>
  );
}

