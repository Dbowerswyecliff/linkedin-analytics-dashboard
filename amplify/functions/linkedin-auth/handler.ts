import type { Handler } from "aws-lambda";
import * as https from "https";
import * as querystring from "querystring";
import type { IncomingMessage } from "http";

// Import token and session services
import {
  storeTokens,
  getTokens,
  deleteTokens,
  getValidAccessToken,
  updateProfile,
  type LinkedInProfile,
  type LinkedInTokens,
} from "./tokenService";

import {
  createSession,
  validateSession,
  deleteSession,
  deleteAllUserSessions,
  refreshSession,
} from "./sessionService";

// LinkedIn Community Management App credentials
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;

/**
 * Request body types for different actions
 */
interface RequestBody {
  action?: "token" | "profile" | "status" | "disconnect" | "analytics" | "refresh";
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  mondayUserId?: string;
  sessionId?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface ProfileResponse {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
}

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    // Parse request body
    const body: RequestBody = JSON.parse(event.body || "{}");
    const action = body.action || "token";

    console.log(`[Handler] Processing action: ${action}`);

    switch (action) {
      case "token":
        return await handleTokenExchange(body, headers);

      case "profile":
        return await handleProfileFetch(body, headers);

      case "status":
        return await handleStatus(body, headers);

      case "disconnect":
        return await handleDisconnect(body, headers);

      case "analytics":
        return await handleAnalytics(body, headers);

      case "refresh":
        return await handleSessionRefresh(body, headers);

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }
  } catch (error) {
    console.error("[Handler] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Request failed",
      }),
    };
  }
};

/**
 * Handle token exchange: exchange code for tokens, store in DynamoDB, return sessionId
 */
async function handleTokenExchange(
  body: RequestBody,
  headers: Record<string, string>
) {
  const { code, redirect_uri, client_id, mondayUserId } = body;

  if (!code || !redirect_uri || !client_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Missing required parameters: code, redirect_uri, client_id",
      }),
    };
  }

  if (!mondayUserId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Missing required parameter: mondayUserId",
      }),
    };
  }

  // Validate client ID
  if (client_id !== LINKEDIN_CLIENT_ID) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid client_id" }),
    };
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForToken(code, redirect_uri);

  // Fetch profile using the new access token
  const profile = await fetchLinkedInProfile(tokens.access_token);

  // Store tokens and profile in DynamoDB (encrypted)
  await storeTokens(mondayUserId, tokens, profile);

  // Create a session for this user
  const sessionId = await createSession(mondayUserId);

  console.log(`[Handler] Token exchange successful for user ${mondayUserId}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      sessionId,
      profile,
      expiresIn: tokens.expires_in,
    }),
  };
}

/**
 * Handle profile fetch: validate session, return profile from DynamoDB or fetch fresh
 */
async function handleProfileFetch(
  body: RequestBody,
  headers: Record<string, string>
) {
  const { sessionId } = body;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required parameter: sessionId" }),
    };
  }

  // Validate session
  const mondayUserId = await validateSession(sessionId);
  if (!mondayUserId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Invalid or expired session" }),
    };
  }

  // Get tokens from DynamoDB
  const tokenRecord = await getTokens(mondayUserId);
  if (!tokenRecord) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "No LinkedIn connection found" }),
    };
  }

  // Return cached profile if available
  if (tokenRecord.profile) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(tokenRecord.profile),
    };
  }

  // Fetch fresh profile
  try {
    const accessToken = await getValidAccessToken(mondayUserId);
    const profile = await fetchLinkedInProfile(accessToken);

    // Update cached profile
    await updateProfile(mondayUserId, profile);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(profile),
    };
  } catch (error) {
    console.error("[Handler] Failed to fetch profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch profile" }),
    };
  }
}

/**
 * Handle status check: check if user has valid LinkedIn connection
 */
async function handleStatus(
  body: RequestBody,
  headers: Record<string, string>
) {
  const { sessionId } = body;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required parameter: sessionId" }),
    };
  }

  // Validate session
  const mondayUserId = await validateSession(sessionId);
  if (!mondayUserId) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ connected: false, reason: "invalid_session" }),
    };
  }

  // Check if tokens exist
  const tokenRecord = await getTokens(mondayUserId);
  if (!tokenRecord) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ connected: false, reason: "no_tokens" }),
    };
  }

  // Check if tokens are expired
  const isExpired = tokenRecord.expiresAt < Date.now();
  const hasRefreshToken = !!tokenRecord.refreshToken;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      connected: !isExpired || hasRefreshToken,
      profile: tokenRecord.profile,
      expiresAt: tokenRecord.expiresAt,
      canRefresh: hasRefreshToken,
    }),
  };
}

/**
 * Handle disconnect: delete tokens and all sessions for user
 */
async function handleDisconnect(
  body: RequestBody,
  headers: Record<string, string>
) {
  const { sessionId } = body;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required parameter: sessionId" }),
    };
  }

  // Validate session
  const mondayUserId = await validateSession(sessionId);
  if (!mondayUserId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Invalid or expired session" }),
    };
  }

  // Delete tokens
  await deleteTokens(mondayUserId);

  // Delete all sessions for this user
  await deleteAllUserSessions(mondayUserId);

  console.log(`[Handler] Disconnected LinkedIn for user ${mondayUserId}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

/**
 * Handle analytics fetch: validate session, get valid token, fetch analytics
 */
async function handleAnalytics(
  body: RequestBody,
  headers: Record<string, string>
) {
  const { sessionId } = body;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required parameter: sessionId" }),
    };
  }

  // Validate session
  const mondayUserId = await validateSession(sessionId);
  if (!mondayUserId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Invalid or expired session" }),
    };
  }

  try {
    // Get valid access token (auto-refreshes if needed)
    const accessToken = await getValidAccessToken(mondayUserId);

    // Get tokens record for the LinkedIn ID
    const tokenRecord = await getTokens(mondayUserId);
    if (!tokenRecord?.linkedInId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "No LinkedIn profile ID found" }),
      };
    }

    // Fetch post analytics from LinkedIn
    const analytics = await fetchPostAnalytics(accessToken, tokenRecord.linkedInId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analytics),
    };
  } catch (error) {
    console.error("[Handler] Failed to fetch analytics:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch analytics",
      }),
    };
  }
}

