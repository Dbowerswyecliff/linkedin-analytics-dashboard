# AWS Amplify Test Branch Setup Guide

This guide explains how to set up the `test` branch in AWS Amplify for testing email/password authentication.

## ✅ What's Already Done

- ✅ Created `test` branch locally
- ✅ Committed all email/password authentication changes
- ✅ `amplify.yml` is configured to use `$AWS_BRANCH` (will automatically use git branch name)

## Steps to Set Up Test Branch in AWS Amplify

### Step 1: Push the Branch to Remote

First, push your `test` branch to your git repository (GitHub, GitLab, etc.):

```bash
git push -u origin test
```

### Step 2: Connect Branch in AWS Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app
3. Click **"Branches"** in the left sidebar
4. Click **"Add branch"**
5. Select your repository and choose the `test` branch
6. Click **"Next"** and configure the branch:
   - **Branch name**: `test`
   - **Display name**: `Test` (optional)
   - **Backend environment**: Choose to create a new backend environment or use existing
   - **Backend environment name**: `test` (recommended)

### Step 3: Backend Deployment

The backend will automatically deploy when you connect the branch because:
- Your `amplify.yml` uses `npx ampx pipeline-deploy --branch $AWS_BRANCH`
- AWS Amplify automatically sets `$AWS_BRANCH` to the git branch name (`test`)

**Important**: The backend deployment will create a **separate backend environment** for the test branch. This means:
- Test branch will have its own Cognito User Pool
- Test branch will have its own DynamoDB tables
- Test branch data is isolated from `main` branch

### Step 4: Generate Amplify Outputs

After the backend deploys (this may take a few minutes):

1. Go to your test branch in AWS Amplify Console
2. Wait for the backend build to complete
3. Once deployed, you can generate outputs using:

```bash
npx ampx generate outputs --app-id <YOUR_APP_ID> --branch test
```

Or if you have the Amplify CLI configured:

```bash
amplify pull --branch test
```

### Step 5: Configure Environment Variables (Optional)

You can optionally set environment variables in AWS Amplify Console for the test branch:

1. Go to your test branch in Amplify Console
2. Click **"Environment variables"** in the left sidebar
3. Add these variables if needed:
   - `VITE_ADMIN_EMAIL` - Email for admin user (defaults to `admin@example.com`)
   - Other environment variables as needed

**Note**: The frontend will automatically use `amplify_outputs.json` if available, so environment variables are optional.

### Step 6: Create Admin User for Test Branch

Since the test branch has its own backend, you'll need to create an admin user specifically for this branch:

1. Go to AWS Console → Cognito → User Pools
2. Find the User Pool for your test branch (name will include "test" or the branch name)
3. Follow the steps in `ADMIN_SETUP.md` to create an admin user
4. Use the admin email that matches `VITE_ADMIN_EMAIL` (or default `admin@example.com`)

## Important Notes

### Backend Isolation

- Each branch gets its own backend environment
- Test branch backend is completely separate from main branch
- Users, data, and resources are isolated per branch

### Frontend Configuration

The frontend code will automatically:
- Use `amplify_outputs.json` if available (recommended)
- Fall back to environment variables if outputs.json is not available
- Work with the backend for the current branch

### Deployment Workflow

1. Make changes on `test` branch
2. Push to remote: `git push origin test`
3. AWS Amplify automatically detects changes and deploys
4. Backend deploys first, then frontend builds
5. Test branch gets its own URL (e.g., `https://test.your-app.amplifyapp.com`)

### Merging to Main

When you're ready to merge to main:
1. Test thoroughly on the test branch
2. Merge `test` → `main` in git
3. AWS Amplify will automatically deploy to main branch
4. Main branch will use its existing backend (or create new if needed)

## Troubleshooting

### Backend Not Deploying

- Check that `amplify.yml` exists and is correctly formatted
- Verify the branch is connected in Amplify Console
- Check build logs in Amplify Console

### Frontend Can't Connect to Backend

- Ensure backend deployment completed successfully
- Generate outputs: `npx ampx generate outputs --branch test`
- Check that `amplify_outputs.json` is in the build (it's gitignored but should be in build)
- Verify environment variables if using manual config

### Authentication Not Working

- Verify Cognito User Pool exists for test branch
- Check that user is created in the correct User Pool (test branch pool)
- Verify `VITE_ADMIN_EMAIL` matches the user's email exactly
- Check browser console for configuration errors

## Next Steps

1. Push the branch: `git push -u origin test`
2. Connect branch in AWS Amplify Console
3. Wait for backend deployment
4. Generate outputs or configure environment variables
5. Create admin user for test branch
6. Test the email/password login functionality

