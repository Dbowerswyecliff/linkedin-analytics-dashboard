import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { linkedinAuth } from './functions/linkedin-auth/resource';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  linkedinAuth,
});

// Create a public Function URL for the LinkedIn OAuth handler
// CORS is handled in the Lambda response headers for more control
const linkedinAuthLambda = backend.linkedinAuth.resources.lambda;
const fnUrl = linkedinAuthLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Output the function URL
backend.addOutput({
  custom: {
    linkedinAuthUrl: fnUrl.url,
  },
});
