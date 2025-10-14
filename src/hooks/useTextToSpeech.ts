import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceSettings {
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  volume: number;
}

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>({
    voice: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      if (availableVoices.length > 0 && !settings.voice) {
        const bestVoice = findBestVoice(availableVoices, gender);
        setSettings(prev => ({
          ...prev,
          voice: bestVoice,
          rate: 0.95,
          pitch: 1.0
        }));
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported, gender]);

  const findBestVoice = (availableVoices: SpeechSynthesisVoice[], preferredGender?: 'male' | 'female' | null): SpeechSynthesisVoice => {
    const femaleVoices = [
      'Samantha',
      'Google UK English Female',
      'Google US English Female',
      'Microsoft Zira',
      'Karen',
      'Moira',
      'Tessa',
      'Fiona',
      'Ava',
      'Allison',
      'Susan',
      'Vicki',
      'Victoria',
      'Kate',
      'Serena'
    ];

    const maleVoices = [
      'Alex',
      'Google UK English Male',
      'Google US English Male',
      'Microsoft David',
      'Daniel',
      'Fred',
      'Tom',
      'Oliver',
      'James'
    ];

    const preferredVoices = preferredGender === 'male' ? maleVoices :
                           preferredGender === 'female' ? femaleVoices :
                           [...femaleVoices, ...maleVoices];

    for (const preferred of preferredVoices) {
      const voice = availableVoices.find(v =>
        v.name.includes(preferred) && v.lang.startsWith('en')
      );
      if (voice) return voice;
    }

    const genderFilter = preferredGender === 'male' ?
      (name: string) => name.toLowerCase().includes('male') && !name.toLowerCase().includes('female') :
      preferredGender === 'female' ?
      (name: string) => name.toLowerCase().includes('female') :
      () => true;

    const englishVoices = availableVoices.filter(v =>
      v.lang.startsWith('en') &&
      genderFilter(v.name) &&
      (v.name.toLowerCase().includes('natural') ||
       v.name.toLowerCase().includes('premium') ||
       v.name.toLowerCase().includes('enhanced'))
    );

    if (englishVoices.length > 0) {
      return englishVoices[0];
    }

    const genderedVoices = availableVoices.filter(v =>
      v.lang.startsWith('en') && genderFilter(v.name)
    );

    if (genderedVoices.length > 0) {
      return genderedVoices[0];
    }

    const anyEnglishVoice = availableVoices.find(v => v.lang.startsWith('en-'));
    return anyEnglishVoice || availableVoices[0];
  };

  const speak = useCallback((text: string) => {
    if (!isSupported) {
      console.warn('Text-to-speech is not supported in this browser');
      return;
    }

    if (!text || text.trim().length === 0) {
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = settings.voice;
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        setIsPaused(false);
        utteranceRef.current = null;
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 50);
  }, [isSupported, settings]);

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    }
  }, [isSupported]);

  const pause = useCallback(() => {
    if (isSupported && isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSupported, isSpeaking, isPaused]);

  const resume = useCallback(() => {
    if (isSupported && isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isSupported, isSpeaking, isPaused]);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    settings,
    updateSettings
  };
}
