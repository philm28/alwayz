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
  onBackToDashboard?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type VoiceStatus = 'loading' | 'cloning' | 'cloned' | 'fallback';

// ✅ Detect iOS Safari
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
  return isIOS || isSafari;
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
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(personaAvatar);
  const [audioWaveform, setAudioWaveform] = useState<number[]>([0, 0, 0, 0, 0]);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('loading');
  const [callEnded, setCallEnded] = useState(false);
  const [cloningAttempt, setCloningAttempt] = useState(0);

  // ✅ iOS-specific state
  const [isIOS, setIsIOS] = useState(false);
  const [waitingForTap, setWaitingForTap] = useState(false); // show "Tap to speak" prompt

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
    setIsIOS(isIOSSafari());

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
    try { if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; } } catch {}
    try { if (recognitionRef.current) { recognitionRef.current.abort(); recognitionRef.current = null; } } catch {}
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; } } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
    accumulatedTranscriptRef.current = '';
    setIsListening(false);
    setIsPersonaSpeaking(false);
    setWaitingForTap(false);
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
          if (attempts === 0) {
            if (!data.voice_model_id || data.voice_model_id.startsWith('voice_')) {
              const { data: content } = await supabase
                .from('persona_content')
                .select('id')
                .eq('persona_id', personaId)
                .limit(1);
              if (content && content.length > 0) setVoiceStatus('cloning');
            }
          }
          if (data.voice_model_id && !data.voice_model_id.startsWith('voice_')) {
            setVoiceStatus('cloned');
            break;
          }
        }

        attempts++;
        setCloningAttempt(attempts);
        if (attempts < maxAttempts) await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!persona) { toast.error('Failed to load persona'); return; }

      if (!persona.voice_model_id || persona.voice_model_id.startsWith('voice_')) {
        setVoiceStatus('fallback');
      }

      personaDataRef.current = persona;

      if (!avatarUrl && persona.avatar_url) setAvatarUrl(persona.avatar_url);

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
        headers: { 'xi-api-key': ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true }
        })
      });
      if (!response.ok) return false;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return new Promise((resolve) => {
        if (!audioRef.current) { resolve(false); return; }
        audioRef.current.src = audioUrl;
        audioRef.current.volume = isSpeakerOn ? 1.0 : 0.0;
        audioRef.current.onended = () => { URL.revokeObjectURL(audioUrl); resolve(true); };
        audioRef.current.onerror = () => { URL.revokeObjectURL(audioUrl); resolve(false); };
        audioRef.current.play().catch(() => resolve(false));
      });
    } catch { return false; }
  };

  const speakAndDisplay = async (text: string) => {
    window.speechSynthesis?.cancel();
    setIsPersonaSpeaking(true);
    setPersonaMessage(text);
    setWaitingForTap(false); // hide tap prompt while persona speaks
    isProcessingRef.current = true;
    stopListening();

    try {
      if (isSpeakerOn) {
        const voiceId = getVoiceId();
        let spoke = false;
        if (ELEVENLABS_API_KEY && voiceId) spoke = await speakWithElevenLabs(text, voiceId);
        if (!spoke) {
          window.speechSynthesis?.cancel();
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

      // ✅ iOS: show "Tap to speak" instead of auto-starting mic
      if (isIOSSafari()) {
        setWaitingForTap(true);
      } else {
        setTimeout(() => startListening(), 500);
      }
    }
  };

  const playGreeting = async (persona: any) => {
    try {
      const greeting = await memoryConversationEngine.generateMemoryEnhancedResponse(personaId, '__greeting__', []);
      await speakAndDisplay(greeting);
    } catch {
      await speakAndDisplay(`Oh, it's so good to hear from you. I've been thinking about you.`);
    }
  };

  const submitAccumulatedTranscript = () => {
    const transcript = accumulatedTranscriptRef.current.trim();
    if (!transcript || isProcessingRef.current) return;
    accumulatedTranscriptRef.current = '';
    setCurrentTranscript('');
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    handleUserSpeech(transcript);
  };

  const handleUserSpeech = async (transcript: string) => {
    if (isProcessingRef.current || !transcript.trim()) return;
    isProcessingRef.current = true;
    setCurrentTranscript('');
    setWaitingForTap(false);
    stopListening();

    if (conversationIdRef.current) {
      await supabase.from('messages').insert({
        conversation_id: conversationIdRef.current,
        sender_type: 'user',
        content: transcript,
        message_type: 'text'
      });
    }

    const updatedHistory: Message[] = [...conversationHistory, { role: 'user', content: transcript }];
    setConversationHistory(updatedHistory);

    try {
      const response = await memoryConversationEngine.generateMemoryEnhancedResponse(personaId, transcript, updatedHistory);
      const newHistory: Message[] = [...updatedHistory, { role: 'assistant', content: response }];
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
      if (isIOSSafari()) {
        setWaitingForTap(true);
      } else {
        startListening();
      }
    }
  };

  const startListening = () => {
    if (isProcessingRef.current) return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }

    accumulatedTranscriptRef.current = '';
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setWaitingForTap(false);
    };

    recognition.onresult = (event: any) => {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interimTranscript += t;
      }
      if (finalTranscript) {
        accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + finalTranscript;
      }
      setCurrentTranscript(accumulatedTranscriptRef.current + (interimTranscript ? ' ' + interimTranscript : ''));

      silenceTimerRef.current = setTimeout(() => {
        if (accumulatedTranscriptRef.current.trim()) submitAccumulatedTranscript();
      }, 2000);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        if (!isProcessingRef.current) {
          // ✅ On iOS, don't auto-restart — go back to tap prompt
          if (isIOSSafari()) {
            setIsListening(false);
            setWaitingForTap(true);
          } else {
            setTimeout(() => startListening(), 300);
          }
        }
        return;
      }
      if (event.error !== 'aborted') console.error('Speech error:', event.error);
      setIsListening(false);
      if (isIOSSafari()) setWaitingForTap(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (accumulatedTranscriptRef.current.trim() && !silenceTimerRef.current && !isProcessingRef.current) {
        submitAccumulatedTranscript();
        return;
      }
      // ✅ On iOS don't auto-restart
      if (!isProcessingRef.current && !isIOSSafari()) {
        setTimeout(() => startListening(), 300);
      } else if (isIOSSafari() && !isProcessingRef.current) {
        setWaitingForTap(true);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (error) { console.error('Failed to start recognition:', error); }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    accumulatedTranscriptRef.current = '';
    setIsListening(false);
  };

  // ✅ The tap handler — this is the user gesture iOS requires
  const handleTapToSpeak = async () => {
    if (isPersonaSpeaking || isProcessingRef.current) return;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setWaitingForTap(false);
      startListening();
    } catch {
      toast.error('Microphone permission required. Check your iPhone Settings → Safari → Microphone.');
    }
  };

  const toggleMic = async () => {
    if (isPersonaSpeaking) return;
    if (isListening) {
      stopListening();
      if (isIOSSafari()) setWaitingForTap(true);
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        startListening();
      } catch {
        toast.error('Microphone permission required');
      }
    }
  };

  const handleEndCall = () => {
    if (callEnded) return;
    setCallEnded(true);
    hardStop();
    if (conversationIdRef.current) {
      supabase.from('conversations').update({
        ended_at: new Date().toISOString(),
        duration_seconds: callDuration
      }).eq('id', conversationIdRef.current).then(() => {});
    }
    setTimeout(() => { if (onBackToDashboard) onBackToDashboard(); else onEndCall(); }, 300);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderLoadingOverlay = () => {
    if (voiceStatus === 'cloning') {
      return (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="bg-black/70 backdrop-blur-md rounded-2xl px-8 py-7 text-center max-w-xs mx-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-7 w-7 text-white animate-pulse" fill="currentColor" />
            </div>
            <p className="text-white font-semibold text-base mb-1">Creating {personaName}'s voice</p>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              Voice cloning is still in progress. This usually takes 1–2 minutes after uploading audio.
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i < cloningAttempt ? 'bg-purple-400' : 'bg-white/20'}`} />
              ))}
            </div>
            <button
              onClick={() => setVoiceStatus('fallback')}
              className="mt-2 px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-all">
              Continue with standard voice
            </button>
          </div>
        </div>
      );
    }
    if (voiceStatus === 'loading') {
      return (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-md rounded-2xl px-8 py-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3" />
            <p className="text-white text-sm">Connecting to {personaName}...</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden">

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-6 pt-8 pb-12">
        <div className="flex items-center justify-between text-white">
          <div>
            <h2 className="text-2xl font-semibold">{personaName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${
                voiceStatus === 'loading' || voiceStatus === 'cloning' ? 'bg-yellow-400 animate-pulse' :
                isPersonaSpeaking ? 'bg-blue-400 animate-pulse' :
                isListening ? 'bg-green-400 animate-pulse' :
                waitingForTap ? 'bg-purple-400 animate-pulse' :
                'bg-white/40'
              }`} />
              <span className="text-sm text-white/70">
                {voiceStatus === 'loading' ? 'Connecting...' :
                 voiceStatus === 'cloning' ? 'Creating voice...' :
                 isPersonaSpeaking ? 'Speaking...' :
                 isListening ? 'Listening...' :
                 waitingForTap ? 'Your turn' :
                 formatDuration(callDuration)}
              </span>
            </div>
          </div>
          <div className="text-xs text-white/30">
            {voiceStatus === 'cloned' ? '🎤 Cloned voice' :
             voiceStatus === 'fallback' ? '⚠️ Standard voice' :
             voiceStatus === 'cloning' ? '⏳ Cloning...' : ''}
          </div>
        </div>
      </div>

      {/* Full screen photo */}
      <div className="absolute inset-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={personaName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-40 h-40 bg-gradient-to-br from-blue-500/40 to-purple-600/40 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
                <span className="text-7xl font-light text-white/80">{personaName[0]}</span>
              </div>
              <p className="text-white/40 text-sm">No photo uploaded yet</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/40" />
      </div>

      {/* Loading overlay */}
      {(voiceStatus === 'loading' || voiceStatus === 'cloning') && renderLoadingOverlay()}

      {/* ✅ iOS "Tap to speak" overlay — appears after persona finishes talking */}
      {waitingForTap && !isPersonaSpeaking && voiceStatus !== 'loading' && voiceStatus !== 'cloning' && (
        <div className="absolute inset-0 z-20 flex items-end justify-center pb-52">
          <button
            onClick={handleTapToSpeak}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/40 group-active:scale-95 transition-all"
              style={{
                boxShadow: '0 0 0 8px rgba(255,255,255,0.08), 0 0 0 16px rgba(255,255,255,0.04)'
              }}>
              <Mic className="h-8 w-8 text-white" />
            </div>
            <span className="text-white font-semibold text-base tracking-wide">Tap to speak</span>
          </button>
        </div>
      )}

      {/* Speech bubbles */}
      <div className="absolute bottom-48 left-4 right-4 z-20 space-y-3">
        {isPersonaSpeaking && personaMessage && (
          <div className="bg-black/70 backdrop-blur-md rounded-3xl px-5 py-4 max-w-lg mx-auto">
            <p className="text-white text-sm leading-relaxed">{personaMessage}</p>
            <div className="flex items-center gap-1 mt-2">
              {audioWaveform.map((height, i) => (
                <div key={i} className="w-1 bg-blue-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, height * 0.2)}px` }} />
              ))}
            </div>
          </div>
        )}
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

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 pt-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="flex items-center justify-center gap-8 px-8 mb-4">
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${isSpeakerOn ? 'bg-white/20 backdrop-blur' : 'bg-red-500/80'}`}>
            {isSpeakerOn ? <Volume2 className="h-6 w-6 text-white" /> : <VolumeX className="h-6 w-6 text-white" />}
          </button>

          <button
            onClick={handleEndCall}
            disabled={callEnded}
            className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-105 disabled:opacity-50">
            <Phone className="h-8 w-8 text-white rotate-[135deg]" />
          </button>

          {/* ✅ On iOS — mic button just shows state, tap-to-speak overlay handles input */}
          <button
            onClick={isIOS ? handleTapToSpeak : toggleMic}
            disabled={isPersonaSpeaking || voiceStatus === 'loading' || voiceStatus === 'cloning'}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
              isListening ? 'bg-white ring-4 ring-green-400/60' :
              waitingForTap ? 'bg-purple-500/80 ring-4 ring-purple-400/40' :
              'bg-white/20 backdrop-blur'
            } disabled:opacity-40`}>
            {isListening
              ? <Mic className="h-6 w-6 text-black" />
              : <MicOff className="h-6 w-6 text-white" />}
          </button>
        </div>

        <p className="text-center text-white/40 text-xs">
          {voiceStatus === 'loading' ? 'Connecting...' :
           voiceStatus === 'cloning' ? 'Creating voice...' :
           isPersonaSpeaking ? `${personaName} is speaking...` :
           isListening ? 'Listening — take your time' :
           waitingForTap ? 'Tap the mic or the button above to respond' :
           'Tap mic to speak'}
        </p>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
