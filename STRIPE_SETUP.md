# Setting Up Stripe for AlwayZ Payments

This guide will help you set up Stripe for handling subscriptions and payments in your AlwayZ application.

## Step 1: Create a Stripe Account

1. Go to [Stripe.com](https://stripe.com) and sign up or log in
2. Make sure you're in test mode initially (toggle in the dashboard)

## Step 2: Get API Keys

1. In the Stripe dashboard, go to **Developers** → **API keys**
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Add the publishable key to your Netlify environment variables as `VITE_STRIPE_PUBLISHABLE_KEY`
5. Add the secret key to your Supabase Edge Functions environment variables as `STRIPE_SECRET_KEY`

## Step 3: Create Products and Prices

Create the subscription plans defined in your application:

### Pro Plan ($29/month)
```bash
# Using Stripe CLI (if available)
stripe products create --name="AlwayZ Pro" --description="Professional AI persona features"
# Note the product ID returned (prod_XYZ)
stripe prices create --product=prod_XYZ --unit-amount=2900 --currency=usd --recurring[interval]=month
# Note the price ID returned (price_XYZ) - this is your "price_pro_monthly"
```

### Premium Plan ($99/month)
```bash
stripe products create --name="AlwayZ Premium" --description="Premium AI persona features"
# Note the product ID returned (prod_ABC)
stripe prices create --product=prod_ABC --unit-amount=9900 --currency=usd --recurring[interval]=month
# Note the price ID returned (price_ABC) - this is your "price_premium_monthly"
```

If you don't have the Stripe CLI, you can create these in the Stripe Dashboard:
1. Go to **Products** → **Add Product**
2. Fill in the details and add a price

## Step 4: Update Price IDs in Your Code

In your application, update the price IDs in `src/lib/payments.ts` to match the ones you created:

```javascript
// Find these lines in your code and update them
stripePriceId: 'price_pro_monthly'     // Replace with your actual price ID
stripePriceId: 'price_premium_monthly' // Replace with your actual price ID
```

## Step 5: Set Up Webhooks

1. In the Stripe dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL: `https://mzdldixwiedqdfvuuxxi.supabase.co/functions/v1/stripe-webhook`
4. Select these events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. After creating, reveal the signing secret
7. Add this secret to your Supabase Edge Functions environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 6: Test the Payment Flow

1. Deploy your application with the updated environment variables
2. Log in to your application
3. Go to the Subscription page
4. Click "Upgrade to Pro"
5. You should be redirected to the Stripe Checkout page
6. Use Stripe's test card: `4242 4242 4242 4242` with any future expiry date and any CVC
7. Complete the checkout
8. Verify you're redirected back to your application
9. Check that your subscription status updates

## Step 7: Go Live with Stripe (When Ready)

When you're ready to accept real payments:

1. Complete Stripe's onboarding process
2. Switch from test to live mode in the Stripe dashboard
3. Update your API keys to the live versions
4. Update your webhook endpoints to use live mode
5. Test the entire flow with a real card and a small amount

## Troubleshooting

### Webhook Issues
- Check the Stripe dashboard for webhook delivery attempts
- Verify your webhook URL is correct
- Check that your webhook secret is correctly set in Supabase

### Payment Flow Issues
- Check browser console for errors
- Verify environment variables are set correctly
- Check Stripe dashboard logs for failed payment attempts

### Subscription Not Updating
- Check the Supabase database for subscription records
- Verify the webhook is receiving events
- Check the edge function logs for errors

For more information, see the [Stripe API documentation](https://stripe.com/docs/api).