/**
 * LinkedIn Sync Handler
 * Fetches analytics for all connected LinkedIn users and stores in DynamoDB
 * Triggered by EventBridge schedule or manual invocation
 */

import { 
  DynamoDBClient, 
  ScanCommand,
  PutItemCommand,
  UpdateItemCommand,
  type AttributeValue 
} from '@aws-sdk/client-dynamodb';
import { createDecipheriv } from 'crypto';
import * as https from 'https';
import * as querystring from 'querystring';

const dynamodb = new DynamoDBClient({});

// Environment variables
const TOKENS_TABLE = process.env.LINKEDIN_TOKENS_TABLE!;
const ANALYTICS_TABLE = process.env.LINKEDIN_ANALYTICS_TABLE!;
const SYNC_LOG_TABLE = process.env.SYNC_LOG_TABLE!;
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!;
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;

interface TokenRecord {
  mondayUserId: string;
  linkedInId?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  profileFirstName?: string;
  profileLastName?: string;
  profileHeadline?: string;
  profilePicture?: string;
}

interface SyncResult {
  mondayUserId: string;
  linkedInId: string;
  success: boolean;
  error?: string;
  impressions?: number;
  engagements?: number;
}

interface LinkedInAnalyticsResponse {
  elements?: Array<{
    totalShareStatistics?: {
      impressionCount?: number;
      uniqueImpressionsCount?: number;
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
      engagement?: number;
      clickCount?: number;
    };
    organizationalEntity?: string;
    share?: string;
  }>;
  paging?: {
    total?: number;
  };
}

/**
 * Decrypt a token using AES-256-CBC
 */
