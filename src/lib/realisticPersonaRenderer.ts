import { ThreeDimensionalAvatarEngine } from './3dAvatarEngine';
import { advancedFaceDetection } from './advancedFaceDetection';
import { voiceCloning } from './voiceCloning';
import { supabase } from './supabase';

export interface RealisticPersonaConfig {
  personaId: string;
  name: string;
  referenceImages: string[];
  referenceVideos: string[];
  voiceSamples: string[];
  socialMediaContent: any[];
  personalityData: any;
}

export interface PersonaRenderingState {
  isInitialized: boolean;
  isRendering: boolean;
  currentExpression: string;
  currentEmotion: string;
  speakingIntensity: number;
  eyeBlinkState: number;
  headRotation: { x: number; y: number; z: number };
  lipSyncActive: boolean;
}

export class RealisticPersonaRenderer {
  private avatarEngine: ThreeDimensionalAvatarEngine | null = null;
  private renderingState: PersonaRenderingState;
  private animationLoop: number | null = null;
  private audioAnalyzer: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private lastBlinkTime: number = 0;
  private nextBlinkTime: number = 0;

  constructor(private config: RealisticPersonaConfig) {
    this.renderingState = {
      isInitialized: false,
      isRendering: false,
      currentExpression: 'neutral',
      currentEmotion: 'neutral',
      speakingIntensity: 0,
      eyeBlinkState: 0,
      headRotation: { x: 0, y: 0, z: 0 },
      lipSyncActive: false
    };
    
    this.scheduleNextBlink();
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing realistic persona renderer...');
      
      // Create 3D avatar engine
      this.avatarEngine = new ThreeDimensionalAvatarEngine({
        personaId: this.config.personaId,
        referenceImages: this.config.referenceImages,
        referenceVideos: this.config.referenceVideos,
        voiceSamples: this.config.voiceSamples,
        socialMediaContent: this.config.socialMediaContent,
        quality: 'high'
      });

      // Initialize avatar from content
      await this.avatarEngine.initializeFromContent();

      // Analyze personality from social media
      const personalityAnalysis = await advancedFaceDetection.extractPersonalityFromSocialMedia(
        this.config.socialMediaContent
      );

      // Store personality data
      await this.savePersonalityAnalysis(personalityAnalysis);

      this.renderingState.isInitialized = true;
      console.log('Realistic persona renderer initialized successfully');
    } catch (error) {
      console.error('Error initializing persona renderer:', error);
      throw error;
    }
  }

  private async savePersonalityAnalysis(analysis: any): Promise<void> {
    try {
      await supabase
        .from('personas')
        .update({
          personality_traits: analysis.personalityTraits.join(', '),
          metadata: {
            ...this.config.personalityData,
            personality_analysis: analysis,
            avatar_type: '3d_realistic',
            analysis_date: new Date().toISOString()
          }
        })
        .eq('id', this.config.personaId);
    } catch (error) {
      console.error('Error saving personality analysis:', error);
    }
  }

  startRendering(): void {
    if (!this.avatarEngine || this.renderingState.isRendering) return;

    this.renderingState.isRendering = true;
    this.renderLoop();
  }

  stopRendering(): void {
    this.renderingState.isRendering = false;
    
    if (this.animationLoop) {
      cancelAnimationFrame(this.animationLoop);
      this.animationLoop = null;
    }
  }

  private renderLoop(): void {
    if (!this.renderingState.isRendering || !this.avatarEngine) return;

    // Update animation state
    this.updateAnimationState();

    // Render current frame
    this.avatarEngine.renderFrame(
      this.renderingState.currentExpression,
      this.renderingState.speakingIntensity,
      this.frequencyData || undefined
    );

    // Schedule next frame
    this.animationLoop = requestAnimationFrame(() => this.renderLoop());
  }

  private updateAnimationState(): void {
    const now = Date.now();

    // Handle eye blinking
    if (now >= this.nextBlinkTime) {
      this.startBlink();
    }

    if (this.renderingState.eyeBlinkState > 0) {
      this.updateBlink();
    }

    // Update head rotation (subtle idle movement)
    this.updateIdleMovement();

    // Update lip sync if speaking
    if (this.renderingState.lipSyncActive && this.audioAnalyzer && this.frequencyData) {
      this.audioAnalyzer.getByteFrequencyData(this.frequencyData);
      this.renderingState.speakingIntensity = this.calculateSpeakingIntensity(this.frequencyData);
    }
  }

  private scheduleNextBlink(): void {
    // Random blink interval between 2-6 seconds
    const blinkInterval = 2000 + Math.random() * 4000;
    this.nextBlinkTime = Date.now() + blinkInterval;
  }

  private startBlink(): void {
    this.renderingState.eyeBlinkState = 1;
    this.scheduleNextBlink();
  }

  private updateBlink(): void {
    this.renderingState.eyeBlinkState -= 0.1;
    if (this.renderingState.eyeBlinkState <= 0) {
      this.renderingState.eyeBlinkState = 0;
    }
  }

  private updateIdleMovement(): void {
    const time = Date.now() * 0.001; // Convert to seconds
    
    // Subtle head movement
    this.renderingState.headRotation.x = Math.sin(time * 0.3) * 2; // Slight nod
    this.renderingState.headRotation.y = Math.sin(time * 0.2) * 1; // Slight turn
    this.renderingState.headRotation.z = Math.sin(time * 0.4) * 0.5; // Slight tilt
  }

  private calculateSpeakingIntensity(frequencyData: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    const average = sum / frequencyData.length;
    return Math.min(average / 128, 1.0);
  }

  async speakWithLipSync(text: string, audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.avatarEngine) return;

    try {
      console.log('Starting lip sync animation...');
      
      // Set up audio analysis
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Create audio source
      const source = audioContext.createBufferSource();
      source.buffer = audioData;
      
      // Set up analyzer
      this.audioAnalyzer = audioContext.createAnalyser();
      this.audioAnalyzer.fftSize = 256;
      this.frequencyData = new Uint8Array(this.audioAnalyzer.frequencyBinCount);
      
      source.connect(this.audioAnalyzer);
      this.audioAnalyzer.connect(audioContext.destination);

      // Start lip sync
      this.renderingState.lipSyncActive = true;
      this.renderingState.currentExpression = 'speaking';

      // Play audio
      source.start();

      // Stop lip sync when audio ends
      source.onended = () => {
        this.renderingState.lipSyncActive = false;
        this.renderingState.currentExpression = 'neutral';
        this.renderingState.speakingIntensity = 0;
        audioContext.close();
      };

    } catch (error) {
      console.error('Error during lip sync:', error);
      this.renderingState.lipSyncActive = false;
      this.renderingState.currentExpression = 'neutral';
    }
  }

  setExpression(expression: string, intensity: number = 1.0): void {
    this.renderingState.currentExpression = expression;
    this.renderingState.currentEmotion = expression;
    
    if (this.avatarEngine) {
      this.avatarEngine.setExpression(expression, intensity);
    }
  }

  setEmotion(emotion: string): void {
    this.renderingState.currentEmotion = emotion;
    this.setExpression(emotion, 0.7);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.avatarEngine?.getCanvas() || null;
  }

  getWebGLCanvas(): HTMLCanvasElement | null {
    return this.avatarEngine?.getWebGLCanvas() || null;
  }

  getRenderingState(): PersonaRenderingState {
    return { ...this.renderingState };
  }

  async generateResponseWithEmotion(message: string): Promise<{
    text: string;
    emotion: string;
    audioBuffer?: ArrayBuffer;
  }> {
    try {
      // Generate text response using AI
      const { AIPersonaEngine } = await import('./ai');
      
      const personaContext = {
        id: this.config.personaId,
        name: this.config.name,
        personality_traits: this.config.personalityData?.personality_traits || '',
        common_phrases: this.config.personalityData?.common_phrases || [],
        relationship: this.config.personalityData?.relationship || '',
        memories: [],
        conversationHistory: []
      };

      const aiEngine = new AIPersonaEngine(personaContext);
      const textResponse = await aiEngine.generateResponse(message);

      // Analyze emotion of the response
      const emotionAnalysis = await aiEngine.analyzeEmotion(textResponse);
      
      // Generate voice with emotion
      let audioBuffer: ArrayBuffer | undefined;
      try {
        audioBuffer = await voiceCloning.synthesizeVoice(
          this.config.personaId,
          textResponse,
          emotionAnalysis.emotion
        );
      } catch (voiceError) {
        console.warn('Voice synthesis failed:', voiceError);
      }

      return {
        text: textResponse,
        emotion: emotionAnalysis.emotion,
        audioBuffer
      };
    } catch (error) {
      console.error('Error generating response with emotion:', error);
      throw error;
    }
  }

  destroy(): void {
    this.stopRendering();
    
    if (this.avatarEngine) {
      this.avatarEngine.destroy();
      this.avatarEngine = null;
    }
    
    this.audioAnalyzer = null;
    this.frequencyData = null;
  }
}

export async function createRealisticPersonaRenderer(config: RealisticPersonaConfig): Promise<RealisticPersonaRenderer> {
  const renderer = new RealisticPersonaRenderer(config);
  await renderer.initialize();
  return renderer;
}