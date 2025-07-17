# 🚀 Fixing Blank Page on Netlify Deployment

## The Problem

You're seeing a blank page when visiting your deployed site. This is likely due to one of these common issues:

1. **Missing environment variables** - The app can't connect to Supabase
2. **Incorrect deployment method** - The site files weren't uploaded correctly
3. **Path issues** - Vite's asset paths might not be configured correctly

## Solution 1: Add Environment Variables

1. Go to your [Netlify Dashboard](https://app.netlify.com/)
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add these required variables:

```
VITE_SUPABASE_URL=https://mzdldixwiedqdfvuuxxi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZGxkaXh3aWVkcWRmdnV1eHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5Nzg5NzAsImV4cCI6MjA2NjU1NDk3MH0.SrPUb4xe95zJl6qjdrw3uJz24IL_bmg5J6lj8KMSfaM
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key_here
VITE_GA_MEASUREMENT_ID=G-YEJS87M2X8
VITE_SENTRY_DSN=https://0a9b19c9a2f143f3cf9726de55966d3c@o4509578670243840.ingest.us.sentry.io/4509578681253888
VITE_APP_URL=https://hilarious-salmiakki-ca98ab.netlify.app
```

5. After adding variables, go to **Deploys** and click **Trigger deploy** → **Deploy site**

## Solution 2: Redeploy Using the Correct Method

If adding environment variables doesn't fix the issue:

1. Run a fresh build locally:
   ```bash
   npm run build
   ```

2. **Important**: Upload the ENTIRE `dist` folder to Netlify, not just its contents
   - Go to [Netlify Drop](https://app.netlify.com/drop)
   - Drag and drop the whole `dist` folder (not individual files)

3. After deployment, add the environment variables as described above

## Solution 3: Add a Netlify Configuration File

Create a `netlify.toml` file in your project root:

```toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Then rebuild and redeploy.

## Solution 4: Check for Console Errors

1. Visit your deployed site
2. Open browser developer tools (F12)
3. Go to the Console tab
4. Look for any error messages
   - If you see "Invalid API key" errors, fix your environment variables
   - If you see 404 errors for assets, check your deployment method

## Need More Help?

If you're still seeing a blank page after trying these solutions:

1. Check the Netlify deployment logs for errors
2. Verify your Supabase project is active and accessible
3. Test your application locally with the same environment variables
4. Consider creating a new Netlify site and deploying from scratch

For more detailed help, see [Netlify's troubleshooting guide](https://docs.netlify.com/site-deploys/troubleshooting-tips/).