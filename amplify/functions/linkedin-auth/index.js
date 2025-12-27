/**
 * LinkedIn OAuth Token Exchange Function
 * Securely exchanges authorization code for access token
 */

const https = require('https');
const querystring = require('querystring');

// These should be set as environment variables in Amplify
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { code, redirect_uri } = body;

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Authorization code is required' }),
      };
    }

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'LinkedIn credentials not configured' }),
      };
    }

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code, redirect_uri);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(tokenData),
    };
  } catch (error) {
    console.error('OAuth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Token exchange failed' }),
    };
  }
};

function exchangeCodeForToken(code, redirectUri) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const options = {
      hostname: 'www.linkedin.com',
      port: 443,
      path: '/oauth/v2/accessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error_description || parsed.error));
          } else {
            resolve({
              access_token: parsed.access_token,
              expires_in: parsed.expires_in,
              refresh_token: parsed.refresh_token,
              scope: parsed.scope,
            });
          }
        } catch (e) {
          reject(new Error('Failed to parse LinkedIn response'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

