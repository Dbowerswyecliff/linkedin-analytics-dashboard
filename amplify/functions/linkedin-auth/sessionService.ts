/**
 * Session Management Service
 * Handles short-lived session tokens for browser authentication
 */

import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand, 
  DeleteItemCommand, 
  QueryCommand,
  type AttributeValue 
} from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';

const dynamodb = new DynamoDBClient({});
const SESSIONS_TABLE = process.env.USER_SESSIONS_TABLE!;
const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '24');

export interface Session {
  sessionId: string;
  mondayUserId: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Create a new session for a user
 */
export async function createSession(mondayUserId: string): Promise<string> {
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_HOURS * 60 * 60 * 1000;

  await dynamodb.send(new PutItemCommand({
    TableName: SESSIONS_TABLE,
    Item: {
      sessionId: { S: sessionId },
      mondayUserId: { S: mondayUserId },
      expiresAt: { N: String(expiresAt) },
      createdAt: { N: String(now) },
    },
  }));

  console.log(`[SessionService] Created session for user ${mondayUserId}, expires in ${SESSION_TTL_HOURS}h`);
  return sessionId;
}

/**
 * Validate a session and return user ID if valid
 */
export async function validateSession(sessionId: string): Promise<string | null> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId: { S: sessionId },
    },
  }));

  if (!result.Item) {
    console.log(`[SessionService] Session not found: ${sessionId.substring(0, 8)}...`);
    return null;
  }

  const expiresAt = parseInt(result.Item.expiresAt?.N || '0');
  
  if (Date.now() > expiresAt) {
    console.log(`[SessionService] Session expired: ${sessionId.substring(0, 8)}...`);
    // Clean up expired session
    await deleteSession(sessionId);
    return null;
  }

  return result.Item.mondayUserId?.S || null;
}

/**
 * Get session details
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId: { S: sessionId },
    },
  }));

  if (!result.Item) {
    return null;
  }

  return {
    sessionId: result.Item.sessionId?.S || '',
    mondayUserId: result.Item.mondayUserId?.S || '',
    expiresAt: parseInt(result.Item.expiresAt?.N || '0'),
    createdAt: parseInt(result.Item.createdAt?.N || '0'),
  };
}

/**
 * Delete a session (logout/revoke)
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await dynamodb.send(new DeleteItemCommand({
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId: { S: sessionId },
    },
  }));

  console.log(`[SessionService] Deleted session ${sessionId.substring(0, 8)}...`);
}

/**
 * Delete all sessions for a user (when disconnecting LinkedIn)
 */
export async function deleteAllUserSessions(mondayUserId: string): Promise<void> {
  // Query sessions by user ID using the GSI.
  // Some environments may not have this GSI yet (or may have drifted), so fail soft.
  let result: { Items?: Array<Record<string, AttributeValue>> } | undefined;
  try {
    result = await dynamodb.send(new QueryCommand({
      TableName: SESSIONS_TABLE,
      IndexName: 'mondayUserId',
      KeyConditionExpression: 'mondayUserId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: mondayUserId },
      },
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Typical error: "The table does not have the specified index: mondayUserId"
    console.warn(`[SessionService] Failed to query sessions by mondayUserId (skipping): ${msg}`);
    return;
  }

  if (result?.Items && result.Items.length > 0) {
    // Delete each session
    for (const item of result.Items) {
      const sessionId = item.sessionId?.S;
      if (sessionId) {
        await deleteSession(sessionId);
      }
    }
    console.log(`[SessionService] Deleted ${result.Items.length} sessions for user ${mondayUserId}`);
  }
}

/**
 * Refresh a session (extend TTL)
 */
export async function refreshSession(sessionId: string): Promise<string | null> {
  const mondayUserId = await validateSession(sessionId);
  
  if (!mondayUserId) {
    return null;
  }

  // Delete old session and create a new one
  await deleteSession(sessionId);
  return createSession(mondayUserId);
}

/**
 * Get user ID from session (alias for validateSession for clarity)
 */
export async function getUserFromSession(sessionId: string): Promise<string | null> {
  return validateSession(sessionId);
}

