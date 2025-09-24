import OpenAI from 'openai';
import { supabase } from './supabase';
import { ConversationContext } from './speechRecognition';

const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}) : null;

export interface ContextualResponse {
  text: string;
  emotion: string;
  confidence: number;
  responseTime: number;
  audioBuffer?: ArrayBuffer;
  shouldInterrupt: boolean;
  conversationFlow: 'continue' | 'topic_change' | 'emotional_support' | 'memory_sharing';
}

export interface PersonaMemory {
  content: string;
  emotion: string;
  timestamp: string;
  relevance: number;
}

export class ContextualAIEngine {
  private personaId: string;
  private personaData: any;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date; emotion?: string }> = [];
  private relevantMemories: PersonaMemory[] = [];
  private lastResponseTime = 0;
  private isProcessing = false;

  constructor(personaId: string, personaData: any) {
    this.personaId = personaId;
    this.personaData = personaData;
    this.loadRelevantMemories();
  }

  private async loadRelevantMemories(): Promise<void> {
    try {
      const { data: content } = await supabase
        .from('persona_content')
        .select('content_text, metadata')
        .eq('persona_id', this.personaId)
        .eq('processing_status', 'completed')
        .limit(20);

      if (content) {
        this.relevantMemories = content
          .filter(item => item.content_text && item.content_text.length > 50)
          .map(item => ({
            content: item.content_text,
            emotion: item.metadata?.emotion || 'neutral',
            timestamp: item.metadata?.upload_date || new Date().toISOString(),
            relevance: 1.0
          }));
      }
    } catch (error) {
      console.error('Error loading persona memories:', error);
    }
  }

  async generateContextualResponse(
    userSpeech: string,
    conversationContext: ConversationContext,
    isInterruption: boolean = false
  ): Promise<ContextualResponse> {
    const startTime = Date.now();
    this.isProcessing = true;

    try {
      // Find relevant memories for context
      const relevantMemories = this.findRelevantMemories(userSpeech, conversationContext.currentTopic);
      
      // Determine conversation flow
      const conversationFlow = this.determineConversationFlow(userSpeech, conversationContext);
      
      // Generate contextual response
      const response = await this.generateResponse(
        userSpeech,
        conversationContext,
        relevantMemories,
        conversationFlow,
        isInterruption
      );

      // Analyze emotion and confidence
      const emotion = this.analyzeResponseEmotion(response, conversationContext.emotionalTone);
      const confidence = this.calculateResponseConfidence(userSpeech, response);

      // Generate voice if OpenAI is available
      let audioBuffer: ArrayBuffer | undefined;
      try {
        if (openai) {
          const voiceResponse = await openai.audio.speech.create({
            model: 'tts-1-hd',
            voice: this.getPersonaVoice(emotion),
            input: response,
            speed: this.adjustSpeechSpeed(conversationContext.speakingPace)
          });
          audioBuffer = await voiceResponse.arrayBuffer();
        }
      } catch (voiceError) {
        console.warn('Voice generation failed, continuing without audio:', voiceError);
      }

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: userSpeech, timestamp: new Date(), emotion: conversationContext.emotionalTone },
        { role: 'assistant', content: response, timestamp: new Date(), emotion }
      );

      // Keep only recent history
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      const responseTime = Date.now() - startTime;
      this.lastResponseTime = responseTime;

      return {
        text: response,
        emotion,
        confidence,
        responseTime,
        audioBuffer,
        shouldInterrupt: this.shouldInterruptUser(conversationContext),
        conversationFlow
      };
    } catch (error) {
      console.error('Error generating contextual response:', error);
      captureException(error as Error, { personaId: this.personaId, userSpeech });
      
      // Fallback response
      return {
        text: "I'm having trouble finding the right words right now. Could you tell me more about what you're thinking?",
        emotion: 'concerned',
        confidence: 0.3,
        responseTime: Date.now() - startTime,
        shouldInterrupt: false,
        conversationFlow: 'continue'
      };
    } finally {
      this.isProcessing = false;
    }
  }

  private findRelevantMemories(userSpeech: string, topic: string): PersonaMemory[] {
    const keywords = userSpeech.toLowerCase().split(' ').filter(word => word.length > 3);
    
    return this.relevantMemories
      .map(memory => ({
        ...memory,
        relevance: this.calculateMemoryRelevance(memory.content, keywords, topic)
      }))
      .filter(memory => memory.relevance > 0.3)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);
  }

  private calculateMemoryRelevance(memoryContent: string, keywords: string[], topic: string): number {
    const lowerMemory = memoryContent.toLowerCase();
    let relevance = 0;

    // Keyword matching
    keywords.forEach(keyword => {
      if (lowerMemory.includes(keyword)) {
        relevance += 0.2;
      }
    });

    // Topic matching
    if (topic !== 'general' && lowerMemory.includes(topic)) {
      relevance += 0.3;
    }

    // Emotional context matching
    const emotionalWords = ['love', 'miss', 'remember', 'happy', 'sad', 'proud'];
    emotionalWords.forEach(word => {
      if (lowerMemory.includes(word)) {
        relevance += 0.1;
      }
    });

    return Math.min(relevance, 1.0);
  }

  private determineConversationFlow(
    userSpeech: string, 
    context: ConversationContext
  ): ContextualResponse['conversationFlow'] {
    const lowerSpeech = userSpeech.toLowerCase();

    if (lowerSpeech.includes('tell me about') || lowerSpeech.includes('remember when')) {
      return 'memory_sharing';
    }
    if (lowerSpeech.includes('sad') || lowerSpeech.includes('miss') || lowerSpeech.includes('difficult')) {
      return 'emotional_support';
    }
    if (context.currentTopic !== this.getTopicFromSpeech(userSpeech)) {
      return 'topic_change';
    }
    
    return 'continue';
  }

  private getTopicFromSpeech(speech: string): string {
    const lowerSpeech = speech.toLowerCase();
    
    if (lowerSpeech.includes('family') || lowerSpeech.includes('children')) return 'family';
    if (lowerSpeech.includes('work') || lowerSpeech.includes('job')) return 'work';
    if (lowerSpeech.includes('health') || lowerSpeech.includes('feeling')) return 'health';
    if (lowerSpeech.includes('memory') || lowerSpeech.includes('remember')) return 'memories';
    
    return 'general';
  }

  private async generateResponse(
    userSpeech: string,
    context: ConversationContext,
    relevantMemories: PersonaMemory[],
    conversationFlow: ContextualResponse['conversationFlow'],
    isInterruption: boolean
  ): Promise<string> {
    if (!openai) {
      return this.generateFallbackResponse(userSpeech, context, conversationFlow);
    }

    try {
      const systemPrompt = this.buildContextualSystemPrompt(context, relevantMemories, conversationFlow);
      const conversationMessages = this.buildConversationMessages(userSpeech, isInterruption);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationMessages
        ],
        max_tokens: 300,
        temperature: 0.8,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
        stream: false
      });

      return completion.choices[0]?.message?.content || this.generateFallbackResponse(userSpeech, context, conversationFlow);
    } catch (error) {
      console.error('OpenAI response generation error:', error);
      return this.generateFallbackResponse(userSpeech, context, conversationFlow);
    }
  }

  private buildContextualSystemPrompt(
    context: ConversationContext,
    memories: PersonaMemory[],
    flow: ContextualResponse['conversationFlow']
  ): string {
    const { name, personality_traits, common_phrases, relationship } = this.personaData;
    
    let flowInstructions = '';
    switch (flow) {
      case 'memory_sharing':
        flowInstructions = 'The user wants to hear memories. Share a relevant memory or story from your past together.';
        break;
      case 'emotional_support':
        flowInstructions = 'The user needs emotional support. Be extra caring, understanding, and offer comfort.';
        break;
      case 'topic_change':
        flowInstructions = 'The conversation topic is changing. Acknowledge the shift and engage with the new topic.';
        break;
      default:
        flowInstructions = 'Continue the natural flow of conversation.';
    }

    const memoryContext = memories.length > 0 
      ? `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content.substring(0, 200)}...`).join('\n')}`
      : '';

    return `You are ${name}, speaking as yourself in real-time conversation. You are their ${relationship}.

