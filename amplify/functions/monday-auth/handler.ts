/**
 * Monday.com OAuth Handler
 * Handles OAuth token exchange and session management for Monday authentication
 */

import type { Handler } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import * as https from "https";

// Environment variables
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID || "";
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET || "";
const MONDAY_SESSIONS_TABLE = process.env.MONDAY_SESSIONS_TABLE || "";

// DynamoDB client
const dynamodb = new DynamoDBClient({});

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

interface MondayUser {
  id: string;
  name: string;
  email: string;
  photo_thumb_small?: string;
  account: {
    id: string;
    name: string;
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
 * Generate UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Make HTTPS request
 */
function httpsRequest(
  url: string,
  options: https.RequestOptions,
  data?: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || "GET",
        headers: options.headers,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({ statusCode: res.statusCode || 500, body });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<MondayTokenResponse> {
  console.log("[Monday OAuth] Exchanging code for token...");

  const body = new URLSearchParams({
    code,
    client_id: MONDAY_CLIENT_ID,
    client_secret: MONDAY_CLIENT_SECRET,
    redirect_uri: redirectUri,
  }).toString();

  const response = await httpsRequest(
    "https://auth.monday.com/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body).toString(),
      },
    },
    body
  );

  if (response.statusCode !== 200) {
    console.error("[Monday OAuth] Token exchange failed:", response.statusCode, response.body);
    throw new Error(`Token exchange failed: ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  console.log("[Monday OAuth] Token exchange successful");
  return data;
}

/**
 * Get user info from Monday API
 */
async function getMondayUser(accessToken: string): Promise<MondayUser> {
  console.log("[Monday OAuth] Fetching user info...");

  const query = JSON.stringify({
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
  });

  const response = await httpsRequest(
    "https://api.monday.com/v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
        "Content-Length": Buffer.byteLength(query).toString(),
      },
    },
    query
  );

  if (response.statusCode !== 200) {
    console.error("[Monday OAuth] Failed to get user:", response.statusCode, response.body);
    throw new Error(`Failed to get user: ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);

  if (data.errors) {
    console.error("[Monday OAuth] GraphQL errors:", data.errors);
    throw new Error(`GraphQL error: ${data.errors[0]?.message || "Unknown error"}`);
  }

  console.log("[Monday OAuth] User info retrieved:", data.data.me.id);
  return data.data.me;
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
  const sessionId = generateUUID();
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

  await dynamodb.send(
    new PutItemCommand({
      TableName: MONDAY_SESSIONS_TABLE,
      Item: {
        sessionId: { S: sessionId },
        mondayUserId: { S: mondayUserId },
        mondayAccountId: { S: mondayAccountId },
        userName: { S: userName },
        userEmail: { S: userEmail },
        ...(userPhoto && { userPhoto: { S: userPhoto } }),
        accountName: { S: accountName },
        accessToken: { S: accessToken },
        createdAt: { N: now.toString() },
        expiresAt: { N: expiresAt.toString() },
      },
    })
  );

  console.log("[Monday OAuth] Session created:", sessionId);
  return session;
}

/**
 * Get session by ID
 */
async function getSession(sessionId: string): Promise<MondaySession | null> {
  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: MONDAY_SESSIONS_TABLE,
      Key: { sessionId: { S: sessionId } },
    })
  );

  if (!result.Item) {
    return null;
  }

  const item = result.Item;
  const expiresAt = parseInt(item.expiresAt?.N || "0");

  // Check if expired
  if (expiresAt < Date.now()) {
    console.log("[Monday OAuth] Session expired:", sessionId);
    await deleteSession(sessionId);
    return null;
  }

  return {
    sessionId: item.sessionId?.S || "",
    mondayUserId: item.mondayUserId?.S || "",
    mondayAccountId: item.mondayAccountId?.S || "",
    userName: item.userName?.S || "",
    userEmail: item.userEmail?.S || "",
    userPhoto: item.userPhoto?.S,
    accountName: item.accountName?.S || "",
    accessToken: item.accessToken?.S || "",
    createdAt: parseInt(item.createdAt?.N || "0"),
    expiresAt,
  };
}

/**
 * Get session by Monday user ID
 */
async function getSessionByMondayUserId(
  mondayUserId: string
): Promise<MondaySession | null> {
  try {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: MONDAY_SESSIONS_TABLE,
        IndexName: "mondayUserId-index",
        KeyConditionExpression: "mondayUserId = :uid",
        ExpressionAttributeValues: {
          ":uid": { S: mondayUserId },
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    const item = result.Items[0];
    const expiresAt = parseInt(item.expiresAt?.N || "0");

    // Check if expired
    if (expiresAt < Date.now()) {
      console.log("[Monday OAuth] Session expired for user:", mondayUserId);
      const sessionId = item.sessionId?.S;
      if (sessionId) {
        await deleteSession(sessionId);
      }
      return null;
    }

    return {
      sessionId: item.sessionId?.S || "",
      mondayUserId: item.mondayUserId?.S || "",
      mondayAccountId: item.mondayAccountId?.S || "",
      userName: item.userName?.S || "",
      userEmail: item.userEmail?.S || "",
      userPhoto: item.userPhoto?.S,
      accountName: item.accountName?.S || "",
      accessToken: item.accessToken?.S || "",
      createdAt: parseInt(item.createdAt?.N || "0"),
      expiresAt,
    };
  } catch (error) {
    console.error("[Monday OAuth] Error getting session by user ID:", error);
    return null;
  }
}

/**
 * Delete session
 */
async function deleteSession(sessionId: string): Promise<void> {
  await dynamodb.send(
    new DeleteItemCommand({
      TableName: MONDAY_SESSIONS_TABLE,
      Key: { sessionId: { S: sessionId } },
    })
  );
  console.log("[Monday OAuth] Session deleted:", sessionId);
}

/**
 * Main Lambda handler
 */
export const handler: Handler = async (event) => {
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
        const user = await getMondayUser(tokenData.access_token);

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
