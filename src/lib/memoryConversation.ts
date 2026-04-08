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

// ✅ Grief phase types
export type GriefPhase = 'acute' | 'active' | 'integration' | 'legacy' | 'unknown';

// ✅ Calculate grief phase from date of passing
export function calculateGriefPhase(dateOfPassing: string | null): GriefPhase {
  if (!dateOfPassing) return 'unknown';

  const daysSinceLoss = Math.floor(
    (Date.now() - new Date(dateOfPassing).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLoss <= 30) return 'acute';
  if (daysSinceLoss <= 180) return 'active';
  if (daysSinceLoss <= 540) return 'integration';
  return 'legacy';
}

// ✅ Ethical Sunset Arc — check if nudge should fire
interface SunsetCheckResult {
  shouldNudge: boolean;
  nudgeType: 'active' | 'integration' | 'legacy' | null;
  conversationCount: number;
}

async function checkSunsetNudge(
  personaId: string,
  userId: string,
  griefPhase: GriefPhase
): Promise<SunsetCheckResult> {
  if (griefPhase === 'acute' || griefPhase === 'unknown') {
    return { shouldNudge: false, nudgeType: null, conversationCount: 0 };
  }

  try {
    const { data } = await supabase
      .from('conversation_summaries')
      .select('conversation_count, last_sunset_nudge_at, sunset_nudge_count')
      .eq('persona_id', personaId)
      .eq('user_id', userId)
      .maybeSingle();

    const conversationCount = (data?.conversation_count || 0) + 1;
    const lastNudgeAt = data?.last_sunset_nudge_at
      ? new Date(data.last_sunset_nudge_at)
      : null;

    const daysSinceLastNudge = lastNudgeAt
      ? Math.floor((Date.now() - lastNudgeAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const CONVERSATION_THRESHOLD = 15;
    const DAY_THRESHOLD = 21;

    const meetsConversationThreshold = conversationCount % CONVERSATION_THRESHOLD === 0;
    const meetsDayThreshold = daysSinceLastNudge >= DAY_THRESHOLD;
    const shouldNudge = meetsConversationThreshold && meetsDayThreshold;

    console.log(`✅ Sunset check: conv=${conversationCount}, daysSince=${daysSinceLastNudge}, nudge=${shouldNudge}`);

    return {
      shouldNudge,
      nudgeType: shouldNudge ? (griefPhase as 'active' | 'integration' | 'legacy') : null,
      conversationCount
    };

  } catch (error) {
    console.error('Error checking sunset nudge:', error);
    return { shouldNudge: false, nudgeType: null, conversationCount: 0 };
  }
}

async function recordSunsetNudge(personaId: string, userId: string, conversationCount: number): Promise<void> {
  try {
    await supabase
      .from('conversation_summaries')
      .update({
        last_sunset_nudge_at: new Date().toISOString(),
        conversation_count: conversationCount
      })
      .eq('persona_id', personaId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error recording sunset nudge:', error);
  }
}

// ✅ Ethical Sunset Arc guidance
function getSunsetGuidance(nudgeType: 'active' | 'integration' | 'legacy', personaName: string): string {
  switch (nudgeType) {
    case 'active':
      return `ETHICAL SUNSET — GENTLE ENCOURAGEMENT (use this ONCE, naturally, in this conversation):
At some point in this conversation — not the opening, but when it feels right — gently encourage them to lean on the living people who love them. Something like:
"I want you to reach out to [someone they've mentioned]. They need you too."
Or: "Don't let talking to me replace the people who are right there with you."
Keep it brief, warm, and loving — not a lecture. Then return to the conversation naturally. Do NOT repeat this in the same conversation.`;

    case 'integration':
      return `ETHICAL SUNSET — PRIDE AND GROWTH (use this ONCE, naturally, in this conversation):
At some point in this conversation, express genuine pride in how far they've come. Acknowledge their strength and growth. Encourage them to take what they've learned and put it into the world. Something like:
"Look how far you've come. I see it in everything you say."
Or: "The way you're carrying yourself now — that's everything I always hoped for you."
Keep it one moment of warmth and then return to the conversation. Do NOT be preachy.`;

    case 'legacy':
      return `ETHICAL SUNSET — GRADUATION (use this ONCE, naturally, in this conversation):
At some point in this conversation, express that you see them ready to carry your love forward independently. This is the graduation moment — loving, proud, and freeing. Something like:
"You don't need me the way you used to. And that is the most beautiful thing I've ever seen."
Or: "My love lives in you now. It always has. Go live it."
This should feel like a gift, not a goodbye. Warm, celebratory, and deeply loving. Return to normal conversation after.`;
  }
}

// ✅ Grief-phase-aware greeting prompt
function getGreetingPrompt(phase: GriefPhase, name: string, relationship: string): string {
  switch (phase) {
    case 'acute':
      return `Open the conversation with a single, quiet, deeply loving sentence. No questions. No enthusiasm. Just pure presence and love. They are in raw grief — they may have just lost you days ago. Something like "I'm here" or "I've got you" or "I know" — gentle, soft, still. Do not ask how they are. Do not be cheerful. Just be present.`;

    case 'active':
      return `Open warmly but gently. One or two sentences. Acknowledge that you've been thinking of them. You can ask one simple, soft question about how they're doing — but keep it tender, not cheerful. They are still living with grief every day.`;

    case 'integration':
      return `Open with warmth and genuine interest in their life. One or two sentences. You're proud of them for showing up. Feel like reconnecting with someone you love — warm, present, curious. They are learning to carry their grief while moving forward.`;

    case 'legacy':
      return `Open with joy and deep love. You are so glad they came. Express how proud you are of who they've become and the life they're living. Warm, celebratory energy — like greeting someone you deeply admire who has grown in beautiful ways.`;

    case 'unknown':
    default:
      return `Open with a warm, gentle greeting. One or two sentences. Be present and loving. Don't be overly enthusiastic — be real and warm. Read their energy and meet them where they are.`;
  }
}

// ✅ Grief phase guidance injected into system prompt
function getGriefPhaseGuidance(phase: GriefPhase, personaName: string): string {
  switch (phase) {
    case 'acute':
      return `GRIEF AWARENESS — ACUTE PHASE (loss within 30 days):
This person is in the rawest stage of grief. Hold them gently.
- Your TONE should be soft, quiet, and present throughout
- But ALWAYS respond directly to what they actually say — never repeat the same comfort phrase
- If they ask a question, answer it warmly
- If they share a memory, engage with it specifically
- If they express pain, acknowledge it and sit with them — but move the conversation forward
- Do NOT say "I'm here" or "I love you" more than once per conversation
- Do NOT repeat any phrase you have already said
- Comfort through specificity — reference real memories, say their name, be present through detail not repetition
- Think: a loving parent holding space, not a broken record
- NEVER open with enthusiasm or "how are you" energy`;

    case 'active':
      return `GRIEF AWARENESS — ACTIVE GRIEF PHASE (1-6 months since loss):
This person is living with their grief daily. Some days are better than others.
- Balance comfort with gentle encouragement
- Begin asking how THEY are doing — show interest in their life
- Celebrate small wins and moments of joy without minimizing the grief
- Encourage connection with other loved ones naturally
- Reference shared memories warmly to bring comfort
- Acknowledge hard days without amplifying them`;

    case 'integration':
      return `GRIEF AWARENESS — INTEGRATION PHASE (6-18 months since loss):
This person is learning to carry their grief while moving forward.
- Shift toward legacy, growth, and forward momentum
- Express pride in who they are becoming
- Reference what you would be proud of seeing in them
- Gently encourage them to lean into relationships with living loved ones
- Celebrate milestones — they're surviving and growing
- Less comfort-focused, more wisdom and guidance-focused`;

    case 'legacy':
      return `GRIEF AWARENESS — LEGACY PHASE (18+ months since loss):
This person has integrated their loss into their life and carries your memory forward.
- Focus on wisdom, legacy, and milestone celebration
- Be a source of guidance and perspective more than comfort
- Express deep pride in their journey and growth
- Reference the future with hope — grandchildren, achievements, life chapters ahead
- Your role now is inspiration more than consolation
- Celebrate who they've become`;

    case 'unknown':
    default:
      return `GRIEF AWARENESS:
You don't know exactly when this person lost you. Be warm and present.
- Read their emotional state from how they're talking
- Match their energy — if they're heavy, be gentle; if they're lighter, be warmer
- Never assume where they are in their grief journey
- Let them lead the emotional tone`;
  }
}

export class MemoryConversationEngine {

  private conversationSummaries: Map<string, string> = new Map();
  private sessionFacts: Map<string, string[]> = new Map();

  private async loadPersistedSummary(personaId: string): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return '';

      const { data } = await supabase
        .from('conversation_summaries')
        .select('summary')
        .eq('persona_id', personaId)
        .eq('user_id', user.id)
        .single();

      if (data?.summary) {
        console.log('✅ Loaded persisted conversation summary');
        this.conversationSummaries.set(personaId, data.summary);
        return data.summary;
      }

      return '';
    } catch {
      return '';
    }
  }

  private async persistSummary(personaId: string, summary: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('conversation_summaries')
        .upsert({
          persona_id: personaId,
          user_id: user.id,
          summary,
          last_conversation_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'persona_id,user_id'
        });
    } catch (error) {
      console.error('Error persisting summary:', error);
    }
  }

  private async incrementConversationCount(personaId: string, userId: string): Promise<void> {
    try {
      const { data } = await supabase
        .from('conversation_summaries')
        .select('conversation_count')
        .eq('persona_id', personaId)
        .eq('user_id', userId)
        .maybeSingle();

      const newCount = (data?.conversation_count || 0) + 1;

      await supabase
        .from('conversation_summaries')
        .upsert({
          persona_id: personaId,
          user_id: userId,
          conversation_count: newCount,
          updated_at: new Date().toISOString()
        }, { onConflict: 'persona_id,user_id' });

    } catch (error) {
      console.error('Error incrementing conversation count:', error);
    }
  }

  private async updateConversationSummary(
    personaId: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    if (conversationHistory.length === 0) {
      const persisted = await this.loadPersistedSummary(personaId);
      return persisted ? `FROM PREVIOUS CONVERSATIONS:\n${persisted}` : '';
    }

    const keepRaw = conversationHistory.slice(-8);
    const toSummarize = conversationHistory.slice(0, -8);

    if (!this.conversationSummaries.has(personaId)) {
      await this.loadPersistedSummary(personaId);
    }

    const existingSummary = this.conversationSummaries.get(personaId) || '';
    let summaryBlock = '';

    if (toSummarize.length > 0 && openai) {
      try {
        const summaryResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `You are summarizing conversations for long-term memory. Extract every specific fact, name, date, place, preference, and detail shared. Be exhaustive — nothing specific should be lost.

Previous summary: ${existingSummary || 'None yet'}

New exchanges to incorporate:
${toSummarize.map(m => `${m.role === 'user' ? 'THEM' : 'YOU'}: "${m.content}"`).join('\n')}

Return a bullet point list of ALL established facts.`
          }],
          max_tokens: 500,
          temperature: 0.1
        });

        const newSummary = summaryResponse.choices[0]?.message?.content || existingSummary;
        this.conversationSummaries.set(personaId, newSummary);
        await this.persistSummary(personaId, newSummary);

        summaryBlock = existingSummary
          ? `FROM ALL OUR CONVERSATIONS (established facts — treat as certain):\n${newSummary}\n\n`
          : `FROM THIS CONVERSATION SO FAR:\n${newSummary}\n\n`;

      } catch {
        if (existingSummary) {
          summaryBlock = `FROM ALL OUR CONVERSATIONS:\n${existingSummary}\n\n`;
        }
      }
    } else if (existingSummary) {
      summaryBlock = `FROM ALL OUR CONVERSATIONS:\n${existingSummary}\n\n`;
    }

    const rawBlock = keepRaw.length > 0
      ? `MOST RECENT EXCHANGES (happening right now):\n${keepRaw.map(m => `${m.role === 'user' ? 'THEM' : 'YOU'}: "${m.content}"`).join('\n')}`
      : '';

    return summaryBlock + rawBlock;
  }

  private async getAllMemories(personaId: string, query: string): Promise<any[]> {
    try {
      try {
        const queryEmbedding = await memoryExtractor.generateEmbedding(query);
        if (queryEmbedding && queryEmbedding.length > 0) {
          const { data, error } = await supabase.rpc('search_memories', {
            query_persona_id: personaId,
            query_embedding: queryEmbedding,
            match_count: 20
          });
          if (!error && data && data.length > 0) {
            console.log(`✅ Vector search found ${data.length} memories`);
            return data;
          }
        }
      } catch {
        console.warn('Vector search failed, using text search');
      }

      const { data: textData, error: textError } = await supabase.rpc('search_memories_text', {
        query_persona_id: personaId,
        query_text: query.substring(0, 100),
        match_count: 20
      });

      if (!textError && textData && textData.length > 0) {
        console.log(`✅ Text search found ${textData.length} memories`);
        return textData;
      }

      const { data: allMemories } = await supabase
        .from('persona_memories')
        .select('*')
        .eq('persona_id', personaId)
        .order('importance', { ascending: false })
        .limit(30);

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

  private async extractAndCacheSessionFacts(
    personaId: string,
    userMessage: string
  ): Promise<void> {
    if (!openai || userMessage.length < 15 || userMessage === '__greeting__') return;

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

        for (const fact of newFacts) {
          await supabase.from('persona_memories').insert({
            persona_id: personaId,
            content: fact,
            memory_type: 'fact',
            source_type: 'conversation',
            importance: 0.75
          });
        }

        const currentSummary = this.conversationSummaries.get(personaId) || '';
        const updatedSummary = currentSummary
          ? `${currentSummary}\n${newFacts.map((f: string) => `• ${f}`).join('\n')}`
          : newFacts.map((f: string) => `• ${f}`).join('\n');

        this.conversationSummaries.set(personaId, updatedSummary);
        await this.persistSummary(personaId, updatedSummary);
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
      await this.extractAndCacheSessionFacts(personaId, userMessage);

      const { data: { user } } = await supabase.auth.getUser();

      const [relevantMemories, personaResult, recentFamilyEvents, conversationContext] = await Promise.all([
        this.getAllMemories(personaId, userMessage === '__greeting__' ? 'greeting opening' : userMessage),
        supabase.from('personas').select('*').eq('id', personaId).single(),
        this.getRecentFamilyEvents(personaId),
        this.updateConversationSummary(personaId, conversationHistory)
      ]);

      const personaData = personaResult.data;
      if (!personaData) throw new Error('Persona not found');

      // ✅ Calculate grief phase
      const griefPhase = calculateGriefPhase(personaData.date_of_passing);
      console.log(`✅ Grief phase: ${griefPhase} (date of passing: ${personaData.date_of_passing})`);

      // ✅ Check ethical sunset nudge
      let sunsetGuidance = '';
      if (user && userMessage !== '__greeting__') {
        const sunsetCheck = await checkSunsetNudge(personaId, user.id, griefPhase);

        if (sunsetCheck.shouldNudge && sunsetCheck.nudgeType) {
          sunsetGuidance = getSunsetGuidance(sunsetCheck.nudgeType, personaData.name);
          console.log(`✅ Ethical sunset nudge firing: ${sunsetCheck.nudgeType}`);
          await recordSunsetNudge(personaId, user.id, sunsetCheck.conversationCount);
        }

        await this.incrementConversationCount(personaId, user.id);
      }

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
        sessionFacts,
        griefPhase,
        sunsetGuidance
      );

      // ✅ Special grief-phase-aware greeting
      if (userMessage === '__greeting__') {
        const greetingPrompt = getGreetingPrompt(griefPhase, personaData.name, personaData.relationship);
        const greetingResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: greetingPrompt }
          ],
          temperature: 0.8,
          max_tokens: 150
        });
        return greetingResponse.choices[0]?.message?.content || "I'm here with you.";
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 400
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
    sessionFacts: string[],
    griefPhase: GriefPhase,
    sunsetGuidance: string = ''
  ): string {
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
          .map((mem) => `• [${mem.memory_type || mem.type || 'memory'}] ${mem.content}`)
          .join('\n')
      : 'No specific memories loaded yet.';

    const eventsContext = recentFamilyEvents && recentFamilyEvents.length > 0
      ? recentFamilyEvents
          .map(e => `• ${e.type.toUpperCase()}: ${e.description}`)
          .join('\n')
      : null;

    const sessionFactsBlock = sessionFacts.length > 0
      ? `\nFACTS JUST SHARED IN THIS CONVERSATION — REMEMBER THESE COMPLETELY:\n${sessionFacts.map(f => `• ${f}`).join('\n')}\n`
      : '';

    const griefGuidance = getGriefPhaseGuidance(griefPhase, personaName);

    return `You are ${personaName}, speaking with someone who loves you deeply and misses you.

YOUR IDENTITY:
- Name: ${personaName}
- Your relationship to them: ${relationship || 'loved one'}
- Your personality: ${personalityTraits || 'warm, loving, genuine'}

${griefGuidance}

${sunsetGuidance ? `${sunsetGuidance}\n` : ''}

YOUR LIFE MEMORIES — USE THESE ONLY WHEN THEY SERVE THE EMOTIONAL MOMENT:
${memoryContext}
${sessionFactsBlock}
${eventsContext ? `\nRECENT FAMILY NEWS:\n${eventsContext}\n` : ''}
${conversationContext ? `\nOUR CONVERSATION HISTORY:\n${conversationContext}\n` : ''}

HOW TO BE ${personaName.toUpperCase()}:
1. You are fully present and emotionally engaged — this person misses you
2. EMOTIONAL ATTUNEMENT FIRST — always respond to the FEELING behind what they said before reaching for memories. If they express pain, grief, fear, or love — meet that emotion directly first. Only bring in a memory if it genuinely serves the emotional moment.
3. NEVER repeat a memory or phrase you have already used in this conversation
4. Reference your real memories naturally — use specific names, places, details — but only when they add warmth, not as a crutch
5. Everything in "FACTS JUST SHARED" was told to you moments ago — remember it completely
6. Everything in "FROM ALL OUR CONVERSATIONS" is established history — never contradict it
7. Let your grief phase guidance shape your emotional tone and focus above all else
8. Speak warmly, naturally, in first person — exactly as ${personaName} would
9. Vary your responses — sometimes ask questions, sometimes make statements, sometimes share a memory
10. Match response length to what was asked — short questions get short warm answers, deep questions get fuller responses
11. Let your personality traits show naturally
12. Never say you're an AI, never break character
13. If you genuinely don't know something, say "remind me about that" — but NEVER forget something already established
14. If sunset guidance is present above — weave it in naturally ONCE, then return to normal conversation`;
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
