import { useState } from 'react'
import './linkedin-connect.css'

// LinkedIn OAuth configuration
const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || ''
const LINKEDIN_REDIRECT_URI = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || window.location.origin + '/auth/linkedin/callback'
const LINKEDIN_SCOPES = ['openid', 'profile', 'email'].join(' ')

interface ConnectedAccount {
  name: string
  email: string
  connectedAt: string
  lastSync?: string
}

export default function LinkedInConnect() {
  const [connectedAccounts] = useState<ConnectedAccount[]>([])
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = () => {
    if (!LINKEDIN_CLIENT_ID) {
      alert('LinkedIn Client ID is not configured. Please set VITE_LINKEDIN_CLIENT_ID in your environment.')
      return
    }

    setIsConnecting(true)
    
    const state = crypto.randomUUID()
    sessionStorage.setItem('linkedin_oauth_state', state)

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', LINKEDIN_REDIRECT_URI)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('scope', LINKEDIN_SCOPES)

    window.location.href = authUrl.toString()
  }

  const handleDisconnect = (email: string) => {
    // In a real app, this would call an API to revoke the token
    console.log('Disconnecting:', email)
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
          <p>Connect employee LinkedIn accounts to sync analytics data</p>
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

      <div className="connected-accounts">
        <div className="accounts-header">
          <h4>Connected Accounts</h4>
          <span className="account-count">{connectedAccounts.length} connected</span>
        </div>

        {connectedAccounts.length === 0 ? (
          <div className="no-accounts">
            <p>No LinkedIn accounts connected yet</p>
            <p className="hint">Connect an account to start syncing analytics</p>
          </div>
        ) : (
          <div className="accounts-list">
            {connectedAccounts.map((account) => (
              <div key={account.email} className="account-item">
                <div className="account-info">
                  <strong>{account.name}</strong>
                  <span>{account.email}</span>
                  {account.lastSync && (
                    <span className="last-sync">Last sync: {account.lastSync}</span>
                  )}
                </div>
                <button 
                  onClick={() => handleDisconnect(account.email)}
                  className="disconnect-btn"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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

      <div className="api-notice">
        <h4>📝 Note on LinkedIn API Access</h4>
        <p>
          LinkedIn restricts API access for analytics data. To get post impressions and engagement metrics, 
          you may need to apply for the <strong>Marketing Developer Platform</strong> or use the 
          <strong> Manual Upload</strong> feature with exported data.
        </p>
      </div>
    </div>
  )
}

