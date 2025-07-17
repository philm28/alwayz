import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Settings, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { realtimeManager } from '../lib/realtime';
import { AIPersonaEngine } from '../lib/ai';
import Webcam from 'react-webcam';

interface AdvancedVideoCallProps {
  personaId: string;
  personaName: string;
  onEndCall: () => void;
}

export function AdvancedVideoCall({ personaId, personaName, onEndCall }: AdvancedVideoCallProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isPersonaSpeaking, setIsPersonaSpeaking] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTime = useRef<Date>(new Date());
  const aiEngine = useRef<AIPersonaEngine | null>(null);

  useEffect(() => {
    initializeCall();
    startCallTimer();

    return () => {
      realtimeManager.endCall();
    };
  }, []);

  const initializeCall = async () => {
    try {
      // Initialize AI engine for this persona
      // In production, load persona data from database
      const personaContext = {
        id: personaId,
        name: personaName,
        personality_traits: "Warm, caring, and wise with a gentle sense of humor",
        common_phrases: ["You know what I mean?", "That reminds me of..."],
        relationship: "Grandmother",
        memories: [],
        conversationHistory: []
      };

      aiEngine.current = new AIPersonaEngine(personaContext);

      // Set up realtime manager callbacks
      realtimeManager.onCallConnected = () => {
        setIsConnected(true);
      };

      realtimeManager.onRemoteStream = (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };

      realtimeManager.onCallEnded = () => {
        onEndCall();
      };

      // Start the call
      await realtimeManager.startCall(personaId, 'video');
      
      // Simulate connection after a delay
      setTimeout(() => {
        setIsConnected(true);
        simulatePersonaGreeting();
      }, 2000);

    } catch (error) {
      console.error('Error initializing call:', error);
    }
  };

  const simulatePersonaGreeting = async () => {
    if (!aiEngine.current) return;

    try {
      const greeting = await aiEngine.current.generateResponse("Hello, it's so good to see you!");
      
      // Generate voice for the greeting
      const audioBuffer = await aiEngine.current.generateVoice(greeting);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audio.play();
      
      setIsPersonaSpeaking(true);
      audio.onended = () => setIsPersonaSpeaking(false);
      
    } catch (error) {
      console.error('Error generating greeting:', error);
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

  const toggleMute = () => {
    setIsMuted(!isMuted);
    realtimeManager.toggleAudio(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
    realtimeManager.toggleVideo(!isVideoOn);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // In production, this would control audio output routing
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const endCall = () => {
    realtimeManager.endCall();
    onEndCall();
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'} bg-black flex flex-col`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-6">
        <div className="flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-semibold">{personaName}</h2>
            <p className="text-sm opacity-75">
              {isConnected ? `Connected • ${formatDuration(callDuration)}` : 'Connecting...'}
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
        {/* Remote Video (Persona) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isConnected ? (
            <div className="relative w-full h-full">
              {/* Simulated persona video */}
              <div className="w-full h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className={`w-48 h-48 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full mx-auto mb-6 flex items-center justify-center transition-all duration-300 ${
                    isPersonaSpeaking ? 'scale-110 shadow-2xl' : ''
                  }`}>
                    <span className="text-6xl font-bold">{personaName[0]}</span>
                  </div>
                  <h2 className="text-3xl font-semibold mb-2">{personaName}</h2>
                  <div className="flex items-center justify-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${isPersonaSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className="text-lg opacity-75">
                      {isPersonaSpeaking ? 'Speaking...' : 'Listening'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Audio visualization */}
              {isPersonaSpeaking && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
                  <div className="flex items-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-white rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 20 + 10}px`,
                          animationDelay: `${i * 0.1}s`
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-xl">Connecting to {personaName}...</p>
            </div>
          )}
        </div>

        {/* Local Video (User) */}
        <div className="absolute bottom-20 right-6 w-48 h-36 bg-gray-800 rounded-lg border-2 border-white/20 overflow-hidden">
          {isVideoOn ? (
            <Webcam
              ref={webcamRef}
              audio={false}
              className="w-full h-full object-cover"
              mirrored
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <VideoOff className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex justify-center items-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all duration-300 ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isMuted ? (
              <MicOff className="h-6 w-6 text-white" />
            ) : (
              <Mic className="h-6 w-6 text-white" />
            )}
          </button>

          {/* Video Button */}
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all duration-300 ${
              !isVideoOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isVideoOn ? (
              <Video className="h-6 w-6 text-white" />
            ) : (
              <VideoOff className="h-6 w-6 text-white" />
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="p-4 bg-red-500 rounded-full hover:bg-red-600 transition-all duration-300 transform hover:scale-105"
          >
            <Phone className="h-6 w-6 text-white" />
          </button>

          {/* Speaker Button */}
          <button
            onClick={toggleSpeaker}
            className={`p-4 rounded-full transition-all duration-300 ${
              !isSpeakerOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isSpeakerOn ? (
              <Volume2 className="h-6 w-6 text-white" />
            ) : (
              <VolumeX className="h-6 w-6 text-white" />
            )}
          </button>

          {/* Settings Button */}
          <button className="p-4 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur transition-all duration-300">
            <Settings className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}