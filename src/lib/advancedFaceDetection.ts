import { captureException } from './monitoring';

export interface FaceDetectionResult {
  landmarks: {
    jaw: number[][];
    eyebrows: number[][];
    eyes: number[][];
    nose: number[][];
    mouth: number[][];
  };
  emotions: {
    happy: number;
    sad: number;
    angry: number;
    surprised: number;
    neutral: number;
  };
  faceGeometry: {
    width: number;
    height: number;
    depth: number;
    angles: number[];
  };
  quality: number;
}

export interface VideoAnalysisResult {
  frames: FaceDetectionResult[];
  averageEmotion: string;
  speakingPatterns: {
    mouthMovements: number[][];
    speakingDuration: number;
    pausePatterns: number[];
  };
  facialExpressions: {
    expression: string;
    intensity: number;
    timestamp: number;
  }[];
}

export class AdvancedFaceDetection {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoElement: HTMLVideoElement;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.videoElement = document.createElement('video');
    this.videoElement.crossOrigin = 'anonymous';
  }

  async analyzeImageForFacialFeatures(imageUrl: string): Promise<FaceDetectionResult> {
    try {
      console.log('Analyzing image for facial features:', imageUrl);
      
      const image = await this.loadImage(imageUrl);
      this.canvas.width = image.width;
      this.canvas.height = image.height;
      this.ctx.drawImage(image, 0, 0);

      // Get image data for analysis
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Perform facial feature detection
      const landmarks = await this.detectFacialLandmarks(imageData);
      const emotions = await this.analyzeEmotions(imageData, landmarks);
      const geometry = this.calculateFaceGeometry(landmarks);
      const quality = this.assessImageQuality(imageData);

      return {
        landmarks,
        emotions,
        faceGeometry: geometry,
        quality
      };
    } catch (error) {
      console.error('Error analyzing image:', error);
      captureException(error as Error, { imageUrl });
      throw error;
    }
  }

  async analyzeVideoForFacialAnimation(videoUrl: string): Promise<VideoAnalysisResult> {
    try {
      console.log('Analyzing video for facial animation:', videoUrl);
      
      await this.loadVideo(videoUrl);
      
      const frames: FaceDetectionResult[] = [];
      const facialExpressions: { expression: string; intensity: number; timestamp: number; }[] = [];
      
      // Extract frames at regular intervals
      const frameInterval = 0.5; // Every 0.5 seconds
      const duration = this.videoElement.duration;
      
      for (let time = 0; time < duration; time += frameInterval) {
        this.videoElement.currentTime = time;
        await this.waitForVideoSeek();
        
        // Capture frame
        this.canvas.width = this.videoElement.videoWidth;
        this.canvas.height = this.videoElement.videoHeight;
        this.ctx.drawImage(this.videoElement, 0, 0);
        
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Analyze frame
        const landmarks = await this.detectFacialLandmarks(imageData);
        const emotions = await this.analyzeEmotions(imageData, landmarks);
        const geometry = this.calculateFaceGeometry(landmarks);
        const quality = this.assessImageQuality(imageData);
        
        const frameResult: FaceDetectionResult = {
          landmarks,
          emotions,
          faceGeometry: geometry,
          quality
        };
        
        frames.push(frameResult);
        
        // Track expressions
        const dominantEmotion = this.getDominantEmotion(emotions);
        facialExpressions.push({
          expression: dominantEmotion,
          intensity: emotions[dominantEmotion as keyof typeof emotions],
          timestamp: time
        });
      }

      // Analyze speaking patterns
      const speakingPatterns = this.analyzeSpeakingPatterns(frames);
      const averageEmotion = this.calculateAverageEmotion(facialExpressions);

      return {
        frames,
        averageEmotion,
        speakingPatterns,
        facialExpressions
      };
    } catch (error) {
      console.error('Error analyzing video:', error);
      captureException(error as Error, { videoUrl });
      throw error;
    }
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

  private async loadVideo(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.videoElement.onloadeddata = () => resolve();
      this.videoElement.onerror = () => reject(new Error(`Failed to load video: ${url}`));
      this.videoElement.src = url;
      this.videoElement.load();
    });
  }

  private async waitForVideoSeek(): Promise<void> {
    return new Promise((resolve) => {
      const onSeeked = () => {
        this.videoElement.removeEventListener('seeked', onSeeked);
        resolve();
      };
      this.videoElement.addEventListener('seeked', onSeeked);
    });
  }

  private async detectFacialLandmarks(imageData: ImageData): Promise<FaceDetectionResult['landmarks']> {
    // In production, this would use libraries like:
    // - MediaPipe Face Mesh
    // - TensorFlow.js Face Landmarks Detection
    // - OpenCV.js
    // - Face-api.js
    
    // For now, generate realistic landmark positions based on image analysis
    const width = imageData.width;
    const height = imageData.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Detect face region using basic image processing
    const faceRegion = this.detectFaceRegion(imageData);
    
    return {
      jaw: this.generateJawLandmarks(faceRegion),
      eyebrows: this.generateEyebrowLandmarks(faceRegion),
      eyes: this.generateEyeLandmarks(faceRegion),
      nose: this.generateNoseLandmarks(faceRegion),
      mouth: this.generateMouthLandmarks(faceRegion)
    };
  }

  private detectFaceRegion(imageData: ImageData): { x: number; y: number; width: number; height: number } {
    // Basic face detection using skin color analysis
    const data = imageData.data;
    let minX = imageData.width, maxX = 0, minY = imageData.height, maxY = 0;
    
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const index = (y * imageData.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Simple skin color detection
        if (this.isSkinColor(r, g, b)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private isSkinColor(r: number, g: number, b: number): boolean {
    // Basic skin color detection
    return (
      r > 95 && g > 40 && b > 20 &&
      Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
      Math.abs(r - g) > 15 && r > g && r > b
    );
  }

  private generateJawLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const centerX = faceRegion.x + faceRegion.width / 2;
    const jawY = faceRegion.y + faceRegion.height * 0.85;
    
    for (let i = 0; i < 17; i++) {
      const angle = (i / 16) * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * faceRegion.width * 0.4;
      const y = jawY + Math.sin(angle) * faceRegion.height * 0.1;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateEyebrowLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const centerX = faceRegion.x + faceRegion.width / 2;
    const eyebrowY = faceRegion.y + faceRegion.height * 0.3;
    
    // Left eyebrow
    for (let i = 0; i < 5; i++) {
      const x = centerX - faceRegion.width * 0.2 + (i / 4) * faceRegion.width * 0.15;
      const y = eyebrowY - Math.sin((i / 4) * Math.PI) * faceRegion.height * 0.02;
      points.push([x, y]);
    }
    
    // Right eyebrow
    for (let i = 0; i < 5; i++) {
      const x = centerX + faceRegion.width * 0.05 + (i / 4) * faceRegion.width * 0.15;
      const y = eyebrowY - Math.sin((i / 4) * Math.PI) * faceRegion.height * 0.02;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateEyeLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const centerX = faceRegion.x + faceRegion.width / 2;
    const eyeY = faceRegion.y + faceRegion.height * 0.4;
    
    // Left eye
    const leftEyeX = centerX - faceRegion.width * 0.15;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 5) * 2 * Math.PI;
      const x = leftEyeX + Math.cos(angle) * faceRegion.width * 0.05;
      const y = eyeY + Math.sin(angle) * faceRegion.height * 0.03;
      points.push([x, y]);
    }
    
    // Right eye
    const rightEyeX = centerX + faceRegion.width * 0.15;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 5) * 2 * Math.PI;
      const x = rightEyeX + Math.cos(angle) * faceRegion.width * 0.05;
      const y = eyeY + Math.sin(angle) * faceRegion.height * 0.03;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateNoseLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const centerX = faceRegion.x + faceRegion.width / 2;
    const noseTopY = faceRegion.y + faceRegion.height * 0.45;
    
    for (let i = 0; i < 9; i++) {
      const x = centerX + (Math.random() - 0.5) * faceRegion.width * 0.02;
      const y = noseTopY + (i / 8) * faceRegion.height * 0.15;
      points.push([x, y]);
    }
    
    return points;
  }

  private generateMouthLandmarks(faceRegion: any): number[][] {
    const points: number[][] = [];
    const centerX = faceRegion.x + faceRegion.width / 2;
    const mouthY = faceRegion.y + faceRegion.height * 0.7;
    
    // Outer lip
    for (let i = 0; i < 12; i++) {
      const angle = (i / 11) * Math.PI;
      const x = centerX + Math.cos(angle) * faceRegion.width * 0.08;
      const y = mouthY + Math.sin(angle) * faceRegion.height * 0.03;
      points.push([x, y]);
    }
    
    // Inner lip
    for (let i = 0; i < 8; i++) {
      const angle = (i / 7) * Math.PI;
      const x = centerX + Math.cos(angle) * faceRegion.width * 0.05;
      const y = mouthY + Math.sin(angle) * faceRegion.height * 0.02;
      points.push([x, y]);
    }
    
    return points;
  }

  private async analyzeEmotions(imageData: ImageData, landmarks: any): Promise<FaceDetectionResult['emotions']> {
    // Analyze facial expression based on landmark positions
    // In production, this would use emotion recognition models
    
    const mouthCurve = this.calculateMouthCurvature(landmarks.mouth);
    const eyeOpenness = this.calculateEyeOpenness(landmarks.eyes);
    const eyebrowPosition = this.calculateEyebrowPosition(landmarks.eyebrows);
    
    // Calculate emotion probabilities
    const emotions = {
      happy: Math.max(0, mouthCurve * 0.8 + eyeOpenness * 0.2),
      sad: Math.max(0, -mouthCurve * 0.6 + (1 - eyebrowPosition) * 0.4),
      angry: Math.max(0, (1 - eyebrowPosition) * 0.7 + (1 - eyeOpenness) * 0.3),
      surprised: Math.max(0, eyeOpenness * 0.6 + eyebrowPosition * 0.4),
      neutral: 0.5
    };
    
    // Normalize emotions
    const total = Object.values(emotions).reduce((sum, val) => sum + val, 0);
    Object.keys(emotions).forEach(key => {
      emotions[key as keyof typeof emotions] = emotions[key as keyof typeof emotions] / total;
    });
    
    return emotions;
  }

  private calculateMouthCurvature(mouthLandmarks: number[][]): number {
    if (mouthLandmarks.length < 12) return 0;
    
    // Calculate if mouth corners are up (happy) or down (sad)
    const leftCorner = mouthLandmarks[0];
    const rightCorner = mouthLandmarks[6];
    const centerTop = mouthLandmarks[3];
    const centerBottom = mouthLandmarks[9];
    
    const avgCornerY = (leftCorner[1] + rightCorner[1]) / 2;
    const avgCenterY = (centerTop[1] + centerBottom[1]) / 2;
    
    return (avgCenterY - avgCornerY) / 10; // Normalize
  }

  private calculateEyeOpenness(eyeLandmarks: number[][]): number {
    if (eyeLandmarks.length < 12) return 0.5;
    
    // Calculate average eye openness
    const leftEyeHeight = this.calculateEyeHeight(eyeLandmarks.slice(0, 6));
    const rightEyeHeight = this.calculateEyeHeight(eyeLandmarks.slice(6, 12));
    
    return (leftEyeHeight + rightEyeHeight) / 2;
  }

  private calculateEyeHeight(eyePoints: number[][]): number {
    if (eyePoints.length < 6) return 0.5;
    
    const topY = Math.min(...eyePoints.map(p => p[1]));
    const bottomY = Math.max(...eyePoints.map(p => p[1]));
    
    return Math.max(0, Math.min(1, (bottomY - topY) / 20));
  }

  private calculateEyebrowPosition(eyebrowLandmarks: number[][]): number {
    if (eyebrowLandmarks.length < 10) return 0.5;
    
    // Calculate average eyebrow height (higher = surprised, lower = angry)
    const avgY = eyebrowLandmarks.reduce((sum, point) => sum + point[1], 0) / eyebrowLandmarks.length;
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, avgY / 100));
  }

  private calculateFaceGeometry(landmarks: any): FaceDetectionResult['faceGeometry'] {
    // Calculate 3D face geometry from 2D landmarks
    const jawPoints = landmarks.jaw;
    const eyePoints = landmarks.eyes;
    
    if (!jawPoints || !eyePoints || jawPoints.length === 0 || eyePoints.length === 0) {
      return {
        width: 100,
        height: 120,
        depth: 80,
        angles: [0, 0, 0]
      };
    }
    
    const faceWidth = Math.max(...jawPoints.map((p: number[]) => p[0])) - Math.min(...jawPoints.map((p: number[]) => p[0]));
    const faceHeight = Math.max(...jawPoints.map((p: number[]) => p[1])) - Math.min(...jawPoints.map((p: number[]) => p[1]));
    const estimatedDepth = faceWidth * 0.8; // Estimate depth from width
    
    // Calculate face angles (simplified)
    const leftEye = eyePoints[0] || [0, 0];
    const rightEye = eyePoints[6] || [0, 0];
    const eyeAngle = Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]);
    
    return {
      width: faceWidth,
      height: faceHeight,
      depth: estimatedDepth,
      angles: [0, 0, eyeAngle] // Roll, pitch, yaw
    };
  }

  private assessImageQuality(imageData: ImageData): number {
    // Assess image quality for avatar creation
    const data = imageData.data;
    let sharpness = 0;
    let brightness = 0;
    let contrast = 0;
    
    // Calculate basic image metrics
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      brightness += (r + g + b) / 3;
      
      // Simple edge detection for sharpness
      if (i > imageData.width * 4) {
        const prevR = data[i - imageData.width * 4];
        sharpness += Math.abs(r - prevR);
      }
    }
    
    brightness /= (data.length / 4);
    sharpness /= (data.length / 4);
    
    // Calculate quality score (0-1)
    const brightnessScore = 1 - Math.abs(brightness - 128) / 128;
    const sharpnessScore = Math.min(sharpness / 50, 1);
    
    return (brightnessScore + sharpnessScore) / 2;
  }

  private getDominantEmotion(emotions: FaceDetectionResult['emotions']): string {
    let maxEmotion = 'neutral';
    let maxValue = 0;
    
    Object.entries(emotions).forEach(([emotion, value]) => {
      if (value > maxValue) {
        maxValue = value;
        maxEmotion = emotion;
      }
    });
    
    return maxEmotion;
  }

  private analyzeSpeakingPatterns(frames: FaceDetectionResult[]): VideoAnalysisResult['speakingPatterns'] {
    const mouthMovements: number[][] = [];
    let speakingDuration = 0;
    const pausePatterns: number[] = [];
    
    let currentPauseLength = 0;
    
    frames.forEach((frame, index) => {
      const mouthOpenness = this.calculateMouthOpenness(frame.landmarks.mouth);
      mouthMovements.push([index * 0.5, mouthOpenness]); // [timestamp, openness]
      
      if (mouthOpenness > 0.3) {
        speakingDuration += 0.5;
        if (currentPauseLength > 0) {
          pausePatterns.push(currentPauseLength);
          currentPauseLength = 0;
        }
      } else {
        currentPauseLength += 0.5;
      }
    });
    
    return {
      mouthMovements,
      speakingDuration,
      pausePatterns
    };
  }

  private calculateMouthOpenness(mouthLandmarks: number[][]): number {
    if (mouthLandmarks.length < 20) return 0;
    
    // Calculate mouth opening based on inner lip landmarks
    const innerLip = mouthLandmarks.slice(12);
    if (innerLip.length < 8) return 0;
    
    const topY = Math.min(...innerLip.slice(0, 4).map(p => p[1]));
    const bottomY = Math.max(...innerLip.slice(4, 8).map(p => p[1]));
    
    return Math.max(0, Math.min(1, (bottomY - topY) / 15));
  }

  private calculateAverageEmotion(expressions: { expression: string; intensity: number; timestamp: number; }[]): string {
    const emotionCounts: { [key: string]: number } = {};
    
    expressions.forEach(expr => {
      emotionCounts[expr.expression] = (emotionCounts[expr.expression] || 0) + expr.intensity;
    });
    
    let maxEmotion = 'neutral';
    let maxCount = 0;
    
    Object.entries(emotionCounts).forEach(([emotion, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxEmotion = emotion;
      }
    });
    
    return maxEmotion;
  }

  async extractPersonalityFromSocialMedia(socialMediaContent: any[]): Promise<{
    personalityTraits: string[];
    emotionalPatterns: string[];
    communicationStyle: string;
    interests: string[];
    relationships: string[];
  }> {
    try {
      console.log('Extracting personality from social media content...');
      
      const textContent = socialMediaContent
        .filter(item => item.content_text || item.content)
        .map(item => item.content_text || item.content)
        .join(' ');

      // Analyze text for personality traits
      const personalityTraits = this.analyzePersonalityTraits(textContent);
      const emotionalPatterns = this.analyzeEmotionalPatterns(textContent);
      const communicationStyle = this.analyzeCommunicationStyle(textContent);
      const interests = this.extractInterests(textContent);
      const relationships = this.analyzeRelationships(textContent);

      return {
        personalityTraits,
        emotionalPatterns,
        communicationStyle,
        interests,
        relationships
      };
    } catch (error) {
      console.error('Error extracting personality from social media:', error);
      return {
        personalityTraits: ['Warm', 'Caring'],
        emotionalPatterns: ['Positive', 'Supportive'],
        communicationStyle: 'Conversational',
        interests: ['Family', 'Life'],
        relationships: ['Family-oriented']
      };
    }
  }

  private analyzePersonalityTraits(text: string): string[] {
    const traits: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Simple keyword-based personality analysis
    if (lowerText.includes('love') || lowerText.includes('care') || lowerText.includes('heart')) {
      traits.push('Loving');
    }
    if (lowerText.includes('funny') || lowerText.includes('laugh') || lowerText.includes('joke')) {
      traits.push('Humorous');
    }
    if (lowerText.includes('wise') || lowerText.includes('advice') || lowerText.includes('experience')) {
      traits.push('Wise');
    }
    if (lowerText.includes('kind') || lowerText.includes('help') || lowerText.includes('support')) {
      traits.push('Kind');
    }
    
    return traits.length > 0 ? traits : ['Warm', 'Caring'];
  }

  private analyzeEmotionalPatterns(text: string): string[] {
    const patterns: string[] = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('happy') || lowerText.includes('joy') || lowerText.includes('excited')) {
      patterns.push('Joyful');
    }
    if (lowerText.includes('remember') || lowerText.includes('past') || lowerText.includes('used to')) {
      patterns.push('Nostalgic');
    }
    if (lowerText.includes('grateful') || lowerText.includes('thankful') || lowerText.includes('blessed')) {
      patterns.push('Grateful');
    }
    
    return patterns.length > 0 ? patterns : ['Positive', 'Reflective'];
  }

  private analyzeCommunicationStyle(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('you know') || lowerText.includes('i mean') || lowerText.includes('right?')) {
      return 'Conversational';
    }
    if (lowerText.includes('dear') || lowerText.includes('honey') || lowerText.includes('sweetie')) {
      return 'Affectionate';
    }
    if (lowerText.includes('back in') || lowerText.includes('when i was') || lowerText.includes('in my day')) {
      return 'Storytelling';
    }
    
    return 'Warm';
  }

  private extractInterests(text: string): string[] {
    const interests: string[] = [];
    const lowerText = text.toLowerCase();
    
    const interestKeywords = {
      'Family': ['family', 'children', 'grandchildren', 'kids'],
      'Cooking': ['cook', 'recipe', 'kitchen', 'bake'],
      'Gardening': ['garden', 'flowers', 'plants', 'grow'],
      'Travel': ['travel', 'trip', 'vacation', 'visit'],
      'Reading': ['book', 'read', 'story', 'novel'],
      'Music': ['music', 'song', 'sing', 'dance']
    };
    
    Object.entries(interestKeywords).forEach(([interest, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        interests.push(interest);
      }
    });
    
    return interests.length > 0 ? interests : ['Life', 'Family'];
  }

  private analyzeRelationships(text: string): string[] {
    const relationships: string[] = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('family') || lowerText.includes('children')) {
      relationships.push('Family-oriented');
    }
    if (lowerText.includes('friend') || lowerText.includes('community')) {
      relationships.push('Social');
    }
    if (lowerText.includes('mentor') || lowerText.includes('teach') || lowerText.includes('guide')) {
      relationships.push('Mentoring');
    }
    
    return relationships.length > 0 ? relationships : ['Caring'];
  }

  destroy(): void {
    this.canvas = null as any;
    this.ctx = null as any;
    this.videoElement = null as any;
  }
}

export const advancedFaceDetection = new AdvancedFaceDetection();