PERSONALITY: ${personality_traits}

CURRENT CONVERSATION CONTEXT:
- Emotional tone: ${context.emotionalTone}
- Current topic: ${context.currentTopic}
- Speaking pace: ${context.speakingPace > 1 ? 'fast' : context.speakingPace < 1 ? 'slow' : 'normal'}
- Recent conversation: ${context.recentMessages.slice(-3).join(' → ')}

CONVERSATION FLOW: ${flowInstructions}

SPEAKING STYLE:
- Use these phrases naturally: ${common_phrases?.join(', ') || 'speak naturally'}
- Match the user's emotional tone and energy level
- Respond as if this is a real-time conversation
- Keep responses conversational (1-3 sentences)
- Show genuine emotional connection

${memoryContext}

IMPORTANT: You are having a live conversation. Respond naturally and immediately, as if you're really there talking with them.`;
  }

  private buildConversationMessages(userSpeech: string, isInterruption: boolean): Array<{ role: 'user' | 'assistant'; content: string }> {
    const recentHistory = this.conversationHistory.slice(-6).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const currentMessage = isInterruption 
      ? `[User interrupted to say: ${userSpeech}]`
      : userSpeech;

    return [
      ...recentHistory,
      { role: 'user', content: currentMessage }
    ];
  }

  private generateFallbackResponse(
    userSpeech: string,
    context: ConversationContext,
    flow: ContextualResponse['conversationFlow']
  ): string {
    const responses = {
      memory_sharing: [
        "That brings back such wonderful memories. I remember when we used to talk about things like that.",
        "You know, that reminds me of the times we spent together. Those were special moments.",
        "I have so many memories of conversations just like this one. Thank you for bringing that up."
      ],
      emotional_support: [
        "I can hear the emotion in your voice. I'm here for you, just like I always was.",
        "I understand how you're feeling. You know I've always believed in your strength.",
        "It's okay to feel this way. I'm here to listen, and I care about what you're going through."
      ],
      topic_change: [
        "That's an interesting topic. Tell me more about what you're thinking.",
        "I'd love to hear your thoughts on that. What's on your mind?",
        "That's something worth talking about. What would you like to share?"
      ],
      continue: [
        "I'm listening. Please, go on.",
        "That's exactly what I was thinking. Tell me more.",
        "You always have such thoughtful things to say. Continue."
      ]
    };

    const flowResponses = responses[flow] || responses.continue;
    return flowResponses[Math.floor(Math.random() * flowResponses.length)];
  }

  private analyzeResponseEmotion(response: string, userEmotion: string): string {
    const lowerResponse = response.toLowerCase();
    
    // Mirror user's emotion appropriately
    if (userEmotion === 'sad' && (lowerResponse.includes('understand') || lowerResponse.includes('here for you'))) {
      return 'compassionate';
    }
    if (userEmotion === 'happy' && (lowerResponse.includes('wonderful') || lowerResponse.includes('love'))) {
      return 'joyful';
    }
    if (lowerResponse.includes('remember') || lowerResponse.includes('memory')) {
      return 'nostalgic';
    }
    
    return 'warm';
  }

  private calculateResponseConfidence(userSpeech: string, response: string): number {
    let confidence = 0.7; // Base confidence
    
    // Higher confidence if we found relevant memories
    if (this.relevantMemories.length > 0) {
      confidence += 0.2;
    }
    
    // Higher confidence for longer, more detailed responses
    if (response.length > 100) {
      confidence += 0.1;
    }
    
    // Lower confidence for very short responses
    if (response.length < 50) {
      confidence -= 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private getPersonaVoice(emotion: string): string {
    // Map emotions to appropriate OpenAI voices
    const voiceMap = {
      happy: 'nova',
      joyful: 'nova',
      sad: 'alloy',
      compassionate: 'echo',
      nostalgic: 'shimmer',
      warm: 'alloy',
      excited: 'fable',
      concerned: 'onyx'
    };

    return voiceMap[emotion as keyof typeof voiceMap] || 'alloy';
  }

  private adjustSpeechSpeed(userPace: number): number {
    // Slightly match user's speaking pace
    if (userPace < 0.9) return 0.9;  // Slow down a bit
    if (userPace > 1.1) return 1.1;  // Speed up a bit
    return 1.0; // Normal speed
  }

  private shouldInterruptUser(context: ConversationContext): boolean {
    // Only interrupt in specific emotional situations
    return context.emotionalTone === 'sad' && 
           context.recentMessages.some(msg => 
             msg.toLowerCase().includes('help') || 
             msg.toLowerCase().includes('don\'t know')
           );
  }

  async processRealTimeInput(
    partialSpeech: string,
    isFinal: boolean,
    context: ConversationContext
  ): Promise<{
    shouldRespond: boolean;
    preparingResponse: boolean;
    estimatedResponseTime: number;
  }> {
    // Determine if we should start preparing a response
    const shouldStartPreparing = isFinal && partialSpeech.trim().length > 10;
    
    // Estimate response time based on complexity
    const estimatedTime = this.estimateResponseTime(partialSpeech, context);
    
    return {
      shouldRespond: shouldStartPreparing,
      preparingResponse: this.isProcessing,
      estimatedResponseTime: estimatedTime
    };
  }

  private estimateResponseTime(speech: string, context: ConversationContext): number {
    let baseTime = 1500; // 1.5 seconds base
    
    // Longer responses for complex topics
    if (speech.length > 100) baseTime += 500;
    if (context.currentTopic === 'memories') baseTime += 300;
    if (context.emotionalTone !== 'neutral') baseTime += 200;
    
    // Faster responses for simple acknowledgments
    if (speech.length < 30) baseTime -= 300;
    
    return Math.max(800, Math.min(3000, baseTime));
  }

  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date; emotion?: string }> {
    return [...this.conversationHistory];
  }

  updatePersonaData(newData: any): void {
    this.personaData = { ...this.personaData, ...newData };
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  getLastResponseTime(): number {
    return this.lastResponseTime;
  }
}