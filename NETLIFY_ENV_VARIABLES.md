# Setting Up Environment Variables in Netlify

After deploying your AlwayZ application to Netlify, you need to configure the environment variables for your application to function properly.

## Required Environment Variables

Add these variables in your Netlify dashboard:

| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://mzdldixwiedqdfvuuxxi.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Your Stripe publishable key | `pk_test_51NXYZabcdef...` |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics ID | `G-YEJS87M2X8` |
| `VITE_SENTRY_DSN` | Sentry error tracking DSN | `https://0a9b19c9a2f143f3cf9726de55966d3c@o4509578670243840.ingest.us.sentry.io/4509578681253888` |
| `VITE_APP_URL` | Your deployed application URL | `https://your-site-name.netlify.app` |

## How to Add Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Click on **Site settings**
4. In the left sidebar, click on **Environment variables**
5. Click **Add variable** for each variable you need to add
6. Enter the variable name and value
7. Click **Save**

## After Adding Variables

After adding all environment variables:

1. Go back to the **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. This will rebuild your site with the new environment variables

## Verifying Environment Variables

To verify your environment variables are working:

1. Visit your deployed site
2. Open browser developer tools (F12)
3. Go to the Console tab
4. Check for any errors related to missing environment variables

If you see errors like "Cannot read property of undefined" related to environment variables, double-check your variable names and values in the Netlify dashboard.