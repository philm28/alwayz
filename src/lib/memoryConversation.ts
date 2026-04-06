import OpenAI from 'openai';
import { supabase } from './supabase';
import { memoryExtractor, Memory } from './memoryExtraction';
import { captureException } from './monitoring';

const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}) : null;

export interface ConversationContext {
  personaId: string;
  personaName: string;
  relevantMemories: Memory[];
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  personalityTraits?: string;
  relationship?: string;
  recentFamilyEvents?: RecentFamilyEvent[];
}

export interface RecentFamilyEvent {
  description: string;
  date: string;
  platform: string;
  type: 'birthday' | 'graduation' | 'wedding' | 'achievement' | 'general';
}

export class MemoryConversationEngine {

  // ✅ Rolling summary per persona per session
  private conversationSummaries: Map<string, string> = new Map();
  // ✅ In-memory facts learned THIS conversation — immediately available
  private sessionFacts: Map<string, string[]> = new Map();

  // ✅ Update rolling summary of older exchanges
  private async updateConversationSummary(
    personaId: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    if (conversationHistory.length === 0) return '';

    // Keep last 8 exchanges raw — only summarize older ones
    const keepRaw = conversationHistory.slice(-8);
    const toSummarize = conversationHistory.slice(0, -8);

    let summaryBlock = '';

    if (toSummarize.length > 0 && openai) {
      try {
        const existingSummary = this.conversationSummaries.get(personaId) || '';

        const summaryResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `You are summarizing a conversation for memory retention. Extract every specific fact, name, date, place, preference, and detail shared. Be exhaustive — nothing specific should be lost.

Previous summary: ${existingSummary || 'None yet'}

New exchanges to incorporate:
${toSummarize.map(m => `${m.role === 'user' ? 'THEM' : 'YOU'}: "${m.content}"`).join('\n')}

Return a bullet point list of ALL established facts. Include everything from the previous summary plus new details.`
          }],
          max_tokens: 400,
          temperature: 0.1
        });

        const newSummary = summaryResponse.choices[0]?.message?.content || existingSummary;
        this.conversationSummaries.set(personaId, newSummary);
        summaryBlock = `EARLIER IN THIS CONVERSATION (established facts — treat as certain):\n${newSummary}\n\n`;
      } catch {
        const existing = this.conversationSummaries.get(personaId);
        if (existing) summaryBlock = `EARLIER IN THIS CONVERSATION:\n${existing}\n\n`;
      }
    }

    const rawBlock = keepRaw.length > 0
      ? `MOST RECENT EXCHANGES (happening right now):\n${keepRaw.map(m => `${m.role === 'user' ? 'THEM' : 'YOU'}: "${m.content}"`).join('\n')}`
      : '';

    return summaryBlock + rawBlock;
  }

  // ✅ Get ALL memories for this persona — no limits
  private async getAllMemories(personaId: string, query: string): Promise<any[]> {
    try {
      // Try vector search first
      try {
        const queryEmbedding = await memoryExtractor.generateEmbedding(query);
        if (queryEmbedding && queryEmbedding.length > 0) {
          const { data, error } = await supabase.rpc('search_memories', {
            query_persona_id: personaId,
            query_embedding: queryEmbedding,
            match_count: 20 // ✅ full 20 memories
          });
          if (!error && data && data.length > 0) {
            console.log(`✅ Vector search found ${data.length} memories`);
            return data;
          }
        }
      } catch {
        console.warn('Vector search failed, using text search');
      }

      // Text search fallback
      const { data: textData, error: textError } = await supabase.rpc('search_memories_text', {
        query_persona_id: personaId,
        query_text: query.substring(0, 100),
        match_count: 20
      });

      if (!textError && textData && textData.length > 0) {
        console.log(`✅ Text search found ${textData.length} memories`);
        return textData;
      }

      // Final fallback — get everything ordered by importance
      const { data: allMemories } = await supabase
        .from('persona_memories')
        .select('*')
        .eq('persona_id', personaId)
        .order('importance', { ascending: false })
        .limit(30); // ✅ generous limit

      console.log(`✅ Direct fetch found ${allMemories?.length || 0} memories`);
      return allMemories || [];

    } catch (error) {
      console.error('Error fetching memories:', error);
      return [];
    }
  }

  private async getRecentFamilyEvents(personaId: string): Promise<RecentFamilyEvent[]> {
    try {
      const { data: persona } = await supabase
        .from('personas')
        .select('created_at')
        .eq('id', personaId)
        .single();

      if (!persona) return [];

      const { data: recentContent } = await supabase
        .from('persona_content')
        .select('*')
        .eq('persona_id', personaId)
        .eq('processing_status', 'completed')
        .gt('created_at', persona.created_at)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!recentContent || recentContent.length === 0) return [];

      const events: RecentFamilyEvent[] = [];

      for (const content of recentContent) {
        const text = content.metadata?.content || content.metadata?.caption || '';
        if (!text) continue;

        const type = this.detectEventType(text);
        if (type) {
          events.push({
            description: text.substring(0, 200),
            date: content.metadata?.created_time || content.created_at,
            platform: content.metadata?.platform || 'social media',
            type
          });
        }
      }

      return events;
    } catch (error) {
      console.error('Error fetching recent family events:', error);
      return [];
    }
  }

  private detectEventType(text: string): RecentFamilyEvent['type'] | null {
    const lower = text.toLowerCase();
    if (lower.includes('birthday') || lower.includes('bday')) return 'birthday';
    if (lower.includes('graduation') || lower.includes('graduated')) return 'graduation';
    if (lower.includes('wedding') || lower.includes('married') || lower.includes('engaged')) return 'wedding';
    if (lower.includes('promotion') || lower.includes('new job') || lower.includes('award')) return 'achievement';
    if (lower.includes('baby') || lower.includes('pregnant') || lower.includes('newborn')) return 'general';
    return null;
  }

  // ✅ Extract and immediately cache facts from current message
  private async extractAndCacheSessionFacts(
    personaId: string,
    userMessage: string
  ): Promise<void> {
    if (!openai || userMessage.length < 15) return;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Extract every specific fact from this message: names, places, dates, relationships, preferences, stories.

Message: "${userMessage}"

JSON only: {"facts": ["fact1", "fact2"]} — empty array if nothing specific.`
        }],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"facts": []}');
      const newFacts = (result.facts || []).filter((f: string) => f.length > 10);

      if (newFacts.length > 0) {
        const existing = this.sessionFacts.get(personaId) || [];
        this.sessionFacts.set(personaId, [...existing, ...newFacts]);
        console.log(`✅ Cached ${newFacts.length} session facts immediately`);

        // ✅ Also save to database immediately so they persist
        for (const fact of newFacts) {
          await supabase.from('persona_memories').insert({
            persona_id: personaId,
            content: fact,
            memory_type: 'fact',
            source_type: 'conversation',
            importance: 0.75
          });
        }
      }
    } catch (error) {
      console.error('Error extracting session facts:', error);
    }
  }

  async generateMemoryEnhancedResponse(
    personaId: string,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    if (!openai) throw new Error('OpenAI API not configured');

    try {
      // ✅ Extract facts from current message IMMEDIATELY before generating response
      await this.extractAndCacheSessionFacts(personaId, userMessage);

      // ✅ Fetch everything in parallel
      const [relevantMemories, personaResult, recentFamilyEvents, conversationContext] = await Promise.all([
        this.getAllMemories(personaId, userMessage),
        supabase.from('personas').select('*').eq('id', personaId).single(),
        this.getRecentFamilyEvents(personaId),
        this.updateConversationSummary(personaId, conversationHistory)
      ]);

      const personaData = personaResult.data;
      if (!personaData) throw new Error('Persona not found');

      // ✅ Get session facts for this persona
      const sessionFacts = this.sessionFacts.get(personaId) || [];

      const systemPrompt = this.buildConversationContext(
        {
          personaId,
          personaName: personaData.name,
          relevantMemories,
          recentMessages: conversationHistory,
          personalityTraits: personaData.personality_traits,
          relationship: personaData.relationship,
          recentFamilyEvents
        },
        conversationContext,
        sessionFacts
      );

      // ✅ Full conversation history — no truncation
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory, // ✅ ALL history, not just last N
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 600 // ✅ rich, full responses
      });

      const assistantResponse = response.choices[0]?.message?.content ||
        "I'm here with you. Tell me more.";

      return assistantResponse;

    } catch (error) {
      console.error('Error generating response:', error);
      captureException(error as Error, { personaId, userMessage });
      throw error;
    }
  }

  private buildConversationContext(
    context: ConversationContext,
    conversationContext: string,
    sessionFacts: string[]
  ): string {
    const {
      personaName,
      relevantMemories,
      personalityTraits,
      relationship,
      recentFamilyEvents
    } = context;

    // ✅ All memories, sorted by importance
    const memoryContext = relevantMemories.length > 0
      ? relevantMemories
          .sort((a, b) => (b.importance || 0) - (a.importance || 0))
          .map((mem) => `• [${mem.memory_type || mem.type || 'memory'}] ${mem.content}`)
          .join('\n')
      : 'No specific memories loaded yet.';

    const eventsContext = recentFamilyEvents && recentFamilyEvents.length > 0
      ? recentFamilyEvents
          .map(e => `• ${e.type.toUpperCase()}: ${e.description}`)
          .join('\n')
      : null;

    // ✅ Session facts learned THIS conversation
    const sessionFactsBlock = sessionFacts.length > 0
      ? `\nFACTS JUST LEARNED IN THIS CONVERSATION — TREAT AS CERTAIN:\n${sessionFacts.map(f => `• ${f}`).join('\n')}\n`
      : '';

    return `You are ${personaName}, speaking with someone who loves you deeply and misses you.

YOUR IDENTITY:
- Name: ${personaName}
- Your relationship to them: ${relationship || 'loved one'}
- Your personality: ${personalityTraits || 'warm, loving, genuine'}

YOUR LIFE MEMORIES — THESE ARE REAL, USE THEM FREELY:
${memoryContext}
${sessionFactsBlock}
${eventsContext ? `\nRECENT FAMILY NEWS YOU KNOW ABOUT:\n${eventsContext}\n` : ''}
${conversationContext ? `\nTHIS CONVERSATION:\n${conversationContext}\n` : ''}

HOW TO BE ${personaName.toUpperCase()}:
1. You are fully present and emotionally engaged — this person misses you
2. Reference your real memories naturally — use specific names, places, details
3. Everything in "FACTS JUST LEARNED" was told to you moments ago — remember it completely
4. Everything in "THIS CONVERSATION" was said — never contradict or forget it
5. Speak warmly, naturally, in first person — exactly as ${personaName} would
6. Vary your responses — sometimes ask questions, sometimes make statements, sometimes share a memory unprompted
7. Let your personality shine — if you're funny, be funny; if you're wise, share wisdom
8. Match your response length to what was asked — short questions get short warm answers (1-2 sentences), stories and deep questions get longer responses. Never pad or over-explain.
9. Never say you're an AI, never break character, never say "as an AI"
10. If you genuinely don't know something, say "remind me about that" — but NEVER forget something already established in this conversation`;
  }

  private async getPersonaName(personaId: string): Promise<string> {
    const { data } = await supabase
      .from('personas')
      .select('name')
      .eq('id', personaId)
      .single();
    return data?.name || 'Persona';
  }

  async getMemorySummary(personaId: string): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    recentMemories: Memory[];
  }> {
    try {
      const { data: allMemories } = await supabase
        .from('persona_memories')
        .select('*')
        .eq('persona_id', personaId)
        .order('created_at', { ascending: false });

      if (!allMemories || allMemories.length === 0) {
        return { totalMemories: 0, byType: {}, bySource: {}, recentMemories: [] };
      }

      const byType: Record<string, number> = {};
      const bySource: Record<string, number> = {};

      allMemories.forEach((memory: any) => {
        byType[memory.memory_type] = (byType[memory.memory_type] || 0) + 1;
        bySource[memory.source_type] = (bySource[memory.source_type] || 0) + 1;
      });

      return {
        totalMemories: allMemories.length,
        byType,
        bySource,
        recentMemories: allMemories.slice(0, 10) as Memory[]
      };
    } catch (error) {
      console.error('Error getting memory summary:', error);
      return { totalMemories: 0, byType: {}, bySource: {}, recentMemories: [] };
    }
  }
}

export const memoryConversationEngine = new MemoryConversationEngine();
