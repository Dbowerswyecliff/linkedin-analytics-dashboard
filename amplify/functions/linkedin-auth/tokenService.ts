/**
 * Token Storage Service
 * Handles encrypted token storage in DynamoDB with auto-refresh
 */

import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand, 
  DeleteItemCommand, 
  UpdateItemCommand,
  type AttributeValue 
} from '@aws-sdk/client-dynamodb';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import * as https from 'https';
import * as querystring from 'querystring';

const dynamodb = new DynamoDBClient({});
const TOKENS_TABLE = process.env.LINKEDIN_TOKENS_TABLE!;
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!;
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;

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
  headline?: string;
  profilePicture?: string;
}

export interface TokenRecord {
  mondayUserId: string;
  linkedInId?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  lastRefreshed?: number;
  profile?: LinkedInProfile;
  createdAt: number;
  updatedAt: number;
}

/**
 * Encrypt a token using AES-256-CBC
 */
export function encryptToken(token: string): string {
  const iv = randomBytes(16);
  // Trim accidental whitespace from secret
  const cleanKey = ENCRYPTION_KEY.trim();
  const keyBuffer = Buffer.from(cleanKey, 'hex');
  
  if (keyBuffer.length !== 32) {
    console.error(`[TokenService] Invalid encryption key length: ${keyBuffer.length} bytes. String length: ${cleanKey.length}. Expected 32 bytes (64 hex chars).`);
    throw new Error(`Invalid key length: ${keyBuffer.length} bytes`);
  }

  const cipher = createCipheriv('aes-256-cbc', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a token
 */
export function decryptToken(encryptedData: string): string {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  
  // Trim any accidental whitespace from the secret
  const cleanKey = ENCRYPTION_KEY.trim();
  const keyBuffer = Buffer.from(cleanKey, 'hex');

  if (keyBuffer.length !== 32) {
    const errorMsg = `[TokenService] Invalid encryption key length: ${keyBuffer.length} bytes. ` +
                    `String length: ${cleanKey.length}. ` +
                    `Expected 32 bytes (64 hex characters).`;
    console.error(errorMsg);
    throw new Error(`Invalid key length: ${keyBuffer.length} bytes`);
  }

  const decipher = createDecipheriv('aes-256-cbc', keyBuffer, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Store tokens in DynamoDB (encrypted)
 */
export async function storeTokens(
  mondayUserId: string,
  tokens: LinkedInTokens,
  profile?: LinkedInProfile
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + tokens.expires_in * 1000;

  const item: Record<string, AttributeValue> = {
    mondayUserId: { S: mondayUserId },
    accessToken: { S: encryptToken(tokens.access_token) },
    expiresAt: { N: String(expiresAt) },
    createdAt: { N: String(now) },
    updatedAt: { N: String(now) },
  };

  if (tokens.refresh_token) {
    item.refreshToken = { S: encryptToken(tokens.refresh_token) };
  }

  if (profile) {
    item.linkedInId = { S: profile.id };
    item.profileFirstName = { S: profile.firstName };
    item.profileLastName = { S: profile.lastName };
    if (profile.headline) item.profileHeadline = { S: profile.headline };
    if (profile.profilePicture) item.profilePicture = { S: profile.profilePicture };
  }

  await dynamodb.send(new PutItemCommand({
    TableName: TOKENS_TABLE,
    Item: item,
  }));

  console.log(`[TokenService] Stored tokens for user ${mondayUserId}`);
}

/**
 * Get tokens from DynamoDB (decrypted)
 */
export async function getTokens(mondayUserId: string): Promise<TokenRecord | null> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: TOKENS_TABLE,
    Key: {
      mondayUserId: { S: mondayUserId },
    },
  }));

  if (!result.Item) {
    return null;
  }

  const item = result.Item;
  
  return {
    mondayUserId: item.mondayUserId?.S || '',
    linkedInId: item.linkedInId?.S,
    accessToken: decryptToken(item.accessToken?.S || ''),
    refreshToken: item.refreshToken?.S ? decryptToken(item.refreshToken.S) : undefined,
    expiresAt: parseInt(item.expiresAt?.N || '0'),
    lastRefreshed: item.lastRefreshed?.N ? parseInt(item.lastRefreshed.N) : undefined,
    profile: item.profileFirstName?.S ? {
      id: item.linkedInId?.S || '',
      firstName: item.profileFirstName.S,
      lastName: item.profileLastName?.S || '',
      headline: item.profileHeadline?.S,
      profilePicture: item.profilePicture?.S,
    } : undefined,
    createdAt: parseInt(item.createdAt?.N || '0'),
    updatedAt: parseInt(item.updatedAt?.N || '0'),
  };
}

