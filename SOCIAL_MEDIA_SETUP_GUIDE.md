# Setting Up Social Media Import for AlwayZ

This guide will help you configure OAuth applications for each social media platform to enable automatic content import for training AI personas.

## Overview

The social media import feature allows users to automatically gather content from their loved one's social media profiles to train AI personas. This requires setting up OAuth applications with each platform.

## Required OAuth Apps

You'll need to create developer applications for each platform you want to support:

### 1. Facebook/Meta Developer App

1. **Create App**:
   - Go to [developers.facebook.com](https://developers.facebook.com/)
   - Click "Create App" → "Consumer" → "Next"
   - App name: "AlwayZ Memory Preservation"
   - Contact email: Your email
   - Click "Create App"

2. **Configure App**:
   - Add "Facebook Login" product
   - In Facebook Login settings:
     - Valid OAuth Redirect URIs: `https://your-site.netlify.app/oauth/callback`
     - Deauthorize Callback URL: `https://your-site.netlify.app/oauth/deauthorize`
   - Request permissions: `public_profile`, `user_posts`, `user_photos`

3. **Get Credentials**:
   - Go to Settings → Basic
   - Copy App ID and App Secret
   - Add to environment variables:
     - `VITE_FACEBOOK_CLIENT_ID=your_app_id`
     - `FACEBOOK_CLIENT_SECRET=your_app_secret` (Supabase Edge Functions)

### 2. Instagram Basic Display API

1. **Use Facebook App**:
   - Instagram uses the same Facebook Developer account
   - Add "Instagram Basic Display" product to your Facebook app

2. **Configure**:
   - Valid OAuth Redirect URIs: `https://your-site.netlify.app/oauth/callback`
   - Deauthorize Callback URL: `https://your-site.netlify.app/oauth/deauthorize`
   - Test Users: Add Instagram accounts for testing

3. **Permissions**:
   - `user_profile`: Basic profile info
   - `user_media`: Access to photos and videos

### 3. Twitter/X API v2

1. **Create App**:
   - Go to [developer.twitter.com](https://developer.twitter.com/)
   - Apply for developer account
   - Create new app: "AlwayZ Memory Import"

2. **Configure OAuth 2.0**:
   - App permissions: Read
   - Type of App: Web App
   - Callback URI: `https://your-site.netlify.app/oauth/callback`
   - Website URL: `https://your-site.netlify.app`

3. **Get Credentials**:
   - Copy Client ID and Client Secret
   - Add to environment variables:
     - `VITE_TWITTER_CLIENT_ID=your_client_id`
     - `TWITTER_CLIENT_SECRET=your_client_secret`

### 4. LinkedIn API

1. **Create App**:
   - Go to [developer.linkedin.com](https://developer.linkedin.com/)
   - Create new app
   - App name: "AlwayZ Memory Preservation"
   - Company: Your company/personal

2. **Configure**:
   - Redirect URLs: `https://your-site.netlify.app/oauth/callback`
   - Request access to: `r_liteprofile`, `r_emailaddress`, `w_member_social`

3. **Get Credentials**:
   - Copy Client ID and Client Secret
   - Add to environment variables

### 5. YouTube Data API

1. **Google Cloud Console**:
   - Go to [console.cloud.google.com](https://console.cloud.google.com/)
   - Create new project: "AlwayZ Social Import"
   - Enable YouTube Data API v3

2. **Create OAuth Credentials**:
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `https://your-site.netlify.app/oauth/callback`

3. **Get Credentials**:
   - Copy Client ID and Client Secret
   - Add to environment variables:
     - `VITE_GOOGLE_CLIENT_ID=your_client_id`
     - `GOOGLE_CLIENT_SECRET=your_client_secret`

## Environment Variables Setup

### Netlify Environment Variables

Add these to your Netlify site settings:

```
# Social Media OAuth Client IDs (Public)
VITE_FACEBOOK_CLIENT_ID=your_facebook_app_id
VITE_INSTAGRAM_CLIENT_ID=your_instagram_client_id
VITE_TWITTER_CLIENT_ID=your_twitter_client_id
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Supabase Edge Functions Environment Variables

Add these to your Supabase dashboard (Project Settings → Edge Functions → Environment Variables):

```
# Social Media OAuth Client Secrets (Private)
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret
TWITTER_CLIENT_SECRET=your_twitter_client_secret
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Testing the Integration

1. **Deploy with Environment Variables**:
   - Add all client IDs to Netlify
   - Redeploy your site

2. **Test OAuth Flow**:
   - Create a persona
   - Go to "Setup Training" → "Social Media Import"
   - Try connecting to a platform
   - You should be redirected to the platform's OAuth page

3. **Verify Data Import**:
   - Complete OAuth flow
   - Check that content is imported and saved to your database

## Security Considerations

- **Client Secrets**: Never expose these in client-side code
- **Scopes**: Only request minimum necessary permissions
- **Data Handling**: Ensure compliance with platform terms of service
- **User Consent**: Always get explicit user permission before importing

## Platform-Specific Notes

### Facebook/Instagram
- Requires app review for production use
- Limited to 100 users in development mode
- Must comply with Facebook Platform Policy

### Twitter/X
- Free tier has rate limits
- May require approval for certain endpoints
- Check current API pricing

### LinkedIn
- Requires partnership for some data access
- Limited to basic profile and posts
- Review LinkedIn API terms

### YouTube
- Quota limits apply
- Requires Google Cloud billing account for production
- Must comply with YouTube API terms

## Troubleshooting

### OAuth Redirect Issues
- Verify redirect URIs match exactly (including https://)
- Check that your domain is properly configured
- Ensure OAuth apps are in correct mode (development vs production)

### Permission Denied Errors
- Check that your app has requested the correct scopes
- Verify the user has granted necessary permissions
- Some platforms require app review for certain permissions

### Rate Limiting
- Implement proper rate limiting in your edge functions
- Cache responses when possible
- Monitor API usage in platform dashboards

## Alternative: Manual Content Upload

If OAuth setup is complex, users can always:
- Download their social media data manually
- Upload files directly through the file upload interface
- Import content from exported data files

This provides a fallback option while you set up the automated import features.

## Next Steps

1. Choose which platforms to support initially (recommend starting with 1-2)
2. Create developer accounts and apps
3. Add environment variables to Netlify and Supabase
4. Test the OAuth flow
5. Gradually add more platforms based on user demand

The social media import feature will significantly enhance the training data available for AI personas, making conversations more authentic and personalized!