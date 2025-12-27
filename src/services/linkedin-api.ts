/**
 * LinkedIn API Service
 * Session-based authentication with server-side token storage
 * Tokens are stored encrypted in DynamoDB - browser only stores session ID
 */

// LinkedIn App (Community Management)
const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
const LINKEDIN_REDIRECT_URI = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || `${window.location.origin}/auth/linkedin/callback`;
const LINKEDIN_AUTH_FUNCTION_URL = import.meta.env.VITE_LINKEDIN_AUTH_FUNCTION_URL || '/api/linkedin-auth';

// Scopes for Community Management app
const LINKEDIN_SCOPES = [
  'r_member_postAnalytics',  // Post analytics
  'r_basicprofile',          // Name, photo, headline
].join(' ');

// Session storage key
const SESSION_STORAGE_KEY = 'linkedin_session';
const OAUTH_STATE_KEY = 'linkedin_oauth_state';
const OAUTH_STATE_TIMESTAMP_KEY = 'linkedin_oauth_state_timestamp';

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  headline?: string;
}

export interface SessionResponse {
  sessionId: string;
  profile: LinkedInProfile;
  expiresIn: number;
}

export interface ConnectionStatus {
  connected: boolean;
  profile?: LinkedInProfile;
  expiresAt?: number;
  canRefresh?: boolean;
  reason?: string;
}

/**
 * Initiate LinkedIn OAuth in a popup window
 * mondayUserId is passed to the Lambda to associate tokens with the user
 */
export function initiateLinkedInAuth(mondayUserId: string): Promise<SessionResponse> {
  return new Promise((resolve, reject) => {
    if (!LINKEDIN_CLIENT_ID) {
      reject(new Error('LinkedIn Client ID not configured'));
      return;
    }

    if (!mondayUserId) {
      reject(new Error('Monday.com user ID is required'));
      return;
    }

    // Check if an OAuth flow is already in progress
    const existingState = localStorage.getItem(OAUTH_STATE_KEY);
    const existingTimestamp = localStorage.getItem(OAUTH_STATE_TIMESTAMP_KEY);
    if (existingState && existingTimestamp) {
      const age = Date.now() - parseInt(existingTimestamp);
      if (age < 60000) { // Less than 1 minute old
        console.warn('[OAuth] OAuth flow already in progress, please wait...');
        reject(new Error('OAuth flow already in progress. Please wait and try again.'));
        return;
      }
    }

    // Generate new state token (includes mondayUserId for Lambda)
    const stateData = {
      nonce: crypto.randomUUID(),
      mondayUserId,
    };
    const state = btoa(JSON.stringify(stateData));
    
    // Store state in localStorage so popup can access it
    localStorage.setItem(OAUTH_STATE_KEY, state);
    localStorage.setItem(OAUTH_STATE_TIMESTAMP_KEY, Date.now().toString());
    
    console.log('[OAuth] State set:', {
      nonce: stateData.nonce.substring(0, 8) + '...',
      mondayUserId,
    });

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', LINKEDIN_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', LINKEDIN_SCOPES);

    // Calculate popup position (centered)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open popup window
    const popup = window.open(
      authUrl.toString(),
      'linkedin-auth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      reject(new Error('Failed to open popup. Please allow popups for this site.'));
      return;
    }

    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        console.warn('[OAuth] Ignored message from foreign origin:', event.origin);
        return;
      }
      
      if (event.data?.type === 'linkedin-auth-success') {
        console.log('[OAuth] Received success message from popup');
        window.removeEventListener('message', handleMessage);
        clearInterval(popupCheckInterval);
        
        // Store session (not tokens!)
        const sessionData = event.data.session as SessionResponse;
        storeSession(sessionData.sessionId);
        
        resolve(sessionData);
      } else if (event.data?.type === 'linkedin-auth-error') {
        console.log('[OAuth] Received error message from popup:', event.data.error);
        window.removeEventListener('message', handleMessage);
        clearInterval(popupCheckInterval);
        reject(new Error(event.data.error || 'LinkedIn authentication failed'));
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed without completing auth
    const popupCheckInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(popupCheckInterval);
        window.removeEventListener('message', handleMessage);
        reject(new Error('Authentication cancelled - popup was closed'));
      }
    }, 500);
  });
}

/**
 * Handle OAuth callback - exchange code for session via serverless function
 */
