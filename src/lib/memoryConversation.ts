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
}

export class MemoryConversationEngine {
  async generateMemoryEnhancedResponse(
    personaId: string,
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    if (!openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      const relevantMemories = await memoryExtractor.searchMemories(
        personaId,
        userMessage,
        15
      );

      const { data: personaData } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (!personaData) {
        throw new Error('Persona not found');
      }

      const context = this.buildConversationContext({
        personaId,
        personaName: personaData.name,
        relevantMemories,
        recentMessages: conversationHistory,
        personalityTraits: personaData.personality_traits
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
        temperature: 0.8,
        max_tokens: 500
      });

      const assistantResponse = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

      await this.saveConversationMemory(personaId, userMessage, assistantResponse);

      return assistantResponse;
    } catch (error) {
      console.error('Error generating memory-enhanced response:', error);
      captureException(error as Error, { personaId, userMessage });
      throw error;
    }
  }

  private buildConversationContext(context: ConversationContext): string {
    const { personaName, relevantMemories, personalityTraits } = context;

    const memoryContext = relevantMemories.length > 0
      ? relevantMemories.map((mem, idx) => `${idx + 1}. ${mem.content} (${mem.type})`).join('\n')
      : 'No specific memories available for this conversation.';

    return `You are ${personaName}, engaging in a natural conversation as yourself.

PERSONALITY & TRAITS:
${personalityTraits || 'Be warm, authentic, and engaging'}

RELEVANT MEMORIES:
${memoryContext}

INSTRUCTIONS:
- Respond naturally as ${personaName}, using the memories and context provided
- Reference specific memories when relevant to the conversation
- Show emotional depth and personal connection based on the relationship memories
- Use the person's communication style and common phrases when available
- If a memory contradicts something, acknowledge it naturally
- Don't explicitly say "according to my memories" - just speak naturally
- Be authentic and true to ${personaName}'s personality
- Keep responses conversational and not too formal
- Show enthusiasm for topics that ${personaName} cares about based on preferences`;
  }

  private async saveConversationMemory(
    personaId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    try {
      const conversationText = `User: ${userMessage}\n${await this.getPersonaName(personaId)}: ${assistantResponse}`;

      const memories = await memoryExtractor.extractFromText(
        conversationText,
        personaId
      );

      if (memories.length > 0) {
        memories.forEach(memory => {
          memory.importance = 0.5;
          memory.metadata = {
            ...memory.metadata,
            conversation_context: true,
            user_message: userMessage.substring(0, 100)
          };
        });

        await memoryExtractor.saveMemories(memories);
        console.log(`Saved ${memories.length} memories from conversation`);
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
