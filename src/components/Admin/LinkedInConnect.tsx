import { useState, useEffect } from 'react'
import { 
  initiateLinkedInAuth,
  checkConnectionStatus,
  disconnectLinkedIn,
  fetchLinkedInProfile,
  hasSession,
  clearAllLinkedInData,
  type LinkedInProfile,
  type ConnectionStatus as ApiConnectionStatus,
} from '@/services/linkedin-api'
import { getMondayUserId } from '@/services/monday-api'
import './linkedin-connect.css'

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || ''

interface ConnectionStatus {
  connected: boolean;
  profile?: LinkedInProfile;
  connectedAt?: string;
  canRefresh?: boolean;
}

export default function LinkedInConnect() {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false })
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConnectionStatus()
  }, [])

  const loadConnectionStatus = async () => {
    setIsLoading(true)
    
    // First check if we have a session locally
    if (!hasSession()) {
      setStatus({ connected: false })
      setIsLoading(false)
      return
    }

    try {
      // Check status with server (validates session and token)
      const serverStatus: ApiConnectionStatus = await checkConnectionStatus()
      
      if (serverStatus.connected) {
        setStatus({
          connected: true,
          profile: serverStatus.profile,
          canRefresh: serverStatus.canRefresh,
        })
      } else {
        // Session or tokens are invalid
        setStatus({ connected: false })
        clearAllLinkedInData()
      }
    } catch (err) {
      console.warn('[Admin] Failed to check connection status:', err)
      setStatus({ connected: false })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!LINKEDIN_CLIENT_ID) {
      setError('LinkedIn Client ID is not configured. Please set VITE_LINKEDIN_CLIENT_ID in your environment.')
      return
    }

    setIsConnecting(true)
    setError(null)
    
    try {
      // Get Monday.com user ID first
      const mondayUserId = await getMondayUserId()
      console.log('[Admin] Monday user ID:', mondayUserId)
      
      // Initiate OAuth flow with Monday user ID
      const session = await initiateLinkedInAuth(mondayUserId)
      console.log('[Admin] OAuth complete, session created')
      
      setStatus({
        connected: true,
        profile: session.profile,
        connectedAt: new Date().toLocaleDateString(),
      })
    } catch (err) {
      console.error('[Admin] OAuth failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect LinkedIn')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectLinkedIn()
    } catch (err) {
      console.error('[Admin] Failed to disconnect:', err)
    }
    setStatus({ connected: false })
  }

  const handleRefreshProfile = async () => {
    try {
      const profile = await fetchLinkedInProfile()
      setStatus(prev => ({
        ...prev,
        profile,
      }))
    } catch (err) {
      console.error('[Admin] Failed to refresh profile:', err)
      setError('Failed to refresh profile. You may need to reconnect.')
    }
  }

  if (isLoading) {
    return (
      <div className="linkedin-connect">
        <div className="connect-header">
          <div className="linkedin-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
          </div>
          <div>
            <h3>LinkedIn Integration</h3>
            <p>Checking connection status...</p>
          </div>
        </div>
        <div className="loading-state">
          <div className="button-spinner" />
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="linkedin-connect">
      <div className="connect-header">
        <div className="linkedin-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
          </svg>
        </div>
        <div>
          <h3>LinkedIn Integration</h3>
          <p>Connect your LinkedIn account to sync analytics data</p>
        </div>
      </div>

      {!LINKEDIN_CLIENT_ID && (
        <div className="config-warning">
          <span>⚠️</span>
          <div>
            <strong>Configuration Required</strong>
            <p>
              Set <code>VITE_LINKEDIN_CLIENT_ID</code> in your environment variables.
              Get credentials from the{' '}
              <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer">
                LinkedIn Developer Portal
              </a>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="config-warning" style={{ borderColor: '#ef4444' }}>
          <span>❌</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="connection-section">
        <div className="section-header">
          <h4>📊 LinkedIn Analytics</h4>
          <p className="section-description">Access your profile info and post analytics</p>
        </div>

        {status.connected && status.profile ? (
          <div className="connected-card">
            <div className="connected-info">
              <div className="status-badge success">✓ Connected</div>
              <div className="profile-info">
                <strong>{status.profile.firstName} {status.profile.lastName}</strong>
                {status.profile.headline && (
                  <span>{status.profile.headline}</span>
                )}
                {status.connectedAt && (
                  <span className="connected-date">Connected on {status.connectedAt}</span>
                )}
              </div>
            </div>
            <div className="connected-actions">
              <button 
                onClick={handleRefreshProfile}
                className="refresh-btn"
                title="Refresh profile info"
              >
                🔄
              </button>
              <button 
                onClick={handleDisconnect}
                className="disconnect-btn"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleConnect}
            disabled={isConnecting || !LINKEDIN_CLIENT_ID}
            className="connect-button"
          >
            {isConnecting ? (
              <>
                <div className="button-spinner" />
                Connecting...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Connect LinkedIn Account
              </>
            )}
          </button>
        )}

        <div className="scope-info">
          <small>Access: Profile info + Post analytics</small>
        </div>
      </div>

      <div className="api-notice">
        <h4>ℹ️ What This Does</h4>
        <p>
          Connecting your LinkedIn account allows this app to:
        </p>
        <ul>
          <li><strong>View your profile:</strong> Name, photo, headline</li>
          <li><strong>Access post analytics:</strong> Impressions, engagement, reach</li>
        </ul>
        <p>
          Your credentials are securely stored on our server (encrypted) and you can disconnect at any time.
          Tokens automatically refresh before they expire.
        </p>
      </div>
    </div>
  )
}
