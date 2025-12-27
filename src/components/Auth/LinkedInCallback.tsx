import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { handleLinkedInCallback } from '@/services/linkedin-api'

/**
 * LinkedIn OAuth Callback Handler
 * This page handles the OAuth redirect from LinkedIn.
 * It exchanges the authorization code for tokens and posts the result back to the opener window.
 */
export default function LinkedInCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Handle LinkedIn error response
      if (error) {
        const message = errorDescription || error || 'LinkedIn authentication failed'
        setErrorMessage(message)
        setStatus('error')
        
        // Post error to opener window
        if (window.opener) {
          window.opener.postMessage(
            { type: 'linkedin-auth-error', error: message },
            window.location.origin
          )
          // Close popup after a short delay
          setTimeout(() => window.close(), 2000)
        }
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
        return
      }

      try {
        // Exchange code for tokens
        const tokens = await handleLinkedInCallback(code, state)
        
        setStatus('success')
        
        // Post success to opener window
        if (window.opener) {
          window.opener.postMessage(
            { type: 'linkedin-auth-success', tokens },
            window.location.origin
          )
          // Close popup after a short delay
          setTimeout(() => window.close(), 1500)
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
            This window will close automatically...
          </p>
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
            This window will close automatically...
          </p>
        </>
      )}
    </div>
  )
}

