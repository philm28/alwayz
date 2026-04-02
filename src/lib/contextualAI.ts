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
  private lastUserMessage = '';
  private responseDebounceTimeout: NodeJS.Timeout | null = null;

  constructor(personaId: string, personaData: any) {
    this.personaId = personaId;
    this.personaData = personaData;
    this.loadRelevantMemories();
  }

  private async loadRelevantMemories(): Promise<void> {
    try {
      // Load content from persona_content table
      const { data: content } = await supabase
        .from('persona_content')
        .select('content_text, metadata, content_type')
        .eq('persona_id', this.personaId)
        .eq('processing_status', 'completed')
        .limit(50);

      // Also load from persona_memories table
      const { data: memories } = await supabase
        .from('persona_memories')
        .select('memory_text, memory_type, importance, metadata')
        .eq('persona_id', this.personaId)
        .order('importance', { ascending: false })
        .limit(30);

      const contentMemories = content
        ? content
            .filter(item => item.content_text && item.content_text.length > 20)
            .map(item => ({
              content: item.content_text,
              emotion: item.metadata?.emotion || 'neutral',
              timestamp: item.metadata?.upload_date || new Date().toISOString(),
              relevance: 1.0
            }))
        : [];

      const extractedMemories = memories
        ? memories.map(item => ({
            content: item.memory_text,
            emotion: item.metadata?.emotion || 'neutral',
            timestamp: item.metadata?.created_at || new Date().toISOString(),
            relevance: item.importance || 0.5
          }))
        : [];

      this.relevantMemories = [...contentMemories, ...extractedMemories];
      console.log(`Loaded ${this.relevantMemories.length} memories for persona ${this.personaId}`);
    } catch (error) {
      console.error('Error loading persona memories:', error);
    }
  }

  async generateContextualResponse(
    userSpeech: string,
    conversationContext: ConversationContext,
    isInterruption: boolean = false
  ): Promise<ContextualResponse> {
    const trimmedSpeech = userSpeech.trim();
    
    // Prevent duplicate responses for the same message or if already processing
    if (this.lastUserMessage === trimmedSpeech || this.isProcessing) {
      console.log('Skipping duplicate or concurrent request:', { 
        lastMessage: this.lastUserMessage, 
        currentMessage: trimmedSpeech, 
        isProcessing: this.isProcessing 
      });
      throw new Error('Already processing this message or duplicate request');
    }
    
    this.lastUserMessage = trimmedSpeech;
    const startTime = Date.now();
    this.isProcessing = true;
    
    console.log('Starting contextual response generation for:', trimmedSpeech);

    try {
      // Find relevant memories for context
      const relevantMemories = this.findRelevantMemories(trimmedSpeech, conversationContext.currentTopic);
      
      // Determine conversation flow
      const conversationFlow = this.determineConversationFlow(trimmedSpeech, conversationContext);
      
      // Generate contextual response
      const response = await this.generateResponse(
        trimmedSpeech,
        conversationContext,
        relevantMemories,
        conversationFlow,
        isInterruption
      );

      // Analyze emotion and confidence
      const emotion = this.analyzeResponseEmotion(response, conversationContext.emotionalTone);
      const confidence = this.calculateResponseConfidence(trimmedSpeech, response);

      // Generate voice using cloned voice or fallback to OpenAI
      let audioBuffer: ArrayBuffer | undefined;
      try {
        const { voiceCloning } = await import('./voiceCloning');
        console.log('🎤 Synthesizing voice for persona:', this.personaId);
        audioBuffer = await voiceCloning.synthesizeVoice(this.personaId, response, emotion);
        console.log('✅ Voice synthesized successfully using cloned voice or OpenAI');
      } catch (voiceError) {
        console.warn('Voice generation failed, continuing without audio:', voiceError);
      }

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: trimmedSpeech, timestamp: new Date(), emotion: conversationContext.emotionalTone },
        { role: 'assistant', content: response, timestamp: new Date(), emotion }
      );

      // Keep only recent history
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      const responseTime = Date.now() - startTime;
      this.lastResponseTime = responseTime;
      
      console.log('Contextual response generated successfully:', {
        responseTime,
        emotion,
        confidence,
        hasAudio: !!audioBuffer
      });

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
      console.error('Context:', { personaId: this.personaId, userSpeech: trimmedSpeech });
      
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
      // Clear the last message after a delay to allow new messages
      setTimeout(() => {
        if (this.lastUserMessage === trimmedSpeech) {
          this.lastUserMessage = '';
          console.log('Cleared last processed message, ready for new input');
        }
      }, 5000);
    }
  }

  private findRelevantMemories(userSpeech: string, topic: string): PersonaMemory[] {
    const keywords = userSpeech.toLowerCase().split(' ').filter(word => word.length > 3);

    return this.relevantMemories
      .map(memory => ({
        ...memory,
        relevance: this.calculateMemoryRelevance(memory.content, keywords, topic)
      }))
      .filter(memory => memory.relevance > 0.2)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
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
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationMessages
        ],
        max_tokens: 400,
        temperature: 0.85,
        presence_penalty: 0.7,
        frequency_penalty: 0.4,
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
        flowInstructions = 'The user is asking about memories. Share a relevant story or memory if you have one, or ask them to tell you more about what they remember.';
        break;
      case 'emotional_support':
        flowInstructions = 'The user needs emotional support. Listen carefully, validate their feelings, and respond with genuine care and understanding.';
        break;
      case 'topic_change':
        flowInstructions = 'The conversation is shifting to a new topic. Acknowledge what they said and engage meaningfully with the new subject.';
        break;
      default:
        flowInstructions = 'Listen closely to what they\'re saying and respond directly to their specific words and meaning.';
    }

    const memoryContext = memories.length > 0
      ? `\n\nRELEVANT BACKGROUND INFORMATION:\n${memories.map(m => `- ${m.content.substring(0, 300)}`).join('\n')}`
      : '';

    const conversationSummary = this.conversationHistory.length > 0
      ? `\n\nWHAT WE'VE BEEN TALKING ABOUT:\n${this.conversationHistory.slice(-6).map(msg =>
          `${msg.role === 'user' ? 'Them' : 'You'}: ${msg.content}`
        ).join('\n')}`
      : '';

    return `You are ${name}, having a genuine real-time conversation with someone you care about. You are their ${relationship}.

WHO YOU ARE:
${personality_traits || 'A caring, thoughtful person who listens deeply and responds authentically'}

YOUR SPEAKING STYLE:
- Characteristic phrases: ${common_phrases?.join(', ') || 'Speak naturally and authentically'}
- Keep responses conversational and natural (2-4 sentences typically)
- Match their energy and emotional tone
- Ask follow-up questions when appropriate
- Show you're truly listening by referencing what they just said

${conversationSummary}

${memoryContext}

CRITICAL INSTRUCTIONS FOR THIS RESPONSE:
${flowInstructions}

HOW TO RESPOND:
1. LISTEN to what they JUST said - respond directly to their specific words
2. Reference something they mentioned to show you're paying attention
3. Respond as ${name} would - with their personality and way of speaking
4. Keep it natural and conversational, like you're really talking
5. If they ask a question, answer it directly before adding your thoughts
6. If they share something emotional, acknowledge their feelings first
7. Don't just give generic responses - make it specific to what they said

REMEMBER: This is a REAL conversation. They just said something to you. What would ${name} actually say back to them in this moment? Respond as if you're truly present and engaged with them.`;
  }

  private buildConversationMessages(userSpeech: string, isInterruption: boolean): Array<{ role: 'user' | 'assistant'; content: string }> {
    const recentHistory = this.conversationHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const currentMessage = isInterruption
      ? `${userSpeech} [they interrupted while you were speaking]`
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
    const lowerSpeech = userSpeech.toLowerCase();

    if (lowerSpeech.includes('how are you') || lowerSpeech.includes('how have you been')) {
      return "I'm doing well, thank you for asking. I've been thinking about you. How have you been?";
    }

    if (lowerSpeech.includes('miss you') || lowerSpeech.includes('miss')) {
      return "I miss you too. I'm so glad we can talk like this. Tell me what's been going on with you.";
    }

    if (lowerSpeech.includes('remember') || lowerSpeech.includes('used to')) {
      return "Yes, I remember those times. They mean so much to me. What made you think of that?";
    }

    if (lowerSpeech.includes('?')) {
      return "That's a great question. Let me think about that for a moment. What do you think?";
    }

    const responses = {
      memory_sharing: [
        "That brings back memories. What specifically do you remember about that?",
        "I love thinking about those times. What was your favorite part?",
        "Those were special moments. Tell me more about what you remember."
      ],
      emotional_support: [
        "I hear you, and I understand. How long have you been feeling this way?",
        "Thank you for sharing that with me. What would help you most right now?",
        "I'm here with you. Tell me more about what you're going through."
      ],
      topic_change: [
        "That's interesting. What made you think of that?",
        "I'd like to hear more about that. What's important to you about this?",
        "Tell me what's on your mind about that."
      ],
      continue: [
        "I'm listening. What else is on your mind?",
        "That's really interesting. Can you tell me more?",
        "I understand. What are you thinking about that?"
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