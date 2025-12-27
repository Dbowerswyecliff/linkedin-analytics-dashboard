import { defineFunction, secret } from "@aws-amplify/backend";

export const linkedinAuth = defineFunction({
  name: "linkedin-auth",
  entry: "./handler.ts",
  timeoutSeconds: 30, // Updated to pick up new encryption key
  environment: {
    // LinkedIn Community Management App (Analytics + Profile)
    LINKEDIN_CLIENT_ID: "86hknid4qlugd1",
    LINKEDIN_CLIENT_SECRET: secret("LINKEDIN_CLIENT_SECRET"),
    
    // Token encryption key (32 bytes hex = 64 chars for AES-256)
    TOKEN_ENCRYPTION_KEY: secret("TOKEN_ENCRYPTION_KEY"),
    
    // Session settings
    SESSION_TTL_HOURS: "24",
  },
});
