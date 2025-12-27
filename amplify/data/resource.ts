import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * LinkedIn Analytics Schema
 * 
 * Four tables:
 * 1. LinkedInTokens - Stores encrypted LinkedIn tokens per Monday.com user
 * 2. UserSessions - Short-lived session tokens for browser authentication
 * 3. LinkedInAnalytics - Historical analytics snapshots for each user
 * 4. SyncLog - Sync job tracking and status
 */
const schema = a.schema({
  /**
   * LinkedInTokens Table
   * Primary Key: mondayUserId (Monday.com user ID)
   * Stores encrypted LinkedIn OAuth tokens with auto-refresh support
   */
  LinkedInTokens: a
    .model({
      mondayUserId: a.string().required(),           // Monday.com user ID (PK)
      linkedInId: a.string(),                         // LinkedIn profile ID (urn:li:person:xxx)
      accessToken: a.string().required(),             // Encrypted access token
      refreshToken: a.string(),                       // Encrypted refresh token
      expiresAt: a.integer().required(),              // Token expiry timestamp (ms)
      lastRefreshed: a.integer(),                     // Last refresh timestamp (ms)
      profileFirstName: a.string(),                   // Cached profile: first name
      profileLastName: a.string(),                    // Cached profile: last name
      profileHeadline: a.string(),                    // Cached profile: headline
      profilePicture: a.string(),                     // Cached profile: picture URL
      createdAt: a.integer().required(),              // Connection timestamp
      updatedAt: a.integer().required(),              // Last update timestamp
    })
    .identifier(['mondayUserId'])
    .authorization((allow) => [
      allow.guest().to(['read']),                     // Lambda uses IAM, not guest
    ]),

  /**
   * UserSessions Table
   * Primary Key: sessionId (UUID)
   * Short-lived sessions (24 hours) for browser authentication
   */
  UserSessions: a
    .model({
      sessionId: a.string().required(),               // UUID session identifier (PK)
      mondayUserId: a.string().required(),            // Monday.com user ID (for lookup)
      expiresAt: a.integer().required(),              // Session expiry timestamp (ms)
      createdAt: a.integer().required(),              // Session creation timestamp
    })
    .identifier(['sessionId'])
    .secondaryIndexes((index) => [
      index('mondayUserId'),                          // GSI for user lookup
    ])
    .authorization((allow) => [
      allow.guest().to(['read']),
    ]),

  /**
   * LinkedInAnalytics Table
   * Primary Key: id (composite: {mondayUserId}#{linkedInId}#{timestamp})
   * Stores historical snapshots of LinkedIn analytics data
   */
  LinkedInAnalytics: a
    .model({
      id: a.string().required(),                      // PK: {mondayUserId}#{linkedInId}#{timestamp}
      mondayUserId: a.string().required(),            // Monday.com user ID
      linkedInId: a.string().required(),              // LinkedIn URN (urn:li:person:xxx)
      syncedAt: a.integer().required(),               // When this snapshot was taken (ms)
      dateRangeStart: a.string().required(),          // Analytics date range start (YYYY-MM-DD)
      dateRangeEnd: a.string().required(),            // Analytics date range end (YYYY-MM-DD)
      
      // Profile info (cached from token record)
      profileFirstName: a.string(),
      profileLastName: a.string(),
      profileHeadline: a.string(),
      profilePicture: a.string(),
      
      // Aggregated metrics for the period
      totalImpressions: a.integer(),
      totalEngagements: a.integer(),
      totalReactions: a.integer(),
      totalComments: a.integer(),
      totalShares: a.integer(),
      uniqueViews: a.integer(),
      
      // Raw LinkedIn API response (JSON string)
      rawAnalyticsData: a.string(),                   // JSON stringified response
    })
    .identifier(['id'])
    .secondaryIndexes((index) => [
      index('mondayUserId').sortKeys(['syncedAt']),   // Query user's history
      index('linkedInId').sortKeys(['syncedAt']),     // Query by LinkedIn ID
    ])
    .authorization((allow) => [
      allow.guest().to(['read']),
    ]),

  /**
   * SyncLog Table
   * Primary Key: id (syncJobId)
   * Tracks sync job status and history
   */
  SyncLog: a
    .model({
      id: a.string().required(),                       // PK: syncJobId (UUID)
      syncJobId: a.string().required(),                // UUID for this sync job
      startedAt: a.integer().required(),               // Sync start timestamp (ms)
      completedAt: a.integer(),                        // Sync completion timestamp (ms)
      status: a.string().required(),                   // 'running' | 'completed' | 'partial' | 'failed'
      triggerType: a.string().required(),              // 'scheduled' | 'manual'
      
      // Summary
      totalUsers: a.integer(),                         // Total users to sync
      successCount: a.integer(),                       // Successfully synced users
      errorCount: a.integer(),                         // Failed users
      
      // Details (JSON string)
      errors: a.string(),                              // JSON array of error details
      successDetails: a.string(),                      // JSON array of success summaries
    })
    .identifier(['id'])
    .secondaryIndexes((index) => [
      index('startedAt'),                              // Query recent syncs
    ])
    .authorization((allow) => [
      allow.guest().to(['read']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'iam',                  // Lambda uses IAM authentication
  },
});
