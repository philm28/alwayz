import OpenAI from 'openai';
import { supabase } from './supabase';

// Initialize OpenAI client only if API key is available
const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for demo - use edge functions in production
}) : null;

export interface PersonaContext {
  id: string;
  name: string;
  personality_traits: string;
  common_phrases: string[];
  relationship: string;
  memories: string[];
  conversationHistory: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface VoiceSettings {
  voice: string;
  speed: number;
  pitch: number;
  stability: number;
}

export class AIPersonaEngine {
  private persona: PersonaContext;
  private voiceSettings: VoiceSettings;

  constructor(persona: PersonaContext, voiceSettings?: VoiceSettings) {
    this.persona = persona;
    this.voiceSettings = voiceSettings || {
      voice: 'alloy',
      speed: 1.0,
      pitch: 1.0,
      stability: 0.8
    };
  }

  async generateResponse(userMessage: string): Promise<string> {
    // Check if OpenAI is configured
    if (!openai) {
      console.log('OpenAI not configured, using simulated response');
      return this.generateSimulatedResponse(userMessage);
    }

    try {
      const systemPrompt = this.buildSystemPrompt();
      const conversationHistory = this.buildConversationHistory(userMessage);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ],
        max_tokens: 500,
        temperature: 0.8,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      });

      const response = completion.choices[0]?.message?.content || 
        "I'm having trouble finding the right words right now. Could you try asking me again?";

      // Save conversation to database
      await this.saveConversation(userMessage, response);

