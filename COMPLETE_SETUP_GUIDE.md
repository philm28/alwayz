# AlwayZ Complete Setup Guide

This guide will walk you through all the steps needed to get your AlwayZ application fully functional, from database setup to deployment.

## 1. Database Setup

### Create the Supabase Storage Bucket

The file upload error you're seeing is because the required storage bucket doesn't exist yet.

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **New Bucket**
5. Enter the following details:
   - Name: `persona-content` (exactly as shown, case-sensitive)
   - Privacy: **Private** (uncheck "Public bucket")
   - File size limit: 50MB
6. Click **Create bucket**

### Set Up Storage Policies

After creating the bucket, add these security policies:

1. Go to the **Policies** tab in Storage
2. For your `persona-content` bucket, click **New Policy**
3. Add these three policies:

**Policy 1: Upload Permission**
- For: Authenticated users only
- Operation: INSERT
- Policy name: "Users can upload persona content"
- Policy definition:
```sql
bucket_id = 'persona-content' 
AND auth.uid()::text = (storage.foldername(name))[1]
```

**Policy 2: Read Permission**
- For: Authenticated users only
- Operation: SELECT
- Policy name: "Users can read own persona content"
- Policy definition:
```sql
bucket_id = 'persona-content' 
AND auth.uid()::text = (storage.foldername(name))[1]
```

**Policy 3: Delete Permission**
- For: Authenticated users only
- Operation: DELETE
- Policy name: "Users can delete own persona content"
- Policy definition:
```sql
bucket_id = 'persona-content' 
AND auth.uid()::text = (storage.foldername(name))[1]
```

## 2. Database Migration

If you haven't already run the database migration:

1. Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql)
2. Create a new query
3. Copy the entire content from `supabase/migrations/20250626224737_ancient_summit.sql`
4. Run the query to create all necessary tables

## 3. Environment Variables Setup

### For Local Development

Create a `.env` file in your project root with these variables:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
VITE_GA_MEASUREMENT_ID=G-YEJS87M2X8
VITE_SENTRY_DSN=https://0a9b19c9a2f143f3cf9726de55966d3c@o4509578670243840.ingest.us.sentry.io/4509578681253888
VITE_APP_URL=http://localhost:3000
```

### For Netlify Deployment

After deploying to Netlify, add these environment variables in the Netlify dashboard:

1. Go to Site settings → Environment variables
2. Add each variable from your `.env` file
3. Update `VITE_APP_URL` to your Netlify URL
4. Trigger a new deploy after adding variables

## 4. Deployment to Netlify

### Build Your Application

```bash
npm run build
```

### Deploy to Netlify

1. Go to [Netlify](https://app.netlify.com/)
2. Sign up or log in
3. Drag and drop the entire `dist` folder to deploy
   - Important: Upload the whole folder, not just its contents
4. Wait for deployment to complete
5. Set up environment variables as described above
6. Trigger a new deploy after adding variables

## 5. Stripe Setup (For Payments)

1. Create a [Stripe account](https://stripe.com)
2. Get your publishable key from the Stripe dashboard
3. Add it to your environment variables as `VITE_STRIPE_PUBLISHABLE_KEY`
4. Create products and prices in Stripe:

```
# Pro Plan ($29/month)
stripe products create --name="AlwayZ Pro" --description="Professional AI persona features"
stripe prices create --product=prod_XXX --unit-amount=2900 --currency=usd --recurring[interval]=month

# Premium Plan ($99/month)
stripe products create --name="AlwayZ Premium" --description="Premium AI persona features"
stripe prices create --product=prod_XXX --unit-amount=9900 --currency=usd --recurring[interval]=month
```

5. Update the price IDs in your code (src/lib/payments.ts)

## 6. Edge Functions Setup

For full functionality, you need to deploy the Supabase Edge Functions. This requires:

1. A local machine with Git and Supabase CLI installed
2. Download your project files to your local machine
3. Run these commands:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy functions
supabase functions deploy --project-ref YOUR_PROJECT_REF
```

4. Set these environment variables in Supabase:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SENDGRID_API_KEY`
   - `FROM_EMAIL`

## 7. Testing Your Application

After completing the setup:

1. Visit your deployed application
2. Create an account
3. Create a persona
4. Upload training content (now that the storage bucket is set up)
5. Start the AI training simulation
6. Test conversations with your persona

## 8. Troubleshooting Common Issues

### File Upload Errors
- Verify the storage bucket name is exactly `persona-content`
- Check that RLS policies are correctly set up
- Ensure file size is under 50MB

### Database Connection Issues
- Verify Supabase URL and anon key are correct
- Check that the migration has been run
- Test connection in the Database Setup page

### Authentication Problems
- Check browser console for specific errors
- Verify Supabase authentication is properly configured
- Clear browser cache and try again

### Deployment Issues
- Make sure you're uploading the entire `dist` folder
- Verify all environment variables are set in Netlify
- Check Netlify deploy logs for errors

## Next Steps

Once your application is fully functional:

1. **Customize content**: Update text, images, and branding
2. **Add real AI integration**: Connect to OpenAI or other AI services
3. **Set up email notifications**: Configure SendGrid for emails
4. **Monitor usage**: Track analytics and error rates
5. **Gather feedback**: Test with real users and iterate

Congratulations! Your AlwayZ application should now be fully functional and ready for use.