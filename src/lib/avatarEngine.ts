import { supabase } from './supabase';

export interface AvatarConfig {
  personaId: string;
  videoUrl?: string;
  photoUrl?: string;
  voiceModel?: string;
  lipSyncEnabled: boolean;
  emotionMapping: boolean;
}

export interface VideoFrame {
  timestamp: number;
  expression: 'neutral' | 'happy' | 'sad' | 'surprised' | 'speaking';
  intensity: number;
}

export class AvatarEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isAnimating = false;
  private currentExpression = 'neutral';

  constructor(private config: AvatarConfig) {
    this.initializeCanvas();
  }

  private initializeCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');
  }

  async loadPersonaVideo(videoUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.videoElement = document.createElement('video');
      this.videoElement.crossOrigin = 'anonymous';
      this.videoElement.muted = true;
      this.videoElement.loop = true;
      
      this.videoElement.onloadeddata = () => {
        console.log('Persona video loaded successfully');
        resolve();
      };
      
      this.videoElement.onerror = () => {
        reject(new Error('Failed to load persona video'));
      };
      
      this.videoElement.src = videoUrl;
    });
  }

  async generateTalkingAvatar(audioBuffer: ArrayBuffer, text: string): Promise<Blob> {
    if (!this.videoElement || !this.canvas || !this.ctx) {
      throw new Error('Avatar engine not initialized');
    }

    try {
      // Create audio context for lip sync analysis
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Analyze audio for lip sync timing
      const lipSyncData = this.analyzeLipSync(audioData);
      
      // Generate video frames with lip sync
      const frames = await this.generateVideoFrames(lipSyncData, text);
      
      // Combine frames into video
      const videoBlob = await this.renderVideoWithAudio(frames, audioBuffer);
      
      return videoBlob;
    } catch (error) {
      console.error('Error generating talking avatar:', error);
      throw error;
    }
  }

  private analyzeLipSync(audioData: AudioBuffer): VideoFrame[] {
    const frames: VideoFrame[] = [];
    const sampleRate = audioData.sampleRate;
    const frameRate = 30; // 30 FPS
    const samplesPerFrame = sampleRate / frameRate;
    
    const channelData = audioData.getChannelData(0);
    
    for (let i = 0; i < channelData.length; i += samplesPerFrame) {
      const frameData = channelData.slice(i, i + samplesPerFrame);
      const amplitude = this.calculateRMS(frameData);
      
      // Determine mouth movement based on audio amplitude
      const isSpeaking = amplitude > 0.01;
      const intensity = Math.min(amplitude * 10, 1);
      
      frames.push({
        timestamp: (i / sampleRate) * 1000,
        expression: isSpeaking ? 'speaking' : 'neutral',
        intensity
      });
    }
    
    return frames;
  }

  private calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  private async generateVideoFrames(lipSyncData: VideoFrame[], text: string): Promise<ImageData[]> {
    const frames: ImageData[] = [];
    
    if (!this.videoElement || !this.ctx) {
      throw new Error('Video element not initialized');
    }

    // Play the base video
    this.videoElement.currentTime = 0;
    await this.videoElement.play();

    for (const frame of lipSyncData) {
      // Seek to appropriate time in base video
      this.videoElement.currentTime = frame.timestamp / 1000;
      
      // Wait for video to seek
      await new Promise(resolve => setTimeout(resolve, 33)); // ~30fps
      
      // Draw video frame to canvas
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas!.width, this.canvas!.height);
      
      // Apply lip sync modifications
      if (frame.expression === 'speaking') {
        this.applyMouthMovement(frame.intensity);
      }
      
      // Capture frame
      const imageData = this.ctx.getImageData(0, 0, this.canvas!.width, this.canvas!.height);
      frames.push(imageData);
    }

    return frames;
  }

  private applyMouthMovement(intensity: number) {
    if (!this.ctx) return;
    
    // Simple mouth animation overlay
    // In production, this would use more sophisticated facial animation
    const mouthY = this.canvas!.height * 0.7;
    const mouthX = this.canvas!.width * 0.5;
    const mouthWidth = 20 + (intensity * 15);
    const mouthHeight = 5 + (intensity * 10);
    
    this.ctx.fillStyle = '#2D1B69'; // Dark color for mouth
    this.ctx.beginPath();
    this.ctx.ellipse(mouthX, mouthY, mouthWidth, mouthHeight, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private async renderVideoWithAudio(frames: ImageData[], audioBuffer: ArrayBuffer): Promise<Blob> {
    // This is a simplified version - in production, you'd use WebCodecs API or similar
    // For now, we'll return the audio as the main output
    return new Blob([audioBuffer], { type: 'audio/mpeg' });
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  destroy() {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}

export async function createPersonaAvatar(
  personaId: string,
  referenceImage: File,
  referenceVideo?: File
): Promise<string> {
  try {
    // Upload reference media to storage
    const timestamp = Date.now();
    const imagePath = `avatars/${personaId}/reference-${timestamp}.jpg`;
    
    const { data: imageUpload, error: imageError } = await supabase.storage
      .from('persona-content')
      .upload(imagePath, referenceImage);

    if (imageError) throw imageError;

    // Get public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('persona-content')
      .getPublicUrl(imagePath);

    // If video is provided, upload it too
    let videoUrl = null;
    if (referenceVideo) {
      const videoPath = `avatars/${personaId}/reference-video-${timestamp}.mp4`;
      
      const { data: videoUpload, error: videoError } = await supabase.storage
        .from('persona-content')
        .upload(videoPath, referenceVideo);

      if (!videoError) {
        const { data: { publicUrl: videoPublicUrl } } = supabase.storage
          .from('persona-content')
          .getPublicUrl(videoPath);
        videoUrl = videoPublicUrl;
      }
    }

    // Update persona with avatar information
    await supabase
      .from('personas')
      .update({
        avatar_url: publicUrl,
        metadata: {
          video_avatar_url: videoUrl,
          avatar_type: 'realistic',
          created_at: new Date().toISOString()
        }
      })
      .eq('id', personaId);

    return publicUrl;
  } catch (error) {
    console.error('Error creating persona avatar:', error);
    throw error;
  }
}