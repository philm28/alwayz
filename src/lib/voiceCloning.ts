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
        const fileExtension = sample.name.split('.').pop() || 'mp3';
        const samplePath = `voice-samples/${personaId}/sample-${i}-${Date.now()}.${fileExtension}`;

        console.log(`📤 Uploading voice sample ${i+1}/${audioSamples.length}:`, {
          name: sample.name,
          type: sample.type,
          size: sample.size,
          path: samplePath
        });

        const { data, error } = await supabase.storage
          .from('persona-content')
          .upload(samplePath, sample, {
            contentType: sample.type || 'audio/mpeg',
            upsert: false
          });

        if (error) {
          console.error('❌ Upload failed:', error);
          throw error;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('persona-content')
          .getPublicUrl(samplePath);

        console.log('✅ Sample uploaded successfully:', publicUrl);
        sampleUrls.push(publicUrl);
      }

      const characteristics = await this.analyzeVoiceCharacteristics(audioSamples, personaMetadata);

      // ✅ Start with placeholder — will be replaced by real ID after cloning
      const voiceProfile: VoiceProfile = {
        personaId,
        voiceModelId: `voice_${personaId}_${Date.now()}`, // placeholder only
        sampleAudioUrls: sampleUrls,
        voiceCharacteristics: characteristics,
        isCloned: false, // ✅ start false — only true after successful clone
        cloneQuality: this.calculateCloneQuality(audioSamples, characteristics)
      };

      // ✅ Update sample count first — independent of voice cloning
      await supabase
        .from('personas')
        .update({ voice_sample_count: audioSamples.length })
        .eq('id', personaId);

      // ✅ Attempt voice cloning — trainVoiceModel saves the real ID directly
      // and updates voiceProfile.voiceModelId in place
      if (audioSamples.length >= 1) {
        try {
          await this.trainVoiceModel(voiceProfile);
          // ✅ Only mark as cloned if trainVoiceModel succeeded
          // voiceProfile.voiceModelId is now the real ElevenLabs ID
          voiceProfile.isCloned = !voiceProfile.voiceModelId.startsWith('voice_');
        } catch (cloningError) {
          console.error('Voice cloning failed, keeping placeholder:', cloningError);
          // ✅ Don't throw — let the flow continue with fallback voice
          voiceProfile.isCloned = false;
        }
      }

      // ✅ Cache the final profile — real ID if cloning succeeded, placeholder if not
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
    if (audioSamples.length === 0) throw new Error('No audio samples provided');

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
    const totalDuration = audioSamples.reduce((sum, file) => sum + (file.size / 16000), 0);
    quality += Math.min(totalDuration / 300, 0.3);
    return Math.min(quality, 1.0);
  }

  async verifyElevenLabsKey(): Promise<{ valid: boolean; error?: string; subscription?: any }> {
    if (!ELEVENLABS_API_KEY) return { valid: false, error: 'API key not configured' };
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
        headers: { 'xi-api-key': ELEVENLABS_API_KEY }
      });
      if (!response.ok) {
        const errorText = await response.text();
        return { valid: false, error: `Status ${response.status}: ${errorText}` };
      }
      const userData = await response.json();
      return { valid: true, subscription: userData.subscription };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async trainVoiceModel(voiceProfile: VoiceProfile): Promise<void> {
    try {
      console.log('Training voice model for persona:', voiceProfile.personaId);

      if (!ELEVENLABS_API_KEY) {
        console.warn('ElevenLabs API key not configured, skipping voice cloning');
        return;
      }

      console.log('✅ ElevenLabs API key configured, proceeding with voice cloning...');

      const audioFiles: Blob[] = [];
      for (const url of voiceProfile.sampleAudioUrls) {
        console.log('📥 Fetching audio sample from:', url);
        const response = await fetch(url);
        const blob = await response.blob();
        console.log('📥 Blob received - type:', blob.type, 'size:', blob.size, 'bytes');
        audioFiles.push(blob);
      }

      const formData = new FormData();
      formData.append('name', `Persona_${voiceProfile.personaId}`);
      formData.append('description', `Voice clone for persona ${voiceProfile.personaId}`);

      audioFiles.forEach((blob, index) => {
        const fileExtension = blob.type.includes('webm') ? 'webm' :
                             blob.type.includes('wav') ? 'wav' :
                             blob.type.includes('m4a') ? 'm4a' :
                             blob.type.includes('mpeg') ? 'mp3' : 'mp3';
        console.log(`📎 Appending file ${index}: sample${index}.${fileExtension} (${blob.type})`);
        formData.append('files', blob, `sample${index}.${fileExtension}`);
      });

      console.log('📤 Sending voice cloning request to ElevenLabs...');

      const response = await fetch(`${ELEVENLABS_API_URL}/voices/add`, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ElevenLabs voice creation failed:', response.status, errorText);

        if (response.status === 401) {
          if (errorText.includes('missing_permissions')) {
            let missingPermission = 'voice cloning';
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.detail?.message) missingPermission = errorData.detail.message;
            } catch (e) {}
            throw new Error(`ELEVENLABS_PERMISSIONS_ERROR: ${missingPermission}`);
          }
          throw new Error('ELEVENLABS_AUTH_ERROR: Invalid or expired API key');
        }

        if (response.status === 422) {
          throw new Error('ELEVENLABS_VALIDATION_ERROR: Audio files may be too short or invalid format');
        }

        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const realVoiceId = data.voice_id;

      console.log('✅ ElevenLabs returned real voice ID:', realVoiceId);

      // ✅ Update the profile object in place BEFORE saving to Supabase
      voiceProfile.voiceModelId = realVoiceId;

      // ✅ Single save — only here, nowhere else
      const { error: updateError } = await supabase
        .from('personas')
        .update({ voice_model_id: realVoiceId })
        .eq('id', voiceProfile.personaId);

      if (updateError) {
        console.error('❌ Failed to save voice_id to Supabase:', updateError);
        throw updateError;
      }

      console.log('✅ Voice ID saved to Supabase successfully:', realVoiceId);

    } catch (error) {
      console.error('❌ Voice model training failed:', error);
      captureException(error as Error, { personaId: voiceProfile.personaId });
      throw error;
    }
  }

  async synthesizeSpeech(text: string, voiceModelId: string): Promise<Blob> {
    if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key not configured');
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceModelId}`, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true }
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('Speech synthesis error:', error);
      throw error;
    }
  }

  async synthesizeVoice(personaId: string, text: string, emotion?: string): Promise<ArrayBuffer> {
    try {
      let voiceProfile = this.voiceProfiles.get(personaId);

      if (!voiceProfile) {
        const { data } = await supabase
          .from('personas')
          .select('voice_model_id, gender')
          .eq('id', personaId)
          .single();

        if (data?.voice_model_id && !data.voice_model_id.startsWith('voice_')) {
          voiceProfile = {
            personaId,
            voiceModelId: data.voice_model_id,
            sampleAudioUrls: [],
            voiceCharacteristics: {
              pitch: 1.0, speed: 1.0, tone: 'warm', accent: 'neutral',
              gender: data.gender || 'neutral', age: 'middle', emotion: 'warm'
            },
            isCloned: true,
            cloneQuality: 0.8
          };
          this.voiceProfiles.set(personaId, voiceProfile);
        }
      }

      if (ELEVENLABS_API_KEY && voiceProfile?.isCloned && !voiceProfile.voiceModelId.startsWith('voice_')) {
        try {
          console.log('🎤 Attempting ElevenLabs synthesis with voice ID:', voiceProfile.voiceModelId);
          const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceProfile.voiceModelId}`, {
            method: 'POST',
            headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.5, similarity_boost: 0.85,
                style: emotion ? 0.5 : 0.2, use_speaker_boost: true
              }
            })
          });
          if (response.ok) {
            console.log('✅ Using ElevenLabs cloned voice');
            return await response.arrayBuffer();
          } else {
            console.warn('❌ ElevenLabs synthesis failed:', response.status);
          }
        } catch (error) {
          console.warn('❌ ElevenLabs error:', error);
        }
      }

      if (!openai) throw new Error('Neither ElevenLabs nor OpenAI configured for voice synthesis');

      const characteristics = voiceProfile?.voiceCharacteristics;
      const voiceMap: Record<string, string> = {
        'male-young': 'onyx', 'male-middle': 'onyx', 'male-elderly': 'onyx',
        'female-young': 'nova', 'female-middle': 'alloy', 'female-elderly': 'shimmer',
        'neutral': 'echo'
      };
      const voiceKey = characteristics ? `${characteristics.gender}-${characteristics.age}` : 'neutral';
      const selectedVoice = voiceMap[voiceKey] || 'alloy';

      const openAiResponse = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: selectedVoice as any,
        input: text,
        speed: characteristics?.speed || 1.0
      });

      return await openAiResponse.arrayBuffer();

    } catch (error) {
      console.error('Voice synthesis error:', error);
      throw error;
    }
  }

  async cloneVoiceFromSamples(personaId: string): Promise<boolean> {
    try {
      const voiceProfile = this.voiceProfiles.get(personaId);
      if (!voiceProfile) throw new Error('Voice profile not found');
      if (!ELEVENLABS_API_KEY) { console.warn('ElevenLabs API key not configured'); return false; }
      await this.trainVoiceModel(voiceProfile);
      return true;
    } catch (error) {
      console.error('Voice cloning error:', error);
      captureException(error as Error, { personaId });
      return false;
    }
  }

  async listAvailableVoices(): Promise<any[]> {
    if (!ELEVENLABS_API_KEY) return [];
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
        headers: { 'xi-api-key': ELEVENLABS_API_KEY }
      });
      if (!response.ok) throw new Error(`Failed to fetch voices: ${response.status}`);
      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  async fixInvalidVoiceId(personaId: string): Promise<boolean> {
    try {
      console.log('🔧 Attempting to fix invalid voice ID for persona:', personaId);

      const { data: persona, error: fetchError } = await supabase
        .from('personas')
        .select('voice_model_id')
        .eq('id', personaId)
        .single();

      if (fetchError || !persona) throw new Error('Persona not found');

      const currentVoiceId = persona.voice_model_id;
      if (!currentVoiceId || !currentVoiceId.startsWith('voice_')) {
        console.log('Voice ID is already valid or not set');
        return false;
      }

      const availableVoices = await this.listAvailableVoices();
      const matchingVoice = availableVoices.find(v =>
        v.name === `Persona_${personaId}` || v.labels?.persona_id === personaId
      );

      if (matchingVoice) {
        console.log('✅ Found matching voice in ElevenLabs:', matchingVoice.voice_id);
        const { error: updateError } = await supabase
          .from('personas')
          .update({ voice_model_id: matchingVoice.voice_id })
          .eq('id', personaId);
        if (updateError) throw updateError;
        this.voiceProfiles.delete(personaId);
        return true;
      } else {
        console.log('❌ No matching voice found. Clearing invalid voice ID...');
        await supabase
          .from('personas')
          .update({ voice_model_id: null })
          .eq('id', personaId);
        return false;
      }
    } catch (error) {
      console.error('Error fixing voice ID:', error);
      return false;
    }
  }

  async deleteVoice(voiceId: string): Promise<boolean> {
    if (!ELEVENLABS_API_KEY) return false;
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY }
      });
      return response.ok;
    } catch (error) {
      console.error('Error deleting voice:', error);
      return false;
    }
  }
}

export const voiceCloning = new VoiceCloning();
