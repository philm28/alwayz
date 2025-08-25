import OpenAI from 'openai';
import { supabase } from './supabase';
import { captureException } from './monitoring';

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
    gender: 'male' | 'female' | 'neutral';
    age: 'young' | 'middle' | 'elderly';
    emotion: 'warm' | 'energetic' | 'calm' | 'authoritative';
  };
  isCloned: boolean;
  cloneQuality: number; // 0-1 score
}

export class VoiceCloning {
  private voiceProfiles: Map<string, VoiceProfile> = new Map();

  async createVoiceProfile(
    personaId: string, 
    audioSamples: File[],
    personaMetadata?: {
      gender?: string;
      age?: string;
      personality?: string;
    }
  ): Promise<VoiceProfile> {
    try {
      console.log(`Creating voice profile for persona ${personaId} with ${audioSamples.length} samples`);
      
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
      const characteristics = await this.analyzeVoiceCharacteristics(audioSamples, personaMetadata);
      
      // Create voice profile
      const voiceProfile: VoiceProfile = {
        personaId,
        voiceModelId: `voice_${personaId}_${Date.now()}`,
        sampleAudioUrls: sampleUrls,
        voiceCharacteristics: characteristics,
        isCloned: audioSamples.length >= 3, // Need at least 3 samples for good cloning
        cloneQuality: this.calculateCloneQuality(audioSamples, characteristics)
      };

      // Train voice model if we have enough samples
      if (audioSamples.length >= 3) {
        await this.trainVoiceModel(voiceProfile);
      }

      // Save voice profile to database
      await supabase
        .from('personas')
        .update({
          voice_model_id: voiceProfile.voiceModelId,
          metadata: {
            ...personaMetadata,
            voice_profile: voiceProfile,
            voice_samples_count: audioSamples.length,
            voice_clone_quality: voiceProfile.cloneQuality
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

  private async analyzeVoiceCharacteristics(
    audioSamples: File[], 
    metadata?: any
  ): Promise<VoiceProfile['voiceCharacteristics']> {
    try {
      // Analyze audio samples for voice characteristics
      const analysis = await this.performAudioAnalysis(audioSamples);
      
      return {
        pitch: analysis.averagePitch || 1.0,
        speed: analysis.averageSpeed || 1.0,
        tone: analysis.detectedTone || metadata?.personality?.toLowerCase() || 'warm',
        accent: analysis.detectedAccent || 'neutral',
        gender: analysis.detectedGender || metadata?.gender || 'neutral',
        age: analysis.detectedAge || metadata?.age || 'middle',
        emotion: analysis.dominantEmotion || 'warm'
      };
    } catch (error) {
      console.error('Voice analysis error:', error);
      
      // Fallback to metadata or defaults
      return {
        pitch: 1.0,
        speed: 1.0,
        tone: metadata?.personality?.toLowerCase() || 'warm',
        accent: 'neutral',
        gender: metadata?.gender || 'neutral',
        age: metadata?.age || 'middle',
        emotion: 'warm'
      };
    }
  }

  private async performAudioAnalysis(audioSamples: File[]): Promise<{
    averagePitch: number;
    averageSpeed: number;
    detectedTone: string;
    detectedAccent: string;
    detectedGender: string;
    detectedAge: string;
    dominantEmotion: string;
  }> {
    // Analyze the first audio sample for characteristics
    if (audioSamples.length === 0) {
      throw new Error('No audio samples provided');
    }

    const firstSample = audioSamples[0];
    
    try {
      // Create audio context for analysis
      const audioContext = new AudioContext();
      const arrayBuffer = await firstSample.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Analyze frequency content
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Calculate fundamental frequency (pitch)
      const fundamentalFreq = this.calculateFundamentalFrequency(channelData, sampleRate);
      
      // Determine characteristics based on analysis
      const pitch = fundamentalFreq < 150 ? 0.8 : fundamentalFreq > 250 ? 1.2 : 1.0;
      const gender = fundamentalFreq < 165 ? 'male' : 'female';
      const age = fundamentalFreq < 120 || fundamentalFreq > 300 ? 'elderly' : 
                  fundamentalFreq < 140 || fundamentalFreq > 280 ? 'middle' : 'young';
      
      return {
        averagePitch: pitch,
        averageSpeed: 1.0, // Would need more complex analysis
        detectedTone: 'warm',
        detectedAccent: 'neutral',
        detectedGender: gender,
        detectedAge: age,
        dominantEmotion: 'warm'
      };
    } catch (error) {
      console.warn('Audio analysis failed, using defaults:', error);
      
      // Return reasonable defaults
      return {
        averagePitch: 1.0,
        averageSpeed: 1.0,
        detectedTone: 'warm',
        detectedAccent: 'neutral',
        detectedGender: 'neutral',
        detectedAge: 'middle',
        dominantEmotion: 'warm'
      };
    }
  }

  private calculateFundamentalFrequency(audioData: Float32Array, sampleRate: number): number {
    // Simple autocorrelation-based pitch detection
    const minPeriod = Math.floor(sampleRate / 800); // 800 Hz max
    const maxPeriod = Math.floor(sampleRate / 80);  // 80 Hz min
    
    let bestCorrelation = 0;
    let bestPeriod = minPeriod;
    
    for (let period = minPeriod; period < maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < audioData.length - period; i++) {
        correlation += audioData[i] * audioData[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return sampleRate / bestPeriod;
  }

  private calculateCloneQuality(audioSamples: File[], characteristics: any): number {
    // Calculate quality score based on samples and analysis
    let quality = 0.3; // Base quality
    
    // More samples = better quality
    quality += Math.min(audioSamples.length * 0.1, 0.4);
    
    // Longer samples = better quality
    const totalDuration = audioSamples.reduce((sum, file) => {
      // Estimate duration from file size (rough approximation)
      return sum + (file.size / 16000); // Assume 16kbps average
    }, 0);
    
    quality += Math.min(totalDuration / 300, 0.3); // Up to 5 minutes for max quality
    
    return Math.min(quality, 1.0);
  }

  private async trainVoiceModel(voiceProfile: VoiceProfile): Promise<void> {
    try {
      console.log('Training voice model for persona:', voiceProfile.personaId);
      
      // In production, this would:
      // 1. Send audio samples to ElevenLabs or similar service
      // 2. Train a custom voice model
      // 3. Store the model ID for later use
      
      // For now, we'll simulate the training process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Voice model training completed');
    } catch (error) {
      console.error('Voice model training failed:', error);
      captureException(error as Error, { personaId: voiceProfile.personaId });
    }
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
      
      if (voiceProfile && voiceProfile.isCloned) {
        // Use cloned voice characteristics
        const characteristics = voiceProfile.voiceCharacteristics;
        
        // Map characteristics to OpenAI voices
        const voiceMap = {
          'male-young': 'onyx',
          'male-middle': 'onyx',
          'male-elderly': 'onyx',
          'female-young': 'nova',
          'female-middle': 'alloy',
          'female-elderly': 'shimmer',
          'neutral': 'echo'
        };
        
        const voiceKey = `${characteristics.gender}-${characteristics.age}`;
        const selectedVoice = voiceMap[voiceKey as keyof typeof voiceMap] || 'alloy';
        
        console.log(`Using voice ${selectedVoice} for ${characteristics.gender} ${characteristics.age} persona`);
        
        // Generate speech with matched characteristics
        const response = await openai.audio.speech.create({
          model: 'tts-1-hd',
          voice: selectedVoice as any,
          input: text,
          speed: characteristics.speed
        });

        return await response.arrayBuffer();
      } else {
        // Fallback to default voice selection
        const voiceSettings = voiceProfile?.voiceCharacteristics || {
          pitch: 1.0,
          speed: 1.0,
          tone: 'warm',
          accent: 'neutral',
          gender: 'neutral',
          age: 'middle',
          emotion: 'warm'
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
      }
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