import OpenAI from 'openai';
import { supabase } from './supabase';
import { captureException } from './monitoring';

const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}) : null;

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

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
  cloneQuality: number;
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

      const characteristics = await this.analyzeVoiceCharacteristics(audioSamples, personaMetadata);

      const voiceProfile: VoiceProfile = {
        personaId,
        voiceModelId: `voice_${personaId}_${Date.now()}`,
        sampleAudioUrls: sampleUrls,
        voiceCharacteristics: characteristics,
        isCloned: audioSamples.length >= 3,
        cloneQuality: this.calculateCloneQuality(audioSamples, characteristics)
      };

      if (audioSamples.length >= 3) {
        await this.trainVoiceModel(voiceProfile);
      }

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
    if (audioSamples.length === 0) {
      throw new Error('No audio samples provided');
    }

    const firstSample = audioSamples[0];

    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await firstSample.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      const fundamentalFreq = this.calculateFundamentalFrequency(channelData, sampleRate);

      const pitch = fundamentalFreq < 150 ? 0.8 : fundamentalFreq > 250 ? 1.2 : 1.0;
      const gender = fundamentalFreq < 165 ? 'male' : 'female';
      const age = fundamentalFreq < 120 || fundamentalFreq > 300 ? 'elderly' :
                  fundamentalFreq < 140 || fundamentalFreq > 280 ? 'middle' : 'young';

      return {
        averagePitch: pitch,
        averageSpeed: 1.0,
        detectedTone: 'warm',
        detectedAccent: 'neutral',
        detectedGender: gender,
        detectedAge: age,
        dominantEmotion: 'warm'
      };
    } catch (error) {
      console.warn('Audio analysis failed, using defaults:', error);

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
    const minPeriod = Math.floor(sampleRate / 800);
    const maxPeriod = Math.floor(sampleRate / 80);

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
    let quality = 0.3;

    quality += Math.min(audioSamples.length * 0.1, 0.4);

    const totalDuration = audioSamples.reduce((sum, file) => {
      return sum + (file.size / 16000);
    }, 0);

    quality += Math.min(totalDuration / 300, 0.3);

    return Math.min(quality, 1.0);
  }

  private async trainVoiceModel(voiceProfile: VoiceProfile): Promise<void> {
    try {
      console.log('Training voice model for persona:', voiceProfile.personaId);

      if (!ELEVENLABS_API_KEY) {
        console.warn('ElevenLabs API key not configured, skipping voice cloning');
        return;
      }

      const audioFiles: Blob[] = [];
      for (const url of voiceProfile.sampleAudioUrls) {
        const response = await fetch(url);
        const blob = await response.blob();
        audioFiles.push(blob);
      }

      const formData = new FormData();
      formData.append('name', `Persona_${voiceProfile.personaId}`);
      formData.append('description', `Voice clone for persona ${voiceProfile.personaId}`);

      audioFiles.forEach((blob, index) => {
        formData.append('files', blob, `sample${index}.mp3`);
      });

      const response = await fetch(`${ELEVENLABS_API_URL}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      const data = await response.json();
      voiceProfile.voiceModelId = data.voice_id;

      console.log('Voice model training completed with ID:', data.voice_id);
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
    try {
      const voiceProfile = this.voiceProfiles.get(personaId);

      if (ELEVENLABS_API_KEY && voiceProfile && voiceProfile.isCloned) {
        try {
          const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceProfile.voiceModelId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: emotion ? 0.5 : 0,
                use_speaker_boost: true
              }
            })
          });

          if (response.ok) {
            console.log('Using ElevenLabs for voice synthesis');
            return await response.arrayBuffer();
          } else {
            console.warn('ElevenLabs synthesis failed, falling back to OpenAI');
          }
        } catch (error) {
          console.warn('ElevenLabs error, falling back to OpenAI:', error);
        }
      }

      if (!openai) {
        throw new Error('Neither ElevenLabs nor OpenAI configured for voice synthesis');
      }

      if (voiceProfile && voiceProfile.isCloned) {
        const characteristics = voiceProfile.voiceCharacteristics;

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

        console.log(`Using OpenAI voice ${selectedVoice} for ${characteristics.gender} ${characteristics.age} persona`);

        const response = await openai.audio.speech.create({
          model: 'tts-1-hd',
          voice: selectedVoice as any,
          input: text,
          speed: characteristics.speed
        });

        return await response.arrayBuffer();
      } else {
        const voiceSettings = voiceProfile?.voiceCharacteristics || {
          pitch: 1.0,
          speed: 1.0,
          tone: 'warm',
          accent: 'neutral',
          gender: 'neutral',
          age: 'middle',
          emotion: 'warm'
        };

        const voiceMap = {
          warm: 'alloy',
          gentle: 'echo',
          energetic: 'fable',
          mature: 'onyx',
          youthful: 'nova',
          professional: 'shimmer'
        };

        const selectedVoice = voiceMap[voiceSettings.tone as keyof typeof voiceMap] || 'alloy';

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

      if (!ELEVENLABS_API_KEY) {
        console.warn('ElevenLabs API key not configured');
        return false;
      }

      console.log('Voice cloning initiated for persona:', personaId);
      console.log('Audio samples:', voiceProfile.sampleAudioUrls.length);

      await this.trainVoiceModel(voiceProfile);

      await supabase
        .from('personas')
        .update({
          voice_model_id: voiceProfile.voiceModelId,
          metadata: {
            ...voiceProfile,
            voice_cloned: true,
            voice_clone_date: new Date().toISOString(),
            voice_provider: 'elevenlabs'
          }
        })
        .eq('id', personaId);

      return true;
    } catch (error) {
      console.error('Voice cloning error:', error);
      captureException(error as Error, { personaId });
      return false;
    }
  }

  async listAvailableVoices(): Promise<any[]> {
    if (!ELEVENLABS_API_KEY) {
      console.warn('ElevenLabs API key not configured');
      return [];
    }

    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  async deleteVoice(voiceId: string): Promise<boolean> {
    if (!ELEVENLABS_API_KEY) {
      return false;
    }

    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error deleting voice:', error);
      return false;
    }
  }
}

export const voiceCloning = new VoiceCloning();
