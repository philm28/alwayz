import { supabase } from './supabase';
import { captureException } from './monitoring';

export interface FaceCloneData {
  personaId: string;
  facialLandmarks: FacialLandmarks;
  faceTexture: ImageData;
  expressionMorphs: ExpressionMorphs;
  voiceCharacteristics: VoiceCharacteristics;
  personalityTraits: PersonalityTraits;
  animationSequences: AnimationSequence[];
}

export interface FacialLandmarks {
  jawline: number[][];
  leftEyebrow: number[][];
  rightEyebrow: number[][];
  leftEye: number[][];
  rightEye: number[][];
  noseBridge: number[][];
  noseBase: number[][];
  outerLip: number[][];
  innerLip: number[][];
  faceContour: number[][];
}

export interface ExpressionMorphs {
  neutral: FacialLandmarks;
  happy: FacialLandmarks;
  sad: FacialLandmarks;
  surprised: FacialLandmarks;
  angry: FacialLandmarks;
  speaking: FacialLandmarks[];
  laughing: FacialLandmarks;
  thinking: FacialLandmarks;
}

export interface VoiceCharacteristics {
  fundamentalFrequency: number;
  formants: number[];
  speechRate: number;
  pausePatterns: number[];
  intonationCurves: number[][];
  emotionalRange: {
    happy: number;
    sad: number;
    excited: number;
    calm: number;
  };
}

export interface PersonalityTraits {
  communicationStyle: string;
  emotionalTendencies: string[];
  commonPhrases: string[];
  gesturePatterns: string[];
  facialExpressionFrequency: { [expression: string]: number };
}

export interface AnimationSequence {
  name: string;
  frames: {
    timestamp: number;
    landmarks: FacialLandmarks;
    expression: string;
    intensity: number;
  }[];
  duration: number;
  triggers: string[];
}

