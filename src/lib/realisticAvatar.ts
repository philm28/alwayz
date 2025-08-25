import { AvatarEngine } from './avatarEngine';
import { voiceCloning } from './voiceCloning';
import { supabase } from './supabase';

export interface RealisticPersona {
  id: string;
  name: string;
  avatarEngine: AvatarEngine;
  isVideoReady: boolean;
  isVoiceReady: boolean;
  currentEmotion: string;
}

export class RealisticAvatarManager {
  private personas: Map<string, RealisticPersona> = new Map();
  private currentlyPlaying: string | null = null;

  async initializePersona(
    personaId: string,
    name: string,
    referencePhoto?: string,
    referenceVideo?: string,
    voiceSamples?: string[]
  ): Promise<RealisticPersona> {
    try {
      // Get uploaded content from database
      const { data: uploadedContent } = await supabase
        .from('persona-content')
        .select('*')
        .eq('persona_id', personaId)
        .eq('processing_status', 'completed');

      // Find the best avatar content from uploads
      const photoContent = uploadedContent?.find(c => c.content_type === 'image') || 
                          uploadedContent?.find(c => c.file_name?.match(/\.(jpg|jpeg|png|gif)$/i));
      const videoContent = uploadedContent?.find(c => c.content_type === 'video') ||
                          uploadedContent?.find(c => c.file_name?.match(/\.(mp4|mov|avi)$/i));
      const audioContent = uploadedContent?.filter(c => c.content_type === 'audio' ||
                          c.file_name?.match(/\.(mp3|wav|m4a)$/i));

      // Use uploaded content or fallback to provided URLs
      const finalPhotoUrl = photoContent?.file_url || referencePhoto;
      const finalVideoUrl = videoContent?.file_url || referenceVideo;
      const finalVoiceSamples = audioContent?.map(a => a.file_url) || voiceSamples || [];

      // Create avatar engine
      const avatarEngine = new AvatarEngine({
        personaId,
        photoUrl: finalPhotoUrl,
        videoUrl: finalVideoUrl,
        lipSyncEnabled: true,
        emotionMapping: true
      });

      // Load reference video if available
      if (finalVideoUrl) {
        await avatarEngine.loadPersonaVideo(finalVideoUrl);
      }

      // Initialize voice profile if samples available
      let isVoiceReady = false;
      if (finalVoiceSamples && finalVoiceSamples.length > 0) {
        // In production, load actual audio files and create voice profile
        isVoiceReady = true;
      }

      const persona: RealisticPersona = {
        id: personaId,
        name,
        avatarEngine,
        isVideoReady: !!finalVideoUrl,
        isVoiceReady,
        currentEmotion: 'neutral'
      };

      this.personas.set(personaId, persona);
      return persona;
    } catch (error) {
      console.error('Error initializing realistic persona:', error);
      throw error;
    }
  }

  async generateResponse(
    personaId: string,
    message: string,
    emotion?: string
  ): Promise<{
    text: string;
    audioBlob?: Blob;
    videoBlob?: Blob;
  }> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new Error('Persona not found');
    }

    try {
      // Generate text response using existing AI engine
      const { AIPersonaEngine } = await import('./ai');
      
      // Get persona data from database
      const { data: personaData } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (!personaData) {
        throw new Error('Persona data not found');
      }

      const personaContext = {
        id: personaData.id,
        name: personaData.name,
        personality_traits: personaData.personality_traits || '',
        common_phrases: personaData.common_phrases || [],
        relationship: personaData.relationship || '',
        memories: [],
        conversationHistory: []
      };

      const aiEngine = new AIPersonaEngine(personaContext);
      const textResponse = await aiEngine.generateResponse(message);

      // Generate voice response
      let audioBlob: Blob | undefined;
      if (persona.isVoiceReady) {
        try {
          const audioBuffer = await voiceCloning.synthesizeVoice(
            personaId, 
            textResponse, 
            emotion
          );
          audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        } catch (voiceError) {
          console.warn('Voice synthesis failed, continuing without audio:', voiceError);
        }
      }

      // Generate video response with lip sync
      let videoBlob: Blob | undefined;
      if (persona.isVideoReady && audioBlob) {
        try {
          const audioBuffer = await audioBlob.arrayBuffer();
          videoBlob = await persona.avatarEngine.generateTalkingAvatar(
            audioBuffer, 
            textResponse
          );
        } catch (videoError) {
          console.warn('Video generation failed, continuing without video:', videoError);
        }
      }

      // Update persona emotion
      persona.currentEmotion = emotion || 'neutral';

      return {
        text: textResponse,
        audioBlob,
        videoBlob
      };
    } catch (error) {
      console.error('Error generating realistic response:', error);
      throw error;
    }
  }

  async uploadTrainingMedia(
    personaId: string,
    files: File[]
  ): Promise<{
    photos: string[];
    videos: string[];
    audioSamples: string[];
  }> {
    const photos: string[] = [];
    const videos: string[] = [];
    const audioSamples: string[] = [];

    for (const file of files) {
      try {
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        let filePath = '';

        if (file.type.startsWith('image/')) {
          filePath = `avatars/${personaId}/photos/${fileName}`;
        } else if (file.type.startsWith('video/')) {
          filePath = `avatars/${personaId}/videos/${fileName}`;
        } else if (file.type.startsWith('audio/')) {
          filePath = `avatars/${personaId}/audio/${fileName}`;
        } else {
          continue; // Skip unsupported file types
        }

        const { data, error } = await supabase.storage
          .from('persona-content')
          .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('persona-content')
          .getPublicUrl(filePath);

        if (file.type.startsWith('image/')) {
          photos.push(publicUrl);
        } else if (file.type.startsWith('video/')) {
          videos.push(publicUrl);
        } else if (file.type.startsWith('audio/')) {
          audioSamples.push(publicUrl);
        }

        // Save metadata to database
        await supabase.from('persona_content').insert({
          persona_id: personaId,
          content_type: file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 'audio',
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          metadata: {
            purpose: 'avatar_training',
            upload_date: new Date().toISOString()
          },
          processing_status: 'completed'
        });

      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }

    return { photos, videos, audioSamples };
  }

  getPersona(personaId: string): RealisticPersona | undefined {
    return this.personas.get(personaId);
  }

  async destroyPersona(personaId: string): Promise<void> {
    const persona = this.personas.get(personaId);
    if (persona) {
      persona.avatarEngine.destroy();
      this.personas.delete(personaId);
    }
  }
}

export const realisticAvatarManager = new RealisticAvatarManager();