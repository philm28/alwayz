import { schedule } from '@netlify/functions';

const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID;
const authToken = process.env.VITE_TWILIO_AUTH_TOKEN;
const fromNumber = process.env.VITE_TWILIO_PHONE_NUMBER;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// ✅ Runs every day at 9am UTC
export const handler = schedule('0 9 * * *', async () => {
  console.log('Checking for legacy letters to send...');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all letters scheduled for today
    const response = await fetch(
      `${supabaseUrl}/rest/v1/legacy_letters?scheduled_date=eq.${today}&status=eq.scheduled&select=*`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const letters = await response.json();

    if (!letters || letters.length === 0) {
      console.log('No letters to send today');
      return { statusCode: 200, body: 'No letters today' };
    }

    console.log(`Found ${letters.length} letters to send`);

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    for (const letter of letters) {
      try {
        // Format phone number
        const cleanPhone = letter.recipient_phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('1')
          ? `+${cleanPhone}`
          : `+1${cleanPhone}`;

        // Send SMS via Twilio
        const smsResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              From: fromNumber!,
              To: formattedPhone,
              Body: letter.generated_message
            }).toString()
          }
        );

        if (smsResponse.ok) {
          // Mark as sent
          await fetch(
            `${supabaseUrl}/rest/v1/legacy_letters?id=eq.${letter.id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey!,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                status: 'sent',
                sent_at: new Date().toISOString()
              })
            }
          );
          console.log(`✅ Sent letter to ${letter.recipient_name} (${formattedPhone})`);
        } else {
          throw new Error(`Twilio error: ${smsResponse.status}`);
        }

      } catch (letterError) {
        console.error(`Failed to send letter ${letter.id}:`, letterError);

        // Mark as failed
        await fetch(
          `${supabaseUrl}/rest/v1/legacy_letters?id=eq.${letter.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ status: 'failed' })
          }
        );
      }
    }

    return {
      statusCode: 200,
      body: `Processed ${letters.length} letters`
    };

  } catch (error) {
    console.error('Error in send-legacy-letters:', error);
    return { statusCode: 500, body: 'Error processing letters' };
  }
});
