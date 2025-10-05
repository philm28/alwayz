import OpenAI from 'openai';
import { supabase } from './supabase';
import { captureException } from './monitoring';

const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}) : null;

export interface Memory {
  id: string;
  personaId: string;
  content: string;
  type: 'fact' | 'experience' | 'preference' | 'relationship' | 'skill' | 'emotion';
  source: 'video' | 'image' | 'audio' | 'text' | 'social_media';
  sourceUrl?: string;
  timestamp: string;
  importance: number;
  embedding?: number[];
  metadata?: {
    location?: string;
    people?: string[];
    topics?: string[];
    sentiment?: string;
  };
}

export interface ExtractedContent {
  text: string;
  facts: string[];
  topics: string[];
  people: string[];
  locations: string[];
  emotions: string[];
  preferences: string[];
  relationships: string[];
}

export class MemoryExtractor {
  async extractFromVideo(videoUrl: string, personaId: string): Promise<Memory[]> {
    try {
      console.log('Extracting memories from video:', videoUrl);

      if (!openai) {
        throw new Error('OpenAI API not configured');
      }

      const videoFile = await this.downloadFile(videoUrl);

      const transcription = await openai.audio.transcriptions.create({
        file: videoFile,
        model: 'whisper-1',
        language: 'en'
      });

      const extractedContent = await this.analyzeContent(transcription.text, 'video');
      const memories = await this.convertToMemories(extractedContent, personaId, 'video', videoUrl);

      console.log(`Extracted ${memories.length} memories from video`);
      return memories;
    } catch (error) {
      console.error('Error extracting from video:', error);
      captureException(error as Error, { personaId, videoUrl });
      return [];
    }
  }

  async extractFromAudio(audioUrl: string, personaId: string): Promise<Memory[]> {
    try {
      console.log('Extracting memories from audio:', audioUrl);

      if (!openai) {
        throw new Error('OpenAI API not configured');
      }

      const audioFile = await this.downloadFile(audioUrl);

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en'
      });

      const extractedContent = await this.analyzeContent(transcription.text, 'audio');
      const memories = await this.convertToMemories(extractedContent, personaId, 'audio', audioUrl);

