import { defineFunction, secret } from "@aws-amplify/backend";

export const mondayAuth = defineFunction({
  name: "monday-auth",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  environment: {
    MONDAY_CLIENT_ID: "0518e73d4d0095206f01698240f4356b",
    MONDAY_CLIENT_SECRET: secret("MONDAY_CLIENT_SECRET"),
  },
});

