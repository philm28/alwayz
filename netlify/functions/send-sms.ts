import { Handler } from '@netlify/functions';

const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID;
const authToken = process.env.VITE_TWILIO_AUTH_TOKEN;
const fromNumber = process.env.VITE_TWILIO_PHONE_NUMBER;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { to, message } = JSON.parse(event.body || '{}');

    if (!to || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing to or message' })
      };
    }

    if (!accountSid || !authToken || !fromNumber) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Twilio credentials not configured' })
      };
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: to,
          Body: message
        }).toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.message || 'Failed to send SMS' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, sid: data.sid })
    };

  } catch (error) {
    console.error('SMS function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
