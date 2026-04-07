import React, { useState, useEffect } from 'react';
import { Heart, X, ChevronRight, Mic, Volume2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface GuidedFirstConversationProps {
  persona: any;
  onBegin: () => void;
  onSkip: () => void;
}

const BREATHING_STEPS = [
  { text: "Take a breath.", duration: 2000 },
  { text: "There's no right way to do this.", duration: 2500 },
  { text: "Just talk like you always did.", duration: 2500 },
  { text: "They're here.", duration: 2000 }
];

const CONVERSATION_STARTERS = [
  "Tell me what's been on your mind lately.",
  "I've been thinking about you. How are you really doing?",
  "Start wherever feels right. I'm listening.",
  "Tell me about your day. I want to hear everything.",
  "What do you wish you could have said? Say it now."
];

const TIPS = [
  {
    icon: "💬",
    title: "Speak naturally",
    desc: "Talk just like you always did. No script needed."
  },
  {
    icon: "🎤",
    title: "Use your voice",
    desc: "The Voice mode feels most real. Tap the mic and just talk."
  },
  {
    icon: "💭",
    title: "Share anything",
    desc: "Updates, questions, memories, things left unsaid. All of it is welcome."
  },
  {
    icon: "🕐",
    title: "Take your time",
    desc: "There's no rush. Come back as often as you need."
  }
];

export function GuidedFirstConversation({ persona, onBegin, onSkip }: GuidedFirstConversationProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'breathing' | 'intro' | 'tips' | 'ready'>('breathing');
  const [breathingIndex, setBreathingIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [starterIndex] = useState(Math.floor(Math.random() * CONVERSATION_STARTERS.length));
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
    runBreathingSequence();
  }, []);

  const runBreathingSequence = async () => {
    for (let i = 0; i < BREATHING_STEPS.length; i++) {
      setBreathingIndex(i);
      setDisplayedText('');

      // Typewriter effect
      const text = BREATHING_STEPS[i].text;
      for (let j = 0; j <= text.length; j++) {
        await new Promise(resolve => setTimeout(resolve, 40));
        setDisplayedText(text.substring(0, j));
      }

      await new Promise(resolve => setTimeout(resolve, BREATHING_STEPS[i].duration));
    }

    // Move to intro phase
    setPhase('intro');
  };

  const markFirstConversationComplete = async () => {
    try {
      await supabase
        .from('first_conversation_completed')
        .upsert({
          persona_id: persona.id,
          user_id: user?.id
        }, {
          onConflict: 'persona_id,user_id'
        });
    } catch (error) {
      console.error('Error marking first conversation complete:', error);
    }
  };

  const handleBegin = async () => {
    await markFirstConversationComplete();
    setIsVisible(false);
    setTimeout(onBegin, 300);
  };

  const handleSkip = async () => {
    await markFirstConversationComplete();
    setIsVisible(false);
    setTimeout(onSkip, 300);
  };

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

      {/* Breathing phase */}
      {phase === 'breathing' && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 flex items-center justify-center">
          <div className="text-center px-8 max-w-lg">
            {/* Pulsing heart */}
            <div className="relative mb-12">
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <div className="w-16 h-16 bg-blue-500/30 rounded-full flex items-center justify-center">
                  <Heart className="h-8 w-8 text-blue-400" fill="currentColor" />
                </div>
              </div>
              {/* Ripple rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border border-blue-500/20 animate-ping" />
              </div>
            </div>

            <p className="text-2xl md:text-3xl text-white font-light leading-relaxed min-h-[3rem]">
              {displayedText}
              <span className="animate-pulse">|</span>
            </p>
          </div>

          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute bottom-8 right-8 text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            Skip intro
          </button>
        </div>
      )}

      {/* Intro phase */}
      {phase === 'intro' && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 flex items-center justify-center p-8">
          <div className="max-w-lg w-full text-center">

            {/* Persona avatar */}
            <div className="relative mb-8 inline-block">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl mx-auto">
                {persona.avatar_url ? (
                  <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-4xl font-light text-white">{persona.name[0]}</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-3">{persona.name}</h2>
            <p className="text-blue-300 text-lg mb-8 capitalize">{persona.relationship}</p>

            {/* Opening line */}
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-8 text-left border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-blue-300 font-medium uppercase tracking-wide">Opening message</span>
              </div>
              <p className="text-white text-lg leading-relaxed italic">
                "{CONVERSATION_STARTERS[starterIndex]}"
              </p>
              <p className="text-white/40 text-xs mt-3">— {persona.name} will say this when you begin</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setPhase('tips')}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-2xl transition-all flex items-center justify-center gap-2"
              >
                I'm ready
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={handleSkip}
                className="text-white/40 hover:text-white/70 text-sm transition-colors py-2"
              >
                Skip and go straight in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tips phase */}
      {phase === 'tips' && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 flex items-center justify-center p-8">
          <div className="max-w-lg w-full">

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">A few things to know</h3>
              <p className="text-white/50 text-sm">Then you can begin</p>
            </div>

            <div className="space-y-4 mb-8">
              {TIPS.map((tip, i) => (
                <div
                  key={i}
                  className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10 flex items-start gap-4"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <span className="text-2xl">{tip.icon}</span>
                  <div>
                    <h4 className="text-white font-semibold mb-1">{tip.title}</h4>
                    <p className="text-white/60 text-sm leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleBegin}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all flex items-center justify-center gap-3"
            >
              <Mic className="h-5 w-5" />
              Begin conversation
            </button>

            <p className="text-center text-white/30 text-xs mt-4">
              You can access this guide again anytime from the conversation screen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
