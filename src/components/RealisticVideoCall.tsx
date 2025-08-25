import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Volume2, VolumeX } from 'lucide-react';
import { realisticAvatarManager } from '../lib/realisticAvatar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import Webcam from 'react-webcam';

interface RealisticVideoCallProps {
  personaId: string;
  personaName: string;
  onEndCall: () => void;
}

export function RealisticVideoCall({ personaId, personaName, onEndCall }: RealisticVideoCallProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isPersonaSpeaking, setIsPersonaSpeaking] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [personaData, setPersonaData] = useState<any>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>('');
  
  const webcamRef = useRef<Webcam>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const callStartTime = useRef<Date>(new Date());
  const avatarEngineRef = useRef<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    initializeRealisticCall();
    startCallTimer();

    return () => {
      cleanup();
    };
  }, []);

  const initializeRealisticCall = async () => {
    try {
      // Get persona data from database
      const { data: persona, error: personaError } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (personaError || !persona) {
        console.error('Persona not found:', personaError);
        setAvatarError('Persona not found');
        return;
      }

      setPersonaData(persona);
      console.log('Initializing realistic call for persona:', persona.name);

      // Try to initialize realistic avatar, but don't fail if it doesn't work
      try {
        // Get all uploaded photos for this persona
        const { data: personaContent } = await supabase
          .from('persona_content')
          .select('*')
          .eq('persona_id', personaId)
          .eq('processing_status', 'completed');

        const photos = personaContent?.filter(c => 
          c.content_type === 'image' || 
          c.file_name?.match(/\.(jpg|jpeg|png|gif)$/i)
        ).map(c => c.file_url) || [];

        const videos = personaContent?.filter(c => 
          c.content_type === 'video' || 
          c.file_name?.match(/\.(mp4|mov|avi)$/i)
        ).map(c => c.file_url) || [];

        const audioSamples = personaContent?.filter(c => 
          c.content_type === 'audio' || 
          c.file_name?.match(/\.(mp3|wav|m4a)$/i)
        ).map(c => c.file_url) || [];

        console.log('Found content:', { photos: photos.length, videos: videos.length, audio: audioSamples.length });

        const realisticPersona = await realisticAvatarManager.initializePersona(
          personaId,
          personaName,
          photos[0] || persona.avatar_url,
          videos[0] || persona.metadata?.video_avatar_url,
          audioSamples
        );

        console.log('Realistic persona initialized:', {
          isVideoReady: realisticPersona.isVideoReady,
          isVoiceReady: realisticPersona.isVoiceReady
        });

        avatarEngineRef.current = realisticPersona.avatarEngine;
      } catch (avatarError) {
        console.warn('Realistic avatar initialization failed, using fallback:', avatarError);
        setAvatarError('Using fallback avatar display');
      }

      // Simulate connection
      setTimeout(() => {
        setIsConnected(true);
        generateGreeting();
      }, 2000);

    } catch (error) {
      console.error('Error initializing realistic call:', error);
      setAvatarError('Failed to initialize call');
      // Still allow connection for basic functionality
      setIsConnected(true);
      generateGreeting();
    }
  };

  const generateGreeting = async () => {
    try {
      const greeting = `Hello! It's so wonderful to see you. I've missed our conversations.`;
      setLastResponse(greeting);
      await speakMessage(greeting);
    } catch (error) {
      console.error('Error generating greeting:', error);
    }
  };

  const speakMessage = async (text: string, emotion?: string) => {
    try {
      setIsPersonaSpeaking(true);
      setLastResponse(text);
      
      // Update avatar expression if we have an avatar engine
      if (avatarEngineRef.current) {
        avatarEngineRef.current.setExpression('speaking', 1.0);
      }
      
      // Try to generate voice using AI engine
      try {
        const { AIPersonaEngine } = await import('../lib/ai');
        
        const personaContext = {
          id: personaData?.id || personaId,
          name: personaData?.name || personaName,
          personality_traits: personaData?.personality_traits || 'Warm and caring',
          common_phrases: personaData?.common_phrases || [],
          relationship: personaData?.relationship || 'Loved one',
          memories: [],
          conversationHistory: []
        };

        const aiEngine = new AIPersonaEngine(personaContext);
        
        // Try to generate voice
        try {
          const audioBuffer = await aiEngine.generateVoice(text);
          
          // Generate talking avatar with lip sync
          if (avatarEngineRef.current) {
            await avatarEngineRef.current.generateTalkingAvatar(audioBuffer, text);
          }
          
          // Play the audio
          await this.playAudioWithLipSync(audioBuffer);
        } catch (voiceError) {
          console.warn('Voice generation failed, using text-to-speech fallback:', voiceError);
          await this.fallbackToSpeechSynthesis(text);
        }
      } catch (aiError) {
        console.error('AI engine error:', aiError);
        await this.fallbackToSpeechSynthesis(text);
      }
    } catch (error) {
      console.error('Error speaking message:', error);
      setIsPersonaSpeaking(false);
      
      // Reset avatar expression
      if (avatarEngineRef.current) {
        avatarEngineRef.current.setExpression('neutral', 0);
      }
    }
  };

  const playAudioWithLipSync = async (audioBuffer: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.volume = isSpeakerOn ? 1.0 : 0.0;
          
          audioRef.current.onended = () => {
            setIsPersonaSpeaking(false);
            if (avatarEngineRef.current) {
              avatarEngineRef.current.setExpression('neutral', 0);
            }
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          
          audioRef.current.onerror = () => {
            console.error('Audio playback failed, falling back to speech synthesis');
            URL.revokeObjectURL(audioUrl);
            this.fallbackToSpeechSynthesis(lastResponse).then(resolve).catch(reject);
          };
          
          // Play audio
          const playPromise = audioRef.current.play();
          if (playPromise) {
            playPromise.catch((error) => {
              console.warn('Audio autoplay prevented:', error);
              this.fallbackToSpeechSynthesis(lastResponse).then(resolve).catch(reject);
            });
          }
        } else {
          reject(new Error('Audio element not available'));
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  const fallbackToSpeechSynthesis = async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to match voice characteristics if we have them
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0 && personaData?.metadata?.voice_profile) {
          const characteristics = personaData.metadata.voice_profile.voiceCharacteristics;
          
          // Find a suitable voice
          const suitableVoice = voices.find(voice => 
            (characteristics.gender === 'female' && voice.name.toLowerCase().includes('female')) ||
            (characteristics.gender === 'male' && voice.name.toLowerCase().includes('male'))
          ) || voices[0];
          
          utterance.voice = suitableVoice;
          utterance.rate = characteristics.speed || 0.9;
          utterance.pitch = characteristics.pitch || 1.0;
        } else {
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
        }
        
        utterance.volume = isSpeakerOn ? 1.0 : 0.0;
        
        utterance.onend = () => {
          setIsPersonaSpeaking(false);
          if (avatarEngineRef.current) {
            avatarEngineRef.current.setExpression('neutral', 0);
          }
          resolve();
        };
        
        utterance.onerror = () => {
          console.error('Speech synthesis also failed');
          setIsPersonaSpeaking(false);
          if (avatarEngineRef.current) {
            avatarEngineRef.current.setExpression('neutral', 0);
          }
          resolve();
        };
        
        speechSynthesis.speak(utterance);
      } else {
        // Final fallback: just simulate speaking time
        setTimeout(() => {
          setIsPersonaSpeaking(false);
          if (avatarEngineRef.current) {
            avatarEngineRef.current.setExpression('neutral', 0);
          }
          resolve();
        }, text.length * 50);
      }
    });
  };

  const animateAvatar = (duration: number) => {
    if (!avatarEngineRef.current) return;

    const canvas = avatarEngineRef.current.getCanvas();
    if (!canvas) return;

    let startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        // Subtle breathing animation
        const intensity = Math.sin(elapsed * 0.003) * 0.1;
        avatarEngineRef.current.setExpression('neutral', intensity);
        
        requestAnimationFrame(animate);
      }
    };
    
    animate();
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

  const handleUserMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage;
    setCurrentMessage('');

    // Display user message briefly
    console.log('User said:', userMessage);

    // Generate persona response
    setTimeout(async () => {
      try {
        // Generate AI response using the AI engine
        const { AIPersonaEngine } = await import('../lib/ai');
        
        const personaContext = {
          id: personaData?.id || personaId,
          name: personaData?.name || personaName,
          personality_traits: personaData?.personality_traits || 'Warm and caring',
          common_phrases: personaData?.common_phrases || [],
          relationship: personaData?.relationship || 'Loved one',
          memories: [],
          conversationHistory: []
        };

        const aiEngine = new AIPersonaEngine(personaContext);
        const response = await aiEngine.generateResponse(userMessage);
        
        await speakMessage(response);
        setLastResponse(response);
      } catch (error) {
        console.error('Error generating response:', error);
        await speakMessage("I'm having trouble finding the right words right now. Could you try asking me again?");
      }
    }, 1000);
  };

  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    if (avatarEngineRef.current) {
      avatarEngineRef.current.destroy();
      avatarEngineRef.current = null;
    }
    
    realisticAvatarManager.destroyPersona(personaId);
  };

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-6">
        <div className="flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-semibold">{personaName}</h2>
            <p className="text-sm opacity-75">
              {isConnected ? `Connected • ${formatDuration(callDuration)}` : 'Connecting...'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative">
        {/* Persona Avatar */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isConnected ? (
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              <div className="text-center text-white">
                {/* Realistic Avatar Container */}
                <div 
                  ref={avatarContainerRef}
                  className="relative"
                >
                  {/* Canvas for realistic avatar */}
                  {avatarEngineRef.current && (
                    <div className={`w-80 h-80 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white/30 transition-all duration-300 ${
                      isPersonaSpeaking ? 'scale-110 shadow-2xl ring-4 ring-purple-400/50' : 'scale-100'
                    }`}>
                      <canvas
                        ref={(canvas) => {
                          if (canvas && avatarEngineRef.current) {
                            const avatarCanvas = avatarEngineRef.current.getCanvas();
                            if (avatarCanvas) {
                              canvas.width = avatarCanvas.width;
                              canvas.height = avatarCanvas.height;
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                // Copy avatar canvas content
                                ctx.drawImage(avatarCanvas, 0, 0);
                                
                                // Set up continuous updates
                                const updateCanvas = () => {
                                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                                  ctx.drawImage(avatarCanvas, 0, 0);
                                  if (isPersonaSpeaking) {
                                    requestAnimationFrame(updateCanvas);
                                  }
                                };
                                
                                if (isPersonaSpeaking) {
                                  updateCanvas();
                                }
                              }
                            }
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Fallback Avatar Display */}
                  {!avatarEngineRef.current && personaData?.avatar_url && (
                  <div className={`w-64 h-64 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white/30 transition-all duration-300 ${
                    isPersonaSpeaking ? 'scale-110 shadow-2xl ring-4 ring-purple-400/50' : 'scale-100'
                  }`}>
                    <img 
                      src={personaData.avatar_url} 
                      alt={personaName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.log('Avatar image failed to load, using fallback');
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center" style={{ display: 'none' }}>
                      <span className="text-6xl font-bold">{personaName[0]}</span>
                    </div>
                  </div>
                  )}
                  
                  {/* Final Fallback - Initials */}
                  {!avatarEngineRef.current && !personaData?.avatar_url && (
                  <div className={`w-64 h-64 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full mx-auto mb-6 flex items-center justify-center transition-all duration-300 ${
                    isPersonaSpeaking ? 'scale-110 shadow-2xl ring-4 ring-purple-400/50' : 'scale-100'
                  }`}>
                    <span className="text-6xl font-bold">{personaName[0]}</span>
                  </div>
                  )}
                </div>
                
                <h2 className="text-3xl font-semibold mb-2">{personaName}</h2>
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${isPersonaSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-lg opacity-75">
                    {isPersonaSpeaking ? 'Speaking...' : 'Listening'}
                  </span>
                </div>
                
                {/* Show last response */}
                {lastResponse && (
                  <div className="max-w-md mx-auto bg-black/30 backdrop-blur rounded-lg p-4 mb-4">
                    <p className="text-sm text-white/90">{lastResponse}</p>
                  </div>
                )}
                
                {avatarError && (
                  <p className="text-xs text-yellow-300/70 mt-2">
                    {avatarError}
                  </p>
                )}
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
        {/* Message Input */}
        <div className="flex items-center space-x-3 mb-4">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUserMessage()}
            placeholder="Say something..."
            className="flex-1 bg-white/20 backdrop-blur text-white placeholder-gray-300 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleUserMessage}
            disabled={!currentMessage.trim()}
            className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <Mic className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Call Controls */}
        <div className="flex justify-center items-center space-x-6">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition-all duration-300 ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
          </button>

          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-4 rounded-full transition-all duration-300 ${
              !isVideoOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isVideoOn ? <Video className="h-6 w-6 text-white" /> : <VideoOff className="h-6 w-6 text-white" />}
          </button>

          <button
            onClick={onEndCall}
            className="p-4 bg-red-500 rounded-full hover:bg-red-600 transition-all duration-300 transform hover:scale-105"
          >
            <Phone className="h-6 w-6 text-white" />
          </button>

          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-4 rounded-full transition-all duration-300 ${
              !isSpeakerOn 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30 backdrop-blur'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="h-6 w-6 text-white" /> : <VolumeX className="h-6 w-6 text-white" />}
          </button>
        </div>
      </div>

      {/* Audio element for persona voice */}
      <audio 
        ref={audioRef} 
        style={{ display: 'none' }} 
        preload="auto"
        onError={(e) => {
          const audioElement = e.target as HTMLAudioElement;
          const error = audioElement.error;
          
          let errorMessage = 'Unknown audio error';
          if (error) {
            switch (error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = 'Audio playback was aborted';
                break;
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = 'Network error occurred while loading audio';
                break;
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage = 'Audio decoding error';
                break;
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Audio format not supported';
                break;
              default:
                errorMessage = `Audio error code: ${error.code}`;
            }
          }
          
          console.error('Audio playback error:', errorMessage, e);
          
          // Reset speaking state
          setIsPersonaSpeaking(false);
          
          // Fallback to speech synthesis if available and there's text to speak
          if (lastResponse && 'speechSynthesis' in window) {
            console.log('Falling back to speech synthesis');
            const utterance = new SpeechSynthesisUtterance(lastResponse);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = isSpeakerOn ? 1.0 : 0.0;
            
            utterance.onend = () => {
              setIsPersonaSpeaking(false);
            };
            
            utterance.onerror = () => {
              console.error('Speech synthesis also failed');
              setIsPersonaSpeaking(false);
            };
            
            speechSynthesis.speak(utterance);
          }
        }}
        onCanPlay={() => {
          console.log('Audio ready to play');
        }}
      />
    </div>
  );
}