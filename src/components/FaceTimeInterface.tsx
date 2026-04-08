import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone, Heart, ArrowLeft } from 'lucide-react';
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
  onBackToDashboard?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function FaceTimeInterface({
  personaId,
  personaName,
  personaAvatar,
  onEndCall,
  onBackToDashboard
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
  const [voiceStatus, setVoiceStatus] = useState<'loading' | 'cloned' | 'fallback'>('loading');
  const [callEnded, setCallEnded] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);
  const conversationIdRef = useRef<string | null>(null);
  const callStartRef = useRef<number>(Date.now());
  const isProcessingRef = useRef(false);
  const personaDataRef = useRef<any>(null);
  const hasInitialized = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef('');
  const { user } = useAuth();

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    initialize();

    const durationInterval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);

    const waveformInterval = setInterval(() => {
      setAudioWaveform(
        isProcessingRef.current
          ? Array.from({ length: 5 }, () => Math.random() * 100)
          : [0, 0, 0, 0, 0]
      );
    }, 100);

    return () => {
      clearInterval(durationInterval);
      clearInterval(waveformInterval);
      hardStop();
    };
  }, []);

  const hardStop = () => {
    try {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } catch {}

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    } catch {}

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    } catch {}

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.cancel();
    } catch {}

    accumulatedTranscriptRef.current = '';
    setIsListening(false);
    setIsPersonaSpeaking(false);
    isProcessingRef.current = false;
  };

  const initialize = async () => {
    try {
      let persona = null;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const { data } = await supabase
          .from('personas')
          .select('*')
          .eq('id', personaId)
          .single();

        if (data) {
          persona = data;
          if (data.voice_model_id && !data.voice_model_id.startsWith('voice_')) {
            console.log(`✅ Got real voice ID on attempt ${attempts + 1}:`, data.voice_model_id);
            setVoiceStatus('cloned');
            break;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!persona) {
        toast.error('Failed to load persona');
        return;
      }

      if (!persona.voice_model_id || persona.voice_model_id.startsWith('voice_')) {
        setVoiceStatus('fallback');
      }

      setPersonaData(persona);
      personaDataRef.current = persona;

      if (!avatarUrl && persona.avatar_url) {
        setAvatarUrl(persona.avatar_url);
      }

      if (!avatarUrl) {
        const { data: content } = await supabase
          .from('persona_content')
          .select('file_url, metadata')
          .eq('persona_id', personaId)
          .eq('content_type', 'image')
          .limit(1)
          .maybeSingle();

        if (content?.file_url) setAvatarUrl(content.file_url);
        else if (content?.metadata?.media_url) setAvatarUrl(content.metadata.media_url);
      }

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

        if (conversation) conversationIdRef.current = conversation.id;
      }

      setTimeout(() => playGreeting(persona), 500);

    } catch (error) {
      console.error('Initialization error:', error);
      toast.error('Failed to start call');
    }
  };

  const getVoiceId = (): string | null => {
    const persona = personaDataRef.current;
    if (!persona?.voice_model_id) return null;
    if (persona.voice_model_id.startsWith('voice_')) return null;
    return persona.voice_model_id;
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
        if (!audioRef.current) { resolve(false); return; }

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

  const speakAndDisplay = async (text: string) => {
    window.speechSynthesis.cancel();

    setIsPersonaSpeaking(true);
    setPersonaMessage(text);
    isProcessingRef.current = true;

    stopListening();

    try {
      if (isSpeakerOn) {
        const voiceId = getVoiceId();
        let spoke = false;

        if (ELEVENLABS_API_KEY && voiceId) {
          spoke = await speakWithElevenLabs(text, voiceId);
        }

        if (!spoke) {
          window.speechSynthesis.cancel();
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.92;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          });
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      setIsPersonaSpeaking(false);
      setPersonaMessage('');
      isProcessingRef.current = false;
      setTimeout(() => startListening(), 500);
    }
  };

  const playGreeting = async (persona: any) => {
    try {
      const greeting = await memoryConversationEngine.generateMemoryEnhancedResponse(
        personaId,
        '__greeting__',
        []
      );
      await speakAndDisplay(greeting);
    } catch {
      await speakAndDisplay(
        `Oh, it's so good to hear from you. I've been thinking about you.`
      );
    }
  };

  const submitAccumulatedTranscript = () => {
    const transcript = accumulatedTranscriptRef.current.trim();
    if (!transcript || isProcessingRef.current) return;

    accumulatedTranscriptRef.current = '';
    setCurrentTranscript('');

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    handleUserSpeech(transcript);
  };

  const handleUserSpeech = async (transcript: string) => {
    if (isProcessingRef.current || !transcript.trim()) return;
    isProcessingRef.current = true;

    setCurrentTranscript('');
    stopListening();

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

      if (conversationIdRef.current) {
        await supabase.from('messages').insert({
          conversation_id: conversationIdRef.current,
          sender_type: 'persona',
          content: response,
          message_type: 'text'
        });
      }

      await speakAndDisplay(response);

    } catch (error) {
      console.error('Response error:', error);
      isProcessingRef.current = false;
      startListening();
    }
  };

  const startListening = () => {
    if (isProcessingRef.current) return;

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    accumulatedTranscriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }

      if (finalTranscript) {
        accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + finalTranscript;
      }

      const displayText = accumulatedTranscriptRef.current +
        (interimTranscript ? ' ' + interimTranscript : '');
      setCurrentTranscript(displayText);

      silenceTimerRef.current = setTimeout(() => {
        if (accumulatedTranscriptRef.current.trim()) {
          submitAccumulatedTranscript();
        }
      }, 2000);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        if (!isProcessingRef.current) {
          setTimeout(() => startListening(), 300);
        }
        return;
      }
      if (event.error !== 'aborted') {
        console.error('Speech error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      if (accumulatedTranscriptRef.current.trim() && !silenceTimerRef.current && !isProcessingRef.current) {
        submitAccumulatedTranscript();
        return;
      }

      if (!isProcessingRef.current) {
        setTimeout(() => startListening(), 300);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    accumulatedTranscriptRef.current = '';
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

  // ✅ End call — clean up and navigate back
  const handleEndCall = () => {
    if (callEnded) return;
    setCallEnded(true);

    hardStop();

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

    // ✅ Navigate back to dashboard after brief delay
    setTimeout(() => {
      if (onBackToDashboard) {
        onBackToDashboard();
      } else {
        onEndCall();
      }
    }, 300);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden">

      {/* ✅ Header — name and status only, no blocking controls */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-6 pt-8 pb-12">
        <div className="flex items-center justify-between text-white">
          <div>
            <h2 className="text-2xl font-semibold">{personaName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${
                voiceStatus === 'loading' ? 'bg-yellow-400 animate-pulse' :
                isPersonaSpeaking ? 'bg-blue-400 animate-pulse' :
                isListening ? 'bg-green-400 animate-pulse' :
                'bg-white/40'
              }`} />
              <span className="text-sm text-white/70">
                {voiceStatus === 'loading' ? 'Connecting...' :
                 isPersonaSpeaking ? 'Speaking...' :
                 isListening ? 'Listening...' :
                 formatDuration(callDuration)}
              </span>
            </div>
          </div>
          <div className="text-xs text-white/30">
            {voiceStatus === 'cloned' ? '🎤 Cloned voice' :
             voiceStatus === 'fallback' ? '⚠️ Standard voice' : ''}
          </div>
        </div>
      </div>

      {/* ✅ Full screen photo — unobstructed */}
      <div className="absolute inset-0">
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

        {/* Gradient overlay — heavier at bottom for controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/40" />
      </div>

      {/* Loading overlay */}
      {voiceStatus === 'loading' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-md rounded-2xl px-8 py-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3" />
            <p className="text-white text-sm">Connecting to {personaName}...</p>
          </div>
        </div>
      )}

      {/* ✅ Speech bubbles — moved higher to avoid overlapping controls */}
      <div className="absolute bottom-48 left-4 right-4 z-20 space-y-3">
        {/* Persona speaking */}
        {isPersonaSpeaking && personaMessage && (
          <div className="bg-black/70 backdrop-blur-md rounded-3xl px-5 py-4 max-w-lg mx-auto">
            <p className="text-white text-sm leading-relaxed">{personaMessage}</p>
            <div className="flex items-center gap-1 mt-2">
              {audioWaveform.map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, height * 0.2)}px` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* User transcript */}
        {currentTranscript && !isPersonaSpeaking && (
          <div className="flex justify-end">
            <div className="bg-purple-600/80 backdrop-blur-md rounded-3xl px-5 py-3 max-w-xs">
              <div className="flex items-center gap-2 mb-1">
                <Mic className="h-3 w-3 text-white/70 animate-pulse" />
                <span className="text-xs text-white/70">You</span>
              </div>
              <p className="text-white text-sm">{currentTranscript}</p>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Controls — pinned to very bottom, clear of photo */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 pt-6 bg-gradient-to-t from-black via-black/80 to-transparent">

        <div className="flex items-center justify-center gap-8 px-8 mb-4">

          {/* Speaker toggle */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
              isSpeakerOn ? 'bg-white/20 backdrop-blur' : 'bg-red-500/80'
            }`}
          >
            {isSpeakerOn
              ? <Volume2 className="h-6 w-6 text-white" />
              : <VolumeX className="h-6 w-6 text-white" />
            }
          </button>

          {/* ✅ End call — center, prominent */}
          <button
            onClick={handleEndCall}
            disabled={callEnded}
            className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-105 disabled:opacity-50"
          >
            <Phone className="h-8 w-8 text-white rotate-[135deg]" />
          </button>

          {/* Mic toggle */}
          <button
            onClick={toggleMic}
            disabled={isPersonaSpeaking || voiceStatus === 'loading'}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
              isListening
                ? 'bg-white ring-4 ring-green-400/60'
                : 'bg-white/20 backdrop-blur'
            } disabled:opacity-40`}
          >
            {isListening
              ? <Mic className="h-6 w-6 text-black" />
              : <MicOff className="h-6 w-6 text-white" />
            }
          </button>
        </div>

        <p className="text-center text-white/40 text-xs">
          {voiceStatus === 'loading' ? 'Connecting...' :
           isPersonaSpeaking ? `${personaName} is speaking...` :
           isListening ? 'Listening — take your time' :
           'Tap mic to speak'}
        </p>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