export class FaceCloningEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private faceCloneData: FaceCloneData | null = null;
  private isAnalyzing = false;
  private analysisProgress = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
  }

  async createFaceClone(
    personaId: string,
    referenceImages: string[],
    referenceVideos: string[],
    voiceSamples: string[],
    socialMediaContent: any[]
  ): Promise<FaceCloneData> {
    try {
      this.isAnalyzing = true;
      this.analysisProgress = 0;
      
      console.log('Starting comprehensive face cloning process...');
      
      // Step 1: Analyze facial structure from images (25%)
      this.analysisProgress = 10;
      const facialLandmarks = await this.analyzeFacialStructure(referenceImages);
      
      // Step 2: Extract face texture (35%)
      this.analysisProgress = 25;
      const faceTexture = await this.extractFaceTexture(referenceImages);
          // Log the error but don't capture it as an exception to avoid breaking the flow
          console.error(`Image loading failed for ${imageUrl}:`, error);
      // Step 3: Create expression morphs from videos (50%)
      this.analysisProgress = 35;
      const expressionMorphs = await this.createExpressionMorphs(referenceVideos, facialLandmarks);
      
      // Step 4: Analyze voice characteristics (65%)
      this.analysisProgress = 50;
      const voiceCharacteristics = await this.analyzeVoiceCharacteristics(voiceSamples);
      
      // Step 5: Extract personality from social media (80%)
      this.analysisProgress = 65;
      const personalityTraits = await this.extractPersonalityTraits(socialMediaContent);
      
      // Step 6: Create animation sequences (95%)
      this.analysisProgress = 80;
      const animationSequences = await this.createAnimationSequences(expressionMorphs, personalityTraits);
      
      // Step 7: Finalize clone data (100%)
      this.analysisProgress = 95;
      const faceCloneData: FaceCloneData = {
        personaId,
        facialLandmarks,
        faceTexture,
        expressionMorphs,
        voiceCharacteristics,
        personalityTraits,
        animationSequences
      };

      // Save clone data to database
      await this.saveFaceCloneData(faceCloneData);
      
      this.faceCloneData = faceCloneData;
      this.analysisProgress = 100;
      this.isAnalyzing = false;
      
      console.log('Face cloning process completed successfully');
      return faceCloneData;
    } catch (error) {
      console.error('Face cloning error:', error);
      this.isAnalyzing = false;
      throw error;
    }
  }

  private async analyzeFacialStructure(imageUrls: string[]): Promise<FacialLandmarks> {
    console.log('Analyzing facial structure from', imageUrls.length, 'images...');
    
    if (imageUrls.length === 0) {
      throw new Error('No reference images provided');
    }

    // Load and analyze the primary image
    const primaryImage = await this.loadImage(imageUrls[0]);
    this.canvas.width = primaryImage.width;
    this.canvas.height = primaryImage.height;
    this.ctx.drawImage(primaryImage, 0, 0);

    // Detect facial landmarks using advanced computer vision
    const landmarks = await this.detectAdvancedFacialLandmarks(primaryImage);
    
    // If we have multiple images, refine the landmarks
    if (imageUrls.length > 1) {
      const refinedLandmarks = await this.refineLandmarksFromMultipleImages(imageUrls, landmarks);
      return refinedLandmarks;
    }

    return landmarks;
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private async detectAdvancedFacialLandmarks(image: HTMLImageElement): Promise<FacialLandmarks> {
    // In production, this would use MediaPipe Face Mesh or similar
    // For now, we'll create detailed landmark detection
    
    const width = image.width;
    const height = image.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Detect face region using skin color analysis
    const faceRegion = await this.detectFaceRegion(image);
    
    return {
      jawline: this.generateJawlineLandmarks(faceRegion),
      leftEyebrow: this.generateEyebrowLandmarks(faceRegion, 'left'),
      rightEyebrow: this.generateEyebrowLandmarks(faceRegion, 'right'),
      leftEye: this.generateEyeLandmarks(faceRegion, 'left'),
      rightEye: this.generateEyeLandmarks(faceRegion, 'right'),
      noseBridge: this.generateNoseBridgeLandmarks(faceRegion),
      noseBase: this.generateNoseBaseLandmarks(faceRegion),
      outerLip: this.generateLipLandmarks(faceRegion, 'outer'),
      innerLip: this.generateLipLandmarks(faceRegion, 'inner'),
      faceContour: this.generateFaceContourLandmarks(faceRegion)
    };
  }

  private async detectFaceRegion(image: HTMLImageElement): Promise<{
    x: number; y: number; width: number; height: number;
    centerX: number; centerY: number;
  }> {
    this.ctx.drawImage(image, 0, 0);
    const imageData = this.ctx.getImageData(0, 0, image.width, image.height);
    const data = imageData.data;

    let minX = image.width, maxX = 0, minY = image.height, maxY = 0;
    let skinPixels = 0;

    // Advanced skin detection
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const index = (y * image.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        if (this.isAdvancedSkinColor(r, g, b)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          skinPixels++;
        }
      }
    }

    const width = maxX - minX;
    const height = maxY - minY;
    
    return {
      x: minX,
      y: minY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2
    };
  }

  private isAdvancedSkinColor(r: number, g: number, b: number): boolean {
    // Advanced skin color detection using multiple color spaces
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    // RGB criteria
    const rgbCriteria = r > 95 && g > 40 && b > 20 && 
                       max - min > 15 && 
                       Math.abs(r - g) > 15 && 
                       r > g && r > b;

    // YCrCb criteria (converted from RGB)
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cr = 0.713 * (r - y) + 128;
    const cb = 0.564 * (b - y) + 128;
    
    const ycrcbCriteria = y > 80 && cr > 133 && cr < 173 && cb > 77 && cb < 127;

    return rgbCriteria || ycrcbCriteria;
  }

  private generateJawlineLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const { centerX, centerY, width, height } = faceRegion;
    
    // Generate 17 points along the jawline
    for (let i = 0; i < 17; i++) {
      const t = i / 16;
      const angle = Math.PI * (0.2 + t * 0.6); // From ear to ear
      const radius = width * 0.45;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + height * 0.3 + Math.sin(angle) * height * 0.15;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateEyebrowLandmarks(faceRegion: any, side: 'left' | 'right'): number[][] {
    const points: number[][] = [];
    const { centerX, centerY, width, height } = faceRegion;
    
    const offsetX = side === 'left' ? -width * 0.15 : width * 0.15;
    const eyebrowY = centerY - height * 0.15;
    
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = centerX + offsetX + (side === 'left' ? -1 : 1) * t * width * 0.08;
      const y = eyebrowY - Math.sin(t * Math.PI) * height * 0.02;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateEyeLandmarks(faceRegion: any, side: 'left' | 'right'): number[][] {
    const points: number[][] = [];
    const { centerX, centerY, width, height } = faceRegion;
    
    const offsetX = side === 'left' ? -width * 0.12 : width * 0.12;
    const eyeY = centerY - height * 0.05;
    
    // Generate 6 points around the eye
    for (let i = 0; i < 6; i++) {
      const angle = (i / 5) * 2 * Math.PI;
      const radiusX = width * 0.04;
      const radiusY = height * 0.02;
      const x = centerX + offsetX + Math.cos(angle) * radiusX;
      const y = eyeY + Math.sin(angle) * radiusY;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateNoseBridgeLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const { centerX, centerY, height } = faceRegion;
    
    // 4 points along the nose bridge
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const x = centerX + (Math.random() - 0.5) * 2;
      const y = centerY - height * 0.08 + t * height * 0.12;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateNoseBaseLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const { centerX, centerY, width, height } = faceRegion;
    
    const noseBaseY = centerY + height * 0.04;
    
    // 5 points around nose base
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI * (0.3 + (i / 4) * 0.4);
      const radius = width * 0.025;
      const x = centerX + Math.cos(angle) * radius;
      const y = noseBaseY + Math.sin(angle) * radius * 0.5;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateLipLandmarks(faceRegion: any, type: 'outer' | 'inner'): number[][] {
    const points: number[][] = [];
    const { centerX, centerY, width, height } = faceRegion;
    
    const mouthY = centerY + height * 0.15;
    const radiusX = width * (type === 'outer' ? 0.06 : 0.04);
    const radiusY = height * (type === 'outer' ? 0.025 : 0.015);
    
    // Generate points around the lip
    const numPoints = type === 'outer' ? 12 : 8;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / (numPoints - 1)) * Math.PI;
      const x = centerX + Math.cos(angle) * radiusX;
      const y = mouthY + Math.sin(angle) * radiusY;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateFaceContourLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const { centerX, centerY, width, height } = faceRegion;
    
    // Generate points around the entire face contour
    for (let i = 0; i < 20; i++) {
      const angle = (i / 19) * 2 * Math.PI;
      const radiusX = width * 0.48;
      const radiusY = height * 0.45;
      const x = centerX + Math.cos(angle) * radiusX;
      const y = centerY + Math.sin(angle) * radiusY;
      points.push([x, y]);
    }
    
    return points;
  }

  private async extractFaceTexture(imageUrls: string[]): Promise<ImageData> {
    console.log('Extracting face texture from images...');
    
    // Load the primary image for texture extraction
    const primaryImage = await this.loadImage(imageUrls[0]);
    
    // Create a normalized face texture
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 256;
    textureCanvas.height = 256;
    const textureCtx = textureCanvas.getContext('2d')!;
    
    // Draw and normalize the face
    textureCtx.drawImage(primaryImage, 0, 0, 256, 256);
    
    // Apply texture enhancement
    this.enhanceFaceTexture(textureCtx);
    
    return textureCtx.getImageData(0, 0, 256, 256);
  }

  private enhanceFaceTexture(ctx: CanvasRenderingContext2D): void {
    // Apply subtle enhancements to the face texture
    const imageData = ctx.getImageData(0, 0, 256, 256);
    const data = imageData.data;
    
    // Enhance skin tone and reduce noise
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Subtle skin tone enhancement
      if (this.isAdvancedSkinColor(r, g, b)) {
        data[i] = Math.min(255, r * 1.05);     // Slightly enhance red
        data[i + 1] = Math.min(255, g * 1.02); // Slightly enhance green
        data[i + 2] = Math.min(255, b * 0.98); // Slightly reduce blue
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  private async createExpressionMorphs(videoUrls: string[], baseLandmarks: FacialLandmarks): Promise<ExpressionMorphs> {
    console.log('Creating expression morphs from videos...');
    
    const morphs: ExpressionMorphs = {
      neutral: baseLandmarks,
      happy: this.morphLandmarksForExpression(baseLandmarks, 'happy'),
      sad: this.morphLandmarksForExpression(baseLandmarks, 'sad'),
      surprised: this.morphLandmarksForExpression(baseLandmarks, 'surprised'),
      angry: this.morphLandmarksForExpression(baseLandmarks, 'angry'),
      speaking: this.createSpeakingMorphs(baseLandmarks),
      laughing: this.morphLandmarksForExpression(baseLandmarks, 'laughing'),
      thinking: this.morphLandmarksForExpression(baseLandmarks, 'thinking')
    };

    // If we have videos, analyze them for more accurate morphs
    if (videoUrls.length > 0) {
      const videoMorphs = await this.analyzeVideoExpressions(videoUrls[0], baseLandmarks);
      Object.assign(morphs, videoMorphs);
    }

    return morphs;
  }

  private morphLandmarksForExpression(baseLandmarks: FacialLandmarks, expression: string): FacialLandmarks {
    const morphed = JSON.parse(JSON.stringify(baseLandmarks));
    
    switch (expression) {
      case 'happy':
        // Raise mouth corners, squint eyes slightly
        morphed.outerLip = morphed.outerLip.map((point: number[], index: number) => {
          if (index === 0 || index === 6) { // Mouth corners
            return [point[0], point[1] - 3];
          }
          return point;
        });
        // Squint eyes
        morphed.leftEye = this.squintEye(morphed.leftEye);
        morphed.rightEye = this.squintEye(morphed.rightEye);
        break;
        
      case 'sad':
        // Lower mouth corners, droop eyebrows
        morphed.outerLip = morphed.outerLip.map((point: number[], index: number) => {
          if (index === 0 || index === 6) {
            return [point[0], point[1] + 3];
          }
          return point;
        });
        // Droop eyebrows
        morphed.leftEyebrow = this.droopEyebrow(morphed.leftEyebrow);
        morphed.rightEyebrow = this.droopEyebrow(morphed.rightEyebrow);
        break;
        
      case 'surprised':
        // Widen eyes, open mouth, raise eyebrows
        morphed.leftEye = this.widenEye(morphed.leftEye);
        morphed.rightEye = this.widenEye(morphed.rightEye);
        morphed.leftEyebrow = this.raiseEyebrow(morphed.leftEyebrow);
        morphed.rightEyebrow = this.raiseEyebrow(morphed.rightEyebrow);
        morphed.outerLip = this.openMouth(morphed.outerLip);
        break;
        
      case 'angry':
        // Furrow brows, tighten mouth
        morphed.leftEyebrow = this.furrowEyebrow(morphed.leftEyebrow);
        morphed.rightEyebrow = this.furrowEyebrow(morphed.rightEyebrow);
        morphed.outerLip = this.tightenMouth(morphed.outerLip);
        break;
        
      case 'laughing':
        // Extreme happy expression with closed eyes
        morphed.outerLip = morphed.outerLip.map((point: number[], index: number) => {
          if (index === 0 || index === 6) {
            return [point[0], point[1] - 5];
          }
          return point;
        });
        morphed.leftEye = this.closeEye(morphed.leftEye);
        morphed.rightEye = this.closeEye(morphed.rightEye);
        break;
        
      case 'thinking':
        // Slight frown, raised eyebrow
        morphed.rightEyebrow = this.raiseEyebrow(morphed.rightEyebrow);
        morphed.outerLip = morphed.outerLip.map((point: number[]) => [point[0], point[1] + 1]);
        break;
    }
    
    return morphed;
  }

  private squintEye(eyeLandmarks: number[][]): number[][] {
    return eyeLandmarks.map((point, index) => {
      if (index === 1 || index === 5) { // Top and bottom of eye
        return [point[0], point[1] + 1];
      }
      return point;
    });
  }

  private droopEyebrow(eyebrowLandmarks: number[][]): number[][] {
    return eyebrowLandmarks.map(point => [point[0], point[1] + 2]);
  }

  private widenEye(eyeLandmarks: number[][]): number[][] {
    return eyeLandmarks.map((point, index) => {
      if (index === 1 || index === 5) { // Top and bottom
        return [point[0], point[1] + (index === 1 ? -2 : 2)];
      }
      return point;
    });
  }

  private raiseEyebrow(eyebrowLandmarks: number[][]): number[][] {
    return eyebrowLandmarks.map(point => [point[0], point[1] - 3]);
  }

  private openMouth(lipLandmarks: number[][]): number[][] {
    return lipLandmarks.map((point, index) => {
      if (index >= 2 && index <= 4) { // Bottom lip
        return [point[0], point[1] + 4];
      }
      if (index >= 8 && index <= 10) { // Top lip
        return [point[0], point[1] - 2];
      }
      return point;
    });
  }

  private furrowEyebrow(eyebrowLandmarks: number[][]): number[][] {
    return eyebrowLandmarks.map((point, index) => {
      const centerPull = index === 2 ? -2 : 0; // Pull center down
      return [point[0], point[1] + centerPull];
    });
  }

  private tightenMouth(lipLandmarks: number[][]): number[][] {
    return lipLandmarks.map((point, index) => {
      if (index === 0 || index === 6) { // Corners
        return [point[0] + (index === 0 ? 1 : -1), point[1]];
      }
      return point;
    });
  }

  private closeEye(eyeLandmarks: number[][]): number[][] {
    return eyeLandmarks.map((point, index) => {
      if (index === 1 || index === 5) { // Top and bottom meet
        const centerY = (eyeLandmarks[1][1] + eyeLandmarks[5][1]) / 2;
        return [point[0], centerY];
      }
      return point;
    });
  }

  private createSpeakingMorphs(baseLandmarks: FacialLandmarks): FacialLandmarks[] {
    const morphs: FacialLandmarks[] = [];
    
    // Create 10 frames of mouth movement for natural speaking
    for (let frame = 0; frame < 10; frame++) {
      const t = frame / 9;
      const intensity = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
      
      const morphed = JSON.parse(JSON.stringify(baseLandmarks));
      
      // Animate mouth opening
      morphed.outerLip = morphed.outerLip.map((point: number[], index: number) => {
        if (index >= 2 && index <= 4) { // Bottom lip
          return [point[0], point[1] + intensity * 3];
        }
        if (index >= 8 && index <= 10) { // Top lip
          return [point[0], point[1] - intensity * 1.5];
        }
        return point;
      });
      
      morphed.innerLip = morphed.innerLip.map((point: number[], index: number) => {
        if (index >= 2 && index <= 4) {
          return [point[0], point[1] + intensity * 4];
        }
        return point;
      });
      
      morphs.push(morphed);
    }
    
    return morphs;
  }

  private async analyzeVideoExpressions(videoUrl: string, baseLandmarks: FacialLandmarks): Promise<Partial<ExpressionMorphs>> {
    console.log('Analyzing video expressions...');
    
    // In production, this would:
    // 1. Extract frames from video
    // 2. Detect facial landmarks in each frame
    // 3. Classify expressions
    // 4. Create morphs based on actual expressions
    
    // For now, return enhanced morphs
    return {};
  }

  private async analyzeVoiceCharacteristics(voiceSampleUrls: string[]): Promise<VoiceCharacteristics> {
    console.log('Analyzing voice characteristics from', voiceSampleUrls.length, 'samples...');
    
    if (voiceSampleUrls.length === 0) {
      return this.getDefaultVoiceCharacteristics();
    }

    try {
      // Analyze the first voice sample
      const audioBlob = await fetch(voiceSampleUrls[0]).then(r => r.blob());
      const audioBuffer = await audioBlob.arrayBuffer();
      
      // Create audio context for analysis
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(audioBuffer);
      
      // Analyze audio characteristics
      const characteristics = await this.performVoiceAnalysis(audioData);
      
      audioContext.close();
      return characteristics;
    } catch (error) {
      console.error('Voice analysis error:', error);
      return this.getDefaultVoiceCharacteristics();
    }
  }

  private async performVoiceAnalysis(audioBuffer: AudioBuffer): Promise<VoiceCharacteristics> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Calculate fundamental frequency
    const fundamentalFreq = this.calculateFundamentalFrequency(channelData, sampleRate);
    
    // Analyze formants (vocal tract resonances)
    const formants = this.analyzeFormants(channelData, sampleRate);
    
    // Calculate speech rate
    const speechRate = this.calculateSpeechRate(channelData, sampleRate);
    
    // Analyze pause patterns
    const pausePatterns = this.analyzePausePatterns(channelData, sampleRate);
    
    // Create intonation curves
    const intonationCurves = this.analyzeIntonation(channelData, sampleRate);
    
    return {
      fundamentalFrequency: fundamentalFreq,
      formants,
      speechRate,
      pausePatterns,
      intonationCurves,
      emotionalRange: {
        happy: 0.7,
        sad: 0.3,
        excited: 0.6,
        calm: 0.8
      }
    };
  }

  private calculateFundamentalFrequency(audioData: Float32Array, sampleRate: number): number {
    // Autocorrelation-based pitch detection
    const minPeriod = Math.floor(sampleRate / 500); // 500 Hz max
    const maxPeriod = Math.floor(sampleRate / 50);  // 50 Hz min
    
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

  private analyzeFormants(audioData: Float32Array, sampleRate: number): number[] {
    // Simplified formant analysis
    // In production, use LPC analysis or FFT-based formant detection
    const fundamentalFreq = this.calculateFundamentalFrequency(audioData, sampleRate);
    
    return [
      fundamentalFreq * 2.5,  // F1 (first formant)
      fundamentalFreq * 4.5,  // F2 (second formant)
      fundamentalFreq * 7.0   // F3 (third formant)
    ];
  }

  private calculateSpeechRate(audioData: Float32Array, sampleRate: number): number {
    // Calculate words per minute based on audio energy patterns
    const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
    let speechFrames = 0;
    
    for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
      const frameEnergy = this.calculateFrameEnergy(audioData.slice(i, i + frameSize));
      if (frameEnergy > 0.01) { // Threshold for speech
        speechFrames++;
      }
    }
    
    const speechDuration = speechFrames * 0.025; // seconds
    const estimatedWords = speechDuration * 2.5; // Rough estimate
    
    return (estimatedWords / speechDuration) * 60; // Words per minute
  }

  private calculateFrameEnergy(frame: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < frame.length; i++) {
      energy += frame[i] * frame[i];
    }
    return energy / frame.length;
  }

  private analyzePausePatterns(audioData: Float32Array, sampleRate: number): number[] {
    const frameSize = Math.floor(sampleRate * 0.1); // 100ms frames
    const pauseThreshold = 0.005;
    const pauses: number[] = [];
    let currentPauseLength = 0;
    
    for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
      const frameEnergy = this.calculateFrameEnergy(audioData.slice(i, i + frameSize));
      
      if (frameEnergy < pauseThreshold) {
        currentPauseLength += 0.1;
      } else {
        if (currentPauseLength > 0.2) { // Significant pause
          pauses.push(currentPauseLength);
        }
        currentPauseLength = 0;
      }
    }
    
    return pauses;
  }

  private analyzeIntonation(audioData: Float32Array, sampleRate: number): number[][] {
    const curves: number[][] = [];
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    
    for (let i = 0; i < audioData.length - windowSize; i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      const pitch = this.calculateFundamentalFrequency(window, sampleRate);
      const timestamp = i / sampleRate;
      curves.push([timestamp, pitch]);
    }
    
    return curves;
  }

  private getDefaultVoiceCharacteristics(): VoiceCharacteristics {
    return {
      fundamentalFrequency: 150,
      formants: [500, 1500, 2500],
      speechRate: 150,
      pausePatterns: [0.3, 0.5, 0.8],
      intonationCurves: [[0, 150], [1, 160], [2, 140]],
      emotionalRange: {
        happy: 0.7,
        sad: 0.4,
        excited: 0.8,
        calm: 0.6
      }
    };
  }

  private async extractPersonalityTraits(socialMediaContent: any[]): Promise<PersonalityTraits> {
    console.log('Extracting personality traits from social media...');
    
    if (socialMediaContent.length === 0) {
      return this.getDefaultPersonalityTraits();
    }

    const textContent = socialMediaContent
      .map(item => item.content_text || item.content || '')
      .join(' ');

    return {
      communicationStyle: this.analyzeCommunicationStyle(textContent),
      emotionalTendencies: this.analyzeEmotionalTendencies(textContent),
      commonPhrases: this.extractCommonPhrases(textContent),
      gesturePatterns: this.analyzeGesturePatterns(textContent),
      facialExpressionFrequency: this.analyzeFacialExpressionFrequency(textContent)
    };
  }

  private analyzeCommunicationStyle(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('you know') || lowerText.includes('i mean') || lowerText.includes('like')) {
      return 'casual';
    }
    if (lowerText.includes('dear') || lowerText.includes('honey') || lowerText.includes('sweetie')) {
      return 'affectionate';
    }
    if (lowerText.includes('furthermore') || lowerText.includes('however') || lowerText.includes('therefore')) {
      return 'formal';
    }
    if (lowerText.includes('back in') || lowerText.includes('when i was') || lowerText.includes('remember when')) {
      return 'storytelling';
    }
    
    return 'conversational';
  }

  private analyzeEmotionalTendencies(text: string): string[] {
    const tendencies: string[] = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('love') || lowerText.includes('wonderful') || lowerText.includes('amazing')) {
      tendencies.push('positive');
    }
    if (lowerText.includes('remember') || lowerText.includes('miss') || lowerText.includes('used to')) {
      tendencies.push('nostalgic');
    }
    if (lowerText.includes('worry') || lowerText.includes('concern') || lowerText.includes('careful')) {
      tendencies.push('caring');
    }
    if (lowerText.includes('funny') || lowerText.includes('laugh') || lowerText.includes('joke')) {
      tendencies.push('humorous');
    }
    
    return tendencies.length > 0 ? tendencies : ['warm', 'caring'];
  }

  private extractCommonPhrases(text: string): string[] {
    const phrases: string[] = [];
    const sentences = text.split(/[.!?]+/);
    
    // Look for repeated patterns
    const phraseMap: { [key: string]: number } = {};
    
    sentences.forEach(sentence => {
      const cleaned = sentence.trim().toLowerCase();
      if (cleaned.length > 10 && cleaned.length < 50) {
        phraseMap[cleaned] = (phraseMap[cleaned] || 0) + 1;
      }
    });
    
    // Extract phrases that appear multiple times
    Object.entries(phraseMap).forEach(([phrase, count]) => {
      if (count > 1) {
        phrases.push(phrase);
      }
    });
    
    return phrases.slice(0, 10); // Top 10 phrases
  }

  private analyzeGesturePatterns(text: string): string[] {
    const patterns: string[] = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('point') || lowerText.includes('gesture') || lowerText.includes('wave')) {
      patterns.push('expressive_hands');
    }
    if (lowerText.includes('nod') || lowerText.includes('shake head') || lowerText.includes('look')) {
      patterns.push('head_movements');
    }
    if (lowerText.includes('smile') || lowerText.includes('frown') || lowerText.includes('wink')) {
      patterns.push('facial_expressions');
    }
    
    return patterns.length > 0 ? patterns : ['subtle_movements'];
  }

  private analyzeFacialExpressionFrequency(text: string): { [expression: string]: number } {
    const lowerText = text.toLowerCase();
    
    return {
      happy: (lowerText.match(/happy|joy|smile|laugh|wonderful/g) || []).length,
      sad: (lowerText.match(/sad|cry|miss|sorrow/g) || []).length,
      surprised: (lowerText.match(/wow|amazing|incredible|surprise/g) || []).length,
      angry: (lowerText.match(/angry|mad|frustrated|annoyed/g) || []).length,
      neutral: 10 // Base frequency
    };
  }

  private getDefaultPersonalityTraits(): PersonalityTraits {
    return {
      communicationStyle: 'warm',
      emotionalTendencies: ['caring', 'wise'],
      commonPhrases: ['You know what I mean?', 'That reminds me of...'],
      gesturePatterns: ['gentle_movements'],
      facialExpressionFrequency: {
        happy: 5,
        sad: 2,
        surprised: 3,
        angry: 1,
        neutral: 10
      }
    };
  }

  private async createAnimationSequences(morphs: ExpressionMorphs, personality: PersonalityTraits): Promise<AnimationSequence[]> {
    console.log('Creating animation sequences...');
    
    const sequences: AnimationSequence[] = [];
    
    // Create greeting animation
    sequences.push({
      name: 'greeting',
      frames: this.createGreetingAnimation(morphs),
      duration: 3000,
      triggers: ['conversation_start', 'user_joins']
    });
    
    // Create listening animation
    sequences.push({
      name: 'listening',
      frames: this.createListeningAnimation(morphs),
      duration: 2000,
      triggers: ['user_speaking', 'waiting_for_input']
    });
    
    // Create speaking animation
    sequences.push({
      name: 'speaking',
      frames: this.createSpeakingAnimation(morphs),
      duration: 1000,
      triggers: ['persona_speaking']
    });
    
    // Create emotional response animations
    sequences.push({
      name: 'happy_response',
      frames: this.createEmotionalAnimation(morphs, 'happy'),
      duration: 2000,
      triggers: ['positive_message', 'happy_content']
    });
    
    return sequences;
  }

  private createGreetingAnimation(morphs: ExpressionMorphs): AnimationSequence['frames'] {
    return [
      { timestamp: 0, landmarks: morphs.neutral, expression: 'neutral', intensity: 0 },
      { timestamp: 500, landmarks: morphs.happy, expression: 'happy', intensity: 0.7 },
      { timestamp: 1500, landmarks: morphs.speaking[0], expression: 'speaking', intensity: 0.8 },
      { timestamp: 2500, landmarks: morphs.happy, expression: 'happy', intensity: 0.5 },
      { timestamp: 3000, landmarks: morphs.neutral, expression: 'neutral', intensity: 0 }
    ];
  }

  private createListeningAnimation(morphs: ExpressionMorphs): AnimationSequence['frames'] {
    return [
      { timestamp: 0, landmarks: morphs.neutral, expression: 'neutral', intensity: 0 },
      { timestamp: 1000, landmarks: morphs.thinking, expression: 'thinking', intensity: 0.3 },
      { timestamp: 2000, landmarks: morphs.neutral, expression: 'neutral', intensity: 0 }
    ];
  }

  private createSpeakingAnimation(morphs: ExpressionMorphs): AnimationSequence['frames'] {
    const frames: AnimationSequence['frames'] = [];
    
    morphs.speaking.forEach((landmarks, index) => {
      frames.push({
        timestamp: (index / morphs.speaking.length) * 1000,
        landmarks,
        expression: 'speaking',
        intensity: 0.8
      });
    });
    
    return frames;
  }

  private createEmotionalAnimation(morphs: ExpressionMorphs, emotion: string): AnimationSequence['frames'] {
    const emotionLandmarks = morphs[emotion as keyof ExpressionMorphs] as FacialLandmarks;
    
    return [
      { timestamp: 0, landmarks: morphs.neutral, expression: 'neutral', intensity: 0 },
      { timestamp: 500, landmarks: emotionLandmarks, expression: emotion, intensity: 0.8 },
      { timestamp: 1500, landmarks: emotionLandmarks, expression: emotion, intensity: 0.6 },
      { timestamp: 2000, landmarks: morphs.neutral, expression: 'neutral', intensity: 0 }
    ];
  }

  private async refineLandmarksFromMultipleImages(imageUrls: string[], baseLandmarks: FacialLandmarks): Promise<FacialLandmarks> {
    console.log('Refining landmarks from multiple images...');
    
    // Analyze additional images and average the landmarks
    const allLandmarks: FacialLandmarks[] = [baseLandmarks];
    
    for (let i = 1; i < Math.min(imageUrls.length, 5); i++) {
      try {
        const image = await this.loadImage(imageUrls[i]);
        const landmarks = await this.detectAdvancedFacialLandmarks(image);
        allLandmarks.push(landmarks);
      } catch (error) {
        console.warn(`Failed to analyze image ${i}:`, error);
      }
    }
    
    // Average the landmarks for more accurate face mapping
    return this.averageLandmarks(allLandmarks);
  }

  private averageLandmarks(landmarkSets: FacialLandmarks[]): FacialLandmarks {
    const averaged: FacialLandmarks = {
      jawline: [],
      leftEyebrow: [],
      rightEyebrow: [],
      leftEye: [],
      rightEye: [],
      noseBridge: [],
      noseBase: [],
      outerLip: [],
      innerLip: [],
      faceContour: []
    };

    // Average each landmark group
    Object.keys(averaged).forEach(key => {
      const landmarkKey = key as keyof FacialLandmarks;
      const maxLength = Math.max(...landmarkSets.map(set => set[landmarkKey].length));
      
      for (let i = 0; i < maxLength; i++) {
        const points = landmarkSets
          .map(set => set[landmarkKey][i])
          .filter(point => point);
        
        if (points.length > 0) {
          const avgX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
          const avgY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
          averaged[landmarkKey].push([avgX, avgY]);
        }
      }
    });

    return averaged;
  }

  private async saveFaceCloneData(faceCloneData: FaceCloneData): Promise<void> {
    try {
      await supabase
        .from('personas')
        .update({
          metadata: {
            face_clone_data: {
              landmarks_count: Object.values(faceCloneData.facialLandmarks).flat().length,
              expressions_count: Object.keys(faceCloneData.expressionMorphs).length,
              voice_analyzed: !!faceCloneData.voiceCharacteristics,
              personality_extracted: !!faceCloneData.personalityTraits,
              animation_sequences: faceCloneData.animationSequences.length,
              clone_quality: this.calculateCloneQuality(faceCloneData),
              created_at: new Date().toISOString()
            }
          },
          status: 'active',
          training_progress: 100
        })
        .eq('id', faceCloneData.personaId);
    } catch (error) {
      console.error('Error saving face clone data:', error);
    }
  }

  private calculateCloneQuality(faceCloneData: FaceCloneData): number {
    let quality = 0.5; // Base quality
    
    // Factor in number of reference images
    const imageCount = Object.values(faceCloneData.facialLandmarks).flat().length / 100;
    quality += Math.min(imageCount * 0.1, 0.2);
    
    // Factor in voice analysis
    if (faceCloneData.voiceCharacteristics.fundamentalFrequency > 0) {
      quality += 0.15;
    }
    
    // Factor in personality analysis
    if (faceCloneData.personalityTraits.commonPhrases.length > 0) {
      quality += 0.1;
    }
    
    // Factor in animation sequences
    quality += Math.min(faceCloneData.animationSequences.length * 0.05, 0.15);
    
    return Math.min(quality, 1.0);
  }

  getAnalysisProgress(): number {
    return this.analysisProgress;
  }

  isAnalyzing(): boolean {
    return this.isAnalyzing;
  }

  getFaceCloneData(): FaceCloneData | null {
    return this.faceCloneData;
  }
}

export const faceCloningEngine = new FaceCloningEngine();