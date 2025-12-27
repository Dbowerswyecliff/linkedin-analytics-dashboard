/**
 * LinkedIn API Service
 * Handles OAuth flow and API calls
 */

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
const LINKEDIN_REDIRECT_URI = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || `${window.location.origin}/auth/linkedin/callback`;
const LINKEDIN_AUTH_FUNCTION_URL = import.meta.env.VITE_LINKEDIN_AUTH_FUNCTION_URL || '/api/linkedin-auth';

// LinkedIn OAuth scopes
// Note: Analytics scopes require Marketing Developer Platform access
const LINKEDIN_SCOPES = [
  'openid',
  'profile', 
  'email',
  // 'r_organization_social', // Requires Marketing API access
  // 'r_1st_connections_size', // Requires Marketing API access
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
  email?: string;
  profilePicture?: string;
}

/**
 * Generate LinkedIn OAuth URL and redirect user
 */
export function initiateLinkedInAuth(): void {
  if (!LINKEDIN_CLIENT_ID) {
    throw new Error('LinkedIn Client ID not configured');
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem('linkedin_oauth_state', state);

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', LINKEDIN_REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', LINKEDIN_SCOPES);

  window.location.href = authUrl.toString();
}

/**
 * Handle OAuth callback - exchange code for token via serverless function
 */
export async function handleLinkedInCallback(code: string, state: string): Promise<LinkedInTokens> {
  // Verify state to prevent CSRF
  const savedState = sessionStorage.getItem('linkedin_oauth_state');
  if (state !== savedState) {
    throw new Error('Invalid OAuth state - possible CSRF attack');
  }
  sessionStorage.removeItem('linkedin_oauth_state');

  // Exchange code for token via serverless function
  const response = await fetch(LINKEDIN_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Token exchange failed' }));
    throw new Error(error.error || 'Failed to exchange code for token');
  }

  return response.json();
}

/**
 * Fetch user profile from LinkedIn
 */
export async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch LinkedIn profile');
  }

  const data = await response.json();
  
  return {
    id: data.sub,
    firstName: data.given_name,
    lastName: data.family_name,
    email: data.email,
    profilePicture: data.picture,
  };
}

/**
 * Store LinkedIn tokens securely
 * In production, consider using Monday's secure storage or a backend
 */
export function storeLinkedInTokens(tokens: LinkedInTokens): void {
  const expiresAt = Date.now() + (tokens.expires_in * 1000);
  const tokenData = {
    ...tokens,
    expiresAt,
  };
  
  // Store in localStorage for now - in production use secure backend storage
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

