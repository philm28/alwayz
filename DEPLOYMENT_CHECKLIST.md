# 🚀 AlwayZ Production Deployment Checklist

## Pre-Deployment Verification

### 1. Environment Variables Check
- [x] Supabase URL and keys configured
- [x] Stripe publishable key set
- [x] SendGrid API key ready
- [x] Sentry DSN configured
- [x] Google Analytics ID set

### 2. Database Setup
- [ ] Run database migration in Supabase
- [ ] Verify RLS policies are active
- [ ] Test database connections

### 3. Edge Functions Setup
- [ ] Deploy Supabase edge functions
- [ ] Configure environment variables in Supabase dashboard
- [ ] Test webhook endpoints

## Deployment Steps

### Step 1: Prepare for Deployment
```bash
# 1. Install dependencies
npm install

# 2. Run type checking
npm run type-check

# 3. Run linting
npm run lint

# 4. Build for production
npm run build

# 5. Test the build locally
npm run preview
```

### Step 2: Deploy Database Migration
1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/mzdldixwiedqdfvuuxxi/sql)
2. Copy the migration from `supabase/migrations/20250626224737_ancient_summit.sql`
3. Run the migration
4. Verify tables are created

### Step 3: Configure Supabase Edge Functions
Set these environment variables in your Supabase dashboard:
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret
- `SENDGRID_API_KEY`: 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
- `FROM_EMAIL`: noreply@alwayz.app

### Step 4: Deploy to Netlify

#### Option A: Drag & Drop (Quickest)
1. Run `npm run build`
2. Go to [Netlify](https://netlify.com)
3. Drag the `dist` folder to deploy

#### Option B: Git Integration (Recommended)
1. Push code to GitHub
2. Connect repository to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables in Netlify dashboard

### Step 5: Configure Custom Domain (Optional)
1. Add your domain in Netlify DNS settings
2. Update `VITE_APP_URL` in environment variables
3. SSL certificates are automatic

### Step 6: Final Testing
- [ ] Test user registration
- [ ] Test persona creation
- [ ] Test payment flow
- [ ] Test email delivery
- [ ] Verify analytics tracking
- [ ] Check error monitoring

## Post-Deployment Monitoring

### Analytics Dashboard
- Google Analytics: [analytics.google.com](https://analytics.google.com)
- Measurement ID: G-YEJS87M2X8

### Error Monitoring
- Sentry Dashboard: [sentry.io](https://sentry.io)
- DSN: https://0a9b19c9a2f143f3cf9726de55966d3c@o4509578670243840.ingest.us.sentry.io/4509578681253888

### Payment Monitoring
- Stripe Dashboard: [dashboard.stripe.com](https://dashboard.stripe.com)

## Troubleshooting

### Common Issues
1. **Build Errors**: Check TypeScript errors with `npm run type-check`
2. **Environment Variables**: Ensure all required vars are set
3. **Database Connection**: Verify Supabase URL and keys
4. **Payment Issues**: Check Stripe webhook configuration

### Support Resources
- Supabase Docs: [supabase.com/docs](https://supabase.com/docs)
- Netlify Docs: [docs.netlify.com](https://docs.netlify.com)
- Stripe Docs: [stripe.com/docs](https://stripe.com/docs)