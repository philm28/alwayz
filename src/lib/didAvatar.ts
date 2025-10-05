import { supabase } from './supabase';
import { captureException } from './monitoring';

const DID_API_KEY = import.meta.env.VITE_DID_API_KEY;
const DID_API_URL = 'https://api.d-id.com';

export interface DIDAvatar {
  id: string;
  personaId: string;
  sourceImageUrl: string;
  avatarVideoUrl?: string;
  status: 'processing' | 'completed' | 'error';
  createdAt: string;
}

export interface TalkingAvatarRequest {
  sourceImageUrl: string;
  audioUrl?: string;
  text?: string;
  voiceId?: string;
  config?: {
    stitch?: boolean;
    driver_expressions?: {
      expressions?: Array<{
        start_frame?: number;
        expression?: string;
        intensity?: number;
      }>;
    };
  };
}

export class DIDService {
  private async makeRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    if (!DID_API_KEY) {
      throw new Error('D-ID API key not configured');
    }

    const headers: HeadersInit = {
      'Authorization': `Basic ${DID_API_KEY}`,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${DID_API_URL}${endpoint}`, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `D-ID API error: ${response.status} - ${errorData.message || response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('D-ID API request failed:', error);
      throw error;
    }
  }

  async createTalkingAvatar(request: TalkingAvatarRequest): Promise<{
    id: string;
    status: string;
    result_url?: string;
  }> {
    try {
      const payload: any = {
        source_url: request.sourceImageUrl,
        script: {}
      };

      if (request.audioUrl) {
        payload.script.type = 'audio';
        payload.script.audio_url = request.audioUrl;
      } else if (request.text) {
        payload.script.type = 'text';
        payload.script.input = request.text;

        if (request.voiceId) {
          payload.script.provider = {
            type: 'microsoft',
            voice_id: request.voiceId
          };
        }
      } else {
        throw new Error('Either audioUrl or text must be provided');
      }

      if (request.config) {
        payload.config = request.config;
      }

      const response = await this.makeRequest('/talks', 'POST', payload);

      console.log('D-ID talking avatar created:', response);
      return response;
    } catch (error) {
      console.error('Error creating talking avatar:', error);
      captureException(error as Error, { request });
      throw error;
    }
  }

  async getTalkStatus(talkId: string): Promise<{
    id: string;
    status: string;
    result_url?: string;
    error?: any;
  }> {
    try {
      const response = await this.makeRequest(`/talks/${talkId}`, 'GET');
      return response;
    } catch (error) {
      console.error('Error getting talk status:', error);
      throw error;
    }
  }

  async waitForTalkCompletion(
    talkId: string,
    maxAttempts: number = 60,
    interval: number = 2000
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getTalkStatus(talkId);

      if (status.status === 'done' && status.result_url) {
        return status.result_url;
      }

      if (status.status === 'error') {
        throw new Error(`D-ID processing failed: ${JSON.stringify(status.error)}`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('D-ID processing timeout');
  }

  async createAvatarFromPhoto(
    personaId: string,
    photoUrl: string
  ): Promise<DIDAvatar> {
    try {
      const avatar: DIDAvatar = {
        id: `did_${Date.now()}`,
        personaId,
        sourceImageUrl: photoUrl,
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      await supabase.from('personas').update({
        metadata: {
          did_avatar: avatar,
          avatar_created_at: new Date().toISOString()
        }
      }).eq('id', personaId);

      return avatar;
    } catch (error) {
      console.error('Error creating D-ID avatar:', error);
      captureException(error as Error, { personaId, photoUrl });
      throw error;
    }
  }

  async generateTalkingVideo(
    personaId: string,
    sourceImageUrl: string,
    audioUrl: string
  ): Promise<string> {
    try {
      console.log('Creating talking avatar video with D-ID...', {
        personaId,
        sourceImageUrl,
        audioUrl
      });

      const talkResult = await this.createTalkingAvatar({
        sourceImageUrl,
        audioUrl,
        config: {
          stitch: true
        }
      });

      console.log('Waiting for D-ID processing...', talkResult.id);
      const videoUrl = await this.waitForTalkCompletion(talkResult.id);

      await supabase.from('personas').update({
        metadata: {
          latest_video_url: videoUrl,
          video_created_at: new Date().toISOString()
        }
      }).eq('id', personaId);

      return videoUrl;
    } catch (error) {
      console.error('Error generating talking video:', error);
      captureException(error as Error, { personaId });
      throw error;
    }
  }

  async generateTalkingVideoWithText(
    personaId: string,
    sourceImageUrl: string,
    text: string,
    voiceId?: string
  ): Promise<string> {
    try {
      console.log('Creating talking avatar video with text...', {
        personaId,
        text: text.substring(0, 50) + '...'
      });

      const talkResult = await this.createTalkingAvatar({
        sourceImageUrl,
        text,
        voiceId: voiceId || 'en-US-JennyNeural',
        config: {
          stitch: true
        }
      });

      console.log('Waiting for D-ID processing...', talkResult.id);
      const videoUrl = await this.waitForTalkCompletion(talkResult.id);

      return videoUrl;
    } catch (error) {
      console.error('Error generating talking video with text:', error);
      captureException(error as Error, { personaId });
      throw error;
    }
  }

  async listVoices(): Promise<any[]> {
    try {
      const response = await this.makeRequest('/tts/voices', 'GET');
      return response.voices || [];
    } catch (error) {
      console.error('Error listing voices:', error);
      return [];
    }
  }

  async getCredits(): Promise<{ remaining: number; total: number }> {
    try {
      const response = await this.makeRequest('/credits', 'GET');
      return {
        remaining: response.remaining || 0,
        total: response.total || 0
      };
    } catch (error) {
      console.error('Error getting credits:', error);
      return { remaining: 0, total: 0 };
    }
  }
}

export const didService = new DIDService();
