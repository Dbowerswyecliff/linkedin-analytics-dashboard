/**
 * Login Page
 * 
 * Displays when user is not authenticated and not inside Monday iframe.
 * Provides Monday OAuth login button and test login for LinkedIn reviewers.
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import './auth.css';

export default function LoginPage() {
  const { login, loginWithTest, isLoading, error } = useAuth();
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testError, setTestError] = useState<string | null>(null);

  const handleTestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestError(null);
    
    try {
      await loginWithTest(testUsername, testPassword);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img 
            src="https://cdn.monday.com/images/logos/monday_logo_icon.png" 
            alt="Monday.com" 
            className="monday-logo"
          />
          <span className="login-title">LinkedIn Analytics</span>
        </div>
        
        <h1>Welcome</h1>
        <p className="login-subtitle">
          Sign in with your Monday.com account to access your LinkedIn analytics dashboard.
        </p>

        {error && (
          <div className="login-error">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button 
          className="monday-login-btn"
          onClick={login}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="btn-spinner" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>Sign in with Monday.com</span>
            </>
          )}
        </button>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button 
          className="test-login-toggle"
          onClick={() => setShowTestLogin(!showTestLogin)}
          type="button"
        >
          {showTestLogin ? 'Hide Reviewer Login' : 'LinkedIn Reviewer? Sign in here'}
        </button>

        {showTestLogin && (
          <form className="test-login-form" onSubmit={handleTestLogin}>
            <p className="test-login-info">
              For LinkedIn app reviewers only. Use the test credentials provided.
            </p>
            
            {testError && (
              <div className="login-error">
                <span>{testError}</span>
              </div>
            )}
            
            <div className="form-field">
              <label htmlFor="test-username">Username</label>
              <input
                id="test-username"
                type="text"
                value={testUsername}
                onChange={(e) => setTestUsername(e.target.value)}
                placeholder="Enter test username"
                autoComplete="username"
              />
            </div>
            
            <div className="form-field">
              <label htmlFor="test-password">Password</label>
              <input
                id="test-password"
                type="password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="Enter test password"
                autoComplete="current-password"
              />
            </div>
            
            <button 
              type="submit"
              className="test-login-btn"
              disabled={isLoading || !testUsername || !testPassword}
            >
              {isLoading ? 'Signing in...' : 'Sign in as Test User'}
            </button>
          </form>
        )}

        <p className="login-note">
          This app requires a Monday.com account to track LinkedIn analytics for your team.
        </p>
      </div>
    </div>
  );
}
