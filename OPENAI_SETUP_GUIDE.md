# Setting Up OpenAI API for AlwayZ

This guide will help you connect your OpenAI account to enable real-time AI persona generation in your AlwayZ application.

## Step 1: Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account (or create one if you don't have one)
3. Click **"Create new secret key"**
4. Give it a name like "AlwayZ Application"
5. Copy the API key (it starts with `sk-`)
6. **Important**: Save this key securely - you won't be able to see it again

## Step 2: Add API Key to Your Environment

### For Local Development

1. Open your `.env` file in the project root
2. Find the line: `VITE_OPENAI_API_KEY=your_openai_api_key`
3. Replace `your_openai_api_key` with your actual API key:
   ```
   VITE_OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
4. Save the file

### For Netlify Deployment

1. Go to your [Netlify Dashboard](https://app.netlify.com/)
2. Select your AlwayZ site
3. Go to **Site settings** → **Environment variables**
4. Click **Add variable**
5. Enter:
   - **Key**: `VITE_OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-`)
6. Click **Save**
7. Go to **Deploys** and click **Trigger deploy** to rebuild with the new variable

## Step 3: Verify OpenAI Integration

After adding your API key:

1. **Local Testing**:
   - Restart your development server: `npm run dev`
   - Create a persona and upload some content
   - Start a conversation - you should now get real AI responses

2. **Production Testing**:
   - After redeploying with the API key
   - Test conversations with your personas
   - Responses should be more contextual and personalized

## What Changes With Real OpenAI Integration

### Before (Simulated):
- ✅ Random responses from a predefined list
- ✅ Basic conversation flow
- ❌ No real understanding of context
- ❌ No voice generation
- ❌ No content analysis

### After (Real OpenAI):
- ✅ **Contextual responses** based on persona's personality
- ✅ **Voice synthesis** using OpenAI's TTS
- ✅ **Content analysis** during training
- ✅ **Emotion detection** in conversations
- ✅ **Memory integration** from uploaded content
- ✅ **Personalized conversation style**

## OpenAI Models Used

Your AlwayZ application uses these OpenAI models:

- **GPT-4**: For generating persona responses and content analysis
- **TTS-1-HD**: For high-quality voice synthesis
- **Whisper**: For processing uploaded audio content (future feature)

## Cost Considerations

OpenAI charges based on usage:

- **GPT-4**: ~$0.03 per 1K tokens (roughly 750 words)
- **TTS**: ~$15 per 1M characters
- **Typical conversation**: $0.05-$0.15 per exchange

For a typical user having 10-20 conversations per month, expect costs of $5-15/month.

## Security Best Practices

1. **Never expose your API key** in client-side code
2. **Use environment variables** to store the key securely
3. **Monitor usage** in the OpenAI dashboard
4. **Set usage limits** to prevent unexpected charges
5. **Rotate keys regularly** for security

## Troubleshooting

### "OpenAI not configured" Messages
- Check that your API key is correctly set in environment variables
- Verify the key starts with `sk-`
- Make sure you've restarted your development server or redeployed

### "Insufficient quota" Errors
- Check your OpenAI account billing
- Ensure you have credits available
- Verify your account has access to GPT-4

### "Rate limit exceeded" Errors
- You're making too many requests too quickly
- Wait a few minutes and try again
- Consider implementing request throttling

### API Key Invalid
- Double-check the API key is copied correctly
- Make sure there are no extra spaces
- Try generating a new API key

## Testing Your Setup

After configuration, test these features:

1. **Persona Conversations**:
   - Create a persona with detailed personality traits
   - Upload some content for training
   - Start a conversation and verify responses are contextual

2. **Voice Generation** (if supported):
   - Enable voice in conversation settings
   - Verify audio responses are generated

3. **Training Analysis**:
   - Upload text content
   - Start AI training
   - Check that personality insights are extracted

## Production Recommendations

For production use:

1. **Use Edge Functions**: Move OpenAI calls to Supabase Edge Functions for better security
2. **Implement Caching**: Cache responses to reduce API costs
3. **Add Rate Limiting**: Prevent abuse and control costs
4. **Monitor Usage**: Set up alerts for high usage
5. **Backup Responses**: Always have fallback responses if OpenAI is unavailable

## Need Help?

If you're having trouble setting up OpenAI:

1. Check the browser console for specific error messages
2. Verify your API key in the OpenAI dashboard
3. Test with a simple conversation first
4. Contact support if issues persist

Once configured, your AI personas will provide much more engaging and authentic conversations! 🤖✨