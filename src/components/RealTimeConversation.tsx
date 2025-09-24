import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Brain, Zap, MessageCircle, Phone } from 'lucide-react';
import { RealTimeSpeechRecognition, SpeechResult, ConversationContext } from '../lib/speechRecognition';
import { ContextualAIEngine, ContextualResponse } from '../lib/contextualAI';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface RealTimeConversationProps {
  personaId: string;
  personaName: string;
  onEndConversation: () => void;
}

interface ConversationMessage {
  id: string;
  sender: 'user' | 'persona';
  content: string;
  timestamp: Date;
  emotion?: string;
  isInterim?: boolean;
  audioUrl?: string;
}

export function RealTimeConversation({ personaId, personaName, onEndConversation }: RealTimeConversationProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isPersonaResponding, setIsPersonaResponding] = useState(false);
  const [responseProgress, setResponseProgress] = useState(0);
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    recentMessages: [],
    currentTopic: 'general',
    emotionalTone: 'neutral',
    speakingPace: 1.0
  });
  const [personaData, setPersonaData] = useState<any>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const speechRecognition = useRef<RealTimeSpeechRecognition | null>(null);
  const contextualAI = useRef<ContextualAIEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const conversationId = useRef<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    initializeConversation();
    return () => cleanup();
  }, []);

  const initializeConversation = async () => {
    try {
      // Load persona data
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

      // Initialize contextual AI
      contextualAI.current = new ContextualAIEngine(personaId, persona);

      // Initialize speech recognition
      speechRecognition.current = new RealTimeSpeechRecognition({
        continuous: true,
        interimResults: true,
        language: 'en-US'
      });

      setupSpeechRecognitionHandlers();

      // Create conversation record
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

      // Add initial greeting
      addPersonaGreeting();

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
        handleUserSpeech(result.transcript, result.confidence);
        setCurrentTranscript('');
      }
    });

    speechRecognition.current.onError((error: string) => {
      console.error('Speech recognition error:', error);
      toast.error(error);
      setIsListening(false);
    });

    speechRecognition.current.onStart(() => {
      setIsListening(true);
    });

    speechRecognition.current.onEnd(() => {
      setIsListening(false);
    });

    speechRecognition.current.onSilenceDetected = () => {
      console.log('Silence detected, persona can respond');
    };
  };

  const addPersonaGreeting = async () => {
    if (!contextualAI.current) return;

    try {
      const greeting = await contextualAI.current.generateContextualResponse(
        "Hello, it's wonderful to see you again!",
        conversationContext,
        false
      );

      const greetingMessage: ConversationMessage = {
        id: Date.now().toString(),
        sender: 'persona',
        content: greeting.text,
        timestamp: new Date(),
        emotion: greeting.emotion
      };

      setMessages([greetingMessage]);

      // Play greeting audio if available
      if (greeting.audioBuffer && isSpeakerOn) {
        playAudioResponse(greeting.audioBuffer);
      }
    } catch (error) {
      console.error('Error generating greeting:', error);
    }
  };

  const handleUserSpeech = async (transcript: string, confidence: number) => {
    // Add user message to conversation
    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: transcript,
      timestamp: new Date(),
      emotion: conversationContext.emotionalTone
    };

    setMessages(prev => [...prev, userMessage]);

    // Save user message to database
    if (conversationId.current) {
      await supabase.from('messages').insert({
        conversation_id: conversationId.current,
        sender_type: 'user',
        content: transcript,
        message_type: 'text',
        metadata: { confidence, emotion: conversationContext.emotionalTone }
      });
    }

    // Generate AI response
    generatePersonaResponse(transcript);
  };

  const generatePersonaResponse = async (userSpeech: string) => {
    if (!contextualAI.current) return;

    setIsPersonaResponding(true);
    setResponseProgress(0);

    try {
      // Simulate response preparation progress
      const progressInterval = setInterval(() => {
        setResponseProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Get updated conversation context
      const context = speechRecognition.current?.getConversationContext() || conversationContext;
      setConversationContext(context);

      // Generate contextual response
      const response = await contextualAI.current.generateContextualResponse(
        userSpeech,
        context,
        false
      );

      clearInterval(progressInterval);
      setResponseProgress(100);

      // Add persona response to conversation
      const personaMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'persona',
        content: response.text,
        timestamp: new Date(),
        emotion: response.emotion
      };

      setMessages(prev => [...prev, personaMessage]);

      // Save persona message to database
      if (conversationId.current) {
        await supabase.from('messages').insert({
          conversation_id: conversationId.current,
          sender_type: 'persona',
          content: response.text,
          message_type: 'text',
          metadata: { 
            emotion: response.emotion, 
            confidence: response.confidence,
            responseTime: response.responseTime,
            conversationFlow: response.conversationFlow
          }
        });
      }

      // Play audio response
      if (response.audioBuffer && isSpeakerOn) {
        playAudioResponse(response.audioBuffer);
      } else if (isSpeakerOn) {
        // Fallback to browser TTS
        speakText(response.text);
      }

    } catch (error) {
      console.error('Error generating persona response:', error);
      toast.error('Failed to generate response');
    } finally {
      setIsPersonaResponding(false);
      setResponseProgress(0);
    }
  };

  const playAudioResponse = (audioBuffer: ArrayBuffer) => {
    try {
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        
        audioRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error('Error playing audio response:', error);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = isSpeakerOn ? 1.0 : 0.0;
      speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = async () => {
    if (!speechRecognition.current) return;

    if (isListening) {
      speechRecognition.current.stopListening();
    } else {
      // Request microphone permission first
      if (permissionGranted === null) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setPermissionGranted(true);
        } catch (error) {
          setPermissionGranted(false);
          toast.error('Microphone permission denied. Please allow microphone access for voice conversation.');
          return;
        }
      }

      try {
        await speechRecognition.current.startListening();
      } catch (error) {
        toast.error('Failed to start speech recognition');
      }
    }
  };

  const cleanup = () => {
    if (speechRecognition.current) {
      speechRecognition.current.destroy();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    // Update conversation end time
    if (conversationId.current) {
      supabase
        .from('conversations')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: Math.floor((Date.now() - Date.parse(messages[0]?.timestamp.toISOString() || '')) / 1000)
        })
        .eq('id', conversationId.current);
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex flex-col text-white">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm p-6 border-b border-white/10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{personaName}</h1>
            <p className="text-purple-200">Real-time voice conversation</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm">{isListening ? 'Listening' : 'Not listening'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Display */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-6 py-4 rounded-2xl shadow-lg ${
                message.sender === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : 'bg-white/90 text-gray-900 backdrop-blur-sm'
              }`}
            >
              <p className="mb-2">{message.content}</p>
              <div className="flex justify-between items-center text-xs opacity-70">
                <span>{formatTime(message.timestamp)}</span>
                {message.emotion && (
                  <span className="capitalize">{message.emotion}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Current transcript display */}
        {currentTranscript && (
          <div className="flex justify-end">
            <div className="max-w-xs lg:max-w-md px-6 py-4 rounded-2xl bg-purple-500/50 text-white border-2 border-purple-400 backdrop-blur-sm">
              <p className="italic">{currentTranscript}</p>
              <p className="text-xs opacity-70 mt-1">Speaking...</p>
            </div>
          </div>
        )}

        {/* Persona responding indicator */}
        {isPersonaResponding && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-md px-6 py-4 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30">
              <div className="flex items-center space-x-3">
                <Brain className="h-5 w-5 text-purple-300 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm text-purple-200 mb-2">Thinking...</p>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-400 to-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${responseProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conversation Context Display */}
      <div className="bg-black/20 backdrop-blur-sm p-4 border-t border-white/10">
        <div className="flex justify-center items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-4 w-4 text-purple-300" />
            <span className="text-purple-200">Topic: {conversationContext.currentTopic}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              conversationContext.emotionalTone === 'happy' ? 'bg-green-400' :
              conversationContext.emotionalTone === 'sad' ? 'bg-blue-400' :
              conversationContext.emotionalTone === 'excited' ? 'bg-yellow-400' :
              'bg-gray-400'
            }`}></div>
            <span className="text-purple-200">Mood: {conversationContext.emotionalTone}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/40 backdrop-blur-sm p-6">
        <div className="flex justify-center items-center space-x-8">
          {/* Microphone Toggle */}
          <button
            onClick={toggleListening}
            disabled={permissionGranted === false}
            className={`p-6 rounded-full transition-all duration-300 shadow-xl ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-400/50'
                : 'bg-green-500 hover:bg-green-600 hover:scale-105'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isListening ? (
              <MicOff className="h-8 w-8 text-white" />
            ) : (
              <Mic className="h-8 w-8 text-white" />
            )}
          </button>

          {/* Speaker Toggle */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-4 rounded-full transition-all duration-300 ${
              isSpeakerOn
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isSpeakerOn ? (
              <Volume2 className="h-6 w-6 text-white" />
            ) : (
              <VolumeX className="h-6 w-6 text-white" />
            )}
          </button>

          {/* End Conversation */}
          <button
            onClick={onEndConversation}
            className="p-4 bg-red-500 rounded-full hover:bg-red-600 transition-all duration-300 hover:scale-105 shadow-xl"
          >
            <Phone className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Status Text */}
        <div className="text-center mt-4">
          {permissionGranted === false ? (
            <p className="text-red-300">Microphone permission required for voice conversation</p>
          ) : isListening ? (
            <p className="text-green-300 flex items-center justify-center">
              <Zap className="h-4 w-4 mr-2 animate-pulse" />
              Listening... Speak naturally
            </p>
          ) : (
            <p className="text-gray-300">Click the microphone to start talking</p>
          )}
        </div>
      </div>

      {/* Hidden audio element for persona responses */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}