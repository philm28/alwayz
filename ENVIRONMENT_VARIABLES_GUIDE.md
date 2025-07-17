# Environment Variables Guide for AlwayZ

This guide explains all the environment variables used in the AlwayZ application and how to set them up in different environments.

## Local Development Environment

For local development, create a `.env` file in the root of your project with the following variables:

```
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenAI Configuration (Optional)
VITE_OPENAI_API_KEY=your_openai_api_key

# Stripe Configuration (Optional)
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Analytics & Monitoring (Optional)
VITE_GA_MEASUREMENT_ID=your_google_analytics_id
VITE_SENTRY_DSN=your_sentry_dsn

# Application Configuration
VITE_APP_URL=http://localhost:3000
```

## Netlify Deployment Environment

When deploying to Netlify, add these environment variables in the Netlify dashboard:

1. Go to your site in Netlify
2. Navigate to **Site settings** → **Environment variables**
3. Add each variable with the same names as above
4. Update `VITE_APP_URL` to your Netlify URL (e.g., `https://your-site-name.netlify.app`)
5. Click **Save** and trigger a new deploy

## Required vs. Optional Variables

### Required Variables
These must be set for basic functionality:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Optional Variables
These enable additional features:
- `VITE_OPENAI_API_KEY`: Enables real AI responses (without this, responses are simulated)
- `VITE_STRIPE_PUBLISHABLE_KEY`: Enables payment processing
- `VITE_GA_MEASUREMENT_ID`: Enables Google Analytics
- `VITE_SENTRY_DSN`: Enables error tracking
- `VITE_APP_URL`: Used for generating links in emails and redirects

## Finding Your Variable Values

### Supabase Variables
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Project Settings → API
4. Copy the URL and anon key

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with "sk-")

### Stripe Publishable Key
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy the publishable key (starts with "pk_")

### Google Analytics Measurement ID
1. Go to [Google Analytics](https://analytics.google.com)
2. Navigate to Admin → Data Streams → Web
3. Copy the Measurement ID (starts with "G-")

### Sentry DSN
1. Go to [Sentry](https://sentry.io)
2. Navigate to Projects → Your Project → Settings → Client Keys (DSN)
3. Copy the DSN

## Troubleshooting

If your application isn't working correctly after setting environment variables:

1. **Verify variable names**: Make sure there are no typos in variable names
2. **Check for missing values**: Ensure all required variables have values
3. **Rebuild after changes**: Always trigger a new deploy after changing variables
4. **Check browser console**: Look for errors related to missing environment variables
5. **Verify quotation marks**: Don't use quotes around values in the Netlify interface

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys secure and don't expose them in client-side code
- Regularly rotate sensitive keys like Stripe and OpenAI