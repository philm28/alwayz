import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface VoiceSettings {
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  volume: number;
}

interface UseTextToSpeechReturn {
  speak: (text: string, personaId?: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  settings: VoiceSettings;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
}

interface UseTextToSpeechOptions {
  gender?: 'male' | 'female' | null;
}

export function useTextToSpeech(options?: UseTextToSpeechOptions): UseTextToSpeechReturn {
  const { gender } = options || {};
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [settings] = useState<VoiceSettings>({
    voice: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSupported = true;

  // Fetch the ElevenLabs voice_id for a persona from Supabase
  const getVoiceId = async (personaId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('voice_model_id')
        .eq('id', personaId)
        .single();

      if (error || !data?.voice_model_id) return null;

      // Only return it if it looks like a real ElevenLabs voice ID
      // ElevenLabs IDs are alphanumeric strings, not our internal format
      const id = data.voice_model_id;
      if (id.startsWith('voice_')) return null; // our placeholder format
      return id;
    } catch {
      return null;
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

      if (!response.ok) {
        console.warn('ElevenLabs TTS failed:', response.statusText);
        return false;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        audioRef.current = null;
      };

      await audio.play();
      return true;
    } catch (error) {
      console.warn('ElevenLabs speech error:', error);
      return false;
    }
  };

  const speakWithBrowser = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferred = gender === 'male'
        ? voices.find(v => v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('Google UK English Male'))
        : voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Google UK English Female'));

      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
      utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };

      window.speechSynthesis.speak(utterance);
    }, 50);
  }, [gender]);

  const speak = useCallback(async (text: string, personaId?: string) => {
    if (!text || text.trim().length === 0) return;

    stop();

    // Try ElevenLabs first if we have an API key and persona ID
    if (ELEVENLABS_API_KEY && personaId) {
      const voiceId = await getVoiceId(personaId);
      if (voiceId) {
        console.log('Using ElevenLabs cloned voice:', voiceId);
        const success = await speakWithElevenLabs(text, voiceId);
        if (success) return;
      } else {
        console.warn('No cloned voice ID found for persona, falling back to browser TTS');
      }
    }

    // Fallback to browser TTS
    console.log('Using browser TTS fallback');
    speakWithBrowser(text);
  }, [speakWithBrowser]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && isSpeaking) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (audioRef.current && isPaused) {
      audioRef.current.play();
      setIsPaused(false);
    }
  }, [isPaused]);

  const updateSettings = useCallback(() => {}, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isSupported,
    voices: [],
    settings,
    updateSettings
  };
}
