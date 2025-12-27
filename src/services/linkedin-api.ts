/**
 * LinkedIn API Service
 * Single OAuth flow using Community Management app
 * Provides both identity (r_basicprofile) and analytics (r_member_postAnalytics)
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

export interface LinkedInTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  headline?: string;
}

/**
 * Initiate LinkedIn OAuth in a popup window
 */
export function initiateLinkedInAuth(): Promise<LinkedInTokens> {
  return new Promise((resolve, reject) => {
    if (!LINKEDIN_CLIENT_ID) {
      reject(new Error('LinkedIn Client ID not configured'));
      return;
    }

    // Check if an OAuth flow is already in progress
    const existingState = localStorage.getItem('linkedin_oauth_state');
    const existingTimestamp = localStorage.getItem('linkedin_oauth_state_timestamp');
    if (existingState && existingTimestamp) {
      const age = Date.now() - parseInt(existingTimestamp);
      if (age < 60000) { // Less than 1 minute old
        console.warn('[OAuth] OAuth flow already in progress, please wait...');
        reject(new Error('OAuth flow already in progress. Please wait and try again.'));
        return;
      }
    }

    // Generate new state token
    const state = crypto.randomUUID();
    
    // Store state in localStorage so popup can access it
    localStorage.setItem('linkedin_oauth_state', state);
    localStorage.setItem('linkedin_oauth_state_timestamp', Date.now().toString());
    
    console.log('[OAuth] State set:', {
      state: state.substring(0, 8) + '...',
      timestamp: Date.now(),
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
        storeLinkedInTokens(event.data.tokens);
        resolve(event.data.tokens);
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
 * Handle OAuth callback - exchange code for token via serverless function
 */
export async function handleLinkedInCallback(
  code: string,
  state: string
): Promise<LinkedInTokens> {
  // Verify state to prevent CSRF
  const savedState = localStorage.getItem('linkedin_oauth_state');
  const stateTimestamp = localStorage.getItem('linkedin_oauth_state_timestamp');
  
  // Debug logging
  console.log('[OAuth Debug]', {
    receivedState: state.substring(0, 12) + '...',
    savedState: savedState ? savedState.substring(0, 12) + '...' : 'null',
    match: state === savedState,
    timestamp: stateTimestamp,
    age: stateTimestamp ? `${Math.round((Date.now() - parseInt(stateTimestamp)) / 1000)}s` : 'unknown',
    allLocalStorageKeys: Object.keys(localStorage),
  });
  
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
      localStorage.removeItem('linkedin_oauth_state');
      localStorage.removeItem('linkedin_oauth_state_timestamp');
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
  localStorage.removeItem('linkedin_oauth_state');
  localStorage.removeItem('linkedin_oauth_state_timestamp');

  // Exchange code for token via serverless function
  const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Token exchange failed' }));
    throw new Error(error.error || 'Failed to exchange code for token');
  }

  return response.json();
}

/**
 * Fetch user profile from LinkedIn via Lambda function
 * (Bypasses CORS by routing through server-side)
 */
export async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'profile',
      access_token: accessToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch profile' }));
    throw new Error(error.error || 'Failed to fetch LinkedIn profile');
  }

  return response.json();
}

/**
 * Fetch post analytics for the authenticated member
 */
export async function fetchMemberPostAnalytics(
  accessToken: string,
  startDate?: Date,
  endDate?: Date
): Promise<unknown> {
  const params = new URLSearchParams({
    q: 'me',
    queryType: 'IMPRESSION',
    aggregation: 'DAILY',
  });

  if (startDate) {
    params.set('startDate.day', String(startDate.getDate()));
    params.set('startDate.month', String(startDate.getMonth() + 1));
    params.set('startDate.year', String(startDate.getFullYear()));
  }

  if (endDate) {
    params.set('endDate.day', String(endDate.getDate()));
    params.set('endDate.month', String(endDate.getMonth() + 1));
    params.set('endDate.year', String(endDate.getFullYear()));
  }

  const response = await fetch(
    `https://api.linkedin.com/rest/memberCreatorPostAnalytics?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LinkedIn API error:', errorText);
    throw new Error('Failed to fetch post analytics');
  }

  return response.json();
}

/**
 * Store LinkedIn tokens securely
 */
export function storeLinkedInTokens(tokens: LinkedInTokens): void {
  const expiresAt = Date.now() + (tokens.expires_in * 1000);
  const tokenData = {
    ...tokens,
    expiresAt,
  };
  localStorage.setItem('linkedin_tokens', JSON.stringify(tokenData));
}

/**
 * Get stored LinkedIn tokens
 */
export function getLinkedInTokens(): (LinkedInTokens & { expiresAt: number }) | null {
  const stored = localStorage.getItem('linkedin_tokens');
  if (!stored) return null;
  
  try {
    const tokens = JSON.parse(stored);
    // Check if expired
    if (tokens.expiresAt && tokens.expiresAt < Date.now()) {
      localStorage.removeItem('linkedin_tokens');
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}

/**
 * Clear LinkedIn tokens (logout)
 */
export function clearLinkedInTokens(): void {
  localStorage.removeItem('linkedin_tokens');
}

/**
 * Check if user is connected to LinkedIn
 */
export function isLinkedInConnected(): boolean {
  return getLinkedInTokens() !== null;
}

/**
 * Debug helper: Clear all OAuth state
 * Use this when troubleshooting OAuth issues
 */
export function clearAllLinkedInData(): void {
  localStorage.removeItem('linkedin_tokens');
  localStorage.removeItem('linkedin_oauth_state');
  localStorage.removeItem('linkedin_oauth_state_timestamp');
  console.log('[LinkedIn] All data cleared');
}
