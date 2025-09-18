import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Volume2, VolumeX, Settings, Maximize, Minimize, Brain, Zap } from 'lucide-react';
import { LifelikePersonaRenderer } from '../lib/lifelikeRenderer';
import { faceCloningEngine } from '../lib/faceCloning';
import { voiceCloning } from '../lib/voiceCloning';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';

interface LifelikeVideoPlayerProps {
  personaId: string;
  personaName: string;
  onEndCall: () => void;
}

export function LifelikeVideoPlayer({ personaId, personaName, onEndCall }: LifelikeVideoPlayerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isPersonaSpeaking, setIsPersonaSpeaking] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const [initializationStep, setInitializationStep] = useState('');
  const [cloneQuality, setCloneQuality] = useState(0);
  
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const personaRendererRef = useRef<LifelikePersonaRenderer | null>(null);
  const callStartTime = useRef<Date>(new Date());
  const { user } = useAuth();

  useEffect(() => {
    initializeLifelikePersona();
    startCallTimer();

    return () => {
      cleanup();
    };
  }, []);

  const initializeLifelikePersona = async () => {
    try {
      setInitializationStep('Loading persona data and content...');
      setInitializationProgress(5);

      // Get persona data and all uploaded content
      const [personaResponse, contentResponse] = await Promise.all([
        supabase.from('personas').select('*').eq('id', personaId).single(),
        supabase.from('persona_content').select('*').eq('persona_id', personaId).eq('processing_status', 'completed')
      ]);

      const personaData = personaResponse.data;
      const uploadedContent = contentResponse.data || [];

      if (!personaData) {
        throw new Error('Persona not found');
      }

      setInitializationStep('Organizing training content...');
      setInitializationProgress(15);

      // Organize content by type for comprehensive analysis
      const referenceImages = uploadedContent
        .filter(c => c.content_type === 'image' || c.file_name?.match(/\.(jpg|jpeg|png|gif)$/i))
        .map(c => c.file_url)
        .filter(Boolean);
      
      const referenceVideos = uploadedContent
        .filter(c => c.content_type === 'video' || c.file_name?.match(/\.(mp4|mov|avi)$/i))
        .map(c => c.file_url)
        .filter(Boolean);
      
      const voiceSamples = uploadedContent
        .filter(c => c.content_type === 'audio' || c.file_name?.match(/\.(mp3|wav|m4a)$/i))
        .map(c => c.file_url)
        .filter(Boolean);

      const socialMediaContent = uploadedContent
        .filter(c => c.content_type === 'social_media')
        .map(c => ({
          content_text: c.content_text,
          metadata: c.metadata
        }));

      console.log('Content analysis for lifelike clone:', {
        images: referenceImages.length,
        videos: referenceVideos.length,
        audio: voiceSamples.length,
        socialMedia: socialMediaContent.length
      });

      if (referenceImages.length === 0) {
        throw new Error('At least one reference image is required for face cloning');
      }

      setInitializationStep('Creating 3D face clone...');
      setInitializationProgress(25);

      // Initialize persona renderer
      personaRendererRef.current = new LifelikePersonaRenderer({
        enableLipSync: true,
        enableEyeTracking: true,
        enableHeadMovement: true,
        enableEmotionalExpressions: true,
        renderQuality: 'high'
      });

      // Monitor face cloning progress
      const progressInterval = setInterval(() => {
        const progress = faceCloningEngine.getAnalysisProgress();
        setInitializationProgress(25 + (progress * 0.6)); // 25% to 85%
        
        if (progress >= 100) {
          clearInterval(progressInterval);
        }
      }, 500);

      // Initialize the lifelike persona
      const lifelikePersona = await personaRendererRef.current.initializePersona(
        personaId,
        personaName,
        referenceImages,
        referenceVideos,
        voiceSamples,
        socialMediaContent
      );

      clearInterval(progressInterval);

      setInitializationStep('Setting up real-time rendering...');
      setInitializationProgress(90);

      // Set up canvas display
      if (avatarCanvasRef.current && personaRendererRef.current) {
        const rendererCanvas = personaRendererRef.current.getCanvas();
        const displayCtx = avatarCanvasRef.current.getContext('2d');
        
        if (displayCtx && rendererCanvas) {
          avatarCanvasRef.current.width = rendererCanvas.width;
          avatarCanvasRef.current.height = rendererCanvas.height;
          
          // Copy frames from renderer to display canvas
          const copyFrames = () => {
            if (displayCtx && rendererCanvas && personaRendererRef.current) {
              displayCtx.clearRect(0, 0, avatarCanvasRef.current!.width, avatarCanvasRef.current!.height);
              displayCtx.drawImage(rendererCanvas, 0, 0);
              
              if (personaRendererRef.current.getPersona()?.isReady) {
                requestAnimationFrame(copyFrames);
              }
            }
          };
          
          copyFrames();
        }
      }

      // Calculate clone quality
      const faceCloneData = faceCloningEngine.getFaceCloneData();
      if (faceCloneData) {
        const quality = this.calculateOverallQuality(
          referenceImages.length,
          referenceVideos.length,
          voiceSamples.length,
          socialMediaContent.length
        );
        setCloneQuality(quality);
      }

      setInitializationStep('Finalizing lifelike persona...');
      setInitializationProgress(95);

      await new Promise(resolve => setTimeout(resolve, 1000));

      setInitializationProgress(100);
      setIsInitialized(true);
      
      // Connect and greet
      setTimeout(() => {
        setIsConnected(true);
        generatePersonalizedGreeting();
      }, 1000);

    } catch (error) {
      console.error('Error initializing lifelike persona:', error);
      toast.error(`Failed to create lifelike ${personaName}. ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to basic mode
      setIsInitialized(true);
      setIsConnected(true);
    }
  };

  const calculateOverallQuality = (images: number, videos: number, audio: number, social: number): number => {
    let quality = 0.3; // Base quality
    
    quality += Math.min(images * 0.1, 0.3);  // Up to 30% for images
    quality += Math.min(videos * 0.15, 0.2); // Up to 20% for videos
    quality += Math.min(audio * 0.1, 0.15);  // Up to 15% for audio
    quality += Math.min(social * 0.01, 0.05); // Up to 5% for social media
    
    return Math.min(quality, 1.0);
  };

  const generatePersonalizedGreeting = async () => {
    if (!personaRendererRef.current) return;

    try {
      // Generate contextual greeting based on personality
      const { AIPersonaEngine } = await import('../lib/ai');
      
      const { data: personaData } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (personaData) {
        const personaContext = {
          id: personaData.id,
          name: personaData.name,
          personality_traits: personaData.personality_traits || '',
          common_phrases: personaData.common_phrases || [],
          relationship: personaData.relationship || '',
          memories: [],
          conversationHistory: []
        };

        const aiEngine = new AIPersonaEngine(personaContext);
        const greeting = await aiEngine.generateResponse("Hello, it's wonderful to see you again!");
        
        // Set happy expression for greeting
        personaRendererRef.current.setExpression('happy', 0.7);
        
        // Generate voice and speak
        try {
          const audioBuffer = await voiceCloning.synthesizeVoice(personaId, greeting, 'happy');
          await personaRendererRef.current.speakWithAdvancedLipSync(greeting, audioBuffer);
        } catch (voiceError) {
          console.warn('Voice synthesis failed, using text-to-speech:', voiceError);
          
          // Fallback to browser TTS
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(greeting);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            
            utterance.onstart = () => {
              personaRendererRef.current?.setExpression('speaking', 0.8);
              setIsPersonaSpeaking(true);
            };
            
            utterance.onend = () => {
              personaRendererRef.current?.setExpression('neutral', 0);
              setIsPersonaSpeaking(false);
            };
            
            speechSynthesis.speak(utterance);
          }
        }
      }
    } catch (error) {
      console.error('Error generating personalized greeting:', error);
    }
  };

  const handleUserMessage = async () => {
    if (!currentMessage.trim() || !personaRendererRef.current || isPersonaSpeaking) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsPersonaSpeaking(true);

    try {
      // Set listening expression
      personaRendererRef.current.setExpression('thinking', 0.5);
      
      // Generate contextual response
      const { AIPersonaEngine } = await import('../lib/ai');
      
      const { data: personaData } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (personaData) {
        const personaContext = {
          id: personaData.id,
          name: personaData.name,
          personality_traits: personaData.personality_traits || '',
          common_phrases: personaData.common_phrases || [],
          relationship: personaData.relationship || '',
          memories: [],
          conversationHistory: []
        };

        const aiEngine = new AIPersonaEngine(personaContext);
        const response = await aiEngine.generateResponse(userMessage);
        
        // Analyze emotion of response
        const emotionAnalysis = await aiEngine.analyzeEmotion(response);
        
        // Set appropriate expression
        personaRendererRef.current.setEmotion(emotionAnalysis.emotion);
        
        // Generate voice and speak with advanced lip sync
        try {
          const audioBuffer = await voiceCloning.synthesizeVoice(personaId, response, emotionAnalysis.emotion);
          await personaRendererRef.current.speakWithAdvancedLipSync(response, audioBuffer);
        } catch (voiceError) {
          console.warn('Advanced voice synthesis failed, using fallback:', voiceError);
          
          // Fallback to browser TTS with lip sync simulation
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(response);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            
            utterance.onstart = () => {
              personaRendererRef.current?.setExpression('speaking', 0.8);
            };
            
            utterance.onend = () => {
              personaRendererRef.current?.setExpression('neutral', 0);
              setIsPersonaSpeaking(false);
            };
            
            speechSynthesis.speak(utterance);
          } else {
            // Simulate speaking time
            personaRendererRef.current.setExpression('speaking', 0.8);
            setTimeout(() => {
              personaRendererRef.current?.setExpression('neutral', 0);
              setIsPersonaSpeaking(false);
            }, response.length * 50);
          }
        }
      }
    } catch (error) {
      console.error('Error handling user message:', error);
      setIsPersonaSpeaking(false);
      toast.error('Failed to generate response');
    }
  };

  const startCallTimer = () => {
    const interval = setInterval(() => {
      const now = new Date();
      const duration = Math.floor((now.getTime() - callStartTime.current.getTime()) / 1000);
      setCallDuration(duration);
    }, 1000);

    return () => clearInterval(interval);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const cleanup = () => {
    if (personaRendererRef.current) {
      personaRendererRef.current.destroy();
      personaRendererRef.current = null;
    }
  };

  // Initialization screen with detailed progress
  if (!isInitialized) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white max-w-lg">
          <div className="relative w-40 h-40 mx-auto mb-8">
            {/* Animated avatar placeholder */}
            <div className="w-40 h-40 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center relative overflow-hidden">
              <span className="text-5xl font-bold">{personaName[0]}</span>
              
              {/* Scanning effect */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{
                  transform: `translateX(${(initializationProgress - 50) * 2}%)`,
                  transition: 'transform 0.5s ease-out'
                }}
              ></div>
            </div>
            
            {/* Progress ring */}
            <div className="absolute inset-0">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="75"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="75"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 75}`}
                  strokeDashoffset={`${2 * Math.PI * 75 * (1 - initializationProgress / 100)}`}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-4">Creating Lifelike {personaName}</h2>
          <p className="text-xl opacity-75 mb-2">{initializationStep}</p>
          <p className="text-lg opacity-60 mb-8">{initializationProgress}% Complete</p>
          
          {/* Quality indicator */}
          {cloneQuality > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Brain className="h-5 w-5 text-purple-400" />
                <span className="text-sm">Clone Quality: {Math.round(cloneQuality * 100)}%</span>
              </div>
              <div className="w-64 bg-white/20 rounded-full h-2 mx-auto">
                <div
                  className="bg-gradient-to-r from-green-400 to-blue-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${cloneQuality * 100}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Feature indicators */}
          <div className="grid grid-cols-2 gap-4 text-sm opacity-60 max-w-md mx-auto">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${initializationProgress > 30 ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              <span>Facial Structure Analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${initializationProgress > 50 ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              <span>Expression Mapping</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${initializationProgress > 70 ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              <span>Voice Cloning</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${initializationProgress > 85 ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              <span>Personality Integration</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'} bg-black flex flex-col`}>
      {/* Header with quality indicator */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-6">
        <div className="flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-semibold">{personaName}</h2>
            <div className="flex items-center space-x-3 text-sm opacity-75">
              <span>{isConnected ? `3D Lifelike • ${formatDuration(callDuration)}` : 'Connecting...'}</span>
              {cloneQuality > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <Zap className="h-3 w-3" />
                    <span>{Math.round(cloneQuality * 100)}% Clone Quality</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main 3D Avatar Display */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
          {isConnected ? (
            <div className="relative">
              {/* 3D Lifelike Avatar Canvas */}
              <div className="relative">
                <canvas
                  ref={avatarCanvasRef}
                  className={`w-96 h-96 rounded-2xl border-4 border-white/30 transition-all duration-300 ${
                    isPersonaSpeaking ? 'scale-105 shadow-2xl ring-4 ring-purple-400/50' : 'scale-100'
                  }`}
                  style={{
                    filter: `brightness(${isSpeakerOn ? 1.2 : 0.8}) contrast(1.3) saturate(1.2)`,
                    background: 'linear-gradient(135deg, #1a1a2e, #16213e)'
                  }}
                />
                
                {/* Realistic lighting overlay */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none"></div>
                
                {/* Advanced speaking visualization */}
                {isPersonaSpeaking && (
                  <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                    <div className="flex items-center space-x-1">
                      {[...Array(9)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-gradient-to-t from-purple-400 to-blue-400 rounded-full animate-pulse"
                          style={{
                            height: `${Math.random() * 28 + 12}px`,
                            animationDelay: `${i * 0.08}s`,
                            animationDuration: '0.6s'
                          }}
                        ></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Persona info */}
              <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 text-center text-white">
                <h3 className="text-2xl font-semibold mb-1">{personaName}</h3>
                <div className="flex items-center justify-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isPersonaSpeaking ? 'bg-green-400 animate-pulse' : 'bg-blue-400'}`}></div>
                  <span className="text-sm opacity-75">
                    {isPersonaSpeaking ? 'Speaking...' : 'Listening'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-xl">Connecting to {personaName}...</p>
              <p className="text-sm opacity-60 mt-2">Initializing 3D lifelike avatar...</p>
            </div>
          )}
        </div>

        {/* User Video (Picture-in-Picture) */}
        <div className="absolute bottom-32 right-6 w-48 h-36 bg-gray-800 rounded-xl border-2 border-white/20 overflow-hidden shadow-2xl">
          {isVideoOn ? (
            <Webcam
              ref={webcamRef}
              audio={false}
              className="w-full h-full object-cover"
              mirrored
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white bg-gray-700">
              <VideoOff className="h-8 w-8" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
            You
          </div>
        </div>
      </div>

      {/* Enhanced Message Input */}
      <div className="absolute bottom-24 left-6 right-6">
        <div className="bg-black/70 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleUserMessage()}
              placeholder="Have a lifelike conversation..."
              className="flex-1 bg-white/10 backdrop-blur text-white placeholder-gray-300 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 transition-all border border-white/10"
              disabled={isPersonaSpeaking}
            />
            <button
              onClick={handleUserMessage}
              disabled={!currentMessage.trim() || isPersonaSpeaking}
              className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Mic className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Call Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
        <div className="flex justify-center items-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition-all duration-300 shadow-lg ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 scale-110' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
          </button>

          {/* Video Button */}
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-4 rounded-full transition-all duration-300 shadow-lg ${
              !isVideoOn 
                ? 'bg-red-500 hover:bg-red-600 scale-110' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isVideoOn ? <Video className="h-6 w-6 text-white" /> : <VideoOff className="h-6 w-6 text-white" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            className="p-5 bg-red-500 rounded-full hover:bg-red-600 transition-all duration-300 transform hover:scale-110 shadow-xl"
          >
            <Phone className="h-7 w-7 text-white" />
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-4 rounded-full transition-all duration-300 shadow-lg ${
              !isSpeakerOn 
                ? 'bg-red-500 hover:bg-red-600 scale-110' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="h-6 w-6 text-white" /> : <VolumeX className="h-6 w-6 text-white" />}
          </button>

          {/* Settings Button */}
          <button className="p-4 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur transition-all duration-300 shadow-lg">
            <Settings className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Quality and Features Indicator */}
      <div className="absolute top-20 right-6 space-y-2">
        <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 text-white text-sm border border-white/10">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>3D Lifelike Active</span>
          </div>
        </div>
        
        {cloneQuality > 0.8 && (
          <div className="bg-purple-600/80 backdrop-blur rounded-lg px-3 py-2 text-white text-sm border border-purple-400/30">
            <div className="flex items-center space-x-2">
              <Zap className="h-3 w-3" />
              <span>Ultra Quality</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}