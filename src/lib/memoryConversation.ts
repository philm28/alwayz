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

  private async getAllMemories(personaId: string, query: string): Promise<any[]> {
    try {
      // First try vector search
      try {
        const queryEmbedding = await memoryExtractor.generateEmbedding(query);
        if (queryEmbedding && queryEmbedding.length > 0) {
          const { data, error } = await supabase.rpc('search_memories', {
            query_persona_id: personaId,
            query_embedding: queryEmbedding,
            match_count: 15
          });
          if (!error && data && data.length > 0) {
            console.log(`✅ Vector search found ${data.length} memories`);
            return data;
          }
        }
      } catch (vectorError) {
        console.warn('Vector search failed, falling back to text search');
      }

      // Fallback: text search
      const { data, error } = await supabase.rpc('search_memories_text', {
        query_persona_id: personaId,
        query_text: query.substring(0, 100),
        match_count: 15
      });

      if (!error && data && data.length > 0) {
        console.log(`✅ Text search found ${data.length} memories`);
        return data;
      }

      // Final fallback: get all memories ordered by importance
      const { data: allMemories } = await supabase
        .from('persona_memories')
        .select('*')
        .eq('persona_id', personaId)
        .order('importance', { ascending: false })
        .limit(20);

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

  async generateMemoryEnhancedResponse(
    personaId: string,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    if (!openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      const [relevantMemories, personaResult, recentFamilyEvents] = await Promise.all([
        this.getAllMemories(personaId, userMessage),
        supabase.from('personas').select('*').eq('id', personaId).single(),
        this.getRecentFamilyEvents(personaId)
      ]);

      const personaData = personaResult.data;
      if (!personaData) throw new Error('Persona not found');

      const context = this.buildConversationContext({
        personaId,
        personaName: personaData.name,
        relevantMemories,
        recentMessages: conversationHistory,
        personalityTraits: personaData.personality_traits,
        relationship: personaData.relationship,
        recentFamilyEvents
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: context },
          ...conversationHistory.slice(-10),
          { role: 'user', content: userMessage }
        ],
        temperature: 0.75,
        max_tokens: 300
      });

      const assistantResponse = response.choices[0]?.message?.content ||
        "I'm here with you. Tell me more.";

      await this.saveConversationMemory(personaId, userMessage, assistantResponse);

      return assistantResponse;
    } catch (error) {
      console.error('Error generating memory-enhanced response:', error);
      captureException(error as Error, { personaId, userMessage });
      throw error;
    }
  }

  private buildConversationContext(context: ConversationContext): string {
    const {
      personaName,
      relevantMemories,
      personalityTraits,
      relationship,
      recentFamilyEvents
    } = context;

    const memoryContext = relevantMemories.length > 0
      ? relevantMemories
          .sort((a, b) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 12)
          .map((mem, idx) => `${idx + 1}. [${mem.memory_type || mem.type || 'memory'}] ${mem.content}`)
          .join('\n')
      : null;

    const eventsContext = recentFamilyEvents && recentFamilyEvents.length > 0
      ? recentFamilyEvents
          .map(e => `- ${e.type.toUpperCase()}: "${e.description}" (${new Date(e.date).toLocaleDateString()})`)
          .join('\n')
      : null;

    return `You are ${personaName}, having a real conversation with someone who loves you deeply.

WHO YOU ARE:
- Name: ${personaName}
- Relationship to the person talking to you: ${relationship || 'loved one'}
- Personality: ${personalityTraits || 'warm, loving, and genuine'}

${memoryContext ? `YOUR REAL MEMORIES — USE THESE:
These are actual facts and memories from your life. Reference them naturally and specifically:
${memoryContext}` : `YOUR MEMORIES:
You don't have many specific memories loaded yet. Stay warm and present-focused.`}

${eventsContext ? `RECENT FAMILY NEWS:
${eventsContext}` : ''}

HOW TO RESPOND:
1. You KNOW the people, places, and stories listed in your memories — reference them by name
2. If someone mentions a name or place from your memories, acknowledge it specifically
3. Keep responses to 2-4 sentences — natural conversation length
4. Speak with warmth and love — this person misses you
5. NEVER say you don't remember something that IS in your memories above
6. NEVER invent memories not listed above
7. Speak in first person as ${personaName} — never break character
8. Never reference being an AI
9. Let your personality traits show naturally
10. Sometimes make statements instead of always asking questions — real conversations flow both ways`;
  }

  private async saveConversationMemory(
    personaId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    try {
      // ✅ Only save if user message contains something genuinely new and specific
      if (userMessage.length < 30) return;

      const skipPatterns = [
        /^(hi|hello|hey|how are you|good morning|good night|bye|goodbye|thanks|thank you)/i,
        /^(yes|no|ok|okay|sure|great|nice|wow|really|interesting)/i,
        /emotional context/i,
        /user and .* have a conversational/i
      ];

      if (skipPatterns.some(p => p.test(userMessage.trim()))) return;

      // ✅ Only extract from user message — not assistant response
      const memories = await memoryExtractor.extractFromText(userMessage, personaId);

      // ✅ Only save high-value memories — facts, relationships, stories
      const valuableMemories = memories.filter(m =>
        ['fact', 'relationship', 'preference', 'experience'].includes(m.type) &&
        m.content.length > 30 &&
        !m.content.toLowerCase().includes('emotional context')
      );

      if (valuableMemories.length > 0) {
        valuableMemories.forEach(memory => {
          memory.importance = 0.75;
        });
        await memoryExtractor.saveMemories(valuableMemories);
        console.log(`✅ Saved ${valuableMemories.length} valuable conversation memories`);
      }
    } catch (error) {
      console.error('Error saving conversation memory:', error);
    }
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
