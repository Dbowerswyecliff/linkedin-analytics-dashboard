import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { linkedinAuth } from './functions/linkedin-auth/resource';
import { linkedinSync } from './functions/linkedin-sync/resource';
import { FunctionUrlAuthType, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction as LambdaTarget } from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  linkedinAuth,
  linkedinSync,
});

// Get references to resources
const linkedinAuthLambda = backend.linkedinAuth.resources.lambda;
const linkedinSyncLambda = backend.linkedinSync.resources.lambda;
const dataResources = backend.data.resources;

// Get table references from the Data construct
const linkedInTokensTable = dataResources.tables['LinkedInTokens'];
const userSessionsTable = dataResources.tables['UserSessions'];
const linkedInAnalyticsTable = dataResources.tables['LinkedInAnalytics'];
const syncLogTable = dataResources.tables['SyncLog'];

// Cast to full Lambda Function to access addEnvironment
const authLambdaFn = linkedinAuthLambda as LambdaFunction;
const syncLambdaFn = linkedinSyncLambda as LambdaFunction;

// ============================================
// Auth Lambda Permissions
// ============================================

// Grant Auth Lambda full access to tokens and sessions tables
if (linkedInTokensTable) {
  linkedInTokensTable.grantReadWriteData(linkedinAuthLambda);
  authLambdaFn.addEnvironment('LINKEDIN_TOKENS_TABLE', linkedInTokensTable.tableName);
}

if (userSessionsTable) {
  userSessionsTable.grantReadWriteData(linkedinAuthLambda);
  authLambdaFn.addEnvironment('USER_SESSIONS_TABLE', userSessionsTable.tableName);
}

// Grant Auth Lambda read access to analytics (for query endpoint)
if (linkedInAnalyticsTable) {
  linkedInAnalyticsTable.grantReadData(linkedinAuthLambda);
  authLambdaFn.addEnvironment('LINKEDIN_ANALYTICS_TABLE', linkedInAnalyticsTable.tableName);
}

// Grant Auth Lambda read access to sync log (for status endpoint)
if (syncLogTable) {
  syncLogTable.grantReadData(linkedinAuthLambda);
  authLambdaFn.addEnvironment('SYNC_LOG_TABLE', syncLogTable.tableName);
}

// ============================================
// Sync Lambda Permissions
// ============================================

// Grant Sync Lambda read access to tokens (to get all users and decrypt tokens)
if (linkedInTokensTable) {
  linkedInTokensTable.grantReadWriteData(linkedinSyncLambda); // Read + write for token refresh
  syncLambdaFn.addEnvironment('LINKEDIN_TOKENS_TABLE', linkedInTokensTable.tableName);
}

// Grant Sync Lambda write access to analytics
if (linkedInAnalyticsTable) {
  linkedInAnalyticsTable.grantReadWriteData(linkedinSyncLambda);
  syncLambdaFn.addEnvironment('LINKEDIN_ANALYTICS_TABLE', linkedInAnalyticsTable.tableName);
}

// Grant Sync Lambda write access to sync log
if (syncLogTable) {
  syncLogTable.grantReadWriteData(linkedinSyncLambda);
  syncLambdaFn.addEnvironment('SYNC_LOG_TABLE', syncLogTable.tableName);
}

// ============================================
// EventBridge Schedule for Hourly Sync
// ============================================

// Get the CDK stack from the sync function
const syncStack = backend.linkedinSync.resources.lambda.stack;

// Create EventBridge rule to trigger sync hourly
const syncScheduleRule = new Rule(syncStack, 'HourlySyncRule', {
  schedule: Schedule.rate(Duration.hours(1)),
  description: 'Trigger LinkedIn analytics sync every hour',
});

// Add the sync Lambda as the target
syncScheduleRule.addTarget(new LambdaTarget(linkedinSyncLambda));

// ============================================
// Function URLs
// ============================================

// Create a public Function URL for the LinkedIn OAuth handler
const authFnUrl = linkedinAuthLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Create a public Function URL for manual sync triggering
const syncFnUrl = linkedinSyncLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Output the function URLs
backend.addOutput({
  custom: {
    linkedinAuthUrl: authFnUrl.url,
    linkedinSyncUrl: syncFnUrl.url,
  },
});
