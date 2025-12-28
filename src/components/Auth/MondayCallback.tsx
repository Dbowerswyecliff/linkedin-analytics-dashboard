/**
 * Monday OAuth Callback Handler
 * 
 * Handles the redirect from Monday OAuth, exchanges the code for a session,
 * and redirects to the dashboard.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import './auth.css';

export default function MondayCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('[MondayCallback] Processing callback...');

      // Handle OAuth error
      if (error) {
        console.error('[MondayCallback] OAuth error:', error, errorDescription);
        setStatus('error');
        setErrorMessage(errorDescription || error || 'Authentication was denied');
        return;
      }

      // Validate parameters
      if (!code || !state) {
        console.error('[MondayCallback] Missing code or state');
        setStatus('error');
        setErrorMessage('Missing authentication parameters. Please try again.');
        return;
      }

      try {
        // Exchange code for session
        await handleOAuthCallback(code, state);
        setStatus('success');
        
        // Redirect to dashboard after short delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } catch (err) {
        console.error('[MondayCallback] Error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    processCallback();
  }, [searchParams, handleOAuthCallback, navigate]);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated && status === 'success') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, status, navigate]);

  return (
    <div className="auth-callback">
      <div className="auth-callback-card">
        {status === 'processing' && (
          <>
            <div className="auth-spinner" />
            <h2>Signing you in...</h2>
            <p>Please wait while we complete your authentication.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="auth-success-icon">✓</div>
            <h2>Welcome!</h2>
            <p>Authentication successful. Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="auth-error-icon">✕</div>
            <h2>Authentication Failed</h2>
            <p className="auth-error-message">{errorMessage}</p>
            <button 
              className="auth-retry-btn"
              onClick={() => navigate('/login', { replace: true })}
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

