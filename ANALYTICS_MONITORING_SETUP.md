# Setting Up Analytics and Monitoring for AlwayZ

This guide will help you set up analytics and error monitoring for your AlwayZ application.

## Google Analytics Setup

### Step 1: Create a Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in with your Google account
3. Click **Admin** → **Create Account**
4. Fill in the account details and click **Next**
5. Choose **Web** as the platform
6. Enter your website details:
   - Website name: AlwayZ
   - Website URL: Your Netlify URL
   - Industry category: Software
7. Click **Create**

### Step 2: Get Your Measurement ID

1. After creating your property, go to **Data Streams**
2. Click on your web stream
3. Copy the **Measurement ID** (starts with G-)
4. Add this ID to your Netlify environment variables as `VITE_GA_MEASUREMENT_ID`

### Step 3: Verify Installation

1. Deploy your site with the updated environment variable
2. Visit your site
3. Go to Google Analytics → **Realtime** report
4. You should see your visit recorded

## Sentry Error Monitoring

### Step 1: Create a Sentry Account

1. Go to [Sentry.io](https://sentry.io) and sign up
2. Create a new project
3. Select **React** as the platform

### Step 2: Get Your DSN

1. After creating the project, you'll be shown a DSN (Data Source Name)
2. Copy this DSN
3. Add it to your Netlify environment variables as `VITE_SENTRY_DSN`

### Step 3: Verify Installation

1. Deploy your site with the updated environment variable
2. Visit your site
3. To test error tracking, you can temporarily add this code to your app:
   ```javascript
   // Add this somewhere in your code to test Sentry
   setTimeout(() => {
     throw new Error("Test error for Sentry");
   }, 5000);
   ```
4. Check your Sentry dashboard to see if the error was captured

## Performance Monitoring

Your AlwayZ application already includes the `PerformanceMonitor` component which tracks:

- Core Web Vitals (LCP, FID, CLS)
- Page load times
- Memory usage
- Network conditions

This data is sent to Sentry if configured, giving you insights into your application's performance.

## Custom Event Tracking

Your application is set up to track important events:

- User sign-ups
- Persona creation
- Conversation starts
- Subscription upgrades
- Feature usage

These events are sent to Google Analytics, allowing you to understand how users interact with your application.

## Monitoring Dashboard Setup

For a comprehensive monitoring solution:

1. **Google Analytics Dashboard**:
   - Create custom reports for user engagement
   - Set up conversion goals for key actions
   - Configure alerts for traffic drops

2. **Sentry Dashboard**:
   - Set up alert rules for critical errors
   - Configure issue assignment
   - Integrate with your communication tools (Slack, etc.)

3. **Uptime Monitoring**:
   - Consider adding a service like [UptimeRobot](https://uptimerobot.com/) (free tier available)
   - Monitor your Netlify URL and Supabase endpoints

## Troubleshooting

### Analytics Not Recording
- Check that your Measurement ID is correct
- Verify that adblockers aren't preventing tracking
- Look for console errors related to analytics

### Sentry Not Capturing Errors
- Verify your DSN is correct
- Check browser console for Sentry initialization errors
- Ensure your security policies allow Sentry connections

For more information, see:
- [Google Analytics Documentation](https://developers.google.com/analytics)
- [Sentry Documentation](https://docs.sentry.io/)