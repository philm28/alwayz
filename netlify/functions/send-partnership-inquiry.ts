import { Handler } from '@netlify/functions';

const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID;
const authToken = process.env.VITE_TWILIO_AUTH_TOKEN;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { to, inquiry } = JSON.parse(event.body || '{}');

    if (!inquiry) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing inquiry data' })
      };
    }

    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

    if (!SENDGRID_API_KEY) {
      // Fallback — log it and return success so form still works
      console.log('New partnership inquiry:', JSON.stringify(inquiry, null, 2));
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, method: 'logged' })
      };
    }

    const emailBody = `
New AlwayZ Partnership Inquiry
===============================

Partnership Type: ${inquiry.partnership_type?.toUpperCase()}
Name: ${inquiry.name}
Title: ${inquiry.title}
Organization: ${inquiry.organization}
Email: ${inquiry.email}
Phone: ${inquiry.phone || 'Not provided'}
Specialty: ${inquiry.specialty || 'Not provided'}
Location: ${inquiry.city || ''}, ${inquiry.state || ''} ${inquiry.zip_code || ''}

Message:
${inquiry.message || 'No message provided'}

===============================
Submitted via AlwayZ Clinical Partnerships
    `.trim();

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to || 'phil@gomangoai.com' }],
          subject: `🏥 New ${inquiry.partnership_type} Partner Inquiry — ${inquiry.name} at ${inquiry.organization}`
        }],
        from: { email: 'noreply@alwayz.netlify.app', name: 'AlwayZ Clinical' },
        content: [{
          type: 'text/plain',
          value: emailBody
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('SendGrid error:', error);
      // Still return success — inquiry is saved to Supabase
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, method: 'supabase_only' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, method: 'email' })
    };

  } catch (error) {
    console.error('Partnership inquiry function error:', error);
    // Return success anyway — Supabase already saved it
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, method: 'supabase_only' })
    };
  }
};
