import { captureException } from './monitoring';

export interface SpeechRecognitionConfig {
  continuous: boolean;
  interimResults: boolean;
  language: string;
  maxAlternatives: number;
}

export interface SpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

export interface ConversationContext {
  recentMessages: string[];
  currentTopic: string;
  emotionalTone: string;
  speakingPace: number;
}

export class RealTimeSpeechRecognition {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private config: SpeechRecognitionConfig;
  private onResultCallback?: (result: SpeechResult) => void;
  private onErrorCallback?: (error: string) => void;
  private onStartCallback?: () => void;
  private onEndCallback?: () => void;
  private silenceTimer: number | null = null;
  private lastSpeechTime = 0;
  private conversationContext: ConversationContext = {
    recentMessages: [],
    currentTopic: '',
    emotionalTone: 'neutral',
    speakingPace: 1.0
  };

  constructor(config: Partial<SpeechRecognitionConfig> = {}) {
    this.config = {
      continuous: true,
      interimResults: true,
      language: 'en-US',
      maxAlternatives: 1,
      ...config
    };

    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();

    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isListening = true;
      this.onStartCallback?.();
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isListening = false;
      this.onEndCallback?.();
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      
      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'no-speech':
          console.log('No speech detected, continuing...');
          return;
        case 'audio-capture':
          errorMessage = 'Microphone access denied or not available.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error during speech recognition.';
          break;
        case 'aborted':
          console.log('Speech recognition aborted (normal during restart)');
          return;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      this.onErrorCallback?.(errorMessage);
    };

    this.recognition.onresult = (event) => {
      this.handleSpeechResult(event);
    };
  }

  private handleSpeechResult(event: SpeechRecognitionEvent): void {
    const result = event.results[event.resultIndex];
    const transcript = result[0].transcript;
    const confidence = result[0].confidence;
    const isFinal = result.isFinal;

    this.lastSpeechTime = Date.now();

    // Update conversation context
    this.updateConversationContext(transcript, isFinal);

    // Clear silence timer since we detected speech
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    const speechResult: SpeechResult = {
      transcript: transcript.trim(),
      confidence,
      isFinal,
      timestamp: new Date()
    };

    this.onResultCallback?.(speechResult);

    // Set silence detection timer for final results
    if (isFinal) {
      this.setSilenceTimer();
    }
  }

  private updateConversationContext(transcript: string, isFinal: boolean): void {
    if (isFinal && transcript.trim().length > 0) {
      // Add to recent messages
      this.conversationContext.recentMessages.push(transcript);
      if (this.conversationContext.recentMessages.length > 10) {
        this.conversationContext.recentMessages.shift();
      }

      // Analyze emotional tone
      this.conversationContext.emotionalTone = this.analyzeEmotionalTone(transcript);
      
      // Update current topic
      this.conversationContext.currentTopic = this.extractTopic(transcript);
      
      // Calculate speaking pace
      this.conversationContext.speakingPace = this.calculateSpeakingPace(transcript);
    }
  }

  private analyzeEmotionalTone(transcript: string): string {
    const lowerText = transcript.toLowerCase();
    
    if (lowerText.includes('happy') || lowerText.includes('great') || lowerText.includes('wonderful')) {
      return 'happy';
    }
    if (lowerText.includes('sad') || lowerText.includes('miss') || lowerText.includes('difficult')) {
      return 'sad';
    }
    if (lowerText.includes('excited') || lowerText.includes('amazing') || lowerText.includes('love')) {
      return 'excited';
    }
    if (lowerText.includes('worried') || lowerText.includes('concerned') || lowerText.includes('anxious')) {
      return 'concerned';
    }
    
    return 'neutral';
  }

  private extractTopic(transcript: string): string {
    const lowerText = transcript.toLowerCase();
    
    if (lowerText.includes('family') || lowerText.includes('children') || lowerText.includes('kids')) {
      return 'family';
    }
    if (lowerText.includes('work') || lowerText.includes('job') || lowerText.includes('career')) {
      return 'work';
    }
    if (lowerText.includes('health') || lowerText.includes('feeling') || lowerText.includes('doctor')) {
      return 'health';
    }
    if (lowerText.includes('memory') || lowerText.includes('remember') || lowerText.includes('past')) {
      return 'memories';
    }
    
    return 'general';
  }

  private calculateSpeakingPace(transcript: string): number {
    // Estimate words per minute based on transcript length and time
    const wordCount = transcript.split(' ').length;
    const timeSpan = 3; // Assume 3 seconds for estimation
    const wordsPerMinute = (wordCount / timeSpan) * 60;
    
    // Normalize to a pace multiplier (0.5 = slow, 1.0 = normal, 1.5 = fast)
    if (wordsPerMinute < 120) return 0.8; // Slow
    if (wordsPerMinute > 180) return 1.2; // Fast
    return 1.0; // Normal
  }

  private setSilenceTimer(): void {
    // Detect when user stops speaking (2 seconds of silence)
    this.silenceTimer = window.setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
      if (timeSinceLastSpeech >= 2000) {
        this.onSilenceDetected?.();
      }
    }, 2000);
  }

  startListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not available'));
        return;
      }

      // Don't start if already listening
      if (this.isListening) {
        console.log('Speech recognition already active');
        resolve();
        return;
      }

      try {
        console.log('Starting speech recognition...');
        this.recognition.start();
        resolve();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        reject(error);
      }
    });
  }

  stopListening(): void {
    console.log('Stopping speech recognition...');
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  getConversationContext(): ConversationContext {
    return { ...this.conversationContext };
  }

  // Event handlers
  onResult(callback: (result: SpeechResult) => void): void {
    this.onResultCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  onSilenceDetected?: () => void;

  destroy(): void {
    this.stopListening();
    this.recognition = null;
    this.onResultCallback = undefined;
    this.onErrorCallback = undefined;
    this.onStartCallback = undefined;
    this.onEndCallback = undefined;
    this.onSilenceDetected = undefined;
  }
}

export const speechRecognition = new RealTimeSpeechRecognition();