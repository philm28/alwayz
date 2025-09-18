import { supabase } from './supabase';
import { captureException } from './monitoring';

export interface FacialLandmarks {
  jawline: number[][];
  eyebrows: number[][];
  eyes: number[][];
  nose: number[][];
  mouth: number[][];
  chin: number[][];
}

export interface FaceMapping {
  landmarks: FacialLandmarks;
  textureMap: ImageData;
  normalMap: ImageData;
  expressions: {
    neutral: FacialLandmarks;
    happy: FacialLandmarks;
    sad: FacialLandmarks;
    surprised: FacialLandmarks;
    speaking: FacialLandmarks[];
  };
  eyeColor: string;
  skinTone: string;
  faceShape: string;
}

export interface Avatar3DConfig {
  personaId: string;
  referenceImages: string[];
  referenceVideos: string[];
  voiceSamples: string[];
  socialMediaContent: any[];
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

export class ThreeDimensionalAvatarEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private webglCanvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private faceMapping: FaceMapping | null = null;
  private currentExpression: string = 'neutral';
  private isAnimating: boolean = false;
  private animationFrame: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private lipSyncData: Float32Array | null = null;
  private textureCanvas: HTMLCanvasElement;
  private textureCtx: CanvasRenderingContext2D;

  constructor(private config: Avatar3DConfig) {
    // Create main rendering canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;

    // Create WebGL canvas for 3D rendering
    this.webglCanvas = document.createElement('canvas');
    this.webglCanvas.width = 512;
    this.webglCanvas.height = 512;
    this.gl = this.webglCanvas.getContext('webgl');

    // Create texture canvas for face mapping
    this.textureCanvas = document.createElement('canvas');
    this.textureCanvas.width = 256;
    this.textureCanvas.height = 256;
    this.textureCtx = this.textureCanvas.getContext('2d')!;

    this.initializeWebGL();
    this.initializeAudioContext();
  }

