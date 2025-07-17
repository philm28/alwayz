# Setting Up Environment Variables in Netlify for AlwayZ

This guide will help you properly configure the environment variables in your Netlify deployment to ensure your AlwayZ application connects correctly to Supabase.

## Required Environment Variables

These variables **must** be set for your application to work properly:

| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://mzdldixwiedqdfvuuxxi.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZGxkaXh3aWVkcWRmdnV1eHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5Nzg5NzAsImV4cCI6MjA2NjU1NDk3MH0.SrPUb4xe95zJl6qjdrw3uJz24IL_bmg5J6lj8KMSfaM` |
| `VITE_APP_URL` | Your deployed application URL | `https://your-site-name.netlify.app` |

## Optional Environment Variables

These enhance functionality but aren't strictly required:

| Variable Name | Description |
|---------------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | For payment processing |
| `VITE_GA_MEASUREMENT_ID` | For Google Analytics |
| `VITE_SENTRY_DSN` | For error tracking |
| `VITE_OPENAI_API_KEY` | For AI functionality |

## Step-by-Step Instructions

### 1. Find Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Project Settings → API
4. Copy the URL and anon key from the "Project API keys" section

### 2. Add Variables to Netlify

1. Go to your [Netlify Dashboard](https://app.netlify.com/)
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add variable** for each variable
5. Enter the variable name and value exactly as shown above
6. Click **Save**

### 3. Redeploy Your Site

After adding environment variables:

1. Go to the **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Wait for the deployment to complete

### 4. Verify Connection

1. Visit your deployed site
2. Go to the "Connection Test" page
3. Click "Test" to verify Supabase connection
4. If successful, you'll see "Connected successfully"

## Troubleshooting

### Connection Fails

If the connection test fails, check:

1. **Variable Names**: Ensure they're exactly as shown (including `VITE_` prefix)
2. **Variable Values**: Check for typos in your Supabase URL and key
3. **Redeploy**: Make sure you've redeployed after adding variables
4. **Browser Console**: Check for specific error messages

### Common Errors

- **"Failed to fetch"**: Network error or incorrect Supabase URL
- **"Invalid API key"**: Incorrect anon key format or value
- **"Not found"**: Supabase project may not exist or URL is wrong

### Still Having Issues?

1. Try clearing your browser cache
2. Verify your Supabase project is active
3. Check if your IP is blocked by Supabase
4. Ensure your Supabase project has the necessary tables created

## Next Steps

Once your connection is working:

1. Test user registration and login
2. Create a persona and upload content
3. Verify file uploads work correctly
4. Test the AI training simulation

Remember to check the "Database Setup" page to ensure all required tables are created in your Supabase project.