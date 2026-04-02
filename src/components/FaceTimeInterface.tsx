import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone, Sparkles, Heart } from 'lucide-react';
import { RealTimeSpeechRecognition, SpeechResult, ConversationContext } from '../lib/speechRecognition';
import { ContextualAIEngine } from '../lib/contextualAI';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface FaceTimeInterfaceProps {
  personaId: string;
  personaName: string;
  personaAvatar?: string;
  onEndCall: () => void;
}

export function FaceTimeInterface({ personaId, personaName, personaAvatar, onEndCall }: FaceTimeInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isPersonaSpeaking, setIsPersonaSpeaking] = useState(false);
  const [personaMessage, setPersonaMessage] = useState('');
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    recentMessages: [],
    currentTopic: 'general',
    emotionalTone: 'neutral',
    speakingPace: 1.0
  });
  const [personaData, setPersonaData] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [audioWaveform, setAudioWaveform] = useState<number[]>([]);

  const speechRecognition = useRef<RealTimeSpeechRecognition | null>(null);
  const contextualAI = useRef<ContextualAIEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const conversationId = useRef<string | null>(null);
  const lastProcessedTranscript = useRef<string>('');
  const callStartTime = useRef<number>(Date.now());
  const { user } = useAuth();

  useEffect(() => {
    initializeConversation();

    // Update call duration every second
    const durationInterval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
    }, 1000);

    // Simulate audio waveform animation
    const waveformInterval = setInterval(() => {
      if (isPersonaSpeaking) {
        setAudioWaveform(Array.from({ length: 5 }, () => Math.random() * 100));
      } else {
        setAudioWaveform([0, 0, 0, 0, 0]);
      }
    }, 100);

    return () => {
      cleanup();
      clearInterval(durationInterval);
      clearInterval(waveformInterval);
    };
  }, []);

  useEffect(() => {
    // Auto-start listening after a brief delay
    const timer = setTimeout(() => {
      if (speechRecognition.current && !isListening && permissionGranted === null) {
        toggleListening();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [permissionGranted]);

  const initializeConversation = async () => {
    try {
      const { data: persona, error } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (error || !persona) {
        toast.error('Failed to load persona data');
        return;
      }

      setPersonaData(persona);
      contextualAI.current = new ContextualAIEngine(personaId, persona);

      speechRecognition.current = new RealTimeSpeechRecognition({
        continuous: true,
        interimResults: true,
        language: 'en-US'
      });

      setupSpeechRecognitionHandlers();

      if (user) {
        const { data: conversation } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            persona_id: personaId,
            conversation_type: 'voice_call',
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (conversation) {
          conversationId.current = conversation.id;
        }
      }

      // Generate and play initial greeting
      setTimeout(() => playGreeting(), 1000);

    } catch (error) {
      console.error('Error initializing conversation:', error);
      toast.error('Failed to initialize conversation');
    }
  };

  const setupSpeechRecognitionHandlers = () => {
    if (!speechRecognition.current) return;

    speechRecognition.current.onResult((result: SpeechResult) => {
      setCurrentTranscript(result.transcript);

      if (result.isFinal && result.transcript.trim().length > 0) {
        if (lastProcessedTranscript.current !== result.transcript.trim()) {
          lastProcessedTranscript.current = result.transcript.trim();
          handleUserSpeech(result.transcript);
        }
      }
    });

    speechRecognition.current.onError((error: string) => {
      if (!error.includes('no-speech') && !error.includes('aborted')) {
        console.error('Speech recognition error:', error);
      }
    });

    speechRecognition.current.onStart(() => {
      setIsListening(true);
      stopAllAudio();
    });

    speechRecognition.current.onEnd(() => {
      setIsListening(false);
      if (!isPersonaSpeaking) {
        setTimeout(() => {
          if (speechRecognition.current) {
            speechRecognition.current.startListening().catch(console.error);
          }
        }, 1000);
      }
    });
  };

  const playGreeting = async () => {
    if (!contextualAI.current) return;

    try {
      const greeting = await contextualAI.current.generateContextualResponse(
        "Hello",
        conversationContext,
        false
      );

      await speakPersonaMessage(greeting.text, greeting.audioBuffer);
    } catch (error) {
      console.error('Error generating greeting:', error);
    }
  };

  const handleUserSpeech = async (transcript: string) => {
    if (isPersonaSpeaking || transcript.trim().length === 0) {
      return;
    }

    stopAllAudio();

    if (speechRecognition.current) {
      speechRecognition.current.stopListening();
    }

    // Save user message
    if (conversationId.current) {
      await supabase.from('messages').insert({
        conversation_id: conversationId.current,
        sender_type: 'user',
        content: transcript,
        message_type: 'text'
      });
    }

    await generatePersonaResponse(transcript);
  };

  const generatePersonaResponse = async (userSpeech: string) => {
    if (!contextualAI.current) return;

    try {
      const context = speechRecognition.current?.getConversationContext() || conversationContext;
      setConversationContext(context);

      const response = await contextualAI.current.generateContextualResponse(
        userSpeech,
        context,
        false
      );

      // Save persona message
      if (conversationId.current) {
        await supabase.from('messages').insert({
          conversation_id: conversationId.current,
          sender_type: 'persona',
          content: response.text,
          message_type: 'text'
        });
      }

      await speakPersonaMessage(response.text, response.audioBuffer);

    } catch (error) {
      console.error('Error generating persona response:', error);
    }
  };

  const speakPersonaMessage = async (text: string, audioBuffer?: ArrayBuffer) => {
    setIsPersonaSpeaking(true);
    setPersonaMessage(text);
    setCurrentTranscript('');

    try {
      if (audioBuffer && isSpeakerOn) {
        await playAudioResponse(audioBuffer);
      } else if (isSpeakerOn) {
        await speakText(text);
      }
    } catch (error) {
      console.error('Error speaking persona message:', error);
    } finally {
      setTimeout(() => {
        setIsPersonaSpeaking(false);
        setPersonaMessage('');
        lastProcessedTranscript.current = '';

        // Resume listening
        if (speechRecognition.current && !isListening) {
          speechRecognition.current.startListening().catch(console.error);
        }
      }, 1000);
    }
  };

  const playAudioResponse = async (audioBuffer: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (!audioRef.current) {
          reject(new Error('Audio element not available'));
          return;
        }

        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        audioRef.current.src = audioUrl;
        audioRef.current.volume = isSpeakerOn ? 1.0 : 0.0;

        audioRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audioRef.current.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          reject(error);
        };

        audioRef.current.play().catch((error) => {
          URL.revokeObjectURL(audioUrl);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  const speakText = async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = isSpeakerOn ? 1.0 : 0.0;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  };

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }

    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  };

  const toggleListening = async () => {
    if (!speechRecognition.current) return;

    if (isListening) {
      speechRecognition.current.stopListening();
      setIsListening(false);
    } else {
      if (permissionGranted === null) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setPermissionGranted(true);
        } catch (error) {
          setPermissionGranted(false);
          toast.error('Microphone permission required');
          return;
        }
      }

      try {
        await speechRecognition.current.startListening();
      } catch (error) {
        console.error('Failed to start listening:', error);
        toast.error('Failed to start speech recognition');
      }
    }
  };

  const cleanup = () => {
    stopAllAudio();

    if (speechRecognition.current) {
      speechRecognition.current.destroy();
    }

    if (conversationId.current) {
      supabase
        .from('conversations')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: callDuration
        })
        .eq('id', conversationId.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col">
      {/* Header with call duration */}
      <div className="bg-black/40 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between text-white">
          <div>
            <h2 className="text-xl font-semibold">{personaName}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span>{formatDuration(callDuration)}</span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            {isListening ? 'Listening...' : 'Paused'}
          </div>
        </div>
      </div>

      {/* Main video area with persona avatar/image */}
      <div className="flex-1 relative overflow-hidden">
        {/* Persona Display */}
        <div className="absolute inset-0 flex items-center justify-center">
          {personaAvatar ? (
            <img
              src={personaAvatar}
              alt={personaName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
              <Heart className="h-48 w-48 text-white/30" fill="currentColor" />
            </div>
          )}

          {/* Overlay gradient for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"></div>
        </div>

        {/* Speaking indicators and text overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-8 pointer-events-none">
          {/* Persona speaking indicator */}
          {isPersonaSpeaking && (
            <div className="mb-6">
              <div className="bg-black/60 backdrop-blur-md rounded-2xl p-6 max-w-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="h-5 w-5 text-blue-400 animate-pulse" />
                  <span className="text-sm font-medium text-blue-300">{personaName} is speaking</span>
                </div>
                <p className="text-white text-lg leading-relaxed">{personaMessage}</p>

                {/* Audio waveform visualization */}
                <div className="flex items-center gap-1 mt-4">
                  {audioWaveform.map((height, i) => (
                    <div
                      key={i}
                      className="w-1 bg-blue-400 rounded-full transition-all duration-100"
                      style={{ height: `${Math.max(4, height * 0.3)}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* User speaking indicator */}
          {currentTranscript && !isPersonaSpeaking && (
            <div className="mb-6">
              <div className="bg-purple-600/80 backdrop-blur-md rounded-2xl p-6 max-w-2xl ml-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="h-4 w-4 text-white animate-pulse" />
                  <span className="text-sm font-medium text-purple-100">You're speaking</span>
                </div>
                <p className="text-white text-lg">{currentTranscript}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="bg-black/60 backdrop-blur-lg p-8">
        <div className="flex items-center justify-center gap-8">
          {/* Microphone toggle */}
          <button
            onClick={toggleListening}
            disabled={permissionGranted === false}
            className={`p-5 rounded-full transition-all duration-300 shadow-2xl ${
              isListening
                ? 'bg-white/20 hover:bg-white/30 ring-4 ring-green-400/50'
                : 'bg-white/20 hover:bg-white/30'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
            title={isListening ? 'Mute' : 'Unmute'}
          >
            {isListening ? (
              <Mic className="h-7 w-7 text-white" />
            ) : (
              <MicOff className="h-7 w-7 text-white" />
            )}
          </button>

          {/* End call button */}
          <button
            onClick={() => {
              cleanup();
              onEndCall();
            }}
            className="p-6 bg-red-500 hover:bg-red-600 rounded-full transition-all duration-300 shadow-2xl hover:scale-110"
            title="End call"
          >
            <Phone className="h-8 w-8 text-white" />
          </button>

          {/* Speaker toggle */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-5 rounded-full transition-all duration-300 shadow-2xl ${
              isSpeakerOn
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-red-500/80 hover:bg-red-600'
            }`}
            title={isSpeakerOn ? 'Mute speaker' : 'Unmute speaker'}
          >
            {isSpeakerOn ? (
              <Volume2 className="h-7 w-7 text-white" />
            ) : (
              <VolumeX className="h-7 w-7 text-white" />
            )}
          </button>
        </div>

        {/* Status message */}
        <div className="text-center mt-6">
          {permissionGranted === false ? (
            <p className="text-red-300 text-sm">Microphone access required</p>
          ) : isListening ? (
            <p className="text-green-300 text-sm flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Listening - speak naturally
            </p>
          ) : (
            <p className="text-gray-400 text-sm">Tap microphone to speak</p>
          )}
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
