import { useState, useEffect } from 'react'
import { 
  initiateLinkedInAuth,
  getLinkedInTokens,
  clearLinkedInTokens,
  fetchLinkedInProfile,
  isLinkedInConnected,
  type LinkedInProfile,
} from '@/services/linkedin-api'
import './linkedin-connect.css'

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || ''

interface ConnectionStatus {
  connected: boolean;
  profile?: LinkedInProfile;
  connectedAt?: string;
}

export default function LinkedInConnect() {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false })
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConnectionStatus()
  }, [])

  const loadConnectionStatus = async () => {
    if (!isLinkedInConnected()) {
      setStatus({ connected: false })
      return
    }

    const tokens = getLinkedInTokens()
    if (!tokens) return

    try {
      const profile = await fetchLinkedInProfile(tokens.access_token)
      setStatus({
        connected: true,
        profile,
        connectedAt: new Date(tokens.expiresAt - (tokens.expires_in * 1000)).toLocaleDateString(),
      })
    } catch (err) {
      console.warn('[Admin] Failed to load profile (Lambda not deployed?), showing connection without profile:', err)
      
      // Still show as connected even if profile fetch fails
      setStatus({
        connected: true,
        profile: {
          id: 'unknown',
          firstName: 'LinkedIn',
          lastName: 'User',
        },
        connectedAt: new Date(tokens.expiresAt - (tokens.expires_in * 1000)).toLocaleDateString(),
      })
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
      const tokens = await initiateLinkedInAuth()
      console.log('[Admin] Got tokens, attempting to fetch profile...')
      
      try {
        const profile = await fetchLinkedInProfile(tokens.access_token)
        console.log('[Admin] Profile fetched successfully:', profile)
        
        setStatus({
          connected: true,
          profile,
          connectedAt: new Date().toLocaleDateString(),
        })
      } catch (profileErr) {
        console.warn('[Admin] Profile fetch failed (Lambda not deployed?), showing connection without profile:', profileErr)
        
        // Still show as connected even if profile fetch fails
        setStatus({
          connected: true,
          profile: {
            id: 'unknown',
            firstName: 'LinkedIn',
            lastName: 'User',
          },
          connectedAt: new Date().toLocaleDateString(),
        })
      }
    } catch (err) {
      console.error('[Admin] OAuth failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect LinkedIn')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    clearLinkedInTokens()
    setStatus({ connected: false })
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
            <button 
              onClick={handleDisconnect}
              className="disconnect-btn"
            >
              Disconnect
            </button>
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
          Your credentials are securely stored and you can disconnect at any time.
        </p>
      </div>
    </div>
  )
}
