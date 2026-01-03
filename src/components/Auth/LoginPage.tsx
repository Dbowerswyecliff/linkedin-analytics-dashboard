/**
 * Login Page
 * 
 * Displays when user is not authenticated and not inside Monday iframe.
 * Provides multiple login options:
 * - Monday.com OAuth login
 * - Email/password login (Amplify)
 * - Test login for LinkedIn reviewers
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import './auth.css';

export default function LoginPage() {
  const { login, loginWithEmail, loginWithTest, isLoading, error } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'monday' | 'email'>('email');
  const [showTestLogin, setShowTestLogin] = useState(false);
  
  // Email/password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  
  // Test login form state
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testError, setTestError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    
    if (!email || !password) {
      setEmailError('Please enter both email and password');
      return;
    }
    
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Login failed');
    }
  };

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
          Sign in to access your LinkedIn analytics dashboard.
        </p>

        {error && (
          <div className="login-error">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Login Method Tabs */}
        <div className="login-method-tabs">
          <button
            className={`login-tab ${loginMethod === 'email' ? 'active' : ''}`}
            onClick={() => setLoginMethod('email')}
            type="button"
          >
            Email & Password
          </button>
          <button
            className={`login-tab ${loginMethod === 'monday' ? 'active' : ''}`}
            onClick={() => setLoginMethod('monday')}
            type="button"
          >
            Monday.com
          </button>
        </div>

        {/* Email/Password Login Form */}
        {loginMethod === 'email' && (
          <form className="email-login-form" onSubmit={handleEmailLogin}>
            {emailError && (
              <div className="login-error">
                <span>{emailError}</span>
              </div>
            )}
            
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>
            
            <button 
              type="submit"
              className="monday-login-btn"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <div className="btn-spinner" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Monday.com OAuth Login */}
        {loginMethod === 'monday' && (
          <>
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
          </>
        )}

        <p className="login-note">
          Use email/password for standard login or Monday.com for integration access.
        </p>
      </div>
    </div>
  );
}
