# 🚀 Complete AlwayZ Deployment Guide

## Overview
We'll deploy your AlwayZ application in 6 main steps:
1. Pre-deployment verification
2. Build the application
3. Deploy to Netlify (Drag & Drop method)
4. Configure environment variables
5. Set up Supabase edge functions
6. Final testing

Let's go through each step!

---

## Step 1: Pre-Deployment Verification

First, let's make sure everything is ready:

```bash
# Check if everything is configured
node verify-deployment.js
```

This will check:
- ✅ Environment variables are set
- ✅ Build system is ready
- ✅ All required files exist

---

## Step 2: Build Your Application

```bash
# Use the automated deployment script
./deploy.sh
```

Or manually:

```bash
# Install any missing dependencies
npm install

# Run type checking to catch errors
npm run type-check

# Run linting to ensure code quality
npm run lint

# Build for production
npm run build

# Test the build locally (optional)
npm run preview
```

After `npm run build`, you'll have a `dist` folder with your production-ready files.

---

## Step 3: Deploy to Netlify (Drag & Drop Method)

**Note:** We use the drag & drop method because Git is not available in WebContainer.

### Drag & Drop Deployment

1. **Go to Netlify**: Open [netlify.com](https://netlify.com) in your browser
2. **Sign up/Login**: Create account or sign in
3. **Deploy**: Look for the deploy area that says "Want to deploy a new site without connecting to Git? Drag and drop your site output folder here"
4. **Drag the `dist` folder**: Drag your entire `dist` folder onto this area
5. **Wait**: Netlify will upload and deploy (usually takes 1-2 minutes)
6. **Get your URL**: You'll get a URL like `https://amazing-name-123456.netlify.app`

### Alternative: Netlify CLI (For Local Development Only)

If you're working on a local machine with Git installed:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

---

## Step 4: Configure Environment Variables in Netlify

After deployment, you need to add your environment variables:

1. **Go to Site Settings**: In your Netlify dashboard, click on your site, then "Site settings"
2. **Environment Variables**: Click "Environment variables" in the left sidebar
3. **Add Variables**: Click "Add variable" and add each of these:

```
VITE_SUPABASE_URL=https://mzdldixwiedqdfvuuxxi.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
VITE_GA_MEASUREMENT_ID=G-YEJS87M2X8
VITE_SENTRY_DSN=https://0a9b19c9a2f143f3cf9726de55966d3c@o4509578670243840.ingest.us.sentry.io/4509578681253888
VITE_APP_URL=https://your-site-name.netlify.app
```

**Important**: Replace `your-site-name.netlify.app` with your actual Netlify URL!

4. **Redeploy**: After adding variables, click "Trigger deploy" to rebuild with the new environment variables

---

## Step 5: Set Up Supabase Edge Functions

### 5.1: Configure Environment Variables in Supabase

1. **Go to Supabase Dashboard**: [supabase.com/dashboard/project/mzdldixwiedqdfvuuxxi](https://supabase.com/dashboard/project/mzdldixwiedqdfvuuxxi)
2. **Edge Functions**: Click "Edge Functions" in the left sidebar
3. **Settings**: Look for environment variables or settings
4. **Add these variables**:

```
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SENDGRID_API_KEY=SG.your_sendgrid_api_key
FROM_EMAIL=noreply@alwayz.app
```

### 5.2: Deploy Edge Functions

**Note:** Edge function deployment requires the Supabase CLI on a local machine with Git.

The edge functions are already written in your `supabase/functions/` folder. To deploy them:

1. **Download project to local machine** (if working in WebContainer)
2. **Install Supabase CLI** on your local machine:
   ```bash
   npm install -g supabase
   ```

3. **Login to Supabase**:
   ```bash
   supabase login
   ```

4. **Deploy Functions**:
   ```bash
   supabase functions deploy --project-ref mzdldixwiedqdfvuuxxi
   ```

---

## Step 6: Set Up Stripe Webhooks

1. **Go to Stripe Dashboard**: [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Webhooks**: Go to "Developers" → "Webhooks"
3. **Add Endpoint**: Click "Add endpoint"
4. **Endpoint URL**: `https://mzdldixwiedqdfvuuxxi.supabase.co/functions/v1/stripe-webhook`
5. **Events**: Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
6. **Save**: Click "Add endpoint"
7. **Get Webhook Secret**: Copy the webhook secret and add it to your Supabase environment variables

---

## Step 7: Final Testing

Test these key features on your deployed site:

### 7.1: Basic Functionality
- [ ] Website loads correctly
- [ ] User registration works
- [ ] User login works
- [ ] Database connection works

### 7.2: Core Features
- [ ] Create a persona
- [ ] Upload content
- [ ] Start a conversation
- [ ] Analytics tracking

### 7.3: Payment System (if configured)
- [ ] Subscription upgrade flow
- [ ] Payment processing
- [ ] Webhook handling

---

## Step 8: Custom Domain (Optional)

If you want to use your own domain:

1. **Buy a Domain**: From any domain registrar
2. **Add to Netlify**: In site settings, go to "Domain management"
3. **Add Custom Domain**: Enter your domain
4. **Update DNS**: Point your domain to Netlify (they'll give you instructions)
5. **SSL**: Netlify automatically provides SSL certificates

---

## Troubleshooting

### Common Issues:

1. **Build Fails**:
   - Check `npm run type-check` for TypeScript errors
   - Ensure all environment variables are set

2. **Site Loads but Features Don't Work**:
   - Check browser console for errors
   - Verify environment variables in Netlify
   - Check Supabase connection

3. **Database Errors**:
   - Verify migration ran successfully
   - Check RLS policies are enabled
   - Confirm Supabase keys are correct

4. **Payment Issues**:
   - Verify Stripe keys
   - Check webhook configuration
   - Test in Stripe dashboard

5. **Git Not Available**:
   - Use drag & drop deployment method
   - Download files to local machine for Git-based workflows

---

## Success! 🎉

Once everything is working:

1. **Monitor**: Check your analytics and error monitoring
2. **Test**: Have friends/family test the application
3. **Iterate**: Make improvements based on feedback
4. **Scale**: Monitor usage and upgrade as needed

Your AlwayZ application is now live and ready to help people preserve precious memories! 

---

## Quick Reference

- **Your Site**: https://your-site-name.netlify.app
- **Supabase Dashboard**: https://supabase.com/dashboard/project/mzdldixwiedqdfvuuxxi
- **Netlify Dashboard**: https://app.netlify.com
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Analytics**: https://analytics.google.com (ID: G-YEJS87M2X8)
- **Error Monitoring**: https://sentry.io

## Environment Limitations

- **WebContainer**: Git is not available, use drag & drop deployment
- **Local Development**: Full Git and CLI functionality available
- **Edge Functions**: Require local deployment with Supabase CLI