/**
 * Delete tokens from DynamoDB
 */
export async function deleteTokens(mondayUserId: string): Promise<void> {
  await dynamodb.send(new DeleteItemCommand({
    TableName: TOKENS_TABLE,
    Key: {
      mondayUserId: { S: mondayUserId },
    },
  }));

  console.log(`[TokenService] Deleted tokens for user ${mondayUserId}`);
}

/**
 * Refresh LinkedIn access token
 */
export async function refreshLinkedInToken(refreshToken: string): Promise<LinkedInTokens> {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const options = {
      hostname: 'www.linkedin.com',
      port: 443,
      path: '/oauth/v2/accessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response as LinkedInTokens);
          } else {
            reject(new Error(response.error_description || response.error || 'Token refresh failed'));
          }
        } catch (err) {
          reject(new Error('Failed to parse token refresh response'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidAccessToken(mondayUserId: string): Promise<string> {
  const record = await getTokens(mondayUserId);
  
  if (!record) {
    throw new Error('No tokens found for user');
  }

  // Check if token is expired or expiring soon (5 minute buffer)
  const now = Date.now();
  const expiresIn = record.expiresAt - now;
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresIn < fiveMinutes) {
    console.log(`[TokenService] Token expiring soon (${Math.round(expiresIn / 1000)}s), refreshing...`);
    
    if (!record.refreshToken) {
      throw new Error('Token expired and no refresh token available');
    }

    try {
      const newTokens = await refreshLinkedInToken(record.refreshToken);
      
      // Update tokens in DynamoDB
      await updateTokensAfterRefresh(mondayUserId, newTokens);
      
      console.log(`[TokenService] Token refreshed successfully`);
      return newTokens.access_token;
    } catch (error) {
      console.error(`[TokenService] Token refresh failed:`, error);
      throw new Error('Failed to refresh token - user may need to reconnect');
    }
  }

  return record.accessToken;
}

/**
 * Update tokens after refresh
 */
async function updateTokensAfterRefresh(mondayUserId: string, tokens: LinkedInTokens): Promise<void> {
  const now = Date.now();
  const expiresAt = now + tokens.expires_in * 1000;

  const updateExpression = 'SET accessToken = :at, expiresAt = :exp, lastRefreshed = :lr, updatedAt = :ua';
  const expressionValues: Record<string, AttributeValue> = {
    ':at': { S: encryptToken(tokens.access_token) },
    ':exp': { N: String(expiresAt) },
    ':lr': { N: String(now) },
    ':ua': { N: String(now) },
  };

  // Only update refresh token if a new one was provided
  let finalExpression = updateExpression;
  if (tokens.refresh_token) {
    finalExpression += ', refreshToken = :rt';
    expressionValues[':rt'] = { S: encryptToken(tokens.refresh_token) };
  }

  await dynamodb.send(new UpdateItemCommand({
    TableName: TOKENS_TABLE,
    Key: {
      mondayUserId: { S: mondayUserId },
    },
    UpdateExpression: finalExpression,
    ExpressionAttributeValues: expressionValues,
  }));
}

/**
 * Update cached profile data
 */
export async function updateProfile(mondayUserId: string, profile: LinkedInProfile): Promise<void> {
  const now = Date.now();

  const expressionValues: Record<string, AttributeValue> = {
    ':li': { S: profile.id },
    ':fn': { S: profile.firstName },
    ':ln': { S: profile.lastName },
    ':ua': { N: String(now) },
  };

  let updateExpression = 'SET linkedInId = :li, profileFirstName = :fn, profileLastName = :ln, updatedAt = :ua';

  if (profile.headline) {
    updateExpression += ', profileHeadline = :hl';
    expressionValues[':hl'] = { S: profile.headline };
  }

  if (profile.profilePicture) {
    updateExpression += ', profilePicture = :pp';
    expressionValues[':pp'] = { S: profile.profilePicture };
  }

  await dynamodb.send(new UpdateItemCommand({
    TableName: TOKENS_TABLE,
    Key: {
      mondayUserId: { S: mondayUserId },
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
  }));
}

/**
 * Check if user has valid tokens
 */
export async function hasValidTokens(mondayUserId: string): Promise<boolean> {
  const record = await getTokens(mondayUserId);
  if (!record) return false;
  
  // Check if token is still valid (not expired)
  return record.expiresAt > Date.now();
}

