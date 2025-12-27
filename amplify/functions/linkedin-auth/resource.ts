import { defineFunction, secret } from "@aws-amplify/backend";

export const linkedinAuth = defineFunction({
  name: "linkedin-auth",
  entry: "./handler.ts",
  environment: {
    // LinkedIn Community Management App (Analytics + Profile)
    LINKEDIN_CLIENT_ID: "86hknid4qlugd1",
    LINKEDIN_CLIENT_SECRET: secret("LINKEDIN_CLIENT_SECRET"),
  },
});
