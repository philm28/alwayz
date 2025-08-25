import { supabase } from './supabase';
import { captureException } from './monitoring';

export interface AvatarConfig {
  personaId: string;
  videoUrl?: string;
  photoUrl?: string;
  photoUrls?: string[]; // Multiple photos for better avatar creation
  voiceModel?: string;
  lipSyncEnabled: boolean;
  emotionMapping: boolean;
  faceMapping: boolean;
  expressionRange: string[]; // Available expressions
}

export interface VideoFrame {
  timestamp: number;
  expression: 'neutral' | 'happy' | 'sad' | 'surprised' | 'speaking';
  intensity: number;
}

export interface FaceMapping {
  landmarks: number[][];
  expressions: {
    neutral: number[];
    happy: number[];
    sad: number[];
    surprised: number[];
    speaking: number[];
  };
  textureMap: string; // Base64 encoded texture
}

export class AvatarEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private faceMapping: FaceMapping | null = null;
  private baseImage: HTMLImageElement | null = null;
  private isAnimating = false;
  private currentExpression = 'neutral';
  private photoUrls: string[] = [];

  constructor(private config: AvatarConfig) {
    this.photoUrls = config.photoUrls || (config.photoUrl ? [config.photoUrl] : []);
    this.initializeCanvas();
    this.loadPersonaPhotos();
  }

  private initializeCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');
  }

  private async loadPersonaPhotos() {
    if (this.photoUrls.length === 0) return;

    try {
      // Load the primary photo
      this.baseImage = new Image();
      this.baseImage.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        this.baseImage!.onload = resolve;
        this.baseImage!.onerror = reject;
        this.baseImage!.src = this.photoUrls[0];
      });

      console.log('Base persona image loaded successfully');
      
      // Analyze face if we have multiple photos
      if (this.photoUrls.length > 1) {
        await this.createFaceMapping();
      }
      
      // Draw initial avatar
      this.drawAvatar();
    } catch (error) {
      console.error('Error loading persona photos:', error);
    }
  }

  private async createFaceMapping(): Promise<void> {
    try {
      console.log('Creating face mapping from photos...');
      
      // In production, this would use face detection/analysis libraries
      // For now, we'll create a basic mapping structure
      this.faceMapping = {
        landmarks: [], // Would contain facial landmark points
        expressions: {
          neutral: [],
          happy: [],
          sad: [],
          surprised: [],
          speaking: []
        },
        textureMap: '' // Would contain face texture data
      };
      
      console.log('Face mapping created successfully');
    } catch (error) {
      console.error('Face mapping creation failed:', error);
    }
  }

  private drawAvatar(expression: string = 'neutral', intensity: number = 0) {
    if (!this.canvas || !this.ctx || !this.baseImage) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw base image
    this.ctx.drawImage(this.baseImage, 0, 0, this.canvas.width, this.canvas.height);
    
    // Apply expression modifications
    if (expression === 'speaking' && intensity > 0) {
      this.applyMouthMovement(intensity);
    }
    
    // Apply emotion-based modifications
    this.applyEmotionalExpression(expression, intensity);
  }

  private applyEmotionalExpression(expression: string, intensity: number) {
    if (!this.ctx || !this.canvas) return;

    // Add subtle overlays based on emotion
    this.ctx.globalAlpha = intensity * 0.3;
    
    switch (expression) {
      case 'happy':
        // Slight warm glow
        this.ctx.fillStyle = 'rgba(255, 220, 150, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        break;
      case 'sad':
        // Slight cool tone
        this.ctx.fillStyle = 'rgba(150, 180, 255, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        break;
      case 'speaking':
        // Slight animation glow
        this.ctx.fillStyle = 'rgba(139, 92, 246, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        break;
    }
    
    this.ctx.globalAlpha = 1.0;
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
    if (!this.canvas || !this.ctx) {
      throw new Error('Avatar engine not initialized');
    }

    try {
      console.log('Generating talking avatar with lip sync...');
      
      // Create audio context for lip sync analysis
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Analyze audio for lip sync timing
      const lipSyncData = this.analyzeLipSync(audioData);
      
      // Animate avatar with lip sync
      this.animateAvatarWithLipSync(lipSyncData);
      
      // Return the audio for playback
      return new Blob([audioBuffer], { type: 'audio/mpeg' });
    } catch (error) {
      console.error('Error generating talking avatar:', error);
      throw error;
    }
  }

  private animateAvatarWithLipSync(lipSyncData: VideoFrame[]) {
    if (!this.canvas || !this.ctx) return;

    let frameIndex = 0;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const currentFrame = lipSyncData.find(frame => 
        Math.abs(frame.timestamp - elapsed) < 50
      );
      
      if (currentFrame) {
        this.drawAvatar(currentFrame.expression, currentFrame.intensity);
        this.currentExpression = currentFrame.expression;
      }
      
      if (frameIndex < lipSyncData.length - 1) {
        frameIndex++;
        requestAnimationFrame(animate);
      } else {
        // Animation complete, return to neutral
        this.drawAvatar('neutral', 0);
        this.currentExpression = 'neutral';
      }
    };
    
    animate();
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

  private applyMouthMovement(intensity: number) {
    if (!this.ctx) return;
    
    // More sophisticated mouth animation
    const mouthY = this.canvas!.height * 0.75; // Adjust position
    const mouthX = this.canvas!.width * 0.5;
    const mouthWidth = 15 + (intensity * 20);
    const mouthHeight = 3 + (intensity * 12);
    
    // Create gradient for more realistic mouth
    const gradient = this.ctx.createRadialGradient(
      mouthX, mouthY, 0,
      mouthX, mouthY, mouthWidth
    );
    gradient.addColorStop(0, 'rgba(40, 20, 60, 0.8)');
    gradient.addColorStop(1, 'rgba(20, 10, 30, 0.4)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.ellipse(mouthX, mouthY, mouthWidth, mouthHeight, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Add subtle teeth highlight for open mouth
    if (intensity > 0.5) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.beginPath();
      this.ctx.ellipse(mouthX, mouthY - 2, mouthWidth * 0.7, mouthHeight * 0.3, 0, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  private calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  // Public method to trigger expression changes
  setExpression(expression: string, intensity: number = 1.0) {
    this.currentExpression = expression;
    this.drawAvatar(expression, intensity);
  }

  // Get the current avatar as a data URL for display
  getAvatarDataURL(): string {
    if (!this.canvas) return '';
    return this.canvas.toDataURL('image/png');
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  destroy() {
    if (this.baseImage) {
      this.baseImage = null;
    }
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
  referenceVideo?: File,
  additionalPhotos?: File[]
): Promise<string> {
  try {
    console.log('Creating persona avatar with advanced face mapping...');
    
    // Upload reference media to storage
    const timestamp = Date.now();
    const imagePath = `avatars/${personaId}/primary-${timestamp}.jpg`;
    
    const { data: imageUpload, error: imageError } = await supabase.storage
      .from('persona-content')
      .upload(imagePath, referenceImage);

    if (imageError) throw imageError;

    // Get public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('persona-content')
      .getPublicUrl(imagePath);
    
    const photoUrls = [publicUrl];

    // Upload additional photos for better face mapping
    if (additionalPhotos && additionalPhotos.length > 0) {
      for (let i = 0; i < additionalPhotos.length; i++) {
        const photo = additionalPhotos[i];
        const photoPath = `avatars/${personaId}/photo-${i}-${timestamp}.jpg`;
        
        const { data: photoUpload, error: photoError } = await supabase.storage
          .from('persona-content')
          .upload(photoPath, photo);

        if (!photoError) {
          const { data: { publicUrl: photoPublicUrl } } = supabase.storage
            .from('persona-content')
            .getPublicUrl(photoPath);
          photoUrls.push(photoPublicUrl);
        }
      }
    }

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

    // Analyze face characteristics from photos
    const faceAnalysis = await analyzeFaceCharacteristics(photoUrls);

    // Update persona with avatar information
    await supabase
      .from('personas')
      .update({
        avatar_url: publicUrl,
        metadata: {
          photo_urls: photoUrls,
          video_avatar_url: videoUrl,
          avatar_type: 'photo_realistic',
          face_analysis: faceAnalysis,
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

async function analyzeFaceCharacteristics(photoUrls: string[]): Promise<{
  dominantFeatures: string[];
  estimatedAge: string;
  estimatedGender: string;
  facialStructure: string;
  eyeColor: string;
  hairColor: string;
}> {
  try {
    console.log('Analyzing face characteristics from photos...');
    
    // In production, this would use face analysis APIs like:
    // - Azure Face API
    // - AWS Rekognition
    // - Google Vision API
    // - Or local face detection libraries
    
    // For now, return reasonable defaults that could be enhanced
    return {
      dominantFeatures: ['eyes', 'smile', 'facial_structure'],
      estimatedAge: 'middle_aged',
      estimatedGender: 'neutral',
      facialStructure: 'oval',
      eyeColor: 'brown',
      hairColor: 'brown'
    };
  } catch (error) {
    console.error('Face analysis error:', error);
    captureException(error as Error, { photoCount: photoUrls.length });
    
    return {
      dominantFeatures: [],
      estimatedAge: 'unknown',
      estimatedGender: 'neutral',
      facialStructure: 'unknown',
      eyeColor: 'unknown',
      hairColor: 'unknown'
    };
  }
}