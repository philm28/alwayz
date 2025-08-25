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
      console.log('Initializing realistic persona:', { personaId, name, referencePhoto, referenceVideo, voiceSamples });
      
      // Get persona data and uploaded content
      const [personaResponse, contentResponse] = await Promise.all([
        supabase.from('personas').select('*').eq('id', personaId).single(),
        supabase.from('persona_content').select('*').eq('persona_id', personaId).eq('processing_status', 'completed')
      ]);

      const personaData = personaResponse.data;
      const uploadedContent = contentResponse.data || [];

      // Organize content by type
      const photos = uploadedContent
        .filter(c => c.content_type === 'image' || c.file_name?.match(/\.(jpg|jpeg|png|gif)$/i))
        .map(c => c.file_url)
        .filter(Boolean);
      
      const videos = uploadedContent
        .filter(c => c.content_type === 'video' || c.file_name?.match(/\.(mp4|mov|avi)$/i))
        .map(c => c.file_url)
        .filter(Boolean);
      
      const audioSamples = uploadedContent
        .filter(c => c.content_type === 'audio' || c.file_name?.match(/\.(mp3|wav|m4a)$/i))
        .map(c => c.file_url)
        .filter(Boolean);

      // Use uploaded content with fallbacks
      const finalPhotoUrls = photos.length > 0 ? photos : (referencePhoto ? [referencePhoto] : []);
      const finalVideoUrl = videos[0] || referenceVideo;
      const finalVoiceSamples = audioSamples.length > 0 ? audioSamples : (voiceSamples || []);

      console.log('Content summary:', {
        photos: finalPhotoUrls.length,
        videos: videos.length,
        audioSamples: finalVoiceSamples.length
      });

      // Create avatar engine
      const avatarEngine = new AvatarEngine({
        personaId,
        photoUrl: finalPhotoUrls[0],
        photoUrls: finalPhotoUrls,
        videoUrl: finalVideoUrl,
        lipSyncEnabled: true,
        emotionMapping: true,
        faceMapping: finalPhotoUrls.length > 1,
        expressionRange: ['neutral', 'happy', 'speaking', 'surprised']
      });

      // Load reference video if available
      if (finalVideoUrl) {
        await avatarEngine.loadPersonaVideo(finalVideoUrl);
      }

      // Initialize voice profile if samples available
      let isVoiceReady = false;
      if (finalVoiceSamples.length > 0) {
        try {
          // Convert URLs to File objects for voice cloning
          const audioFiles = await Promise.all(
            finalVoiceSamples.slice(0, 5).map(async (url) => {
              const response = await fetch(url);
              const blob = await response.blob();
              return new File([blob], `voice-sample-${Date.now()}.mp3`, { type: 'audio/mpeg' });
            })
          );
          
          // Create voice profile with persona metadata
          await voiceCloning.createVoiceProfile(personaId, audioFiles, {
            gender: personaData?.metadata?.gender,
            age: personaData?.metadata?.age,
            personality: personaData?.personality_traits
          });
          
          isVoiceReady = true;
          console.log('Voice profile created successfully');
        } catch (voiceError) {
          console.warn('Voice profile creation failed:', voiceError);
        }
      }

      const persona: RealisticPersona = {
        id: personaId,
        name,
        avatarEngine,
        isVideoReady: finalPhotoUrls.length > 0 || !!finalVideoUrl,
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