export async function handleLinkedInCallback(
  code: string,
  state: string
): Promise<SessionResponse> {
  // Verify state to prevent CSRF
  const savedState = localStorage.getItem(OAUTH_STATE_KEY);
  const stateTimestamp = localStorage.getItem(OAUTH_STATE_TIMESTAMP_KEY);
  
  // Parse state to get mondayUserId
  let mondayUserId: string;
  try {
    const stateData = JSON.parse(atob(state));
    mondayUserId = stateData.mondayUserId;
    
    console.log('[OAuth Debug]', {
      receivedNonce: stateData.nonce?.substring(0, 12) + '...',
      mondayUserId,
      stateMatch: state === savedState,
      timestamp: stateTimestamp,
      age: stateTimestamp ? `${Math.round((Date.now() - parseInt(stateTimestamp)) / 1000)}s` : 'unknown',
    });
  } catch {
    throw new Error('Invalid OAuth state format');
  }
  
  // If no saved state, this might be a duplicate attempt or the state was cleared
  if (!savedState) {
    console.error('[OAuth Error] No saved state found. Possible causes:', {
      cause1: 'State already consumed by previous attempt',
      cause2: 'localStorage was cleared',
      cause3: 'Different browser context',
    });
    throw new Error('OAuth state not found. Please close any other LinkedIn connection popups and try again.');
  }
  
  // Check if state is expired (older than 10 minutes)
  if (stateTimestamp) {
    const age = Date.now() - parseInt(stateTimestamp);
    if (age > 10 * 60 * 1000) {
      localStorage.removeItem(OAUTH_STATE_KEY);
      localStorage.removeItem(OAUTH_STATE_TIMESTAMP_KEY);
      throw new Error('OAuth state expired. Please try connecting again.');
    }
  }
  
  if (state !== savedState) {
    const errorMsg = `State mismatch - Received: ${state?.substring(0, 8)}..., Expected: ${savedState?.substring(0, 8)}`;
    console.error('[OAuth Error]', errorMsg);
    throw new Error('OAuth state mismatch. Please try connecting again.');
  }
  
  console.log('[OAuth] State validated successfully');
  
  // Clear the state after successful validation
  localStorage.removeItem(OAUTH_STATE_KEY);
  localStorage.removeItem(OAUTH_STATE_TIMESTAMP_KEY);

  // Exchange code for session via serverless function
  // Now includes mondayUserId for server-side token storage
  const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'token',
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      mondayUserId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Token exchange failed' }));
    throw new Error(error.error || 'Failed to exchange code for token');
  }

  return response.json();
}

/**
 * Fetch user profile via Lambda (session-based)
 */
export async function fetchLinkedInProfile(): Promise<LinkedInProfile> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not connected to LinkedIn');
  }

  const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'profile',
      sessionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch profile' }));
    
    // If session is invalid, clear it
    if (response.status === 401) {
      clearSession();
    }
    
    throw new Error(error.error || 'Failed to fetch LinkedIn profile');
  }

  return response.json();
}

/**
 * Check connection status via Lambda
 */
export async function checkConnectionStatus(): Promise<ConnectionStatus> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    return { connected: false, reason: 'no_session' };
  }

  try {
    const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'status',
        sessionId,
      }),
    });

    if (!response.ok) {
      // If server error, assume not connected
      clearSession();
      return { connected: false, reason: 'server_error' };
    }

    return response.json();
  } catch (error) {
    console.error('[LinkedIn] Failed to check status:', error);
    return { connected: false, reason: 'network_error' };
  }
}

/**
 * Disconnect LinkedIn (delete tokens from server)
 */
export async function disconnectLinkedIn(): Promise<void> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    return; // Already disconnected
  }

  try {
    await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'disconnect',
        sessionId,
      }),
    });
  } catch (error) {
    console.error('[LinkedIn] Failed to disconnect:', error);
  } finally {
    // Always clear local session
    clearSession();
  }
}

/**
 * Fetch post analytics via Lambda (handles token refresh automatically)
 */
export async function fetchMemberPostAnalytics(): Promise<unknown> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not connected to LinkedIn');
  }

  const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'analytics',
      sessionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch analytics' }));
    
    // If session is invalid, clear it
    if (response.status === 401) {
      clearSession();
    }
    
    throw new Error(error.error || 'Failed to fetch post analytics');
  }

  return response.json();
}

/**
 * Refresh session (extend TTL)
 */
export async function refreshSession(): Promise<string | null> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    return null;
  }

  try {
    const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'refresh',
        sessionId,
      }),
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const data = await response.json();
    if (data.sessionId) {
      storeSession(data.sessionId);
      return data.sessionId;
    }
    
    return null;
  } catch (error) {
    console.error('[LinkedIn] Failed to refresh session:', error);
    return null;
  }
}

// ============================================================================
// Session Storage (Browser only stores session ID, not tokens)
// ============================================================================

/**
 * Store session ID in localStorage
 */
export function storeSession(sessionId: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  console.log('[LinkedIn] Session stored');
}

/**
 * Get session ID from localStorage
 */
export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  console.log('[LinkedIn] Session cleared');
}

/**
 * Check if user has a session (may or may not be valid)
 */
export function hasSession(): boolean {
  return getSessionId() !== null;
}

// ============================================================================
// Legacy compatibility - kept for migration support
// ============================================================================

/**
 * @deprecated Use hasSession() instead
 */
export function isLinkedInConnected(): boolean {
  return hasSession();
}

/**
 * @deprecated Tokens are no longer stored in browser
 */
export function getLinkedInTokens(): null {
  // Migration: if old tokens exist, clear them
  const oldTokens = localStorage.getItem('linkedin_tokens');
  if (oldTokens) {
    localStorage.removeItem('linkedin_tokens');
    console.log('[LinkedIn] Cleared legacy tokens from localStorage');
  }
  return null;
}

/**
 * @deprecated Use clearSession() instead
 */
export function clearLinkedInTokens(): void {
  clearSession();
}

/**
 * Clear all LinkedIn data from localStorage
 */
export function clearAllLinkedInData(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(OAUTH_STATE_KEY);
  localStorage.removeItem(OAUTH_STATE_TIMESTAMP_KEY);
  localStorage.removeItem('linkedin_tokens'); // Legacy cleanup
  console.log('[LinkedIn] All data cleared');
}