function decryptToken(encryptedData: string): string {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Encrypt a token using AES-256-CBC
 */
function encryptToken(token: string): string {
  const { createCipheriv, randomBytes } = require('crypto');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Refresh LinkedIn access token
 */
async function refreshLinkedInToken(refreshToken: string): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
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
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(response.error_description || response.error || 'Token refresh failed'));
          }
        } catch {
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
 * Update tokens in DynamoDB after refresh
 */
async function updateTokensAfterRefresh(
  mondayUserId: string, 
  newAccessToken: string, 
  expiresIn: number,
  newRefreshToken?: string
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + expiresIn * 1000;

  const expressionValues: Record<string, AttributeValue> = {
    ':at': { S: encryptToken(newAccessToken) },
    ':exp': { N: String(expiresAt) },
    ':lr': { N: String(now) },
    ':ua': { N: String(now) },
  };

  let updateExpression = 'SET accessToken = :at, expiresAt = :exp, lastRefreshed = :lr, updatedAt = :ua';
  
  if (newRefreshToken) {
    updateExpression += ', refreshToken = :rt';
    expressionValues[':rt'] = { S: encryptToken(newRefreshToken) };
  }

  await dynamodb.send(new UpdateItemCommand({
    TableName: TOKENS_TABLE,
    Key: { mondayUserId: { S: mondayUserId } },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
  }));
}

/**
 * Get valid access token, refreshing if needed
 */
async function getValidAccessToken(record: TokenRecord): Promise<string> {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  if (record.expiresAt - now < fiveMinutes) {
    console.log(`[Sync] Token expiring soon for ${record.mondayUserId}, refreshing...`);
    
    if (!record.refreshToken) {
      throw new Error('Token expired and no refresh token available');
    }

    const newTokens = await refreshLinkedInToken(record.refreshToken);
    await updateTokensAfterRefresh(
      record.mondayUserId, 
      newTokens.access_token, 
      newTokens.expires_in,
      newTokens.refresh_token
    );
    
    return newTokens.access_token;
  }

  return record.accessToken;
}

/**
 * Fetch LinkedIn member analytics using the organizationShareStatistics API
 * Note: This uses the r_member_postAnalytics scope
 */
async function fetchLinkedInAnalytics(
  accessToken: string,
  linkedInId: string,
  startDate: string,
  endDate: string
): Promise<LinkedInAnalyticsResponse> {
  return new Promise((resolve, reject) => {
    // Convert dates to milliseconds for LinkedIn API
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    
    // Use the shares endpoint to get post statistics
    // The r_member_postAnalytics scope allows querying share statistics
    const path = `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(linkedInId)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`;

    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401',
      },
    };

    console.log(`[Sync] Fetching analytics from: ${path}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        console.log(`[Sync] LinkedIn API response status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Failed to parse LinkedIn response'));
          }
        } else if (res.statusCode === 403) {
          // Try alternative endpoint for member share statistics
          fetchMemberShareStatistics(accessToken, linkedInId, startDate, endDate)
            .then(resolve)
            .catch(reject);
        } else {
          console.error(`[Sync] LinkedIn API error: ${data}`);
          reject(new Error(`LinkedIn API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Alternative: Fetch member share statistics directly
 */
async function fetchMemberShareStatistics(
  accessToken: string,
  linkedInId: string,
  _startDate: string,
  _endDate: string
): Promise<LinkedInAnalyticsResponse> {
  return new Promise((resolve, reject) => {
    // Get posts/shares by the member
    const authorUrn = `urn:li:person:${linkedInId.replace('urn:li:person:', '')}`;
    const path = `/v2/shares?q=owners&owners=${encodeURIComponent(authorUrn)}&count=50`;

    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401',
      },
    };

    console.log(`[Sync] Fetching member shares from: ${path}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const sharesData = JSON.parse(data);
            // Transform shares data into analytics format
            resolve({
              elements: sharesData.elements?.map((share: { activity?: string }) => ({
                share: share.activity,
                totalShareStatistics: {
                  impressionCount: 0, // Would need separate API call per share
                  likeCount: 0,
                  commentCount: 0,
                  shareCount: 0,
                },
              })),
              paging: sharesData.paging,
            });
          } catch {
            reject(new Error('Failed to parse shares response'));
          }
        } else {
          console.error(`[Sync] Shares API error: ${data}`);
          reject(new Error(`Shares API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Store analytics snapshot in DynamoDB
 */
async function storeAnalytics(
  record: TokenRecord,
  analytics: LinkedInAnalyticsResponse,
  dateRangeStart: string,
  dateRangeEnd: string
): Promise<void> {
  const now = Date.now();
  const id = `${record.mondayUserId}#${record.linkedInId}#${now}`;

  // Calculate totals from analytics elements
  let totalImpressions = 0;
  let totalEngagements = 0;
  let totalReactions = 0;
  let totalComments = 0;
  let totalShares = 0;
  let uniqueViews = 0;

  if (analytics.elements) {
    for (const element of analytics.elements) {
      const stats = element.totalShareStatistics;
      if (stats) {
        totalImpressions += stats.impressionCount || 0;
        uniqueViews += stats.uniqueImpressionsCount || 0;
        totalReactions += stats.likeCount || 0;
        totalComments += stats.commentCount || 0;
        totalShares += stats.shareCount || 0;
        totalEngagements += (stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0) + (stats.clickCount || 0);
      }
    }
  }

  const item: Record<string, AttributeValue> = {
    id: { S: id },
    mondayUserId: { S: record.mondayUserId },
    linkedInId: { S: record.linkedInId || '' },
    syncedAt: { N: String(now) },
    dateRangeStart: { S: dateRangeStart },
    dateRangeEnd: { S: dateRangeEnd },
    totalImpressions: { N: String(totalImpressions) },
    totalEngagements: { N: String(totalEngagements) },
    totalReactions: { N: String(totalReactions) },
    totalComments: { N: String(totalComments) },
    totalShares: { N: String(totalShares) },
    uniqueViews: { N: String(uniqueViews) },
    rawAnalyticsData: { S: JSON.stringify(analytics) },
  };

  // Add profile info if available
  if (record.profileFirstName) item.profileFirstName = { S: record.profileFirstName };
  if (record.profileLastName) item.profileLastName = { S: record.profileLastName };
  if (record.profileHeadline) item.profileHeadline = { S: record.profileHeadline };
  if (record.profilePicture) item.profilePicture = { S: record.profilePicture };

  await dynamodb.send(new PutItemCommand({
    TableName: ANALYTICS_TABLE,
    Item: item,
  }));

  console.log(`[Sync] Stored analytics for ${record.mondayUserId}: ${totalImpressions} impressions, ${totalEngagements} engagements`);
}

/**
 * Get all users with LinkedIn tokens
 */
async function getAllTokenRecords(): Promise<TokenRecord[]> {
  const records: TokenRecord[] = [];
  let lastKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: TOKENS_TABLE,
      ExclusiveStartKey: lastKey,
    }));

    if (result.Items) {
      for (const item of result.Items) {
        try {
          records.push({
            mondayUserId: item.mondayUserId?.S || '',
            linkedInId: item.linkedInId?.S,
            accessToken: decryptToken(item.accessToken?.S || ''),
            refreshToken: item.refreshToken?.S ? decryptToken(item.refreshToken.S) : undefined,
            expiresAt: parseInt(item.expiresAt?.N || '0'),
            profileFirstName: item.profileFirstName?.S,
            profileLastName: item.profileLastName?.S,
            profileHeadline: item.profileHeadline?.S,
            profilePicture: item.profilePicture?.S,
          });
        } catch (err) {
          console.error(`[Sync] Failed to parse token record:`, err);
        }
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return records;
}

/**
 * Create a sync log entry
 */
async function createSyncLog(syncJobId: string, triggerType: 'scheduled' | 'manual'): Promise<void> {
  const now = Date.now();
  
  await dynamodb.send(new PutItemCommand({
    TableName: SYNC_LOG_TABLE,
    Item: {
      id: { S: syncJobId },
      syncJobId: { S: syncJobId },
      startedAt: { N: String(now) },
      status: { S: 'running' },
      triggerType: { S: triggerType },
      totalUsers: { N: '0' },
      successCount: { N: '0' },
      errorCount: { N: '0' },
    },
  }));
}

/**
 * Update sync log with results
 */
async function updateSyncLog(
  syncJobId: string,
  status: 'completed' | 'partial' | 'failed',
  totalUsers: number,
  successCount: number,
  errorCount: number,
  errors: string[],
  successDetails: string[]
): Promise<void> {
  const now = Date.now();

  await dynamodb.send(new UpdateItemCommand({
    TableName: SYNC_LOG_TABLE,
    Key: { id: { S: syncJobId } },
    UpdateExpression: 'SET #status = :status, completedAt = :ca, totalUsers = :tu, successCount = :sc, errorCount = :ec, errors = :err, successDetails = :sd',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': { S: status },
      ':ca': { N: String(now) },
      ':tu': { N: String(totalUsers) },
      ':sc': { N: String(successCount) },
      ':ec': { N: String(errorCount) },
      ':err': { S: JSON.stringify(errors) },
      ':sd': { S: JSON.stringify(successDetails) },
    },
  }));
}

/**
 * Main sync function - syncs all connected users
 */
async function syncAllUsers(triggerType: 'scheduled' | 'manual'): Promise<{
  totalUsers: number;
  successCount: number;
  errorCount: number;
  results: SyncResult[];
}> {
  const syncJobId = crypto.randomUUID();
  console.log(`[Sync] Starting sync job ${syncJobId} (${triggerType})`);

  await createSyncLog(syncJobId, triggerType);

  // Get date range (last 7 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const dateRangeStart = startDate.toISOString().split('T')[0];
  const dateRangeEnd = endDate.toISOString().split('T')[0];

  // Get all token records
  const records = await getAllTokenRecords();
  console.log(`[Sync] Found ${records.length} users to sync`);

  const results: SyncResult[] = [];
  const errors: string[] = [];
  const successDetails: string[] = [];

  for (const record of records) {
    if (!record.linkedInId) {
      console.log(`[Sync] Skipping ${record.mondayUserId} - no LinkedIn ID`);
      results.push({
        mondayUserId: record.mondayUserId,
        linkedInId: '',
        success: false,
        error: 'No LinkedIn ID',
      });
      errors.push(`${record.mondayUserId}: No LinkedIn ID`);
      continue;
    }

    try {
      // Get valid access token (refresh if needed)
      const accessToken = await getValidAccessToken(record);

      // Fetch analytics from LinkedIn
      const analytics = await fetchLinkedInAnalytics(
        accessToken,
        record.linkedInId,
        dateRangeStart,
        dateRangeEnd
      );

      // Store in DynamoDB
      await storeAnalytics(record, analytics, dateRangeStart, dateRangeEnd);

      // Calculate summary
      let totalImpressions = 0;
      let totalEngagements = 0;
      if (analytics.elements) {
        for (const el of analytics.elements) {
          totalImpressions += el.totalShareStatistics?.impressionCount || 0;
          totalEngagements += (el.totalShareStatistics?.likeCount || 0) + 
                            (el.totalShareStatistics?.commentCount || 0) + 
                            (el.totalShareStatistics?.shareCount || 0);
        }
      }

      results.push({
        mondayUserId: record.mondayUserId,
        linkedInId: record.linkedInId,
        success: true,
        impressions: totalImpressions,
        engagements: totalEngagements,
      });

      successDetails.push(`${record.profileFirstName || record.mondayUserId}: ${totalImpressions} impressions`);
      console.log(`[Sync] Synced ${record.mondayUserId}: ${totalImpressions} impressions`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Sync] Failed to sync ${record.mondayUserId}:`, errorMsg);
      
      results.push({
        mondayUserId: record.mondayUserId,
        linkedInId: record.linkedInId,
        success: false,
        error: errorMsg,
      });
      errors.push(`${record.profileFirstName || record.mondayUserId}: ${errorMsg}`);
    }
  }

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;
  const status = errorCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial';

  await updateSyncLog(syncJobId, status, records.length, successCount, errorCount, errors, successDetails);

  console.log(`[Sync] Completed: ${successCount} success, ${errorCount} errors`);

  return {
    totalUsers: records.length,
    successCount,
    errorCount,
    results,
  };
}

/**
 * Lambda handler - supports both EventBridge and HTTP invocation
 */
export const handler = async (event: {
  source?: string;
  httpMethod?: string;
  body?: string;
  requestContext?: { http?: { method: string } };
}): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Determine trigger type
    const isScheduled = event.source === 'aws.events';
    const triggerType: 'scheduled' | 'manual' = isScheduled ? 'scheduled' : 'manual';

    console.log(`[Sync] Handler invoked - trigger: ${triggerType}`);

    const result = await syncAllUsers(triggerType);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        syncJobId: crypto.randomUUID(),
        ...result,
      }),
    };

  } catch (err) {
    console.error('[Sync] Handler error:', err);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      }),
    };
  }
};

