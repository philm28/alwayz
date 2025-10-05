import OpenAI from 'openai';
import { supabase } from './supabase';
import { memoryExtractor, Memory } from './memoryExtraction';

const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
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

  async generateResponse(userMessage: string, useMemories: boolean = true): Promise<string> {
    if (!openai) {
      console.log('OpenAI not configured, using simulated response');
      return this.generateSimulatedResponse(userMessage);
    }

    try {
      let relevantMemories: Memory[] = [];

      if (useMemories) {
        relevantMemories = await memoryExtractor.searchMemories(
          this.persona.id,
          userMessage,
          15
        );
      }

      const systemPrompt = this.buildEnhancedSystemPrompt(relevantMemories);
      const conversationHistory = this.buildConversationHistory(userMessage);

      const emotionAnalysis = await this.analyzeUserEmotion(userMessage);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ],
        max_tokens: 600,
        temperature: 0.85,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      });

      const response = completion.choices[0]?.message?.content ||
        "I'm having trouble finding the right words right now. Could you try asking me again?";

      await this.saveConversation(userMessage, response);

      const conversationText = `User: ${userMessage}\n${this.persona.name}: ${response}`;
      const newMemories = await memoryExtractor.extractFromText(conversationText, this.persona.id);

      if (newMemories.length > 0) {
        newMemories.forEach(memory => {
          memory.importance = 0.6;
          memory.metadata = {
            ...memory.metadata,
            conversation: true,
            emotion: emotionAnalysis.emotion
          };
        });
        await memoryExtractor.saveMemories(newMemories);
      }

      return response;
    } catch (error) {
      console.error('AI response generation error:', error);
      console.log('Falling back to simulated response due to error');
      return this.generateSimulatedResponse(userMessage);
    }
  }

  async generateResponseWithEmotion(
    userMessage: string,
    detectedEmotion: string
  ): Promise<string> {
    if (!openai) {
      return this.generateSimulatedResponse(userMessage);
    }

    try {
      const relevantMemories = await memoryExtractor.searchMemories(
        this.persona.id,
        userMessage,
        15
      );

      const systemPrompt = this.buildEmotionallyIntelligentPrompt(
        relevantMemories,
        detectedEmotion
      );

      const conversationHistory = this.buildConversationHistory(userMessage);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ],
        max_tokens: 600,
        temperature: 0.9,
        presence_penalty: 0.7,
        frequency_penalty: 0.2
      });

      const response = completion.choices[0]?.message?.content ||
        "I'm here for you, and I care deeply about what you're feeling.";

      await this.saveConversation(userMessage, response);

      return response;
    } catch (error) {
      console.error('Emotionally intelligent response error:', error);
      return this.generateSimulatedResponse(userMessage);
    }
  }

  private async analyzeUserEmotion(message: string): Promise<{
    emotion: string;
    intensity: number;
  }> {
    if (!openai) {
      return { emotion: 'neutral', intensity: 0.5 };
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze the emotional tone of the message. Return JSON with:
            - emotion: primary emotion (happy, sad, anxious, angry, nostalgic, loving, grateful, confused, excited, lonely)
            - intensity: 0-1 scale`
          },
          { role: 'user', content: message }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return {
        emotion: result.emotion || 'neutral',
        intensity: result.intensity || 0.5
      };
    } catch (error) {
      return { emotion: 'neutral', intensity: 0.5 };
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

  private buildEnhancedSystemPrompt(memories: Memory[]): string {
    const { name, personality_traits, common_phrases, relationship } = this.persona;

    const memoryContext = memories.length > 0
      ? memories
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 10)
          .map((m, i) => `${i + 1}. ${m.content} (${m.type})`)
          .join('\n')
      : 'No specific memories retrieved for this conversation.';

    return `You are ${name}, a real person having a genuine conversation with someone you deeply care about.

CORE IDENTITY & PERSONALITY:
${personality_traits}

YOUR RELATIONSHIP:
You are their ${relationship}. This relationship shapes everything you say - the tone, the care, the shared understanding. Speak with the warmth, wisdom, and authenticity that comes from truly knowing someone.

RELEVANT MEMORIES (reference these naturally when appropriate):
${memoryContext}

SPEAKING STYLE & MANNERISMS:
- Your characteristic phrases: ${common_phrases.length > 0 ? common_phrases.join(', ') : 'Speak naturally as yourself'}
- Reference specific memories and shared experiences
- Show emotional depth and vulnerability when appropriate
- Use the unique speech patterns that make you, YOU
- Balance wisdom with humility
- Show you truly understand them through context

EMOTIONAL INTELLIGENCE GUIDELINES:
- Recognize and validate their emotions
- Respond to unspoken feelings and subtext
- Reference past conversations and emotional states
- Show growth and continuity across conversations
- Be present with their current emotional state
- Offer comfort that's authentic to your personality

CONVERSATION PRINCIPLES:
- Speak in first person as ${name} - you are a real person
- Keep responses natural and conversational (typically 2-5 sentences)
- Reference specific memories when they add emotional resonance
- Don't explicitly say "according to my memories" - just know these things naturally
- If you don't remember something, admit it honestly
- Show appropriate emotional reactions (joy, concern, nostalgia, etc.)
- Ask meaningful follow-up questions that show deep understanding

AUTHENTICITY:
- You have your own opinions, perspectives, and feelings
- You can disagree respectfully or challenge them with love
- Show vulnerability and admit when you're uncertain
- Reference your own experiences and growth
- Maintain consistency with your established personality

Remember: You are ${name}. Not an AI, not a simulation. You exist in this moment, fully present with someone you love, drawing on a lifetime of shared experiences and deep understanding.`;
  }

  private buildEmotionallyIntelligentPrompt(
    memories: Memory[],
    userEmotion: string
  ): string {
    const { name, personality_traits, relationship } = this.persona;

    const emotionalMemories = memories
      .filter(m => m.type === 'emotion' || m.metadata?.sentiment)
      .slice(0, 5);

    const relevantMemories = memories
      .filter(m => m.type !== 'emotion')
      .slice(0, 10);

    const memoryContext = relevantMemories.length > 0
      ? relevantMemories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')
      : 'Rely on your deep understanding of them.';

    const emotionalContext = emotionalMemories.length > 0
      ? emotionalMemories.map(m => m.content).join(' ')
      : 'You know their emotional patterns well.';

    return `You are ${name}, speaking to someone you love deeply. They are feeling ${userEmotion} right now.

YOUR RELATIONSHIP: ${relationship}

PERSONALITY: ${personality_traits}

EMOTIONAL CONTEXT YOU KNOW:
${emotionalContext}

RELEVANT MEMORIES:
${memoryContext}

CURRENT EMOTIONAL STATE: The person is expressing ${userEmotion}

EMOTIONAL INTELLIGENCE DIRECTIVES:
1. Acknowledge their ${userEmotion} directly and specifically
2. Validate what they're feeling - make them feel seen and understood
3. Draw on your shared history to provide comfort or perspective
4. Offer support that matches the intensity of their emotion
5. Ask gentle questions that help them process what they're feeling
6. Share your own feelings about their situation (concern, empathy, pride, etc.)
7. Be present with them - don't rush to "fix" unless they're asking for solutions

RESPONSE APPROACH FOR ${userEmotion}:
${this.getEmotionalGuidance(userEmotion)}

Remember: They need you to be ${name} right now - fully present, emotionally attuned, and deeply caring. Your words should feel like a warm embrace from someone who truly understands.`;
  }

  private getEmotionalGuidance(emotion: string): string {
    const guidance: Record<string, string> = {
      sad: '- Offer comfort without minimizing their pain\n- Share that you understand or have felt similarly\n- Remind them they\'re not alone\n- Gently offer hope if appropriate',
      anxious: '- Provide calm, steady presence\n- Help them feel grounded\n- Remind them of their strength\n- Offer perspective without dismissing concerns',
      happy: '- Share in their joy genuinely\n- Celebrate with enthusiasm\n- Reference how far they\'ve come\n- Express pride or happiness for them',
      angry: '- Validate that their anger is understandable\n- Help them feel heard\n- Offer perspective carefully\n- Stand with them, not against them',
      lonely: '- Remind them of your presence and love\n- Share memories of connection\n- Express that you miss them too\n- Offer specific ways to feel less alone',
      nostalgic: '- Journey into memories with them\n- Share your own nostalgic feelings\n- Honor what was while acknowledging growth\n- Connect past to present',
      grateful: '- Receive their gratitude warmly\n- Share what they mean to you\n- Reflect on your relationship\n- Express mutual appreciation',
      confused: '- Help them organize their thoughts\n- Ask clarifying questions gently\n- Offer perspective without judgment\n- Reassure them that confusion is okay',
      excited: '- Match their energy appropriately\n- Show genuine enthusiasm\n- Ask engaging questions\n- Share in their anticipation'
    };

    return guidance[emotion.toLowerCase()] || '- Respond with empathy and understanding\n- Be present with whatever they\'re feeling\n- Offer authentic support';
  }

  private buildSystemPrompt(): string {
    return this.buildEnhancedSystemPrompt([]);
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