      console.log(`Extracted ${memories.length} memories from audio`);
      return memories;
    } catch (error) {
      console.error('Error extracting from audio:', error);
      captureException(error as Error, { personaId, audioUrl });
      return [];
    }
  }

  async extractFromImage(imageUrl: string, personaId: string): Promise<Memory[]> {
    try {
      console.log('Extracting memories from image:', imageUrl);

      if (!openai) {
        throw new Error('OpenAI API not configured');
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and extract: 1) What is happening in the image, 2) Who is in the image, 3) Where might this be, 4) What emotions or mood does it convey, 5) Any text visible in the image. Provide detailed descriptions.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      const description = response.choices[0]?.message?.content || '';
      const extractedContent = await this.analyzeContent(description, 'image');
      const memories = await this.convertToMemories(extractedContent, personaId, 'image', imageUrl);

      console.log(`Extracted ${memories.length} memories from image`);
      return memories;
    } catch (error) {
      console.error('Error extracting from image:', error);
      captureException(error as Error, { personaId, imageUrl });
      return [];
    }
  }

  async extractFromText(text: string, personaId: string): Promise<Memory[]> {
    try {
      console.log('Extracting memories from text');

      const extractedContent = await this.analyzeContent(text, 'text');
      const memories = await this.convertToMemories(extractedContent, personaId, 'text');

      console.log(`Extracted ${memories.length} memories from text`);
      return memories;
    } catch (error) {
      console.error('Error extracting from text:', error);
      captureException(error as Error, { personaId });
      return [];
    }
  }

  private async analyzeContent(content: string, sourceType: string): Promise<ExtractedContent> {
    if (!openai) {
      throw new Error('OpenAI API not configured');
    }

    const prompt = `Analyze the following content and extract structured information about a person's life, personality, and experiences.

Content: "${content}"

Extract:
1. Facts: Concrete, factual information about the person (age, occupation, education, etc.)
2. Topics: Main subjects or themes discussed
3. People: Names of people mentioned (friends, family, colleagues)
4. Locations: Places mentioned (cities, countries, specific venues)
5. Emotions: Emotional states or feelings expressed
6. Preferences: Likes, dislikes, opinions, or preferences mentioned
7. Relationships: Information about relationships with others

Return as JSON with these keys: facts, topics, people, locations, emotions, preferences, relationships (all arrays of strings).`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing content and extracting structured information about people. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        text: content,
        facts: result.facts || [],
        topics: result.topics || [],
        people: result.people || [],
        locations: result.locations || [],
        emotions: result.emotions || [],
        preferences: result.preferences || [],
        relationships: result.relationships || []
      };
    } catch (error) {
      console.error('Error analyzing content:', error);
      return {
        text: content,
        facts: [],
        topics: [],
        people: [],
        locations: [],
        emotions: [],
        preferences: [],
        relationships: []
      };
    }
  }

  private async convertToMemories(
    extracted: ExtractedContent,
    personaId: string,
    source: Memory['source'],
    sourceUrl?: string
  ): Promise<Memory[]> {
    const memories: Memory[] = [];
    const timestamp = new Date().toISOString();

    extracted.facts.forEach((fact, index) => {
      memories.push({
        id: `mem_${Date.now()}_${index}`,
        personaId,
        content: fact,
        type: 'fact',
        source,
        sourceUrl,
        timestamp,
        importance: 0.8,
        metadata: {
          topics: extracted.topics,
          people: extracted.people,
          location: extracted.locations[0]
        }
      });
    });

    extracted.preferences.forEach((pref, index) => {
      memories.push({
        id: `mem_${Date.now()}_pref_${index}`,
        personaId,
        content: pref,
        type: 'preference',
        source,
        sourceUrl,
        timestamp,
        importance: 0.7,
        metadata: {
          topics: extracted.topics
        }
      });
    });

    extracted.relationships.forEach((rel, index) => {
      memories.push({
        id: `mem_${Date.now()}_rel_${index}`,
        personaId,
        content: rel,
        type: 'relationship',
        source,
        sourceUrl,
        timestamp,
        importance: 0.9,
        metadata: {
          people: extracted.people
        }
      });
    });

    if (extracted.emotions.length > 0) {
      memories.push({
        id: `mem_${Date.now()}_emotion`,
        personaId,
        content: `Emotional context: ${extracted.emotions.join(', ')}`,
        type: 'emotion',
        source,
        sourceUrl,
        timestamp,
        importance: 0.6,
        metadata: {
          sentiment: extracted.emotions[0]
        }
      });
    }

    return memories;
  }

  private async downloadFile(url: string): Promise<File> {
    const response = await fetch(url);
    const blob = await response.blob();
    const filename = url.split('/').pop() || 'file';
    return new File([blob], filename, { type: blob.type });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return [];
    }
  }

  async saveMemories(memories: Memory[]): Promise<void> {
    try {
      for (const memory of memories) {
        const embedding = await this.generateEmbedding(memory.content);
        memory.embedding = embedding;

        const { error } = await supabase.from('persona_memories').insert({
          id: memory.id,
          persona_id: memory.personaId,
          content: memory.content,
          memory_type: memory.type,
          source_type: memory.source,
          source_url: memory.sourceUrl,
          importance: memory.importance,
          embedding,
          metadata: memory.metadata,
          created_at: memory.timestamp
        });

        if (error) {
          console.error('Error saving memory:', error);
        }
      }

      console.log(`Saved ${memories.length} memories to database`);
    } catch (error) {
      console.error('Error in saveMemories:', error);
      captureException(error as Error);
    }
  }

  async searchMemories(
    personaId: string,
    query: string,
    limit: number = 10
  ): Promise<Memory[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const { data, error } = await supabase.rpc('search_memories', {
        query_persona_id: personaId,
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: limit
      });

      if (error) {
        console.error('Error searching memories:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchMemories:', error);
      return [];
    }
  }
}

export const memoryExtractor = new MemoryExtractor();
