import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { handleLinkedInCallback, storeSession } from '@/services/linkedin-api'

/**
 * LinkedIn OAuth Callback Handler
 * This page handles the OAuth redirect from LinkedIn.
 * It exchanges the authorization code for a session and posts the result back to the opener window.
 * 
 * New flow with DynamoDB:
 * 1. LinkedIn redirects here with code and state
 * 2. We call Lambda to exchange code for tokens
 * 3. Lambda stores tokens in DynamoDB (encrypted) and returns a session ID + profile
 * 4. We store the session ID locally and post the result to the opener
 */
export default function LinkedInCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasRun = useRef(false)

  useEffect(() => {
    // Prevent multiple executions (React strict mode, hot reload, etc.)
    if (hasRun.current) {
      console.log('[OAuth Callback] Already executed, skipping duplicate call');
      return;
    }
    hasRun.current = true;
    
    const handleCallback = async () => {
      console.log('[OAuth Callback] Starting callback handler', {
        url: window.location.href,
        hasOpener: !!window.opener,
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37a99209-83e4-4cc5-b2e7-dc66d713db5d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'src/components/Auth/LinkedInCallback.tsx:useEffect',message:'callback_loaded',data:{pathname:window.location.pathname,hasOpener:!!window.opener},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      
      console.log('[OAuth Callback] Params:', { 
        code: code?.substring(0, 10) + '...', 
        state: state?.substring(0, 10) + '...', 
        error,
        localStorageState: localStorage.getItem('linkedin_oauth_state')?.substring(0, 10) + '...',
      })

      // Handle LinkedIn error response
      if (error) {
        const message = errorDescription || error || 'LinkedIn authentication failed'
        setErrorMessage(message)
        setStatus('error')
        
        // Post error to opener window and close
        if (window.opener) {
          window.opener.postMessage(
            { type: 'linkedin-auth-error', error: message },
            window.location.origin
          )
          setTimeout(() => window.close(), 2000)
        }
        // No opener: stay on error screen (user can close tab manually)
        return
      }

      // Validate required parameters
      if (!code || !state) {
        const message = 'Missing authorization code or state'
        setErrorMessage(message)
        setStatus('error')
        
        if (window.opener) {
          window.opener.postMessage(
            { type: 'linkedin-auth-error', error: message },
            window.location.origin
          )
          setTimeout(() => window.close(), 2000)
        }
        // No opener: stay on error screen (user can close tab manually)
        return
      }

      try {
        // Exchange code for session (tokens stored server-side)
        const session = await handleLinkedInCallback(code, state)
        
        // Store session ID locally
        storeSession(session.sessionId)
        
        setStatus('success')
        
        // Post success to opener window with session (NOT tokens)
        if (window.opener) {
          window.opener.postMessage(
            { type: 'linkedin-auth-success', session },
            window.location.origin
          )
          // Close popup after a short delay
          setTimeout(() => window.close(), 1500)
        } else {
          // No opener (opened as tab, not popup) - stay on success screen.
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/37a99209-83e4-4cc5-b2e7-dc66d713db5d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'src/components/Auth/LinkedInCallback.tsx:handleCallback',message:'success_no_opener_redirecting',data:{pathname:window.location.pathname},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          // Do not redirect into the main app; user should return to Monday.
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to complete authentication'
        setErrorMessage(message)
        setStatus('error')
        
        if (window.opener) {
          window.opener.postMessage(
            { type: 'linkedin-auth-error', error: message },
            window.location.origin
          )
          setTimeout(() => window.close(), 2000)
        }
        // No opener: stay on error screen (user can close tab manually)
      }
    }

    handleCallback()
  }, [searchParams])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#0a0a0f',
      color: '#ffffff',
    }}>
      {status === 'processing' && (
        <>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#0077b5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ marginTop: '1rem', color: '#9ca3af' }}>
            Completing LinkedIn authentication...
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          </div>
          <p style={{ marginTop: '1rem', color: '#10b981', fontWeight: 600 }}>
            Successfully connected!
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            {window.opener ? 'This window will close automatically...' : 'You can close this tab and return to Monday.'}
          </p>
          {!window.opener && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => window.close()}
                style={{
                  padding: '0.6rem 0.9rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Close this tab
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '0.6rem 0.9rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0077b5',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p style={{ marginTop: '1rem', color: '#ef4444', fontWeight: 600 }}>
            Authentication failed
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', maxWidth: '300px' }}>
            {errorMessage}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            {window.opener ? 'This window will close automatically...' : 'You can close this tab and try again from Monday.'}
          </p>
          {!window.opener && (
            <button
              onClick={() => window.close()}
              style={{
                marginTop: '1rem',
                padding: '0.6rem 0.9rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Close this tab
            </button>
          )}
        </>
      )}
    </div>
  )
}
