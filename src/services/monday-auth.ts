/**
 * Monday.com OAuth Authentication Service
 * 
 * Hybrid auth approach:
 * 1. Inside Monday iframe: Use monday.get('context') for instant auth
 * 2. Direct URL access: Use Monday OAuth flow
 */

import { getContext, isInsideMonday } from './monday-api';

// Environment variables
const MONDAY_CLIENT_ID = import.meta.env.VITE_MONDAY_CLIENT_ID || '0518e73d4d0095206f01698240f4356b';
const MONDAY_AUTH_FUNCTION_URL = import.meta.env.VITE_MONDAY_AUTH_FUNCTION_URL || '';
const MONDAY_REDIRECT_URI = `${window.location.origin}/auth/monday/callback`;

// Session storage key
const MONDAY_SESSION_KEY = 'monday_session';
const MONDAY_OAUTH_STATE_KEY = 'monday_oauth_state';

export interface MondayUser {
  id: string;
  name: string;
  email: string;
  photo?: string;
  account: {
    id: string;
    name: string;
  };
}

export interface MondaySession {
  sessionId: string;
  user: MondayUser;
  expiresAt: number;
  source: 'iframe' | 'oauth';
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: MondayUser | null;
  session: MondaySession | null;
  error: string | null;
}

/**
 * Store session in localStorage
 */
function storeSession(session: MondaySession): void {
  localStorage.setItem(MONDAY_SESSION_KEY, JSON.stringify(session));
}

/**
 * Get session from localStorage
 */
function getStoredSession(): MondaySession | null {
  try {
    const stored = localStorage.getItem(MONDAY_SESSION_KEY);
    if (!stored) return null;
    
    const session = JSON.parse(stored) as MondaySession;
    
    // Check expiry
    if (session.expiresAt < Date.now()) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  localStorage.removeItem(MONDAY_SESSION_KEY);
  localStorage.removeItem(MONDAY_OAUTH_STATE_KEY);
}

/**
 * Check if we're inside Monday.com iframe and get context
 */
export async function checkMondayContext(): Promise<MondaySession | null> {
  if (!isInsideMonday()) {
    console.log('[MondayAuth] Not inside Monday iframe');
    return null;
  }
  
  try {
    console.log('[MondayAuth] Getting Monday context...');
    const context = await getContext();
    
    if (!context?.user?.id) {
      console.log('[MondayAuth] No user in Monday context');
      return null;
    }
    
    // Create a session from Monday context
    const session: MondaySession = {
      sessionId: `iframe-${context.user.id}`,
      user: {
        id: String(context.user.id),
        name: context.user.name || 'Monday User',
        email: context.user.email || '',
        photo: context.user.photo_thumb_small || context.user.photo_thumb,
        account: {
          id: String(context.account?.id || ''),
          name: context.account?.name || 'Monday Account',
        },
      },
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      source: 'iframe',
    };
    
    console.log('[MondayAuth] Monday context session created:', session.user.id);
    storeSession(session);
    return session;
  } catch (error) {
    console.error('[MondayAuth] Error getting Monday context:', error);
    return null;
  }
}

/**
 * Validate existing session with backend
 */
export async function validateSession(sessionId: string): Promise<MondaySession | null> {
  if (!MONDAY_AUTH_FUNCTION_URL) {
    console.warn('[MondayAuth] Monday auth function URL not configured');
    return null;
  }
  
  try {
    const response = await fetch(MONDAY_AUTH_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        sessionId,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Session validation failed');
    }
    
    const data = await response.json();
    
    if (!data.valid) {
      clearSession();
      return null;
    }
    
    const session: MondaySession = {
      sessionId,
      user: data.user,
      expiresAt: data.expiresAt,
      source: 'oauth',
    };
    
    storeSession(session);
    return session;
  } catch (error) {
    console.error('[MondayAuth] Session validation error:', error);
    clearSession();
    return null;
  }
}

/**
 * Initialize authentication - check all sources
 */
export async function initializeAuth(): Promise<MondaySession | null> {
  console.log('[MondayAuth] Initializing authentication...');
  
  // 1. Check if we have a stored session
  const storedSession = getStoredSession();
  
  if (storedSession) {
    console.log('[MondayAuth] Found stored session');
    
    // If it's an iframe session and we're still in iframe, it's valid
    if (storedSession.source === 'iframe' && isInsideMonday()) {
      console.log('[MondayAuth] Reusing iframe session');
      return storedSession;
    }
    
    // If it's an OAuth session, validate with backend
    if (storedSession.source === 'oauth') {
      console.log('[MondayAuth] Validating OAuth session...');
      return validateSession(storedSession.sessionId);
    }
  }
  
  // 2. Try Monday iframe context
  const iframeSession = await checkMondayContext();
  if (iframeSession) {
    return iframeSession;
  }
  
  // 3. No valid session found
  console.log('[MondayAuth] No valid session found');
  return null;
}

/**
 * Generate OAuth state for CSRF protection
 */
function generateOAuthState(): string {
  const state = crypto.randomUUID();
  localStorage.setItem(MONDAY_OAUTH_STATE_KEY, state);
  return state;
}

/**
 * Validate OAuth state
 */
export function validateOAuthState(state: string): boolean {
  const storedState = localStorage.getItem(MONDAY_OAUTH_STATE_KEY);
  localStorage.removeItem(MONDAY_OAUTH_STATE_KEY);
  return storedState === state;
}

/**
 * Get Monday OAuth authorization URL
 */
export function getMondayOAuthUrl(): string {
  const state = generateOAuthState();
  
  const params = new URLSearchParams({
    client_id: MONDAY_CLIENT_ID,
    redirect_uri: MONDAY_REDIRECT_URI,
    state,
  });
  
  return `https://auth.monday.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Redirect to Monday OAuth
 */
export function redirectToMondayOAuth(): void {
  const url = getMondayOAuthUrl();
  console.log('[MondayAuth] Redirecting to Monday OAuth:', url);
  window.location.href = url;
}

/**
 * Exchange OAuth code for session
 */
export async function exchangeCodeForSession(code: string): Promise<MondaySession> {
  if (!MONDAY_AUTH_FUNCTION_URL) {
    throw new Error('Monday auth function URL not configured');
  }
  
  console.log('[MondayAuth] Exchanging code for session...');
  
  const response = await fetch(MONDAY_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'exchange',
      code,
      redirect_uri: MONDAY_REDIRECT_URI,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Token exchange failed' }));
    throw new Error(error.error || 'Token exchange failed');
  }
  
  const data = await response.json();
  
  const session: MondaySession = {
    sessionId: data.sessionId,
    user: data.user,
    expiresAt: data.expiresAt,
    source: 'oauth',
  };
  
  console.log('[MondayAuth] Session created:', session.user.id);
  storeSession(session);
  return session;
}

/**
 * Logout - clear session
 */
export async function logout(): Promise<void> {
  const session = getStoredSession();
  
  if (session?.source === 'oauth' && MONDAY_AUTH_FUNCTION_URL) {
    try {
      await fetch(MONDAY_AUTH_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'logout',
          sessionId: session.sessionId,
        }),
      });
    } catch (error) {
      console.error('[MondayAuth] Error logging out:', error);
    }
  }
  
  clearSession();
}

/**
 * Get current session
 */
export function getCurrentSession(): MondaySession | null {
  return getStoredSession();
}

/**
 * Get current user
 */
export function getCurrentUser(): MondayUser | null {
  const session = getStoredSession();
  return session?.user || null;
}

