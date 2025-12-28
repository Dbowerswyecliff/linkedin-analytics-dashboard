import { defineFunction, secret } from "@aws-amplify/backend";

/**
 * LinkedIn Sync Lambda Function
 * Scheduled to run hourly via EventBridge
 * Fetches analytics for all connected LinkedIn users and stores in DynamoDB
 */
export const linkedinSync = defineFunction({
  name: "linkedin-sync",
  entry: "./handler.ts",
  timeoutSeconds: 301, // Bumped to force update for secrets
  memoryMB: 512,
  environment: {
    // LinkedIn App credentials
    LINKEDIN_CLIENT_ID: "86hknid4qlugd1",
    LINKEDIN_CLIENT_SECRET: secret("LINKEDIN_CLIENT_SECRET"),
    
    // DynamoDB table names are set dynamically by backend.ts
    // DO NOT hardcode table names here - Amplify generates unique names
    
    // Encryption key for token decryption
    TOKEN_ENCRYPTION_KEY: secret("TOKEN_ENCRYPTION_KEY"),
  },
});

