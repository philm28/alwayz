# Setting Up Supabase Edge Functions for AlwayZ

Supabase Edge Functions are serverless functions that run close to your users. Your AlwayZ application uses these for payment processing, email sending, and more.

## Prerequisites

- Local machine with Git installed
- Supabase CLI installed
- Node.js 16+ installed

## Step 1: Download Your Project Files

Since you're working in WebContainer which doesn't have Git, you'll need to:

1. Download your project files to your local machine
2. Set up the Supabase CLI on your local machine

## Step 2: Install Supabase CLI

```bash
# Install Supabase CLI globally
npm install -g supabase

# Verify installation
supabase --version
```

## Step 3: Login to Supabase

```bash
supabase login
```

This will open a browser window where you can authenticate with your Supabase account.

## Step 4: Deploy Edge Functions

Navigate to your project directory on your local machine and run:

```bash
# Deploy all functions
supabase functions deploy --project-ref mzdldixwiedqdfvuuxxi
```

This will deploy all functions in the `supabase/functions/` directory:
- `create-checkout-session` - For Stripe checkout
- `create-portal-session` - For Stripe customer portal
- `send-email` - For email notifications
- `social-media-scraper` - For importing social media content
- `stripe-webhook` - For handling Stripe events

## Step 5: Set Environment Variables for Edge Functions

In the Supabase dashboard:

1. Go to **Project Settings** → **API**
2. Scroll down to **Edge Functions**
3. Click on **Environment Variables**
4. Add the following variables:

```
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SENDGRID_API_KEY=SG.your_sendgrid_api_key
FROM_EMAIL=noreply@alwayz.app
```

## Step 6: Test Edge Functions

You can test your deployed functions using the Supabase CLI:

```bash
# Test the send-email function
supabase functions invoke send-email --project-ref mzdldixwiedqdfvuuxxi --body '{"to":"test@example.com","subject":"Test Email","html":"<p>This is a test</p>"}'
```

## Step 7: Set Up Stripe Webhooks

1. Go to the [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter your webhook URL: `https://mzdldixwiedqdfvuuxxi.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Get your webhook signing secret and add it to your Supabase environment variables

## Troubleshooting

- **Function deployment fails**: Check your Supabase CLI version and login status
- **Function execution fails**: Check environment variables and permissions
- **Webhook not receiving events**: Verify the webhook URL and signing secret

For more information, see the [Supabase Edge Functions documentation](https://supabase.com/docs/guides/functions).