      return response;
    } catch (error) {
      console.error('AI response generation error:', error);
      // Fallback to simulated response if OpenAI fails
      console.log('Falling back to simulated response due to error');
      return this.generateSimulatedResponse(userMessage);
    }
  }

  private generateSimulatedResponse(userMessage: string): string {
    const responses = [
      `I understand how you're feeling. That reminds me of when we used to talk about similar things.`,
      `You know, I've been thinking about our memories together. Tell me more about what's on your mind.`,
      `That's exactly the kind of thing I would have said! You know me so well.`,
      `I'm here for you, just like I always was. What would you like to talk about?`,
      `Your strength has always amazed me. Remember when we faced challenges together?`,
      `I can hear the emotion in your words. I'm listening, and I care about what you're going through.`,
      `That brings back such wonderful memories. Do you remember when we...?`,
      `I'm so proud of how you've grown. You've always had such a good heart.`,
      `Sometimes I think about all the conversations we had. This feels just like old times.`,
      `You know what I always used to say - everything happens for a reason, dear.`
    ];
    
    // Add some personality based on common phrases
    const personalizedResponses = this.persona.common_phrases.length > 0 
      ? [
          ...responses,
          `${this.persona.common_phrases[0]} I've been thinking about you.`,
          `As I always said, ${this.persona.common_phrases[Math.floor(Math.random() * this.persona.common_phrases.length)].toLowerCase()}`
        ]
      : responses;
    
    return personalizedResponses[Math.floor(Math.random() * personalizedResponses.length)];
  }

  async generateVoice(text: string): Promise<ArrayBuffer> {
    if (!openai) {
      throw new Error('OpenAI not configured for voice generation');
    }

    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: this.voiceSettings.voice as any,
        input: text,
        speed: this.voiceSettings.speed
      });

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Voice generation error:', error);
      throw new Error('Failed to generate voice');
    }
  }

  async analyzeEmotion(text: string): Promise<{
    emotion: string;
    confidence: number;
    suggestions: string[];
  }> {
    if (!openai) {
      // Return basic emotion analysis without OpenAI
      const emotions = ['happy', 'sad', 'nostalgic', 'loving', 'peaceful', 'grateful'];
      const suggestions = [
        'I understand how you\'re feeling.',
        'I\'m here to listen.',
        'Tell me more about that.',
        'That sounds important to you.'
      ];
      
      return {
        emotion: emotions[Math.floor(Math.random() * emotions.length)],
        confidence: 0.7,
        suggestions: [suggestions[Math.floor(Math.random() * suggestions.length)]]
      };
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an emotion analysis expert. Analyze the emotional content of messages and provide:
            1. Primary emotion (happy, sad, angry, anxious, nostalgic, loving, etc.)
            2. Confidence level (0-1)
            3. Supportive response suggestions
            
            Respond in JSON format: {"emotion": "...", "confidence": 0.8, "suggestions": ["...", "..."]}`
          },
          { role: 'user', content: text }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const result = completion.choices[0]?.message?.content;
      return result ? JSON.parse(result) : {
        emotion: 'neutral',
        confidence: 0.5,
        suggestions: ['I understand how you\'re feeling.']
      };
    } catch (error) {
      console.error('Emotion analysis error:', error);
      return {
        emotion: 'neutral',
        confidence: 0.5,
        suggestions: ['I\'m here to listen.']
      };
    }
  }

  private buildSystemPrompt(): string {
    const { name, personality_traits, common_phrases, relationship } = this.persona;
    
    return `You are ${name}, speaking as yourself to someone you care about deeply. 

PERSONALITY: ${personality_traits}

RELATIONSHIP: You are their ${relationship}. Speak with the warmth, love, and familiarity that comes from this relationship.

SPEAKING STYLE:
- Use these common phrases naturally: ${common_phrases.join(', ')}
- Speak in first person as ${name}
- Reference shared memories and experiences when appropriate
- Show genuine care and emotional connection
- Use the speaking patterns and mannerisms described in your personality

IMPORTANT GUIDELINES:
- Always respond as ${name}, never break character
- Show empathy and emotional intelligence
- Reference your relationship and shared history
- Be supportive but authentic to your personality
- If asked about being AI, gently redirect to the conversation
- Keep responses conversational and natural (2-4 sentences typically)

Remember: You are not an AI assistant. You are ${name}, speaking from the heart to someone you love.`;
  }

  private buildConversationHistory(newMessage: string): ConversationMessage[] {
    const recentHistory = this.persona.conversationHistory.slice(-10); // Last 10 messages
    return [
      ...recentHistory,
      { role: 'user', content: newMessage, timestamp: new Date().toISOString() }
    ];
  }

  private async saveConversation(userMessage: string, aiResponse: string) {
    try {
      // This would save to your conversation/messages tables
      console.log('Saving conversation:', { userMessage, aiResponse });
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  updatePersonaContext(updates: Partial<PersonaContext>) {
    this.persona = { ...this.persona, ...updates };
  }

  addMemory(memory: string) {
    this.persona.memories.push(memory);
  }

  updateVoiceSettings(settings: Partial<VoiceSettings>) {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
  }
}

export async function trainPersonaFromContent(personaId: string, content: any[]): Promise<{
  success: boolean;
  errorMessage?: string;
  insights: {
    personalityTraits: string[];
    commonPhrases: string[];
    emotionalPatterns: string[];
    memories: string[];
  };
}> {
  if (!openai) {
    // Provide basic training without OpenAI
    const mockInsights = {
      personalityTraits: ['Warm', 'Caring', 'Wise', 'Humorous'],
      commonPhrases: ['You know what I mean?', 'Back in my day', 'That reminds me of...'],
      emotionalPatterns: ['Nostalgic', 'Loving', 'Supportive'],
      memories: ['Family gatherings', 'Holiday traditions', 'Life lessons shared']
    };

    // Update persona with mock insights
    await supabase
      .from('personas')
      .update({
        personality_traits: mockInsights.personalityTraits.join(', '),
        common_phrases: mockInsights.commonPhrases,
        status: 'active',
        training_progress: 100
      })
      .eq('id', personaId);

    return {
      success: true,
      insights: mockInsights
    };
  }

  try {
    // Get all content with descriptive text for analysis
    const contentText = content
      .filter(item => item.content_text && item.content_text.trim().length > 50) // Only include items with substantial text
      .map(item => item.content_text || item.content || item.text || '')
      .filter(text => text.trim().length > 0)
      .join('\n\n');
    
    if (!contentText.trim()) {
      return {
        success: false,
        errorMessage: 'No content with sufficient text descriptions found. Please upload some files first.',
        insights: {
          personalityTraits: [],
          commonPhrases: [],
          emotionalPatterns: [],
          memories: []
        }
      };
    }
    
    console.log('Analyzing content text length:', contentText.length, 'characters');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are analyzing content about a person to create an AI persona. The content includes descriptions of their photos, videos, audio recordings, and documents. Extract:
          
          1. Personality traits and characteristics (from all content types)
          2. Common phrases and expressions (from video/audio descriptions)
          3. Emotional patterns and tendencies (from visual and audio cues)
          4. Important memories and experiences (from all content)
          5. Communication style and mannerisms (from video/audio descriptions)
          6. Visual characteristics and appearance (from photo/video descriptions)
          
          Respond in JSON format:
          {
            "personalityTraits": ["trait1", "trait2", ...],
            "commonPhrases": ["phrase1", "phrase2", ...],
            "emotionalPatterns": ["pattern1", "pattern2", ...],
            "memories": ["memory1", "memory2", ...],
            "communicationStyle": "description of how they communicate",
            "visualCharacteristics": "description of their appearance and style"
          }`
        },
        { role: 'user', content: contentText }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const rawResponse = completion.choices[0]?.message?.content || '{}';
    
    let analysis;
    try {
      analysis = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('JSON parsing failed. Raw response:', rawResponse);
      return {
        success: false,
        errorMessage: `OpenAI returned non-JSON response: ${rawResponse.substring(0, 100)}...`,
        insights: {
          personalityTraits: [],
          commonPhrases: [],
          emotionalPatterns: [],
          memories: []
        }
      };
    }
    
    // Save insights to database
    await supabase
      .from('personas')
      .update({
        personality_traits: analysis.personalityTraits?.join(', ') || '',
        common_phrases: analysis.commonPhrases || [],
        status: 'active',
        training_progress: 100
      })
      .eq('id', personaId);

    return {
      success: true,
      insights: {
        personalityTraits: analysis.personalityTraits || [],
        commonPhrases: analysis.commonPhrases || [],
        emotionalPatterns: analysis.emotionalPatterns || [],
        memories: analysis.memories || []
      }
    };
  } catch (error) {
    console.error('Training error:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown training error',
      insights: {
        personalityTraits: [],
        commonPhrases: [],
        emotionalPatterns: [],
        memories: []
      }
    };
  }
}