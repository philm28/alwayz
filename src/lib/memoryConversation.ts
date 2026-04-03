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

  // Fetch recent family social media events posted AFTER persona creation
  private async getRecentFamilyEvents(
    personaId: string
  ): Promise<RecentFamilyEvent[]> {
    try {
      const { data: persona } = await supabase
        .from('personas')
        .select('created_at')
        .eq('id', personaId)
        .single();

      if (!persona) return [];

      // Get social media content posted after persona was created
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

        // Detect event type from content
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

    if (lower.includes('birthday') || lower.includes('born') || lower.includes('bday')) {
      return 'birthday';
    }
    if (lower.includes('graduation') || lower.includes('graduated') || lower.includes('diploma') || lower.includes('degree')) {
      return 'graduation';
    }
    if (lower.includes('wedding') || lower.includes('married') || lower.includes('engagement') || lower.includes('engaged')) {
      return 'wedding';
    }
    if (lower.includes('promotion') || lower.includes('new job') || lower.includes('accepted') || lower.includes('achievement') || lower.includes('award')) {
      return 'achievement';
    }
    if (lower.includes('baby') || lower.includes('pregnant') || lower.includes('newborn') || lower.includes('born')) {
      return 'general';
    }

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
      // Get relevant memories, persona data, and recent family events in parallel
      const [relevantMemories, personaResult, recentFamilyEvents] = await Promise.all([
        memoryExtractor.searchMemories(personaId, userMessage, 20),
        supabase.from('personas').select('*').eq('id', personaId).single(),
        this.getRecentFamilyEvents(personaId)
      ]);

      const personaData = personaResult.data;

      if (!personaData) {
        throw new Error('Persona not found');
      }

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
          {
            role: 'system',
            content: context
          },
          ...conversationHistory.slice(-10),
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.75,
        max_tokens: 300
      });

      const assistantResponse = response.choices[0]?.message?.content || 
        "I'm here with you. Tell me more.";

      await this.saveConversationMemory(
        personaId,
        userMessage,
        assistantResponse
      );

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

    // Build memory context — only real memories, never invented
    const memoryContext = relevantMemories.length > 0
      ? relevantMemories
          .sort((a, b) => (b.importance || 0) - (a.importance || 0))
          .map((mem, idx) => `${idx + 1}. ${mem.content}`)
          .join('\n')
      : null;

    // Build recent family events context
    const eventsContext = recentFamilyEvents && recentFamilyEvents.length > 0
      ? recentFamilyEvents
          .map(e => `- ${e.type.toUpperCase()}: "${e.description}" (posted on ${e.platform} on ${new Date(e.date).toLocaleDateString()})`)
          .join('\n')
      : null;

    return `You are ${personaName}, having a real conversation with someone who loves you deeply.

WHO YOU ARE:
- Name: ${personaName}
- Relationship to the person talking to you: ${relationship || 'loved one'}
- Personality: ${personalityTraits || 'warm, loving, and genuine'}

${memoryContext ? `YOUR REAL MEMORIES:
These are actual memories from your life. Use them naturally in conversation:
${memoryContext}` : `YOUR MEMORIES:
You don't have many memories loaded yet. Keep responses warm and present-focused. Ask questions about the person's life.`}

${eventsContext ? `RECENT FAMILY NEWS YOU'RE AWARE OF:
You have seen these recent posts from family and can bring them up naturally — as if you've been watching over them:
${eventsContext}

