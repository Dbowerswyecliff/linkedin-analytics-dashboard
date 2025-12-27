import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * LinkedIn Token Storage Schema
 * 
 * Two tables:
 * 1. LinkedInTokens - Stores encrypted LinkedIn tokens per Monday.com user
 * 2. UserSessions - Short-lived session tokens for browser authentication
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
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'iam',                  // Lambda uses IAM authentication
  },
});
