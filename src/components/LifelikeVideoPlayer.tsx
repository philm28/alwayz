import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Volume2, VolumeX, Settings, Maximize, Minimize } from 'lucide-react';
import { createRealisticPersonaRenderer, RealisticPersonaRenderer } from '../lib/realisticPersonaRenderer';
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
  
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const personaRendererRef = useRef<RealisticPersonaRenderer | null>(null);
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
      setInitializationStep('Loading persona data...');
      setInitializationProgress(10);

      // Get persona data and content
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
      setInitializationProgress(25);

      // Organize content by type
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

      console.log('Content analysis:', {
        images: referenceImages.length,
        videos: referenceVideos.length,
        audio: voiceSamples.length,
        socialMedia: socialMediaContent.length
      });

      setInitializationStep('Creating 3D avatar model...');
      setInitializationProgress(50);

      // Create realistic persona renderer
      const rendererConfig = {
        personaId,
        name: personaName,
        referenceImages,
        referenceVideos,
        voiceSamples,
        socialMediaContent,
        personalityData: personaData
      };

      personaRendererRef.current = await createRealisticPersonaRenderer(rendererConfig);

      setInitializationStep('Initializing facial animation...');
      setInitializationProgress(75);

      // Set up canvas
      if (avatarCanvasRef.current && personaRendererRef.current) {
        const avatarCanvas = personaRendererRef.current.getCanvas();
        if (avatarCanvas) {
          const ctx = avatarCanvasRef.current.getContext('2d');
          if (ctx) {
            avatarCanvasRef.current.width = avatarCanvas.width;
            avatarCanvasRef.current.height = avatarCanvas.height;
            
            // Start rendering loop
            personaRendererRef.current.startRendering();
            
            // Copy frames from avatar engine to display canvas
            const copyFrame = () => {
              if (avatarCanvas && ctx && personaRendererRef.current) {
                ctx.clearRect(0, 0, avatarCanvasRef.current!.width, avatarCanvasRef.current!.height);
                ctx.drawImage(avatarCanvas, 0, 0);
                
                if (personaRendererRef.current.getRenderingState().isRendering) {
                  requestAnimationFrame(copyFrame);
                }
              }
            };
            
            copyFrame();
          }
        }
      }

      setInitializationStep('Finalizing setup...');
      setInitializationProgress(90);

      // Simulate final setup
      await new Promise(resolve => setTimeout(resolve, 1000));

      setInitializationProgress(100);
      setIsInitialized(true);
      
      // Simulate connection
      setTimeout(() => {
        setIsConnected(true);
        generateWelcomeMessage();
      }, 1000);

    } catch (error) {
      console.error('Error initializing lifelike persona:', error);
      toast.error('Failed to initialize 3D persona. Using fallback mode.');
      
      // Fallback to basic mode
      setIsInitialized(true);
      setIsConnected(true);
    }
  };

  const generateWelcomeMessage = async () => {
    if (!personaRendererRef.current) return;

    try {
      const welcomeMessage = "Hello! It's so wonderful to see you again. I've missed our conversations.";
      
      const response = await personaRendererRef.current.generateResponseWithEmotion(
        "Hello, it's great to see you!"
      );

      // Set emotion and speak
      personaRendererRef.current.setEmotion(response.emotion);
      
      if (response.audioBuffer) {
        await personaRendererRef.current.speakWithLipSync(response.text, response.audioBuffer);
      }
      
    } catch (error) {
      console.error('Error generating welcome message:', error);
    }
  };

  const handleUserMessage = async () => {
    if (!currentMessage.trim() || !personaRendererRef.current) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsPersonaSpeaking(true);

    try {
      // Generate response with emotion
      const response = await personaRendererRef.current.generateResponseWithEmotion(userMessage);
      
      // Set appropriate emotion
      personaRendererRef.current.setEmotion(response.emotion);
      
      // Speak with lip sync if audio is available
      if (response.audioBuffer) {
        await personaRendererRef.current.speakWithLipSync(response.text, response.audioBuffer);
      } else {
        // Fallback to text-to-speech
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(response.text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = isSpeakerOn ? 1.0 : 0.0;
          
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
          setTimeout(() => {
            personaRendererRef.current?.setExpression('neutral', 0);
            setIsPersonaSpeaking(false);
          }, response.text.length * 50);
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

  // Initialization screen
  if (!isInitialized) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full mx-auto mb-8 flex items-center justify-center">
            <span className="text-4xl font-bold">{personaName[0]}</span>
          </div>
          
          <h2 className="text-3xl font-bold mb-4">Creating Lifelike {personaName}</h2>
          <p className="text-xl opacity-75 mb-8">{initializationStep}</p>
          
          <div className="w-full bg-white/20 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-purple-400 to-blue-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${initializationProgress}%` }}
            ></div>
          </div>
          
          <p className="text-lg opacity-60">{initializationProgress}% Complete</p>
          
          <div className="mt-8 text-sm opacity-50 space-y-2">
            <p>• Analyzing facial features from photos</p>
            <p>• Extracting animation data from videos</p>
            <p>• Processing voice characteristics</p>
            <p>• Building 3D personality model</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'} bg-black flex flex-col`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-6">
        <div className="flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-semibold">{personaName}</h2>
            <p className="text-sm opacity-75">
              {isConnected ? `3D Lifelike • ${formatDuration(callDuration)}` : 'Connecting...'}
            </p>
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

      {/* Main Video Area */}
      <div className="flex-1 relative">
        {/* 3D Avatar Display */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
          {isConnected ? (
            <div className="relative">
              {/* 3D Avatar Canvas */}
              <canvas
                ref={avatarCanvasRef}
                className={`w-96 h-96 rounded-full border-4 border-white/20 transition-all duration-300 ${
                  isPersonaSpeaking ? 'scale-105 shadow-2xl ring-4 ring-purple-400/50' : 'scale-100'
                }`}
                style={{
                  filter: `brightness(${isSpeakerOn ? 1.1 : 0.8}) contrast(1.2) saturate(1.1)`
                }}
              />
              
              {/* Realistic lighting effects */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none"></div>
              
              {/* Speaking indicator */}
              {isPersonaSpeaking && (
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                  <div className="flex items-center space-x-1">
                    {[...Array(7)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-purple-400 rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 24 + 8}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.8s'
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Persona name and status */}
              <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center text-white">
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
        <div className="absolute bottom-24 right-6 w-48 h-36 bg-gray-800 rounded-xl border-2 border-white/20 overflow-hidden shadow-2xl">
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

      {/* Message Input Area */}
      <div className="absolute bottom-20 left-6 right-6">
        <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-4">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleUserMessage()}
              placeholder="Say something to your persona..."
              className="flex-1 bg-white/20 backdrop-blur text-white placeholder-gray-300 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/30 transition-all"
              disabled={isPersonaSpeaking}
            />
            <button
              onClick={handleUserMessage}
              disabled={!currentMessage.trim() || isPersonaSpeaking}
              className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mic className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Call Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex justify-center items-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition-all duration-300 ${
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
            className={`p-4 rounded-full transition-all duration-300 ${
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
            className="p-5 bg-red-500 rounded-full hover:bg-red-600 transition-all duration-300 transform hover:scale-110 shadow-lg"
          >
            <Phone className="h-7 w-7 text-white" />
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-4 rounded-full transition-all duration-300 ${
              !isSpeakerOn 
                ? 'bg-red-500 hover:bg-red-600 scale-110' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="h-6 w-6 text-white" /> : <VolumeX className="h-6 w-6 text-white" />}
          </button>

          {/* Settings Button */}
          <button className="p-4 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur transition-all duration-300">
            <Settings className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Quality Indicator */}
      <div className="absolute top-20 right-6 bg-black/60 backdrop-blur rounded-lg px-3 py-2 text-white text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>3D Lifelike Quality</span>
        </div>
      </div>
    </div>
  );
}