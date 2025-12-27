import type { Handler } from "aws-lambda";
import * as https from "https";
import * as querystring from "querystring";
import type { IncomingMessage } from "http";

// LinkedIn Community Management App credentials
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;

interface TokenRequest {
  action?: "token" | "profile";
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  access_token?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface ProfileResponse {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
}

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    // Parse request body
    const body: TokenRequest = JSON.parse(event.body || "{}");
    const action = body.action || "token";

    // Handle profile fetch action
    if (action === "profile") {
      const { access_token } = body;

      if (!access_token) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required parameter: access_token" }),
        };
      }

      const profile = await fetchLinkedInProfile(access_token);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(profile),
      };
    }

    // Handle token exchange action (default)
    const { code, redirect_uri, client_id } = body;

    if (!code || !redirect_uri || !client_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required parameters: code, redirect_uri, client_id",
        }),
      };
    }

    // Validate client ID
    if (client_id !== LINKEDIN_CLIENT_ID) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid client_id" }),
      };
    }

    // Exchange code for token
    const tokens = await exchangeCodeForToken(code, redirect_uri);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(tokens),
    };
  } catch (error) {
    console.error("LinkedIn API error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Request failed",
      }),
    };
  }
};

/**
 * Exchange authorization code for access token
 */
function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const options = {
      hostname: "www.linkedin.com",
      port: 443,
      path: "/oauth/v2/accessToken",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200) {
            resolve(response as TokenResponse);
          } else {
            reject(
              new Error(
                response.error_description || response.error || "Token exchange failed"
              )
            );
          }
        } catch (err) {
          reject(new Error("Failed to parse LinkedIn response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Fetch LinkedIn profile using access token
 */
function fetchLinkedInProfile(accessToken: string): Promise<ProfileResponse> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.linkedin.com",
      port: 443,
      path: "/v2/me",
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let data = "";

      res.on("data", (chunk: Buffer) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200) {
            // Extract localized names from LinkedIn response
            const firstName =
              response.localizedFirstName ||
              response.firstName?.localized?.en_US ||
              "User";
            const lastName =
              response.localizedLastName ||
              response.lastName?.localized?.en_US ||
              "";

            // Extract profile picture if available
            const profilePicture =
              response.profilePicture?.["displayImage~"]?.elements?.[0]
                ?.identifiers?.[0]?.identifier;

            resolve({
              id: response.id,
              firstName,
              lastName,
              headline: response.localizedHeadline,
              profilePicture,
            });
          } else {
            reject(
              new Error(
                response.message || response.error || "Failed to fetch profile"
              )
            );
          }
        } catch (err) {
          reject(new Error("Failed to parse LinkedIn profile response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Profile request failed: ${err.message}`));
    });

    req.end();
  });
}
