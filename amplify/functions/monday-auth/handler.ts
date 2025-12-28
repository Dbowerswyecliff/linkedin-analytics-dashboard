/**
 * Monday.com OAuth Handler
 * Handles OAuth token exchange and session management for Monday authentication
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

// Environment variables
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID || "";
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET || "";
const MONDAY_SESSIONS_TABLE = process.env.MONDAY_SESSIONS_TABLE || "";

// DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

interface MondayTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface MondayUserResponse {
  data: {
    me: {
      id: string;
      name: string;
      email: string;
      photo_thumb_small?: string;
      account: {
        id: string;
        name: string;
      };
    };
  };
}

interface MondaySession {
  sessionId: string;
  mondayUserId: string;
  mondayAccountId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  accountName: string;
  accessToken: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<MondayTokenResponse> {
  console.log("[Monday OAuth] Exchanging code for token...");

  const response = await fetch("https://auth.monday.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: MONDAY_CLIENT_ID,
      client_secret: MONDAY_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Monday OAuth] Token exchange failed:", response.status, errorText);
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  console.log("[Monday OAuth] Token exchange successful");
  return data;
}

/**
 * Get user info from Monday API
 */
async function getMondayUser(accessToken: string): Promise<MondayUserResponse> {
  console.log("[Monday OAuth] Fetching user info...");

  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({
      query: `
        query {
          me {
            id
            name
            email
            photo_thumb_small
            account {
              id
              name
            }
          }
        }
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Monday OAuth] Failed to get user:", response.status, errorText);
    throw new Error(`Failed to get user: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    console.error("[Monday OAuth] GraphQL errors:", data.errors);
    throw new Error(`GraphQL error: ${data.errors[0]?.message || "Unknown error"}`);
  }

  console.log("[Monday OAuth] User info retrieved:", data.data.me.id);
  return data;
}

/**
 * Create a new session
 */
async function createSession(
  mondayUserId: string,
  mondayAccountId: string,
  userName: string,
  userEmail: string,
  userPhoto: string | undefined,
  accountName: string,
  accessToken: string
): Promise<MondaySession> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  const session: MondaySession = {
    sessionId,
    mondayUserId,
    mondayAccountId,
    userName,
    userEmail,
    userPhoto,
    accountName,
    accessToken,
    createdAt: now,
    expiresAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: MONDAY_SESSIONS_TABLE,
      Item: session,
    })
  );

  console.log("[Monday OAuth] Session created:", sessionId);
  return session;
}

/**
 * Get session by ID
 */
async function getSession(sessionId: string): Promise<MondaySession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: MONDAY_SESSIONS_TABLE,
      Key: { sessionId },
    })
  );

  if (!result.Item) {
    return null;
  }

  const session = result.Item as MondaySession;

  // Check if expired
  if (session.expiresAt < Date.now()) {
    console.log("[Monday OAuth] Session expired:", sessionId);
    await deleteSession(sessionId);
    return null;
  }

  return session;
}

/**
 * Get session by Monday user ID
 */
async function getSessionByMondayUserId(
  mondayUserId: string
): Promise<MondaySession | null> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: MONDAY_SESSIONS_TABLE,
        IndexName: "mondayUserId-index",
        KeyConditionExpression: "mondayUserId = :uid",
        ExpressionAttributeValues: {
          ":uid": mondayUserId,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    const session = result.Items[0] as MondaySession;

    // Check if expired
    if (session.expiresAt < Date.now()) {
      console.log("[Monday OAuth] Session expired for user:", mondayUserId);
      await deleteSession(session.sessionId);
      return null;
    }

    return session;
  } catch (error) {
    console.error("[Monday OAuth] Error getting session by user ID:", error);
    return null;
  }
}

/**
 * Delete session
 */
async function deleteSession(sessionId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: MONDAY_SESSIONS_TABLE,
      Key: { sessionId },
    })
  );
  console.log("[Monday OAuth] Session deleted:", sessionId);
}

/**
 * Main Lambda handler
 */
export const handler = async (event: {
  httpMethod?: string;
  requestContext?: { http?: { method?: string } };
  body?: string;
  headers?: Record<string, string>;
}): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const method = event.httpMethod || event.requestContext?.http?.method || "GET";

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action } = body;

    console.log("[Monday OAuth] Action:", action);

    switch (action) {
      case "exchange": {
        // Exchange authorization code for token
        const { code, redirect_uri } = body;

        if (!code || !redirect_uri) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing code or redirect_uri" }),
          };
        }

        // Exchange code for token
        const tokenData = await exchangeCodeForToken(code, redirect_uri);

        // Get user info
        const userResponse = await getMondayUser(tokenData.access_token);
        const user = userResponse.data.me;

        // Create session
        const session = await createSession(
          user.id,
          user.account.id,
          user.name,
          user.email,
          user.photo_thumb_small,
          user.account.name,
          tokenData.access_token
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            sessionId: session.sessionId,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              photo: user.photo_thumb_small,
              account: {
                id: user.account.id,
                name: user.account.name,
              },
            },
            expiresAt: session.expiresAt,
          }),
        };
      }

      case "validate": {
        // Validate session
        const { sessionId } = body;

        if (!sessionId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing sessionId" }),
          };
        }

        const session = await getSession(sessionId);

        if (!session) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ valid: false }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            valid: true,
            user: {
              id: session.mondayUserId,
              name: session.userName,
              email: session.userEmail,
              photo: session.userPhoto,
              account: {
                id: session.mondayAccountId,
                name: session.accountName,
              },
            },
            expiresAt: session.expiresAt,
          }),
        };
      }

      case "checkMondayUser": {
        // Check if a Monday user has an existing session
        const { mondayUserId } = body;

        if (!mondayUserId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing mondayUserId" }),
          };
        }

        const session = await getSessionByMondayUserId(mondayUserId);

        if (!session) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ hasSession: false }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            hasSession: true,
            sessionId: session.sessionId,
            user: {
              id: session.mondayUserId,
              name: session.userName,
              email: session.userEmail,
              photo: session.userPhoto,
              account: {
                id: session.mondayAccountId,
                name: session.accountName,
              },
            },
            expiresAt: session.expiresAt,
          }),
        };
      }

      case "logout": {
        // Delete session
        const { sessionId } = body;

        if (sessionId) {
          await deleteSession(sessionId);
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true }),
        };
      }

      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid action" }),
        };
    }
  } catch (error) {
    console.error("[Monday OAuth] Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};

