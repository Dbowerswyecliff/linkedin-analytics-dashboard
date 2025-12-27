import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { linkedinAuth } from './functions/linkedin-auth/resource';
import { FunctionUrlAuthType, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  linkedinAuth,
});

// Get references to resources
const linkedinAuthLambda = backend.linkedinAuth.resources.lambda;
const dataResources = backend.data.resources;

// Get table ARNs from the Data construct
const linkedInTokensTable = dataResources.tables['LinkedInTokens'];
const userSessionsTable = dataResources.tables['UserSessions'];

// Cast to full Lambda Function to access addEnvironment
const lambdaFn = linkedinAuthLambda as LambdaFunction;

// Grant Lambda full access to DynamoDB tables and add table names to environment
if (linkedInTokensTable) {
  linkedInTokensTable.grantReadWriteData(linkedinAuthLambda);
  lambdaFn.addEnvironment('LINKEDIN_TOKENS_TABLE', linkedInTokensTable.tableName);
}

if (userSessionsTable) {
  userSessionsTable.grantReadWriteData(linkedinAuthLambda);
  lambdaFn.addEnvironment('USER_SESSIONS_TABLE', userSessionsTable.tableName);
}

// Create a public Function URL for the LinkedIn OAuth handler
// CORS is handled in the Lambda response headers for more control
const fnUrl = linkedinAuthLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Output the function URL
backend.addOutput({
  custom: {
    linkedinAuthUrl: fnUrl.url,
  },
});