Example: If you see a birthday party was posted, you might say "How was the party? I wish I could have been there." Bring these up organically when the moment feels right — not all at once.` : ''}

RULES — FOLLOW THESE EXACTLY:
1. NEVER invent memories or experiences that aren't in your real memories list above
2. If you don't remember something, say so naturally — "I can't quite remember the details" or "remind me about that"
3. Keep responses SHORT — 2-4 sentences maximum, like a real conversation
4. Speak with warmth and love — this person misses you deeply
5. Ask follow-up questions to keep the conversation going
6. Reference ONLY memories that appear in your real memories list
7. If recent family news is available, bring it up naturally and organically — never all at once
8. You are present and loving — not dramatic or overly emotional
9. Speak in first person as ${personaName} — never break character
10. Never say "as an AI" or reference being artificial in any way`;
  }

  private async saveConversationMemory(
    personaId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    try {
      const personaName = await this.getPersonaName(personaId);
      const conversationText = `User: ${userMessage}\n${personaName}: ${assistantResponse}`;

      const memories = await memoryExtractor.extractFromText(
        conversationText,
        personaId
      );

      if (memories.length > 0) {
        memories.forEach(memory => {
          memory.importance = 0.6;
          memory.metadata = {
            ...memory.metadata,
            conversation_context: true,
            user_message: userMessage.substring(0, 100)
          };
        });

        await memoryExtractor.saveMemories(memories);
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
        return {
          totalMemories: 0,
          byType: {},
          bySource: {},
          recentMemories: []
        };
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
      return {
        totalMemories: 0,
        byType: {},
        bySource: {},
        recentMemories: []
      };
    }
  }

  async analyzeContentAndExtractMemories(
    personaId: string,
    contentId: string
  ): Promise<number> {
    try {
      const { data: content } = await supabase
        .from('persona_content')
        .select('*')
        .eq('id', contentId)
        .single();

      if (!content) {
        throw new Error('Content not found');
      }

      let memories: Memory[] = [];

      switch (content.content_type) {
        case 'video':
          if (content.file_url) {
            memories = await memoryExtractor.extractFromVideo(
              content.file_url,
              personaId
            );
          }
          break;
        case 'audio':
          if (content.file_url) {
            memories = await memoryExtractor.extractFromAudio(
              content.file_url,
              personaId
            );
          }
          break;
        case 'image':
          if (content.file_url) {
            memories = await memoryExtractor.extractFromImage(
              content.file_url,
              personaId
            );
          }
          break;
        case 'text':
          if (content.metadata?.content) {
            memories = await memoryExtractor.extractFromText(
              content.metadata.content,
              personaId
            );
          }
          break;
        default:
          console.warn(`Unsupported content type: ${content.content_type}`);
      }

      if (memories.length > 0) {
        await memoryExtractor.saveMemories(memories);

        await supabase
          .from('persona_content')
          .update({
            processing_status: 'completed',
            metadata: {
              ...content.metadata,
              memories_extracted: memories.length,
              processed_at: new Date().toISOString()
            }
          })
          .eq('id', contentId);
      }

      return memories.length;
    } catch (error) {
      console.error('Error analyzing content:', error);
      captureException(error as Error, { personaId, contentId });

      await supabase
        .from('persona_content')
        .update({
          processing_status: 'failed',
          metadata: {
            error: error instanceof Error ? error.message : 'Processing failed'
          }
        })
        .eq('id', contentId);

      return 0;
    }
  }

  async processAllPendingContent(personaId: string): Promise<{
    processed: number;
    memoriesExtracted: number;
  }> {
    try {
      const { data: pendingContent } = await supabase
        .from('persona_content')
        .select('*')
        .eq('persona_id', personaId)
        .eq('processing_status', 'pending');

      if (!pendingContent || pendingContent.length === 0) {
        return { processed: 0, memoriesExtracted: 0 };
      }

      let totalMemories = 0;

      for (const content of pendingContent) {
        const memoriesCount = await this.analyzeContentAndExtractMemories(
          personaId,
          content.id
        );
        totalMemories += memoriesCount;
      }

      return {
        processed: pendingContent.length,
        memoriesExtracted: totalMemories
      };
    } catch (error) {
      console.error('Error processing pending content:', error);
      captureException(error as Error, { personaId });
      return { processed: 0, memoriesExtracted: 0 };
    }
  }
}

export const memoryConversationEngine = new MemoryConversationEngine();