/**
 * Handle session refresh: extend session TTL
 */
async function handleSessionRefresh(
  body: RequestBody,
  headers: Record<string, string>
) {
  const { sessionId } = body;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required parameter: sessionId" }),
    };
  }

  const newSessionId = await refreshSession(sessionId);

  if (!newSessionId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Invalid or expired session" }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ sessionId: newSessionId }),
  };
}

/**
 * Exchange authorization code for access token
 */
function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<LinkedInTokens> {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const options = {
      hostname: "www.linkedin.com",
      port: 443,
      path: "/oauth/v2/accessToken",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200) {
            resolve(response as LinkedInTokens);
          } else {
            reject(
              new Error(
                response.error_description || response.error || "Token exchange failed"
              )
            );
          }
        } catch (err) {
          reject(new Error("Failed to parse LinkedIn response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Fetch LinkedIn profile using access token
 */
function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.linkedin.com",
      port: 443,
      path: "/v2/me",
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200) {
            // Extract localized names from LinkedIn response
            const firstName =
              response.localizedFirstName ||
              response.firstName?.localized?.en_US ||
              "User";
            const lastName =
              response.localizedLastName ||
              response.lastName?.localized?.en_US ||
              "";

            // Extract profile picture if available
            const profilePicture =
              response.profilePicture?.["displayImage~"]?.elements?.[0]
                ?.identifiers?.[0]?.identifier;

            resolve({
              id: response.id,
              firstName,
              lastName,
              headline: response.localizedHeadline,
              profilePicture,
            });
          } else {
            reject(
              new Error(
                response.message || response.error || "Failed to fetch profile"
              )
            );
          }
        } catch (err) {
          reject(new Error("Failed to parse LinkedIn profile response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Profile request failed: ${err.message}`));
    });

    req.end();
  });
}

/**
 * Fetch post analytics from LinkedIn (r_member_postAnalytics scope)
 */
function fetchPostAnalytics(
  accessToken: string,
  linkedInId: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // LinkedIn API for member's share statistics
    const path = `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(linkedInId)}`;

    const options = {
      hostname: "api.linkedin.com",
      port: 443,
      path,
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200) {
            resolve(response);
          } else {
            console.error("[Handler] LinkedIn analytics error:", response);
            reject(
              new Error(
                response.message || response.error || "Failed to fetch analytics"
              )
            );
          }
        } catch (err) {
          reject(new Error("Failed to parse LinkedIn analytics response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Analytics request failed: ${err.message}`));
    });

    req.end();
  });
}
