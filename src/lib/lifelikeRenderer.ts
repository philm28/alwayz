import { FaceCloneData, faceCloningEngine } from './faceCloning';
import { supabase } from './supabase';
import { voiceCloning } from './voiceCloning';

export interface LifelikePersona {
  id: string;
  name: string;
  faceCloneData: FaceCloneData;
  isReady: boolean;
  currentExpression: string;
  currentEmotion: string;
  speakingIntensity: number;
  eyeBlinkState: number;
  headRotation: { x: number; y: number; z: number };
}

export interface RenderingOptions {
  enableLipSync: boolean;
  enableEyeTracking: boolean;
  enableHeadMovement: boolean;
  enableEmotionalExpressions: boolean;
  renderQuality: 'low' | 'medium' | 'high' | 'ultra';
}

export class LifelikePersonaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private persona: LifelikePersona | null = null;
  private animationFrame: number | null = null;
  private isRendering = false;
  private lastBlinkTime = 0;
  private nextBlinkTime = 0;
  private audioAnalyzer: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private renderingOptions: RenderingOptions;

  constructor(options: Partial<RenderingOptions> = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.renderingOptions = {
      enableLipSync: true,
      enableEyeTracking: true,
      enableHeadMovement: true,
      enableEmotionalExpressions: true,
      renderQuality: 'high',
      ...options
    };
    
    this.scheduleNextBlink();
  }

  async initializePersona(
    personaId: string,
    name: string,
    referenceImages: string[],
    referenceVideos: string[],
    voiceSamples: string[],
    socialMediaContent: any[]
  ): Promise<LifelikePersona> {
    try {
      console.log('Initializing lifelike persona:', name);
      
      // Create face clone data
      const faceCloneData = await faceCloningEngine.createFaceClone(
        personaId,
        referenceImages,
        referenceVideos,
        voiceSamples,
        socialMediaContent
      );

      this.persona = {
        id: personaId,
        name,
        faceCloneData,
        isReady: true,
        currentExpression: 'neutral',
        currentEmotion: 'neutral',
        speakingIntensity: 0,
        eyeBlinkState: 0,
        headRotation: { x: 0, y: 0, z: 0 }
      };

      // Start rendering
      this.startRendering();
      
      return this.persona;
    } catch (error) {
      console.error('Error initializing lifelike persona:', error);
      throw error;
    }
  }

  startRendering(): void {
    if (this.isRendering || !this.persona) return;
    
    this.isRendering = true;
    this.renderLoop();
  }

  stopRendering(): void {
    this.isRendering = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private renderLoop(): void {
    if (!this.isRendering || !this.persona) return;

    // Update animation state
    this.updateAnimationState();
    
    // Render current frame
    this.renderPersonaFrame();
    
    // Schedule next frame
    this.animationFrame = requestAnimationFrame(() => this.renderLoop());
  }

  private updateAnimationState(): void {
    if (!this.persona) return;
    
    const now = Date.now();

    // Handle eye blinking
    if (now >= this.nextBlinkTime) {
      this.startBlink();
    }
    
    if (this.persona.eyeBlinkState > 0) {
      this.updateBlink();
    }

    // Update subtle head movement
    if (this.renderingOptions.enableHeadMovement) {
      this.updateIdleHeadMovement();
    }

    // Update lip sync if speaking
    if (this.persona.speakingIntensity > 0 && this.audioAnalyzer && this.frequencyData) {
      this.audioAnalyzer.getByteFrequencyData(this.frequencyData);
      this.persona.speakingIntensity = this.calculateSpeakingIntensity(this.frequencyData);
    }
  }

  private renderPersonaFrame(): void {
    if (!this.persona) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Get current landmarks based on expression
    const currentLandmarks = this.getCurrentLandmarks();
    
    // Render face with current state
    this.renderFaceWithCloneData(currentLandmarks);
    
    // Apply real-time effects
    this.applyRealtimeEffects();
  }

  private getCurrentLandmarks(): any {
    if (!this.persona) return null;
    
    const { faceCloneData, currentExpression, speakingIntensity, eyeBlinkState } = this.persona;
    let landmarks = faceCloneData.expressionMorphs.neutral;
    
    // Get base expression landmarks
    if (currentExpression === 'speaking' && speakingIntensity > 0) {
      const speakingFrame = Math.floor(speakingIntensity * (faceCloneData.expressionMorphs.speaking.length - 1));
      landmarks = faceCloneData.expressionMorphs.speaking[speakingFrame] || landmarks;
    } else if (faceCloneData.expressionMorphs[currentExpression as keyof typeof faceCloneData.expressionMorphs]) {
      landmarks = faceCloneData.expressionMorphs[currentExpression as keyof typeof faceCloneData.expressionMorphs] as any;
    }
    
    // Apply eye blink modification
    if (eyeBlinkState > 0) {
      landmarks = this.applyEyeBlink(landmarks, eyeBlinkState);
    }
    
    return landmarks;
  }

  private renderFaceWithCloneData(landmarks: any): void {
    if (!this.persona || !landmarks) return;
    
    // Render base face texture
    this.renderFaceTexture();
    
    // Render facial features using landmarks
    this.renderFacialFeatures(landmarks);
    
    // Apply lighting and shading
    this.applyRealisticLighting();
  }

  private renderFaceTexture(): void {
    if (!this.persona) return;
    
    const { faceTexture } = this.persona.faceCloneData;
    
    // Create temporary canvas for texture
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 256;
    tempCanvas.height = 256;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(faceTexture, 0, 0);
    
    // Draw texture to main canvas
    this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
  }

  private renderFacialFeatures(landmarks: any): void {
    // Render eyes
    this.renderEyes(landmarks.leftEye, landmarks.rightEye);
    
    // Render eyebrows
    this.renderEyebrows(landmarks.leftEyebrow, landmarks.rightEyebrow);
    
    // Render nose
    this.renderNose(landmarks.noseBridge, landmarks.noseBase);
    
    // Render mouth
    this.renderMouth(landmarks.outerLip, landmarks.innerLip);
    
    // Render face contour
    this.renderFaceContour(landmarks.faceContour);
  }

  private renderEyes(leftEye: number[][], rightEye: number[][]): void {
    [leftEye, rightEye].forEach(eyeLandmarks => {
      if (!eyeLandmarks || eyeLandmarks.length < 6) return;
      
      const centerX = eyeLandmarks.reduce((sum, point) => sum + point[0], 0) / eyeLandmarks.length;
      const centerY = eyeLandmarks.reduce((sum, point) => sum + point[1], 0) / eyeLandmarks.length;
      
      // Draw eye white
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, centerY, 18, 10, 0, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw iris with realistic color
      const irisColor = this.persona?.faceCloneData.personalityTraits.facialExpressionFrequency.happy > 5 
        ? '#4A90E2' : '#8B4513';
      this.ctx.fillStyle = irisColor;
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, centerY, 9, 9, 0, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw pupil
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, centerY, 4, 4, 0, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Add realistic highlight
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.ellipse(centerX - 2, centerY - 2, 2, 2, 0, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  private renderEyebrows(leftEyebrow: number[][], rightEyebrow: number[][]): void {
    [leftEyebrow, rightEyebrow].forEach(eyebrowLandmarks => {
      if (!eyebrowLandmarks || eyebrowLandmarks.length < 3) return;
      
      this.ctx.strokeStyle = '#654321';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.beginPath();
      eyebrowLandmarks.forEach((point, index) => {
        if (index === 0) {
          this.ctx.moveTo(point[0], point[1]);
        } else {
          this.ctx.lineTo(point[0], point[1]);
        }
      });
      this.ctx.stroke();
    });
  }

  private renderNose(noseBridge: number[][], noseBase: number[][]): void {
    // Render nose bridge
    if (noseBridge && noseBridge.length > 0) {
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      noseBridge.forEach((point, index) => {
        if (index === 0) {
          this.ctx.moveTo(point[0], point[1]);
        } else {
          this.ctx.lineTo(point[0], point[1]);
        }
      });
      this.ctx.stroke();
    }
    
    // Render nose base and nostrils
    if (noseBase && noseBase.length > 0) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      noseBase.slice(-2).forEach(point => {
        this.ctx.beginPath();
        this.ctx.ellipse(point[0], point[1], 2, 1, 0, 0, 2 * Math.PI);
        this.ctx.fill();
      });
    }
  }

  private renderMouth(outerLip: number[][], innerLip: number[][]): void {
    // Render outer lip
    if (outerLip && outerLip.length > 0) {
      this.ctx.fillStyle = '#C67B5C';
      this.ctx.beginPath();
      outerLip.forEach((point, index) => {
        if (index === 0) {
          this.ctx.moveTo(point[0], point[1]);
        } else {
          this.ctx.lineTo(point[0], point[1]);
        }
      });
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    // Render inner mouth if speaking
    if (innerLip && innerLip.length > 0 && this.persona && this.persona.speakingIntensity > 0.2) {
      this.ctx.fillStyle = 'rgba(40, 20, 20, 0.8)';
      this.ctx.beginPath();
      innerLip.forEach((point, index) => {
        if (index === 0) {
          this.ctx.moveTo(point[0], point[1]);
        } else {
          this.ctx.lineTo(point[0], point[1]);
        }
      });
      this.ctx.closePath();
      this.ctx.fill();
      
      // Add teeth
      if (this.persona.speakingIntensity > 0.5) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.beginPath();
        this.ctx.ellipse(
          outerLip[6][0], outerLip[6][1] - 3,
          12, 3, 0, 0, 2 * Math.PI
        );
        this.ctx.fill();
      }
    }
  }

  private renderFaceContour(faceContour: number[][]): void {
    if (!faceContour || faceContour.length < 3) return;
    
    // Subtle face contour shading
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    faceContour.forEach((point, index) => {
      if (index === 0) {
        this.ctx.moveTo(point[0], point[1]);
      } else {
        this.ctx.lineTo(point[0], point[1]);
      }
    });
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private applyRealisticLighting(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Create lighting gradient
    const lightGradient = this.ctx.createRadialGradient(
      centerX - 50, centerY - 50, 0,
      centerX, centerY, this.canvas.width / 2
    );
    lightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    lightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    lightGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    
    this.ctx.globalCompositeOperation = 'overlay';
    this.ctx.fillStyle = lightGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';
  }

  private applyRealtimeEffects(): void {
    if (!this.persona) return;
    
    // Apply emotional color tinting
    const emotion = this.persona.currentEmotion;
    let tintColor = 'rgba(255, 255, 255, 0)';
    
    switch (emotion) {
      case 'happy':
        tintColor = 'rgba(255, 220, 150, 0.1)';
        break;
      case 'sad':
        tintColor = 'rgba(150, 180, 255, 0.1)';
        break;
      case 'excited':
        tintColor = 'rgba(255, 180, 180, 0.1)';
        break;
      case 'calm':
        tintColor = 'rgba(180, 255, 180, 0.1)';
        break;
    }
    
    if (tintColor !== 'rgba(255, 255, 255, 0)') {
      this.ctx.globalCompositeOperation = 'overlay';
      this.ctx.fillStyle = tintColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalCompositeOperation = 'source-over';
    }
  }

  private scheduleNextBlink(): void {
    const blinkInterval = 2000 + Math.random() * 4000; // 2-6 seconds
    this.nextBlinkTime = Date.now() + blinkInterval;
  }

  private startBlink(): void {
    if (!this.persona) return;
    this.persona.eyeBlinkState = 1;
    this.scheduleNextBlink();
  }

  private updateBlink(): void {
    if (!this.persona) return;
    this.persona.eyeBlinkState -= 0.15;
    if (this.persona.eyeBlinkState <= 0) {
      this.persona.eyeBlinkState = 0;
    }
  }

  private updateIdleHeadMovement(): void {
    if (!this.persona) return;
    
    const time = Date.now() * 0.001;
    
    // Subtle breathing-like movement
    this.persona.headRotation.x = Math.sin(time * 0.3) * 1;
    this.persona.headRotation.y = Math.sin(time * 0.2) * 0.5;
    this.persona.headRotation.z = Math.sin(time * 0.4) * 0.3;
  }

  private applyEyeBlink(landmarks: any, blinkState: number): any {
    const modified = JSON.parse(JSON.stringify(landmarks));
    
    // Close eyes based on blink state
    if (blinkState > 0) {
      modified.leftEye = this.blinkEye(modified.leftEye, blinkState);
      modified.rightEye = this.blinkEye(modified.rightEye, blinkState);
    }
    
    return modified;
  }

  private blinkEye(eyeLandmarks: number[][], blinkState: number): number[][] {
    return eyeLandmarks.map((point, index) => {
      if (index === 1 || index === 5) { // Top and bottom of eye
        const centerY = (eyeLandmarks[1][1] + eyeLandmarks[5][1]) / 2;
        const targetY = centerY;
        const currentY = point[1];
        const blinkY = currentY + (targetY - currentY) * blinkState;
        return [point[0], blinkY];
      }
      return point;
    });
  }

  private calculateSpeakingIntensity(frequencyData: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    const average = sum / frequencyData.length;
    return Math.min(average / 128, 1.0);
  }

  async speakWithAdvancedLipSync(text: string, audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.persona) return;

    try {
      console.log('Starting advanced lip sync for:', text);
      
      // Set up audio analysis
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Create audio source and analyzer
      const source = audioContext.createBufferSource();
      source.buffer = audioData;
      
      this.audioAnalyzer = audioContext.createAnalyser();
      this.audioAnalyzer.fftSize = 512;
      this.frequencyData = new Uint8Array(this.audioAnalyzer.frequencyBinCount);
      
      source.connect(this.audioAnalyzer);
      this.audioAnalyzer.connect(audioContext.destination);
      
      // Start speaking animation
      this.persona.currentExpression = 'speaking';
      this.persona.speakingIntensity = 0.8;
      
      // Play audio
      source.start();
      
      // Stop animation when audio ends
      source.onended = () => {
        if (this.persona) {
          this.persona.currentExpression = 'neutral';
          this.persona.speakingIntensity = 0;
        }
        audioContext.close();
      };
      
    } catch (error) {
      console.error('Error in advanced lip sync:', error);
      if (this.persona) {
        this.persona.currentExpression = 'neutral';
        this.persona.speakingIntensity = 0;
      }
    }
  }

  setExpression(expression: string, intensity: number = 1.0): void {
    if (!this.persona) return;
    
    this.persona.currentExpression = expression;
    this.persona.currentEmotion = expression;
  }

  setEmotion(emotion: string): void {
    if (!this.persona) return;
    
    this.persona.currentEmotion = emotion;
    
    // Trigger appropriate animation sequence
    const animationSequence = this.persona.faceCloneData.animationSequences.find(
      seq => seq.triggers.includes(emotion) || seq.name.includes(emotion)
    );
    
    if (animationSequence) {
      this.playAnimationSequence(animationSequence);
    }
  }

  private async playAnimationSequence(sequence: any): Promise<void> {
    console.log('Playing animation sequence:', sequence.name);
    
    const startTime = Date.now();
    
    const animate = () => {
      if (!this.persona) return;
      
      const elapsed = Date.now() - startTime;
      const progress = elapsed / sequence.duration;
      
      if (progress >= 1) {
        // Animation complete
        this.persona.currentExpression = 'neutral';
        return;
      }
      
      // Find current frame
      const currentFrame = sequence.frames.find((frame: any) => 
        frame.timestamp <= elapsed && 
        elapsed < frame.timestamp + 100
      );
      
      if (currentFrame) {
        this.persona.currentExpression = currentFrame.expression;
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getPersona(): LifelikePersona | null {
    return this.persona;
  }

  destroy(): void {
    this.stopRendering();
    this.persona = null;
    this.audioAnalyzer = null;
    this.frequencyData = null;
  }
}

export const lifelikePersonaRenderer = new LifelikePersonaRenderer();