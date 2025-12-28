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

interface LinkedInPost {
  id: string;        // URN of the post (e.g., urn:li:share:xxx or urn:li:ugcPost:xxx)
  created?: number;  // Timestamp
  text?: string;     // Post content
}

interface PostStatistics {
  postUrn: string;
  impressionCount: number;
  uniqueImpressionsCount: number;
  clickCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  engagementCount: number;
}

interface MemberAnalyticsResult {
  posts: LinkedInPost[];
  statistics: PostStatistics[];
  totals: {
    totalImpressions: number;
    uniqueViews: number;
    totalClicks: number;
    totalReactions: number;
    totalComments: number;
    totalShares: number;
    totalEngagements: number;
    postCount: number;
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
 * Make an HTTPS request to LinkedIn API
 */
function linkedInApiRequest<T>(
  accessToken: string,
  path: string,
  method: string = 'GET'
): Promise<{ statusCode: number; data: T }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode || 500, data: parsed });
        } catch {
          reject(new Error(`Failed to parse LinkedIn response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch member's posts using the posts API
 * Uses the Community Management API / r_member_postAnalytics scope
 */
async function fetchMemberPosts(
  accessToken: string,
  linkedInId: string,
  startDate: string,
  endDate: string
): Promise<LinkedInPost[]> {
  // Normalize the person URN
  const personUrn = linkedInId.startsWith('urn:li:person:') 
    ? linkedInId 
    : `urn:li:person:${linkedInId}`;
  
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  
  console.log(`[Sync] Fetching posts for ${personUrn} from ${startDate} to ${endDate}`);
  
  // Try the posts API first (newer endpoint)
  const postsPath = `/rest/posts?author=${encodeURIComponent(personUrn)}&q=author&count=100`;
  
  try {
    const result = await linkedInApiRequest<{
      elements?: Array<{
        id: string;
        createdAt?: number;
        commentary?: string;
        content?: { article?: { title?: string } };
      }>;
    }>(accessToken, postsPath);
    
    console.log(`[Sync] Posts API response: ${result.statusCode}`);
    
    if (result.statusCode === 200 && result.data.elements) {
      // Filter posts within date range
      return result.data.elements
        .filter(post => {
          const createdAt = post.createdAt || 0;
          return createdAt >= startMs && createdAt <= endMs;
        })
        .map(post => ({
          id: post.id,
          created: post.createdAt,
          text: post.commentary || post.content?.article?.title,
        }));
    }
  } catch (err) {
    console.log(`[Sync] Posts API failed, trying shares API:`, err);
  }
  
  // Fallback to shares API (older endpoint)
  const sharesPath = `/v2/shares?q=owners&owners=${encodeURIComponent(personUrn)}&count=100`;
  
  const sharesResult = await linkedInApiRequest<{
    elements?: Array<{
      activity?: string;
      created?: { time?: number };
      text?: { text?: string };
    }>;
  }>(accessToken, sharesPath);
  
  console.log(`[Sync] Shares API response: ${sharesResult.statusCode}`);
  
  if (sharesResult.statusCode === 200 && sharesResult.data.elements) {
    return sharesResult.data.elements
      .filter(share => {
        const createdAt = share.created?.time || 0;
        return createdAt >= startMs && createdAt <= endMs;
      })
      .map(share => ({
        id: share.activity || '',
        created: share.created?.time,
        text: share.text?.text,
      }))
      .filter(post => post.id); // Remove posts without IDs
  }
  
  console.log(`[Sync] No posts found for ${personUrn}`);
  return [];
}

/**
 * Fetch social metadata (engagement counts) for posts
 * Uses the socialMetadata API for batch fetching
 */
async function fetchPostEngagement(
  accessToken: string,
  postUrns: string[]
): Promise<Map<string, PostStatistics>> {
  const statsMap = new Map<string, PostStatistics>();
  
  if (postUrns.length === 0) {
    return statsMap;
  }
  
  // Initialize all posts with zero stats
  for (const urn of postUrns) {
    statsMap.set(urn, {
      postUrn: urn,
      impressionCount: 0,
      uniqueImpressionsCount: 0,
      clickCount: 0,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      engagementCount: 0,
    });
  }
  
  // Try to fetch social actions for each post (batch if possible)
  // LinkedIn's socialActions endpoint gets likes, comments, shares
  for (const postUrn of postUrns) {
    try {
      // Get social action summary
      const summaryPath = `/v2/socialActions/${encodeURIComponent(postUrn)}`;
      const result = await linkedInApiRequest<{
        likesSummary?: { totalLikes?: number };
        commentsSummary?: { totalFirstLevelComments?: number };
        sharesSummary?: { totalShares?: number };
      }>(accessToken, summaryPath);
      
      if (result.statusCode === 200) {
        const existing = statsMap.get(postUrn)!;
        existing.likeCount = result.data.likesSummary?.totalLikes || 0;
        existing.commentCount = result.data.commentsSummary?.totalFirstLevelComments || 0;
        existing.shareCount = result.data.sharesSummary?.totalShares || 0;
        existing.engagementCount = existing.likeCount + existing.commentCount + existing.shareCount;
      }
    } catch (err) {
      console.log(`[Sync] Failed to fetch engagement for ${postUrn}:`, err);
    }
  }
  
  // Try to fetch impressions via post analytics if available
  // This requires r_member_postAnalytics scope
  for (const postUrn of postUrns) {
    try {
      const analyticsPath = `/rest/postAnalytics?q=analytics&posts=List(${encodeURIComponent(postUrn)})`;
      const result = await linkedInApiRequest<{
        elements?: Array<{
          post: string;
          impressionCount?: number;
          uniqueImpressionsCount?: number;
          clickCount?: number;
        }>;
      }>(accessToken, analyticsPath);
      
      if (result.statusCode === 200 && result.data.elements) {
        for (const analytics of result.data.elements) {
          const existing = statsMap.get(analytics.post);
          if (existing) {
            existing.impressionCount = analytics.impressionCount || 0;
            existing.uniqueImpressionsCount = analytics.uniqueImpressionsCount || 0;
            existing.clickCount = analytics.clickCount || 0;
            existing.engagementCount = existing.likeCount + existing.commentCount + 
                                       existing.shareCount + existing.clickCount;
          }
        }
      }
    } catch (err) {
      console.log(`[Sync] Post analytics not available for ${postUrn}:`, err);
      // This is expected if r_member_postAnalytics isn't fully approved
    }
  }
  
  return statsMap;
}

/**
 * Fetch complete member analytics - posts + engagement
 */
async function fetchMemberAnalytics(
  accessToken: string,
  linkedInId: string,
  startDate: string,
  endDate: string
): Promise<MemberAnalyticsResult> {
  console.log(`[Sync] Fetching analytics for ${linkedInId}`);
  
  // Step 1: Get member's posts in date range
  const posts = await fetchMemberPosts(accessToken, linkedInId, startDate, endDate);
  console.log(`[Sync] Found ${posts.length} posts`);
  
  // Step 2: Get engagement stats for each post
  const postUrns = posts.map(p => p.id).filter(Boolean);
  const statistics = await fetchPostEngagement(accessToken, postUrns);
  
  // Step 3: Calculate totals
  const totals = {
    totalImpressions: 0,
    uniqueViews: 0,
    totalClicks: 0,
    totalReactions: 0,
    totalComments: 0,
    totalShares: 0,
    totalEngagements: 0,
    postCount: posts.length,
  };
  
  for (const stats of statistics.values()) {
    totals.totalImpressions += stats.impressionCount;
    totals.uniqueViews += stats.uniqueImpressionsCount;
    totals.totalClicks += stats.clickCount;
    totals.totalReactions += stats.likeCount;
    totals.totalComments += stats.commentCount;
    totals.totalShares += stats.shareCount;
    totals.totalEngagements += stats.engagementCount;
  }
  
  console.log(`[Sync] Analytics totals: ${JSON.stringify(totals)}`);
  
  return {
    posts,
    statistics: Array.from(statistics.values()),
    totals,
  };
}

/**
 * Store analytics snapshot in DynamoDB
 */
async function storeAnalytics(
  record: TokenRecord,
  analytics: MemberAnalyticsResult,
  dateRangeStart: string,
  dateRangeEnd: string
): Promise<void> {
  const now = Date.now();
  const id = `${record.mondayUserId}#${record.linkedInId}#${now}`;

  const { totals } = analytics;

  const item: Record<string, AttributeValue> = {
    id: { S: id },
    mondayUserId: { S: record.mondayUserId },
    linkedInId: { S: record.linkedInId || '' },
    syncedAt: { N: String(now) },
    dateRangeStart: { S: dateRangeStart },
    dateRangeEnd: { S: dateRangeEnd },
    totalImpressions: { N: String(totals.totalImpressions) },
    totalEngagements: { N: String(totals.totalEngagements) },
    totalReactions: { N: String(totals.totalReactions) },
    totalComments: { N: String(totals.totalComments) },
    totalShares: { N: String(totals.totalShares) },
    totalClicks: { N: String(totals.totalClicks) },
    uniqueViews: { N: String(totals.uniqueViews) },
    postCount: { N: String(totals.postCount) },
    // Store per-post statistics for detailed analysis
    rawAnalyticsData: { S: JSON.stringify({
      posts: analytics.posts,
      statistics: analytics.statistics,
    }) },
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

  console.log(`[Sync] Stored analytics for ${record.mondayUserId}: ${totals.totalImpressions} impressions, ${totals.totalEngagements} engagements, ${totals.postCount} posts`);
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

      // Fetch analytics from LinkedIn using Member Post Analytics API
      const analytics = await fetchMemberAnalytics(
        accessToken,
        record.linkedInId,
        dateRangeStart,
        dateRangeEnd
      );

      // Store in DynamoDB
      await storeAnalytics(record, analytics, dateRangeStart, dateRangeEnd);

      const { totals } = analytics;

      results.push({
        mondayUserId: record.mondayUserId,
        linkedInId: record.linkedInId,
        success: true,
        impressions: totals.totalImpressions,
        engagements: totals.totalEngagements,
      });

      successDetails.push(`${record.profileFirstName || record.mondayUserId}: ${totals.totalImpressions} impressions, ${totals.postCount} posts`);
      console.log(`[Sync] Synced ${record.mondayUserId}: ${totals.totalImpressions} impressions, ${totals.postCount} posts`);

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