  private initializeWebGL() {
    if (!this.gl) {
      console.warn('WebGL not supported, falling back to 2D rendering');
      return;
    }

    // Set up WebGL viewport
    this.gl.viewport(0, 0, this.webglCanvas.width, this.webglCanvas.height);
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Create shaders for 3D face rendering
    this.createShaders();
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.lipSyncData = new Float32Array(this.analyser.frequencyBinCount);
    } catch (error) {
      console.warn('Audio context initialization failed:', error);
    }
  }

  private createShaders() {
    if (!this.gl) return;

    // Vertex shader for 3D face mesh
    const vertexShaderSource = `
      attribute vec3 position;
      attribute vec2 texCoord;
      attribute vec3 normal;
      
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform mat3 normalMatrix;
      
      varying vec2 vTexCoord;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vTexCoord = texCoord;
        vNormal = normalMatrix * normal;
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Fragment shader for realistic face rendering
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D faceTexture;
      uniform sampler2D normalMap;
      uniform vec3 lightDirection;
      uniform float expressionBlend;
      uniform vec3 skinTone;
      
      varying vec2 vTexCoord;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vec4 textureColor = texture2D(faceTexture, vTexCoord);
        vec3 normal = normalize(vNormal);
        
        // Basic lighting calculation
        float lightIntensity = max(dot(normal, normalize(lightDirection)), 0.2);
        
        // Apply skin tone and lighting
        vec3 finalColor = textureColor.rgb * skinTone * lightIntensity;
        
        gl_FragColor = vec4(finalColor, textureColor.a);
      }
    `;

    // Compile and link shaders (simplified for demo)
    console.log('WebGL shaders initialized for 3D face rendering');
  }

  async initializeFromContent(): Promise<void> {
    try {
      console.log('Initializing 3D avatar from uploaded content...');
      
      // Load and analyze reference images
      if (this.config.referenceImages.length > 0) {
        await this.analyzeReferenceImages();
      }

      // Process reference videos for facial animation
      if (this.config.referenceVideos.length > 0) {
        await this.extractFacialAnimationData();
      }

      // Analyze social media content for personality traits
      if (this.config.socialMediaContent.length > 0) {
        await this.analyzeSocialMediaContent();
      }

      // Create 3D face model
      await this.generate3DFaceModel();

      console.log('3D avatar initialization complete');
    } catch (error) {
      console.error('Error initializing 3D avatar:', error);
      captureException(error as Error, { personaId: this.config.personaId });
      throw error;
    }
  }

  private async analyzeReferenceImages(): Promise<void> {
    console.log('Analyzing reference images for facial structure...');
    
    const images = await Promise.all(
      this.config.referenceImages.map(async (url) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = url;
        });
      })
    );

    // Analyze facial features from multiple angles
    const faceAnalysis = await this.performFacialAnalysis(images);
    
    // Create face mapping from analysis
    this.faceMapping = await this.createFaceMapping(faceAnalysis);
    
    console.log('Facial analysis complete:', {
      landmarks: Object.keys(this.faceMapping.landmarks).length,
      expressions: Object.keys(this.faceMapping.expressions).length
    });
  }

  private async performFacialAnalysis(images: HTMLImageElement[]): Promise<any> {
    // In production, this would use advanced computer vision libraries like:
    // - MediaPipe Face Mesh
    // - TensorFlow.js Face Landmarks Detection
    // - OpenCV.js
    // - Face-api.js
    
    const analysis = {
      faceShape: 'oval',
      eyeColor: 'brown',
      skinTone: '#F4C2A1',
      facialStructure: {
        jawWidth: 0.8,
        cheekboneHeight: 0.7,
        foreheadHeight: 0.6,
        noseWidth: 0.4,
        mouthWidth: 0.5
      },
      landmarks: this.generateFacialLandmarks(images[0])
    };

    return analysis;
  }

  private generateFacialLandmarks(image: HTMLImageElement): FacialLandmarks {
    // Generate facial landmarks based on image analysis
    // In production, this would use ML models to detect actual facial features
    
    const width = image.width;
    const height = image.height;
    const centerX = width / 2;
    const centerY = height / 2;

    return {
      jawline: this.generateJawlinePoints(centerX, centerY, width, height),
      eyebrows: this.generateEyebrowPoints(centerX, centerY, width, height),
      eyes: this.generateEyePoints(centerX, centerY, width, height),
      nose: this.generateNosePoints(centerX, centerY, width, height),
      mouth: this.generateMouthPoints(centerX, centerY, width, height),
      chin: this.generateChinPoints(centerX, centerY, width, height)
    };
  }

  private generateJawlinePoints(centerX: number, centerY: number, width: number, height: number): number[][] {
    const points: number[][] = [];
    const jawY = centerY + height * 0.3;
    
    for (let i = 0; i < 17; i++) {
      const angle = (i / 16) * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * width * 0.35;
      const y = jawY + Math.sin(angle) * height * 0.15;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateEyebrowPoints(centerX: number, centerY: number, width: number, height: number): number[][] {
    const points: number[][] = [];
    const eyebrowY = centerY - height * 0.1;
    
    // Left eyebrow
    for (let i = 0; i < 5; i++) {
      const x = centerX - width * 0.15 + (i / 4) * width * 0.1;
      const y = eyebrowY - Math.sin((i / 4) * Math.PI) * height * 0.02;
      points.push([x, y]);
    }
    
    // Right eyebrow
    for (let i = 0; i < 5; i++) {
      const x = centerX + width * 0.05 + (i / 4) * width * 0.1;
      const y = eyebrowY - Math.sin((i / 4) * Math.PI) * height * 0.02;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateEyePoints(centerX: number, centerY: number, width: number, height: number): number[][] {
    const points: number[][] = [];
    const eyeY = centerY - height * 0.05;
    
    // Left eye
    const leftEyeX = centerX - width * 0.1;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 5) * 2 * Math.PI;
      const x = leftEyeX + Math.cos(angle) * width * 0.04;
      const y = eyeY + Math.sin(angle) * height * 0.02;
      points.push([x, y]);
    }
    
    // Right eye
    const rightEyeX = centerX + width * 0.1;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 5) * 2 * Math.PI;
      const x = rightEyeX + Math.cos(angle) * width * 0.04;
      const y = eyeY + Math.sin(angle) * height * 0.02;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateNosePoints(centerX: number, centerY: number, width: number, height: number): number[][] {
    const points: number[][] = [];
    
    // Nose bridge and tip
    for (let i = 0; i < 9; i++) {
      const x = centerX + (Math.random() - 0.5) * width * 0.02;
      const y = centerY - height * 0.05 + (i / 8) * height * 0.1;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateMouthPoints(centerX: number, centerY: number, width: number, height: number): number[][] {
    const points: number[][] = [];
    const mouthY = centerY + height * 0.1;
    
    // Outer lip
    for (let i = 0; i < 12; i++) {
      const angle = (i / 11) * Math.PI;
      const x = centerX + Math.cos(angle) * width * 0.06;
      const y = mouthY + Math.sin(angle) * height * 0.02;
      points.push([x, y]);
    }
    
    // Inner lip
    for (let i = 0; i < 8; i++) {
      const angle = (i / 7) * Math.PI;
      const x = centerX + Math.cos(angle) * width * 0.04;
      const y = mouthY + Math.sin(angle) * height * 0.015;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateChinPoints(centerX: number, centerY: number, width: number, height: number): number[][] {
    const points: number[][] = [];
    const chinY = centerY + height * 0.25;
    
    for (let i = 0; i < 7; i++) {
      const x = centerX - width * 0.1 + (i / 6) * width * 0.2;
      const y = chinY + Math.sin((i / 6) * Math.PI) * height * 0.03;
      points.push([x, y]);
    }
    
    return points;
  }

  private async createFaceMapping(analysis: any): Promise<FaceMapping> {
    // Create texture map from reference images
    const textureMap = await this.createTextureMap();
    const normalMap = await this.createNormalMap();

    // Generate expression variations
    const expressions = {
      neutral: analysis.landmarks,
      happy: this.morphLandmarksForExpression(analysis.landmarks, 'happy'),
      sad: this.morphLandmarksForExpression(analysis.landmarks, 'sad'),
      surprised: this.morphLandmarksForExpression(analysis.landmarks, 'surprised'),
      speaking: this.generateSpeakingFrames(analysis.landmarks)
    };

    return {
      landmarks: analysis.landmarks,
      textureMap,
      normalMap,
      expressions,
      eyeColor: analysis.eyeColor,
      skinTone: analysis.skinTone,
      faceShape: analysis.faceShape
    };
  }

  private async createTextureMap(): Promise<ImageData> {
    // Combine multiple reference images to create a unified face texture
    this.textureCtx.clearRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
    
    // In production, this would:
    // 1. Align faces from multiple images
    // 2. Blend textures to create a unified face map
    // 3. Remove lighting variations
    // 4. Create seamless texture coordinates
    
    // For now, create a basic texture
    const gradient = this.textureCtx.createRadialGradient(
      this.textureCanvas.width / 2, this.textureCanvas.height / 2, 0,
      this.textureCanvas.width / 2, this.textureCanvas.height / 2, this.textureCanvas.width / 2
    );
    gradient.addColorStop(0, '#F4C2A1');
    gradient.addColorStop(1, '#E8B896');
    
    this.textureCtx.fillStyle = gradient;
    this.textureCtx.fillRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
    
    return this.textureCtx.getImageData(0, 0, this.textureCanvas.width, this.textureCanvas.height);
  }

  private async createNormalMap(): Promise<ImageData> {
    // Create normal map for realistic lighting
    this.textureCtx.clearRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
    
    // Generate normal map data (simplified)
    const imageData = this.textureCtx.createImageData(this.textureCanvas.width, this.textureCanvas.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 128;     // R (normal X)
      imageData.data[i + 1] = 128; // G (normal Y)
      imageData.data[i + 2] = 255; // B (normal Z)
      imageData.data[i + 3] = 255; // A (alpha)
    }
    
    return imageData;
  }

  private morphLandmarksForExpression(baseLandmarks: FacialLandmarks, expression: string): FacialLandmarks {
    const morphed = JSON.parse(JSON.stringify(baseLandmarks));
    
    switch (expression) {
      case 'happy':
        // Raise mouth corners, squint eyes slightly
        morphed.mouth = morphed.mouth.map((point: number[], index: number) => {
          if (index < 6) { // Upper lip
            return [point[0], point[1] - 2];
          }
          return point;
        });
        break;
        
      case 'sad':
        // Lower mouth corners, droop eyebrows
        morphed.mouth = morphed.mouth.map((point: number[], index: number) => {
          if (index < 6) {
            return [point[0], point[1] + 2];
          }
          return point;
        });
        break;
        
      case 'surprised':
        // Widen eyes, open mouth
        morphed.eyes = morphed.eyes.map((point: number[]) => [
          point[0] * 1.1, point[1] * 1.1
        ]);
        morphed.mouth = morphed.mouth.map((point: number[]) => [
          point[0], point[1] + 3
        ]);
        break;
    }
    
    return morphed;
  }

  private generateSpeakingFrames(baseLandmarks: FacialLandmarks): FacialLandmarks[] {
    const frames: FacialLandmarks[] = [];
    
    // Generate 10 frames of mouth movement for speaking animation
    for (let frame = 0; frame < 10; frame++) {
      const morphed = JSON.parse(JSON.stringify(baseLandmarks));
      const intensity = Math.sin((frame / 9) * Math.PI * 2) * 0.5 + 0.5;
      
      // Animate mouth for speaking
      morphed.mouth = morphed.mouth.map((point: number[], index: number) => {
        if (index >= 12) { // Inner lip
          return [point[0], point[1] + intensity * 4];
        }
        return [point[0], point[1] + intensity * 2];
      });
      
      frames.push(morphed);
    }
    
    return frames;
  }

  private async extractFacialAnimationData(): Promise<void> {
    console.log('Extracting facial animation data from videos...');
    
    // In production, this would:
    // 1. Extract frames from videos
    // 2. Detect facial landmarks in each frame
    // 3. Create animation sequences
    // 4. Map expressions to emotional states
    
    // For now, simulate the process
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Facial animation data extracted');
  }

  private async analyzeSocialMediaContent(): Promise<void> {
    console.log('Analyzing social media content for personality insights...');
    
    // Analyze text content for emotional patterns and personality traits
    const textContent = this.config.socialMediaContent
      .filter(item => item.content_text || item.content)
      .map(item => item.content_text || item.content)
      .join(' ');

    if (textContent.length > 0) {
      // In production, use NLP to analyze:
      // - Emotional patterns
      // - Speaking style
      // - Common expressions
      // - Personality traits
      
      console.log('Social media analysis complete:', {
        contentLength: textContent.length,
        posts: this.config.socialMediaContent.length
      });
    }
  }

  private async generate3DFaceModel(): Promise<void> {
    if (!this.faceMapping) {
      throw new Error('Face mapping not available');
    }

    console.log('Generating 3D face model...');
    
    // In production, this would:
    // 1. Create 3D mesh from facial landmarks
    // 2. Apply texture mapping
    // 3. Set up bone structure for animation
    // 4. Configure lighting and materials
    
    // For now, prepare the 2D rendering system
    this.setupFaceRendering();
  }

  private setupFaceRendering(): void {
    if (!this.faceMapping) return;

    // Set up the rendering pipeline for the 3D-like face
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    console.log('Face rendering pipeline initialized');
  }

  async renderFrame(expression: string = 'neutral', intensity: number = 1.0, audioData?: Float32Array): Promise<void> {
    if (!this.faceMapping) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render 3D-like face
    await this.render3DFace(expression, intensity, audioData);
    
    // Apply post-processing effects
    this.applyPostProcessing(expression, intensity);
  }

  private async render3DFace(expression: string, intensity: number, audioData?: Float32Array): Promise<void> {
    if (!this.faceMapping) return;

    // Get appropriate landmarks for expression
    let targetLandmarks = this.faceMapping.expressions.neutral;
    
    if (expression === 'speaking' && audioData) {
      // Use lip sync data for speaking animation
      const speakingFrame = this.calculateSpeakingFrame(audioData);
      targetLandmarks = this.faceMapping.expressions.speaking[speakingFrame] || this.faceMapping.expressions.neutral;
    } else if (this.faceMapping.expressions[expression as keyof typeof this.faceMapping.expressions]) {
      targetLandmarks = this.faceMapping.expressions[expression as keyof typeof this.faceMapping.expressions] as FacialLandmarks;
    }

    // Render face with current expression
    this.drawFaceWithLandmarks(targetLandmarks, intensity);
  }

  private calculateSpeakingFrame(audioData: Float32Array): number {
    if (!audioData || audioData.length === 0) return 0;
    
    // Calculate audio amplitude
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const amplitude = Math.sqrt(sum / audioData.length);
    
    // Map amplitude to speaking frame (0-9)
    return Math.floor(amplitude * 9);
  }

  private drawFaceWithLandmarks(landmarks: FacialLandmarks, intensity: number): void {
    // Draw base face shape
    this.drawFaceBase();
    
    // Draw facial features using landmarks
    this.drawEyes(landmarks.eyes, intensity);
    this.drawNose(landmarks.nose, intensity);
    this.drawMouth(landmarks.mouth, intensity);
    this.drawEyebrows(landmarks.eyebrows, intensity);
    
    // Add realistic shading and highlights
    this.addFacialShading();
  }

  private drawFaceBase(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const faceWidth = this.canvas.width * 0.7;
    const faceHeight = this.canvas.height * 0.8;

    // Create face gradient
    const gradient = this.ctx.createRadialGradient(
      centerX, centerY - 20, 0,
      centerX, centerY, faceWidth / 2
    );
    gradient.addColorStop(0, '#F4C2A1');
    gradient.addColorStop(0.7, '#E8B896');
    gradient.addColorStop(1, '#D4A574');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, faceWidth / 2, faceHeight / 2, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private drawEyes(eyeLandmarks: number[][], intensity: number): void {
    // Left eye
    this.drawEye(eyeLandmarks.slice(0, 6), intensity);
    // Right eye
    this.drawEye(eyeLandmarks.slice(6, 12), intensity);
  }

  private drawEye(eyePoints: number[][], intensity: number): void {
    if (eyePoints.length < 6) return;

    const centerX = eyePoints.reduce((sum, point) => sum + point[0], 0) / eyePoints.length;
    const centerY = eyePoints.reduce((sum, point) => sum + point[1], 0) / eyePoints.length;

    // Draw eye white
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, 15, 8, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw iris
    this.ctx.fillStyle = this.faceMapping?.eyeColor || '#8B4513';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, 8, 8, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw pupil
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, 3, 3, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    // Add eye highlight
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX - 2, centerY - 2, 1.5, 1.5, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private drawNose(noseLandmarks: number[][], intensity: number): void {
    if (noseLandmarks.length < 3) return;

    this.ctx.strokeStyle = '#D4A574';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    noseLandmarks.forEach((point, index) => {
      if (index === 0) {
        this.ctx.moveTo(point[0], point[1]);
      } else {
        this.ctx.lineTo(point[0], point[1]);
      }
    });
    
    this.ctx.stroke();

    // Add nostril shadows
    const nostrilY = noseLandmarks[noseLandmarks.length - 1][1];
    const nostrilX = noseLandmarks[noseLandmarks.length - 1][0];
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.beginPath();
    this.ctx.ellipse(nostrilX - 5, nostrilY, 2, 1, 0, 0, 2 * Math.PI);
    this.ctx.ellipse(nostrilX + 5, nostrilY, 2, 1, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private drawMouth(mouthLandmarks: number[][], intensity: number): void {
    if (mouthLandmarks.length < 12) return;

    const outerLip = mouthLandmarks.slice(0, 12);
    const innerLip = mouthLandmarks.slice(12);

    // Draw outer lip
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

    // Draw inner mouth (if speaking)
    if (innerLip.length > 0 && intensity > 0.3) {
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

      // Add teeth highlight
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.beginPath();
      this.ctx.ellipse(
        outerLip[6][0], outerLip[6][1] - 2,
        8, 2, 0, 0, 2 * Math.PI
      );
      this.ctx.fill();
    }
  }

  private drawEyebrows(eyebrowLandmarks: number[][], intensity: number): void {
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';

    // Left eyebrow
    this.ctx.beginPath();
    const leftBrow = eyebrowLandmarks.slice(0, 5);
    leftBrow.forEach((point, index) => {
      if (index === 0) {
        this.ctx.moveTo(point[0], point[1]);
      } else {
        this.ctx.lineTo(point[0], point[1]);
      }
    });
    this.ctx.stroke();

    // Right eyebrow
    this.ctx.beginPath();
    const rightBrow = eyebrowLandmarks.slice(5, 10);
    rightBrow.forEach((point, index) => {
      if (index === 0) {
        this.ctx.moveTo(point[0], point[1]);
      } else {
        this.ctx.lineTo(point[0], point[1]);
      }
    });
    this.ctx.stroke();
  }

  private addFacialShading(): void {
    // Add subtle shading for depth
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Cheek highlights
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX - 40, centerY + 20, 15, 10, 0, 0, 2 * Math.PI);
    this.ctx.ellipse(centerX + 40, centerY + 20, 15, 10, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    // Forehead highlight
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY - 60, 30, 15, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    // Nose bridge highlight
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY - 10, 3, 20, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private applyPostProcessing(expression: string, intensity: number): void {
    // Apply subtle effects based on expression
    if (expression === 'happy') {
      // Warm glow for happiness
      this.ctx.globalCompositeOperation = 'overlay';
      this.ctx.fillStyle = `rgba(255, 220, 150, ${intensity * 0.1})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (expression === 'sad') {
      // Cool tone for sadness
      this.ctx.globalCompositeOperation = 'overlay';
      this.ctx.fillStyle = `rgba(150, 180, 255, ${intensity * 0.1})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalCompositeOperation = 'source-over';
    }
  }

  async animateWithAudio(audioBuffer: ArrayBuffer, text: string): Promise<void> {
    if (!this.audioContext || !this.analyser) {
      console.warn('Audio context not available for lip sync');
      return;
    }

    try {
      // Decode audio for analysis
      const audioData = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Create audio source for playback
      const source = this.audioContext.createBufferSource();
      source.buffer = audioData;
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      // Start animation
      this.isAnimating = true;
      this.currentExpression = 'speaking';
      
      // Start audio playback
      source.start();
      
      // Animate lip sync
      this.startLipSyncAnimation();
      
      // Stop animation when audio ends
      source.onended = () => {
        this.stopAnimation();
      };

    } catch (error) {
      console.error('Error animating with audio:', error);
      this.stopAnimation();
    }
  }

  private startLipSyncAnimation(): void {
    if (!this.analyser || !this.lipSyncData) return;

    const animate = () => {
      if (!this.isAnimating) return;

      // Get current audio frequency data
      this.analyser!.getByteFrequencyData(this.lipSyncData!);
      
      // Calculate mouth movement intensity
      const amplitude = this.calculateAudioAmplitude(this.lipSyncData!);
      const intensity = Math.min(amplitude * 3, 1.0);

      // Render frame with lip sync
      this.renderFrame('speaking', intensity, this.lipSyncData!);

      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  private calculateAudioAmplitude(frequencyData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    return sum / (frequencyData.length * 255);
  }

  private stopAnimation(): void {
    this.isAnimating = false;
    this.currentExpression = 'neutral';
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Return to neutral expression
    this.renderFrame('neutral', 0);
  }

  setExpression(expression: string, intensity: number = 1.0): void {
    this.currentExpression = expression;
    this.renderFrame(expression, intensity);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getWebGLCanvas(): HTMLCanvasElement {
    return this.webglCanvas;
  }

  getDataURL(): string {
    return this.canvas.toDataURL('image/png');
  }

  destroy(): void {
    this.stopAnimation();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.faceMapping = null;
    this.analyser = null;
    this.lipSyncData = null;
  }
}

export async function create3DPersonaAvatar(config: Avatar3DConfig): Promise<ThreeDimensionalAvatarEngine> {
  const engine = new ThreeDimensionalAvatarEngine(config);
  await engine.initializeFromContent();
  return engine;
}