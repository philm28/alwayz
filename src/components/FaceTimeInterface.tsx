import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { memoryConversationEngine } from '../lib/memoryConversation';
import toast from 'react-hot-toast';

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

interface FaceTimeInterfaceProps {
  personaId: string;
  personaName: string;
  personaAvatar?: string;
  onEndCall: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function FaceTimeInterface({
  personaId,
  personaName,
  personaAvatar,
  onEndCall
}: FaceTimeInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isPersonaSpeaking, setIsPersonaSpeaking] = useState(false);
  const [personaMessage, setPersonaMessage] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [personaData, setPersonaData] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(personaAvatar);
  const [audioWaveform, setAudioWaveform] = useState<number[]>([0, 0, 0, 0, 0]);
  const [isInitialized, setIsInitialized] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);
  const conversationIdRef = useRef<string | null>(null);
  const callStartRef = useRef<number>(Date.now());
  const isProcessingRef = useRef(false);
  const { user } = useAuth();

  useEffect(() => {
    initialize();

    const durationInterval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);

    const waveformInterval = setInterval(() => {
      setAudioWaveform(prev =>
        isPersonaSpeaking
          ? Array.from({ length: 5 }, () => Math.random() * 100)
          : [0, 0, 0, 0, 0]
      );
    }, 100);

    return () => {
      cleanup();
      clearInterval(durationInterval);
      clearInterval(waveformInterval);
    };
  }, []);

  const initialize = async () => {
    try {
      const { data: persona } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (!persona) {
        toast.error('Failed to load persona');
        return;
      }

      setPersonaData(persona);

      // Try to find a photo from uploaded content if no avatar provided
      if (!avatarUrl) {
        const { data: content } = await supabase
          .from('persona_content')
          .select('file_url, metadata')
          .eq('persona_id', personaId)
          .eq('content_type', 'image')
          .limit(1)
          .single();

        if (content?.file_url) {
          setAvatarUrl(content.file_url);
        } else if (content?.metadata?.media_url) {
          setAvatarUrl(content.metadata.media_url);
        }
      }

      // Create conversation record
      if (user) {
        const { data: conversation } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            persona_id: personaId,
            conversation_type: 'voice_call',
            started_at: new Date().toISOString(),
            metadata: {}
          })
          .select()
          .single();

        if (conversation) {
          conversationIdRef.current = conversation.id;
        }
      }

      setIsInitialized(true);

      // Play personalized greeting after short delay
      setTimeout(() => playGreeting(persona), 1200);

    } catch (error) {
      console.error('Initialization error:', error);
      toast.error('Failed to start call');
    }
  };

  const playGreeting = async (persona: any) => {
    const greetingPrompt = `Generate a warm, natural greeting of 1-2 sentences as ${persona.name}. 
    You are their ${persona.relationship}. Make it feel like a real FaceTime call just connected. 
    Be warm, loving, and personal. Do not say "Hello" generically — make it feel like you.`;

    try {
      const greeting = await memoryConversationEngine.generateMemoryEnhancedResponse(
        personaId,
        '__greeting__',
        []
      );

      await speakAndDisplay(greeting, []);
    } catch (error) {
      // Fallback greeting
      await speakAndDisplay(
        `Oh, it's so good to see your face. I've been thinking about you.`,
        []
      );
    }
  };

  const speakWithElevenLabs = async (text: string, voiceId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.2,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) return false;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return new Promise((resolve) => {
        if (!audioRef.current) {
          resolve(false);
          return;
        }

        audioRef.current.src = audioUrl;
        audioRef.current.volume = isSpeakerOn ? 1.0 : 0.0;

        audioRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve(true);
        };

        audioRef.current.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve(false);
        };

        audioRef.current.play().catch(() => resolve(false));
      });
    } catch {
      return false;
    }
  };

  const speakAndDisplay = async (text: string, history: Message[]) => {
    setIsPersonaSpeaking(true);
    setPersonaMessage(text);

    // Stop listening while persona speaks
    stopListening();

    try {
      if (isSpeakerOn) {
        // Try ElevenLabs cloned voice first
        const voiceId = personaData?.voice_model_id;
        let spoke = false;

        if (ELEVENLABS_API_KEY && voiceId && !voiceId.startsWith('voice_')) {
          spoke = await speakWithElevenLabs(text, voiceId);
        }

        // Fallback to browser TTS
        if (!spoke) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.92;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            speechSynthesis.speak(utterance);
          });
        }
      } else {
        // Speaker off — just wait a beat for the message to show
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      setIsPersonaSpeaking(false);
      setPersonaMessage('');
      isProcessingRef.current = false;

      // Resume listening after persona finishes speaking
      setTimeout(() => startListening(), 500);
    }
  };

  const handleUserSpeech = async (transcript: string) => {
    if (isProcessingRef.current || !transcript.trim()) return;
    isProcessingRef.current = true;

    setCurrentTranscript('');
    stopListening();

    // Save user message
    if (conversationIdRef.current) {
      await supabase.from('messages').insert({
        conversation_id: conversationIdRef.current,
        sender_type: 'user',
        content: transcript,
        message_type: 'text'
      });
    }

    const updatedHistory: Message[] = [
      ...conversationHistory,
      { role: 'user', content: transcript }
    ];

    setConversationHistory(updatedHistory);

    try {
      const response = await memoryConversationEngine.generateMemoryEnhancedResponse(
        personaId,
        transcript,
        updatedHistory
      );

      const newHistory: Message[] = [
        ...updatedHistory,
        { role: 'assistant', content: response }
      ];

      setConversationHistory(newHistory);

      // Save persona message
      if (conversationIdRef.current) {
        await supabase.from('messages').insert({
          conversation_id: conversationIdRef.current,
          sender_type: 'persona',
          content: response,
          message_type: 'text'
        });
      }

      await speakAndDisplay(response, newHistory);

    } catch (error) {
      console.error('Response generation error:', error);
      isProcessingRef.current = false;
      startListening();
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setCurrentTranscript(interim || final);

      if (final.trim()) {
        recognition.stop();
        handleUserSpeech(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  const toggleMic = async () => {
    if (isPersonaSpeaking) return;

    if (isListening) {
      stopListening();
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        startListening();
      } catch {
        toast.error('Microphone permission required');
      }
    }
  };

  const cleanup = () => {
    stopListening();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    speechSynthesis.cancel();

    if (conversationIdRef.current) {
      supabase
        .from('conversations')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: callDuration
        })
        .eq('id', conversationIdRef.current)
        .then(() => {});
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-black flex flex-col">

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-6 pt-safe pt-6 pb-8">
        <div className="flex items-center justify-between text-white">
          <div>
            <h2 className="text-xl font-semibold">{personaName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${
                isPersonaSpeaking ? 'bg-blue-400 animate-pulse' :
                isListening ? 'bg-green-400 animate-pulse' :
                'bg-white/40'
              }`} />
              <span className="text-sm text-white/70">
                {isPersonaSpeaking ? 'Speaking...' :
                 isListening ? 'Listening...' :
                 formatDuration(callDuration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main photo area — full screen */}
      <div className="flex-1 relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={personaName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-40 h-40 bg-gradient-to-br from-blue-500/40 to-purple-600/40 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
                <span className="text-7xl font-light text-white/80">
                  {personaName[0]}
                </span>
              </div>
              <p className="text-white/40 text-sm">No photo uploaded yet</p>
            </div>
          </div>
        )}

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Persona speaking bubble */}
        {isPersonaSpeaking && personaMessage && (
          <div className="absolute bottom-32 left-4 right-4">
            <div className="bg-black/70 backdrop-blur-md rounded-3xl px-6 py-4 max-w-lg mx-auto">
              <p className="text-white text-base leading-relaxed">{personaMessage}</p>
              <div className="flex items-center gap-1 mt-3">
                {audioWaveform.map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-blue-400 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, height * 0.25)}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User transcript bubble */}
        {currentTranscript && !isPersonaSpeaking && (
          <div className="absolute bottom-32 left-4 right-4">
            <div className="bg-purple-600/80 backdrop-blur-md rounded-3xl px-6 py-4 max-w-lg mx-auto ml-auto">
              <div className="flex items-center gap-2 mb-1">
                <Mic className="h-3 w-3 text-white/70 animate-pulse" />
                <span className="text-xs text-white/70">You</span>
              </div>
              <p className="text-white text-base">{currentTranscript}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent pb-safe pb-10 pt-16">
        <div className="flex items-center justify-center gap-10 px-8">

          {/* Mic button */}
          <button
            onClick={toggleMic}
            disabled={isPersonaSpeaking}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
              isListening
                ? 'bg-white ring-4 ring-green-400/60'
                : 'bg-white/20 backdrop-blur'
            } disabled:opacity-40`}
          >
            {isListening
              ? <Mic className="h-7 w-7 text-black" />
              : <MicOff className="h-7 w-7 text-white" />
            }
          </button>

          {/* End call */}
          <button
            onClick={() => { cleanup(); onEndCall(); }}
            className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-105"
          >
            <Phone className="h-8 w-8 text-white rotate-[135deg]" />
          </button>

          {/* Speaker toggle */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
              isSpeakerOn
                ? 'bg-white/20 backdrop-blur'
                : 'bg-red-500/80'
            }`}
          >
            {isSpeakerOn
              ? <Volume2 className="h-7 w-7 text-white" />
              : <VolumeX className="h-7 w-7 text-white" />
            }
          </button>
        </div>

        <p className="text-center text-white/40 text-xs mt-4">
          {isPersonaSpeaking ? `${personaName} is speaking...` :
           isListening ? 'Listening — speak naturally' :
           'Tap mic to speak'}
        </p>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
