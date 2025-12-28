/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Supports hybrid auth (Monday iframe + OAuth for direct URL access)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initializeAuth,
  redirectToMondayOAuth,
  logout as doLogout,
  exchangeCodeForSession,
  validateOAuthState,
  MondaySession,
  MondayUser,
  clearSession,
} from '@/services/monday-auth';
import { isInsideMonday } from '@/services/monday-api';

interface AuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: MondayUser | null;
  session: MondaySession | null;
  error: string | null;
  isInsideMonday: boolean;
  
  // Actions
  login: () => void;
  logout: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<MondayUser | null>(null);
  const [session, setSession] = useState<MondaySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inMonday] = useState(() => isInsideMonday());

  /**
   * Initialize authentication on mount
   */
  const initialize = useCallback(async () => {
    console.log('[AuthContext] Initializing...');
    setIsLoading(true);
    setError(null);
    
    try {
      const session = await initializeAuth();
      
      if (session) {
        setSession(session);
        setUser(session.user);
        setIsAuthenticated(true);
        console.log('[AuthContext] Authenticated:', session.user.name);
      } else {
        setSession(null);
        setUser(null);
        setIsAuthenticated(false);
        console.log('[AuthContext] Not authenticated');
      }
    } catch (err) {
      console.error('[AuthContext] Initialization error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * Redirect to Monday OAuth login
   */
  const login = useCallback(() => {
    console.log('[AuthContext] Initiating login...');
    redirectToMondayOAuth();
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    console.log('[AuthContext] Logging out...');
    try {
      await doLogout();
    } finally {
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  /**
   * Handle OAuth callback - exchange code for session
   */
  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
    console.log('[AuthContext] Handling OAuth callback...');
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate state for CSRF protection
      if (!validateOAuthState(state)) {
        throw new Error('Invalid OAuth state. Please try logging in again.');
      }
      
      // Exchange code for session
      const session = await exchangeCodeForSession(code);
      
      setSession(session);
      setUser(session.user);
      setIsAuthenticated(true);
      console.log('[AuthContext] OAuth successful:', session.user.name);
    } catch (err) {
      console.error('[AuthContext] OAuth callback error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      clearSession();
      setIsAuthenticated(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    await initialize();
  }, [initialize]);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    session,
    error,
    isInsideMonday: inMonday,
    login,
    logout,
    handleOAuthCallback,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook for components that require authentication
 */
export function useRequireAuth(): AuthContextType & { isReady: boolean } {
  const auth = useAuth();
  
  return {
    ...auth,
    isReady: !auth.isLoading && auth.isAuthenticated,
  };
}

