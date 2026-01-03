/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Supports hybrid auth: Monday.com OAuth, email/password (Amplify), and test credentials
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initializeAuth,
  redirectToMondayOAuth,
  logout as doMondayLogout,
  exchangeCodeForSession,
  validateOAuthState,
  loginWithTestCredentials,
  MondaySession,
  MondayUser,
  clearSession,
} from '@/services/monday-auth';
import {
  signInUser,
  signOutUser,
  getCurrentAmplifySession,
  AmplifySession,
  AmplifyUser,
} from '@/services/amplify-auth';
import { isInsideMonday } from '@/services/monday-api';

// Unified user type
export interface AppUser {
  id: string;
  name: string;
  email: string;
  photo?: string;
  isAdmin: boolean;
  account: {
    id: string;
    name: string;
  };
}

// Unified session type
export interface AppSession {
  sessionId: string;
  user: AppUser;
  expiresAt: number;
  source: 'iframe' | 'oauth' | 'test' | 'amplify';
}

// Convert Monday user to App user
function mondayUserToAppUser(mondayUser: MondayUser, isAdmin: boolean = false): AppUser {
  return {
    id: mondayUser.id,
    name: mondayUser.name,
    email: mondayUser.email,
    photo: mondayUser.photo,
    isAdmin,
    account: mondayUser.account,
  };
}

// Convert Amplify user to App user
function amplifyUserToAppUser(amplifyUser: AmplifyUser): AppUser {
  return {
    id: amplifyUser.id,
    name: amplifyUser.name,
    email: amplifyUser.email,
    photo: amplifyUser.photo,
    isAdmin: amplifyUser.isAdmin,
    account: amplifyUser.account,
  };
}

// Convert Monday session to App session
function mondaySessionToAppSession(mondaySession: MondaySession): AppSession {
  return {
    sessionId: mondaySession.sessionId,
    user: mondayUserToAppUser(mondaySession.user),
    expiresAt: mondaySession.expiresAt,
    source: mondaySession.source,
  };
}

// Convert Amplify session to App session
function amplifySessionToAppSession(amplifySession: AmplifySession): AppSession {
  return {
    sessionId: amplifySession.sessionId,
    user: amplifyUserToAppUser(amplifySession.user),
    expiresAt: amplifySession.expiresAt,
    source: 'amplify',
  };
}

interface AuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AppUser | null;
  session: AppSession | null;
  error: string | null;
  isInsideMonday: boolean;
  isTestSession: boolean;
  
  // Actions
  login: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithTest: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inMonday] = useState(() => isInsideMonday());

  /**
   * Initialize authentication on mount
   * Checks both Monday.com and Amplify sessions
   */
  const initialize = useCallback(async () => {
    console.log('[AuthContext] Initializing...');
    setIsLoading(true);
    setError(null);
    
    try {
      // First, try Monday.com auth (if in Monday iframe or has OAuth session)
      const mondaySession = await initializeAuth();
      if (mondaySession) {
        const appSession = mondaySessionToAppSession(mondaySession);
        setSession(appSession);
        setUser(appSession.user);
        setIsAuthenticated(true);
        console.log('[AuthContext] Authenticated via Monday.com:', appSession.user.name);
        setIsLoading(false);
        return;
      }
      
      // If no Monday session, try Amplify auth
      const amplifySession = await getCurrentAmplifySession();
      if (amplifySession) {
        const appSession = amplifySessionToAppSession(amplifySession);
        setSession(appSession);
        setUser(appSession.user);
        setIsAuthenticated(true);
        console.log('[AuthContext] Authenticated via email/password:', appSession.user.name);
        setIsLoading(false);
        return;
      }
      
      // No valid session found
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
      console.log('[AuthContext] Not authenticated');
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
    console.log('[AuthContext] Initiating Monday.com login...');
    redirectToMondayOAuth();
  }, []);

  /**
   * Login with email and password (Amplify)
   */
  const loginWithEmail = useCallback(async (email: string, password: string) => {
    console.log('[AuthContext] Attempting email/password login...');
    setIsLoading(true);
    setError(null);
    
    try {
      const amplifySession = await signInUser(email, password);
      const appSession = amplifySessionToAppSession(amplifySession);
      setSession(appSession);
      setUser(appSession.user);
      setIsAuthenticated(true);
      console.log('[AuthContext] Email/password login successful:', appSession.user.name);
    } catch (err) {
      console.error('[AuthContext] Email/password login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login with test credentials (for LinkedIn reviewers)
   */
  const loginWithTest = useCallback(async (username: string, password: string) => {
    console.log('[AuthContext] Attempting test login...');
    setIsLoading(true);
    setError(null);
    
    try {
      const mondaySession = loginWithTestCredentials(username, password);
      const appSession = mondaySessionToAppSession(mondaySession);
      setSession(appSession);
      setUser(appSession.user);
      setIsAuthenticated(true);
      console.log('[AuthContext] Test login successful');
    } catch (err) {
      console.error('[AuthContext] Test login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    console.log('[AuthContext] Logging out...');
    try {
      // Logout from the appropriate service based on session source
      if (session?.source === 'amplify') {
        await signOutUser();
      } else if (session?.source === 'oauth' || session?.source === 'iframe') {
        await doMondayLogout();
      } else {
        // Test session - just clear
        clearSession();
      }
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    } finally {
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, [session]);

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
      const mondaySession = await exchangeCodeForSession(code);
      const appSession = mondaySessionToAppSession(mondaySession);
      
      setSession(appSession);
      setUser(appSession.user);
      setIsAuthenticated(true);
      console.log('[AuthContext] OAuth successful:', appSession.user.name);
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

  // Check if current session is a test session (enables demo mode)
  const isTestSession = session?.source === 'test';

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    session,
    error,
    isInsideMonday: inMonday,
    isTestSession,
    login,
    loginWithEmail,
    loginWithTest,
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
