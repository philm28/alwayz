# Meta Graph API Setup Guide

This guide walks you through setting up Meta Graph API to import Facebook and Instagram content into your AI personas.

## Prerequisites

- Facebook Developer account
- Access to Facebook and/or Instagram accounts you want to import from

## Step 1: Create a Meta App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Select **"Consumer"** as the app type
4. Fill in app details:
   - **App Name**: Your app name (e.g., "Alwayz AI")
   - **Contact Email**: Your email
   - Click **"Create App"**

## Step 2: Configure App Settings

1. In your app dashboard, go to **"Settings"** → **"Basic"**
2. Note your **App ID** and **App Secret**
3. Add your app domain:
   - **App Domains**: Your domain (e.g., `yourdomain.com`)
   - **Site URL**: Your full URL (e.g., `https://yourdomain.com`)
4. Add **Privacy Policy URL** and **Terms of Service URL**

## Step 3: Add Facebook Login Product

1. In the left sidebar, click **"Add Product"**
2. Find **"Facebook Login"** and click **"Set Up"**
3. Choose **"Web"** as the platform
4. Enter your **Site URL**: `https://yourdomain.com`
5. Click **"Save"**

### Configure OAuth Settings

1. Go to **Facebook Login** → **"Settings"**
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://yourdomain.com/oauth/callback
   http://localhost:3000/oauth/callback (for development)
   ```
3. Enable **"Client OAuth Login"**
4. Enable **"Web OAuth Login"**
5. Click **"Save Changes"**

## Step 4: Request Permissions

### For Facebook Data Access

1. Go to **"App Review"** → **"Permissions and Features"**
2. Request the following permissions:
   - `public_profile` (Default - already approved)
   - `email` (Default - already approved)
   - `user_posts` - Request this permission
   - `user_photos` - Request this permission

3. For each permission:
   - Click **"Request"**
   - Provide a clear description of how you'll use the data
   - Upload a screencast demonstrating the feature

### For Instagram Data Access

1. Add **Instagram Product**:
   - Go to **"Add Product"** → **"Instagram"**
   - Click **"Set Up"**

2. Request Instagram permissions:
   - `instagram_basic` - Basic profile info
   - `instagram_content_publish` - Access to media

## Step 5: Add Environment Variables

Add these to your `.env` file:

```bash
VITE_META_APP_ID=your_facebook_app_id
VITE_META_APP_SECRET=your_facebook_app_secret
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id
VITE_INSTAGRAM_CLIENT_ID=your_facebook_app_id
```

**Note**: For Meta platforms, `VITE_FACEBOOK_CLIENT_ID` and `VITE_INSTAGRAM_CLIENT_ID` are the same as `VITE_META_APP_ID`.

## Step 6: Test in Development Mode

Before going live, test with development mode:

1. Go to **"Roles"** → **"Test Users"**
2. Create test users or add yourself as a tester
3. Go to **"App Settings"** → **"Basic"**
4. Set **App Mode** to **"Development"**

Now you can test the OAuth flow with test accounts.

## Step 7: Submit for Review

Once testing is complete:

1. Prepare required assets:
   - **App Icon** (1024x1024px)
   - **Privacy Policy** (hosted on your domain)
   - **Terms of Service** (hosted on your domain)
   - **Screencast** showing permission usage

2. Go to **"App Review"** → **"Permissions and Features"**

3. For each requested permission, provide:
   - **Detailed Description**: Explain how you use the permission
   - **Step-by-Step Instructions**: How reviewers can test it
   - **Screencast**: Video demonstration (max 3 minutes)

4. Submit for review and wait for approval (typically 3-5 business days)

## Step 8: Go Live

After approval:

1. Go to **"Settings"** → **"Basic"**
2. Toggle **App Mode** to **"Live"**
3. Your app is now ready for production!

## Using the Integration

### Connect Facebook

1. In your persona setup, go to **"Social Media Import"**
2. Click **"Connect Facebook"**
3. Authorize the app with your Facebook account
4. Click **"Import Facebook Content"**
5. The app will:
   - Import your posts, photos, and videos
   - Extract memories from content
   - Store everything in the persona's memory bank

### Connect Instagram

1. **Important**: Instagram access requires a **Business Account**
2. Convert your Instagram account to Business:
   - Go to Instagram Settings → Account
   - Switch to Professional Account → Business
   - Connect to a Facebook Page

3. In Alwayz:
   - Click **"Connect Instagram"**
   - Authorize the app
   - Click **"Import Instagram Content"**

## Data Imported

### From Facebook
- Posts (text, images, videos)
- Photos from albums
- Comments and engagement metrics
- Profile information
- Timestamps and metadata

### From Instagram
- Photos and videos
- Captions and hashtags
- Stories (if available)
- Comments and likes
- Profile information

## Memory Extraction

The system automatically:
1. **Analyzes content** using AI (GPT-4 Vision)
2. **Extracts memories** including:
   - Facts about the person
   - Experiences and events
   - Preferences and opinions
   - Relationships mentioned
   - Emotions and sentiments
3. **Creates vector embeddings** for semantic search
4. **Stores in database** with full metadata

## Sync Frequency

- **Initial Import**: All available content (up to API limits)
- **Automatic Sync**: Every 24 hours (configurable)
- **Manual Sync**: Click refresh button anytime

## Troubleshooting

### "App Not Set Up" Error
- Make sure all OAuth redirect URIs are correctly configured
- Verify your app is in Live mode (or you're using a test user)

### "Insufficient Permissions" Error
- Check that required permissions are approved
- Make sure you're requesting the correct scopes in OAuth

### No Data Imported
- Verify the access token is valid (check social_media_connections table)
- Check API rate limits (Facebook: 200 calls/hour/user)
- Ensure the account has public posts/media

### Instagram Not Working
- Confirm you're using an Instagram Business account
- Make sure the Business account is connected to a Facebook Page
- Verify Instagram permissions are approved in App Review

## API Limits

### Facebook Graph API
- **Rate Limit**: 200 calls per hour per user
- **Post Limit**: Last 100 posts per request
- **Photo Limit**: Last 100 photos per request

### Instagram Graph API
- **Rate Limit**: 200 calls per hour per user
- **Media Limit**: Last 100 media items per request

## Security Best Practices

1. **Never commit** App Secret to version control
2. **Use environment variables** for sensitive data
3. **Store access tokens** encrypted in database
4. **Implement token refresh** for long-lived tokens
5. **Request minimum permissions** needed
6. **Handle token expiration** gracefully

## Support

For issues with Meta Graph API:
- [Facebook Developer Documentation](https://developers.facebook.com/docs/graph-api)
- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Meta Developer Support](https://developers.facebook.com/support/)

For Alwayz-specific issues:
- Check the console for detailed error messages
- Review `social_media_connections` table in Supabase
- Check `social_media_sync_jobs` for import status
