# Admin User Setup Guide

This guide explains how to set up email/password authentication and create an admin user for the LinkedIn Analytics Dashboard.

## Prerequisites

1. Deploy your Amplify backend (if not already deployed)
2. Generate Amplify outputs for your frontend

## Step 1: Deploy Amplify Backend

If you haven't deployed your Amplify backend yet:

```bash
npx ampx sandbox
```

This will deploy your backend and generate configuration outputs.

## Step 2: Generate Outputs for Frontend

After deployment, generate the outputs file:

```bash
npx ampx generate outputs --app-id <YOUR_APP_ID> --branch <YOUR_BRANCH>
```

Or if using sandbox:

```bash
npx ampx generate outputs --branch main
```

This creates an `amplify_outputs.json` file in the root directory.

Alternatively, you can manually configure using environment variables (see Step 3).

## Step 3: Configure Environment Variables (Alternative)

If you prefer not to use `amplify_outputs.json`, create a `.env` file in the root directory:

```env
VITE_AWS_USER_POOL_ID=your-user-pool-id
VITE_AWS_USER_POOL_CLIENT_ID=your-user-pool-client-id
VITE_ADMIN_EMAIL=admin@example.com
```

You can find these values in:
- AWS Console → Cognito → User Pools → Your User Pool
- Or in the Amplify Console → Backend → Authentication

## Step 4: Create Admin User

### Option 1: Using AWS Cognito Console (Recommended)

1. Go to AWS Console → Cognito → User Pools
2. Select your user pool
3. Click "Users" in the left sidebar
4. Click "Create user"
5. Enter the admin email (must match `VITE_ADMIN_EMAIL` or default `admin@example.com`)
6. Set a temporary password (user will be prompted to change on first login)
7. Uncheck "Send an email invitation" if you want to set a permanent password
8. Click "Create user"

### Option 2: Using AWS CLI

```bash
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password "TempPassword123!" \
  --message-action SUPPRESS
```

Then set a permanent password:

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --password "YourSecurePassword123!" \
  --permanent
```

### Option 3: Using Amplify CLI

```bash
npx ampx sandbox
# Then use the AWS Console or CLI as shown above
```

## Step 5: Configure Admin Email

Set the admin email in your `.env` file:

```env
VITE_ADMIN_EMAIL=admin@example.com
```

**Important:** The email you use for the admin user must match `VITE_ADMIN_EMAIL` (or the default `admin@example.com`).

## Step 6: Test Login

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the login page
3. Select "Email & Password" tab
4. Enter your admin email and password
5. You should be logged in and have admin privileges

## Troubleshooting

### "Amplify not configured" warning

- Make sure you've deployed your backend and generated `amplify_outputs.json`
- Or set the environment variables `VITE_AWS_USER_POOL_ID` and `VITE_AWS_USER_POOL_CLIENT_ID`

### "Sign in failed" error

- Check that the user exists in Cognito
- Verify the email matches `VITE_ADMIN_EMAIL`
- Check browser console for detailed error messages
- Ensure the user's email is verified in Cognito

### User created but not recognized as admin

- Verify `VITE_ADMIN_EMAIL` matches the user's email exactly (case-sensitive)
- Restart the dev server after changing environment variables
- Clear browser localStorage and try logging in again

## Security Notes

- Use a strong password for the admin account
- Consider using AWS Secrets Manager or environment variables for sensitive configuration
- Regularly rotate admin passwords
- Consider implementing MFA for admin accounts

