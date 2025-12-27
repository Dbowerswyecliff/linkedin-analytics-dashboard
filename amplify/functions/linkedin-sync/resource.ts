import { defineFunction, secret } from "@aws-amplify/backend";

/**
 * LinkedIn Sync Lambda Function
 * Scheduled to run hourly via EventBridge
 * Fetches analytics for all connected LinkedIn users and stores in DynamoDB
 */
export const linkedinSync = defineFunction({
  name: "linkedin-sync",
  entry: "./handler.ts",
  timeoutSeconds: 300, // 5 minutes (sync can take time for many users)
  memoryMB: 512,
  environment: {
    // LinkedIn App credentials
    LINKEDIN_CLIENT_ID: "86hknid4qlugd1",
    LINKEDIN_CLIENT_SECRET: secret("LINKEDIN_CLIENT_SECRET"),
    
    // DynamoDB table names (set by Amplify)
    LINKEDIN_TOKENS_TABLE: "LinkedInTokens",
    LINKEDIN_ANALYTICS_TABLE: "LinkedInAnalytics",
    SYNC_LOG_TABLE: "SyncLog",
    
    // Encryption key for token decryption
    TOKEN_ENCRYPTION_KEY: secret("TOKEN_ENCRYPTION_KEY"),
  },
});

