/**
 * AWS Amplify Email/Password Authentication Service
 * 
 * Handles email/password authentication using AWS Amplify Auth
 */

import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

// Admin email from environment (or default)
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com';

export interface AmplifyUser {
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

export interface AmplifySession {
  sessionId: string;
  user: AmplifyUser;
  expiresAt: number;
  source: 'amplify';
}

/**
 * Sign up a new user with email and password
 */
export async function signUpUser(email: string, password: string, name: string): Promise<{ userId: string }> {
  try {
    const { userId } = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
        },
        autoSignIn: {
          enabled: true,
        },
      },
    });
    
    return { userId };
  } catch (error: any) {
    throw new Error(error.message || 'Sign up failed');
  }
}

/**
 * Sign in with email and password
 */
export async function signInUser(email: string, password: string): Promise<AmplifySession> {
  try {
    const { isSignedIn, nextStep } = await signIn({
      username: email,
      password,
    });
    
    if (!isSignedIn) {
      // Check if confirmation is needed
      if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        throw new Error('Password change required. Please contact administrator.');
      }
      if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        throw new Error('Please verify your email before signing in.');
      }
      throw new Error('Sign in failed');
    }
    
    // Get current user details
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    
    // Get user attributes - in Amplify v6, we get username directly
    const userEmail = user.username || email;
    const userName = user.username?.split('@')[0] || userEmail.split('@')[0];
    
    const isAdmin = userEmail === ADMIN_EMAIL;
    
    const amplifyUser: AmplifyUser = {
      id: user.userId,
      email: userEmail,
      name: userName,
      photo: undefined,
      isAdmin,
      account: {
        id: user.userId,
        name: isAdmin ? 'Admin Account' : 'User Account',
      },
    };
    
    // Calculate expiry (JWT tokens typically expire in 1 hour, but we'll use 24 hours for session)
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    
    const sessionId = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString() || `amplify-${user.userId}`;
    
    const amplifySession: AmplifySession = {
      sessionId,
      user: amplifyUser,
      expiresAt,
      source: 'amplify',
    };
    
    // Store session in localStorage
    localStorage.setItem('amplify_session', JSON.stringify(amplifySession));
    
    return amplifySession;
  } catch (error: any) {
    throw new Error(error.message || 'Sign in failed');
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut();
    localStorage.removeItem('amplify_session');
  } catch (error: any) {
    console.error('[AmplifyAuth] Sign out error:', error);
    // Clear local storage anyway
    localStorage.removeItem('amplify_session');
  }
}

/**
 * Get current session if user is authenticated
 */
export async function getCurrentAmplifySession(): Promise<AmplifySession | null> {
  try {
    // Check localStorage first
    const stored = localStorage.getItem('amplify_session');
    if (stored) {
      const session = JSON.parse(stored) as AmplifySession;
      // Check if expired
      if (session.expiresAt < Date.now()) {
        localStorage.removeItem('amplify_session');
        return null;
      }
    }
    
    // Verify with Amplify
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    
    if (!session.tokens) {
      localStorage.removeItem('amplify_session');
      return null;
    }
    
    const userEmail = user.username || '';
    const userName = user.username?.split('@')[0] || userEmail.split('@')[0];
    
    const isAdmin = userEmail === ADMIN_EMAIL;
    
    const amplifyUser: AmplifyUser = {
      id: user.userId,
      email: userEmail,
      name: userName,
      photo: undefined,
      isAdmin,
      account: {
        id: user.userId,
        name: isAdmin ? 'Admin Account' : 'User Account',
      },
    };
    
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    
    const sessionId = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString() || `amplify-${user.userId}`;
    
    const amplifySession: AmplifySession = {
      sessionId,
      user: amplifyUser,
      expiresAt,
      source: 'amplify',
    };
    
    localStorage.setItem('amplify_session', JSON.stringify(amplifySession));
    return amplifySession;
  } catch (error: any) {
    // User is not authenticated
    localStorage.removeItem('amplify_session');
    return null;
  }
}

/**
 * Check if current user is admin
 */
export function isAdminUser(email: string): boolean {
  return email === ADMIN_EMAIL;
}
