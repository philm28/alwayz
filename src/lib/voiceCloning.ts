import OpenAI from 'openai';
import { supabase } from './supabase';

const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}) : null;

export interface VoiceProfile {
  personaId: string;
  voiceModelId: string;
  sampleAudioUrls: string[];
  voiceCharacteristics: {
    pitch: number;
    speed: number;
    tone: string;
    accent: string;
  };
}

export class VoiceCloning {
  private voiceProfiles: Map<string, VoiceProfile> = new Map();

  async createVoiceProfile(
    personaId: string, 
    audioSamples: File[]
  ): Promise<VoiceProfile> {
    try {
      // Upload audio samples to storage
      const sampleUrls: string[] = [];
      
      for (let i = 0; i < audioSamples.length; i++) {
        const sample = audioSamples[i];
        const samplePath = `voice-samples/${personaId}/sample-${i}-${Date.now()}.mp3`;
        
        const { data, error } = await supabase.storage
          .from('persona-content')
          .upload(samplePath, sample);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('persona-content')
          .getPublicUrl(samplePath);
        
        sampleUrls.push(publicUrl);
      }

      // Analyze voice characteristics
      const characteristics = await this.analyzeVoiceCharacteristics(audioSamples);
      
      // Create voice profile
      const voiceProfile: VoiceProfile = {
        personaId,
        voiceModelId: `voice_${personaId}_${Date.now()}`,
        sampleAudioUrls: sampleUrls,
        voiceCharacteristics: characteristics
      };

      // Save voice profile to database
      await supabase
        .from('personas')
        .update({
          voice_model_id: voiceProfile.voiceModelId,
          metadata: {
            voice_profile: voiceProfile,
            voice_samples_count: audioSamples.length
          }
        })
        .eq('id', personaId);

      this.voiceProfiles.set(personaId, voiceProfile);
      return voiceProfile;
    } catch (error) {
      console.error('Error creating voice profile:', error);
      throw error;
    }
  }

  private async analyzeVoiceCharacteristics(audioSamples: File[]): Promise<VoiceProfile['voiceCharacteristics']> {
    // In production, this would use advanced audio analysis
    // For now, we'll provide reasonable defaults
    return {
      pitch: 1.0,
      speed: 1.0,
      tone: 'warm',
      accent: 'neutral'
    };
  }

  async synthesizeVoice(
    personaId: string, 
    text: string, 
    emotion?: string
  ): Promise<ArrayBuffer> {
    if (!openai) {
      throw new Error('OpenAI not configured for voice synthesis');
    }

    try {
      const voiceProfile = this.voiceProfiles.get(personaId);
      
      // Get voice settings from profile or use defaults
      const voiceSettings = voiceProfile?.voiceCharacteristics || {
        pitch: 1.0,
        speed: 1.0,
        tone: 'warm',
        accent: 'neutral'
      };

      // Choose appropriate OpenAI voice based on characteristics
      const voiceMap = {
        warm: 'alloy',
        gentle: 'echo',
        energetic: 'fable',
        mature: 'onyx',
        youthful: 'nova',
        professional: 'shimmer'
      };

      const selectedVoice = voiceMap[voiceSettings.tone as keyof typeof voiceMap] || 'alloy';

      // Generate speech with OpenAI TTS
      const response = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: selectedVoice as any,
        input: text,
        speed: voiceSettings.speed
      });

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Voice synthesis error:', error);
      throw error;
    }
  }

  async cloneVoiceFromSamples(personaId: string): Promise<boolean> {
    try {
      const voiceProfile = this.voiceProfiles.get(personaId);
      if (!voiceProfile) {
        throw new Error('Voice profile not found');
      }

      // In production, this would:
      // 1. Send audio samples to a voice cloning service (ElevenLabs, Murf, etc.)
      // 2. Train a custom voice model
      // 3. Return the trained model ID
      
      console.log('Voice cloning initiated for persona:', personaId);
      console.log('Audio samples:', voiceProfile.sampleAudioUrls.length);
      
      // Simulate voice cloning process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update persona with cloned voice status
      await supabase
        .from('personas')
        .update({
          metadata: {
            ...voiceProfile,
            voice_cloned: true,
            voice_clone_date: new Date().toISOString()
          }
        })
        .eq('id', personaId);

      return true;
    } catch (error) {
      console.error('Voice cloning error:', error);
      return false;
    }
  }
}

export const voiceCloning = new VoiceCloning();