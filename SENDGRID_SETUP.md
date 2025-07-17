# Setting Up SendGrid for AlwayZ Email Notifications

This guide will help you set up SendGrid to handle email notifications for your AlwayZ application.

## Step 1: Create a SendGrid Account

1. Go to [SendGrid.com](https://sendgrid.com) and sign up for an account
2. Complete the account verification process

## Step 2: Verify a Sender Identity

Before you can send emails, you need to verify a sender:

1. In the SendGrid dashboard, go to **Settings** → **Sender Authentication**
2. Choose either **Single Sender Verification** or **Domain Authentication**
   - For testing, Single Sender is simpler
   - For production, Domain Authentication is recommended
3. Follow the steps to verify your email or domain

## Step 3: Create an API Key

1. In the SendGrid dashboard, go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it something like "AlwayZ Email Service"
4. Select "Restricted Access" and ensure "Mail Send" permissions are enabled
5. Click **Create & View**
6. Copy your API key (it starts with `SG.`)
7. Add this key to your Supabase Edge Functions environment variables as `SENDGRID_API_KEY`

## Step 4: Configure FROM_EMAIL Environment Variable

1. Add the verified sender email to your Supabase Edge Functions environment variables as `FROM_EMAIL`
2. This should match the email you verified in Step 2

## Step 5: Test Email Sending

You can test your email setup using the Supabase CLI:

```bash
supabase functions invoke send-email --project-ref mzdldixwiedqdfvuuxxi --body '{
  "to": "your-test-email@example.com",
  "subject": "Test Email from AlwayZ",
  "html": "<h1>Hello from AlwayZ!</h1><p>This is a test email.</p>"
}'
```

## Step 6: Create Email Templates (Optional)

For a more professional look:

1. In the SendGrid dashboard, go to **Email API** → **Dynamic Templates**
2. Click **Create Template**
3. Design your templates for:
   - Welcome emails
   - Persona ready notifications
   - Subscription confirmations
4. Note the template IDs for use in your code

## Step 7: Update Your Code (If Using Templates)

If you created templates, update your email service to use them:

```javascript
// In your send-email edge function
const templateId = 'd-your-template-id-from-sendgrid';

// Add to the request body
body: JSON.stringify({
  personalizations: [{
    to: [{ email: to }],
    dynamic_template_data: {
      name: userName,
      // other template variables
    }
  }],
  from: {
    email: Deno.env.get('FROM_EMAIL'),
    name: 'AlwayZ'
  },
  template_id: templateId
})
```

## Step 8: Monitor Email Performance

1. In the SendGrid dashboard, go to **Activity**
2. Here you can monitor:
   - Delivered emails
   - Opens and clicks
   - Bounces and blocks
   - Spam reports

## Troubleshooting

### Emails Not Sending
- Check that your API key has Mail Send permissions
- Verify your sender identity is confirmed
- Check the SendGrid Activity feed for errors

### Emails Going to Spam
- Complete domain authentication
- Ensure your HTML is well-formed
- Follow email best practices (clear unsubscribe, valid content)

### Rate Limiting Issues
- SendGrid free tier has sending limits
- Upgrade your plan if you need higher volume

For more information, see the [SendGrid documentation](https://docs.sendgrid.com/).