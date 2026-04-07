import React, { useState, useEffect, useRef } from 'react';
import { Mic, Play, Pause, Download, Trash2, X, Heart, Volume2, Clock, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { calculateGriefPhase } from '../lib/memoryConversation';
import toast from 'react-hot-toast';

const MOODS = [
  { id: 'comfort', label: '🤗 Comfort me', prompt: 'Record a short, deeply comforting voice note. Be gentle, warm, and present. Tell them you love them and that everything is going to be okay in your own words.' },
  { id: 'proud', label: '⭐ Tell me you\'re proud', prompt: 'Record a heartfelt voice note expressing how proud you are of them. Be specific if you can — reference their strength, their journey, who they are.' },
  { id: 'name', label: '💙 Just say my name', prompt: 'Record a short, loving voice note that begins with their name and expresses pure love. Simple, warm, intimate — like you always said their name.' },
  { id: 'story', label: '📖 Tell me a story', prompt: 'Share a warm memory or story from your life together. Keep it short but specific and personal — something that captures who you are.' },
  { id: 'okay', label: '🌅 It\'s going to be okay', prompt: 'Record an encouraging voice note reminding them that it\'s going to be okay. Draw on your wisdom, your faith in them, your love.' },
  { id: 'morning', label: '☀️ Good morning', prompt: 'Record a warm good morning message — the kind you would have said to start their day. Loving, gentle, energizing.' },
  { id: 'night', label: '🌙 Goodnight', prompt: 'Record a goodnight message — the kind that would help them sleep. Peaceful, loving, reassuring.' },
  { id: 'miss', label: '💔 I miss you too', prompt: 'Record a voice note acknowledging that you miss them just as much. Let them know the love goes both ways.' }
];

interface VoiceNote {
  id: string;
  persona_id: string;
  title: string;
  mood: string;
  transcript: string;
  audio_url: string;
  duration_seconds: number;
  grief_phase: string;
  created_at: string;
}

interface VoiceNotesProps {
  persona: any;
  onClose: () => void;
}

export function VoiceNotes({ persona, onClose }: VoiceNotesProps) {
  const { user } = useAuth();
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedMood, setSelectedMood] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [generatedNote, setGeneratedNote] = useState<{ transcript: string; audioUrl: string } | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadVoiceNotes();
  }, []);

  const loadVoiceNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('voice_notes')
        .select('*')
        .eq('persona_id', persona.id)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVoiceNotes(data || []);
    } catch (error) {
      console.error('Error loading voice notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateVoiceNote = async () => {
    if (!selectedMood) return;
    setIsGenerating(true);
    setGeneratedNote(null);

    try {
      // Fetch memories for context
      const { data: memories } = await supabase
        .from('persona_memories')
        .select('content, memory_type, importance')
        .eq('persona_id', persona.id)
        .order('importance', { ascending: false })
        .limit(10);

      const memoryContext = memories && memories.length > 0
        ? memories.map(m => `• ${m.content}`).join('\n')
        : '';

      const griefPhase = calculateGriefPhase(persona.date_of_passing);

      // Generate transcript with OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: `You are ${persona.name}, recording a short personal voice note for someone you love deeply.

YOUR PERSONALITY: ${persona.personality_traits || 'warm, loving, genuine'}
YOUR RELATIONSHIP: ${persona.relationship}

YOUR MEMORIES:
${memoryContext || 'Speak from the heart.'}

GRIEF PHASE AWARENESS:
${griefPhase === 'acute' ? 'They are in raw grief. Be gentle, quiet, and purely loving.' :
  griefPhase === 'active' ? 'They are living with grief daily. Balance comfort with warmth.' :
  griefPhase === 'integration' ? 'They are moving forward. Express pride and encouragement.' :
  griefPhase === 'legacy' ? 'They have grown so much. Express deep pride and wisdom.' :
  'Be warm and present.'}

INSTRUCTIONS:
- Speak as ${persona.name} in first person
- Keep it SHORT — 3-5 sentences maximum, like a real voicemail
- Be specific and personal — use real memories if relevant
- Sound natural and conversational — not like a script
- Do NOT mention being deceased or being an AI
- End warmly — like you would end a real message`
          }, {
            role: 'user',
            content: selectedMood.prompt
          }],
          max_tokens: 200,
          temperature: 0.85
        })
      });

      const data = await response.json();
      const transcript = data.choices[0]?.message?.content || '';

      if (!transcript) throw new Error('No transcript generated');

      // Generate audio with ElevenLabs
      const voiceId = persona.voice_model_id;
      if (!voiceId || voiceId.startsWith('voice_')) {
        throw new Error('No cloned voice available');
      }

      const audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': import.meta.env.VITE_ELEVENLABS_API_KEY!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: transcript,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.85,
              style: 0.2,
              use_speaker_boost: true
            }
          })
        }
      );

      if (!audioResponse.ok) throw new Error('ElevenLabs failed');

      const audioBlob = await audioResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      setGeneratedNote({ transcript, audioUrl });

      // Auto play preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.play();

    } catch (error) {
      console.error('Error generating voice note:', error);
      toast.error('Could not generate voice note. Make sure this persona has a cloned voice.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveVoiceNote = async () => {
    if (!generatedNote || !user) return;

    try {
      // Upload audio to Supabase storage
      const audioBlob = await fetch(generatedNote.audioUrl).then(r => r.blob());
      const fileName = `voice-notes/${persona.id}/${Date.now()}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from('persona-content')
        .upload(fileName, audioBlob, { contentType: 'audio/mpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('persona-content')
        .getPublicUrl(fileName);

      // Save to database
      const griefPhase = calculateGriefPhase(persona.date_of_passing);
      const moodLabel = MOODS.find(m => m.id === selectedMood?.id)?.label || selectedMood?.id;

      const { data, error } = await supabase
        .from('voice_notes')
        .insert({
          persona_id: persona.id,
          user_id: user.id,
          title: moodLabel,
          mood: selectedMood?.id,
          transcript: generatedNote.transcript,
          audio_url: publicUrl,
          duration_seconds: 0,
          grief_phase: griefPhase
        })
        .select()
        .single();

      if (error) throw error;

      setVoiceNotes(prev => [data, ...prev]);
      setGeneratedNote(null);
      setSelectedMood(null);
      setShowGenerator(false);
      toast.success('Voice note saved to your library 💙');

    } catch (error) {
      console.error('Error saving voice note:', error);
      toast.error('Could not save voice note');
    }
  };

  const playNote = (note: VoiceNote) => {
    // Stop all other audio
    audioRefs.current.forEach((audio, id) => {
      if (id !== note.id) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    if (currentlyPlaying === note.id) {
      const audio = audioRefs.current.get(note.id);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setCurrentlyPlaying(null);
      return;
    }

    let audio = audioRefs.current.get(note.id);
    if (!audio) {
      audio = new Audio(note.audio_url);
      audio.onended = () => setCurrentlyPlaying(null);
      audioRefs.current.set(note.id, audio);
    }

    audio.play();
    setCurrentlyPlaying(note.id);
  };

  const downloadNote = async (note: VoiceNote) => {
    try {
      const response = await fetch(note.audio_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${persona.name} - ${note.title}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download voice note');
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('voice_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setVoiceNotes(prev => prev.filter(n => n.id !== id));

      // Stop if playing
      if (currentlyPlaying === id) {
        audioRefs.current.get(id)?.pause();
        setCurrentlyPlaying(null);
      }

      toast.success('Voice note removed');
    } catch {
      toast.error('Could not remove voice note');
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Voice Notes</h2>
                <p className="text-white/70 text-sm">From {persona.name} — replay anytime</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-8">

          {/* Generator */}
          {!showGenerator && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Your Voice Notes</h3>
                  <p className="text-sm text-gray-500">{voiceNotes.length} saved message{voiceNotes.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setShowGenerator(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
                >
                  <Mic className="h-4 w-4" />
                  New Note
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              ) : voiceNotes.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Volume2 className="h-10 w-10 text-blue-300" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">No voice notes yet</h4>
                  <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                    Create a short personal message from {persona.name} in their cloned voice — replay it anytime you need them.
                  </p>
                  <button
                    onClick={() => setShowGenerator(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Create First Voice Note
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {voiceNotes.map(note => (
                    <div key={note.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-start gap-4">

                        {/* Play button */}
                        <button
                          onClick={() => playNote(note)}
                          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-md ${
                            currentlyPlaying === note.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          {currentlyPlaying === note.id
                            ? <Pause className="h-5 w-5" />
                            : <Play className="h-5 w-5 ml-0.5" />
                          }
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900 text-sm">{note.title}</h4>
                            <span className="text-xs text-gray-400">{formatTime(note.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 italic">
                            "{note.transcript}"
                          </p>

                          {/* Waveform placeholder */}
                          {currentlyPlaying === note.id && (
                            <div className="flex items-center gap-0.5 mt-2">
                              {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="w-1 bg-blue-400 rounded-full animate-pulse"
                                  style={{
                                    height: `${Math.random() * 16 + 4}px`,
                                    animationDelay: `${i * 50}ms`
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => downloadNote(note)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
                            title="Download"
                          >
                            <Download className="h-4 w-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Generator form */}
          {showGenerator && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setShowGenerator(false); setSelectedMood(null); setGeneratedNote(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <h3 className="text-lg font-bold text-gray-900">New Voice Note</h3>
              </div>

              {/* Mood selector */}
              {!generatedNote && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    What would you like {persona.name} to say?
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {MOODS.map(mood => (
                      <button
                        key={mood.id}
                        onClick={() => setSelectedMood(mood)}
                        className={`p-4 text-left rounded-2xl border-2 transition-all ${
                          selectedMood?.id === mood.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-100 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-sm font-semibold text-gray-700">{mood.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={generateVoiceNote}
                    disabled={!selectedMood || isGenerating}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        {persona.name} is recording...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Generate Voice Note
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Preview generated note */}
              {generatedNote && (
                <div>
                  <div className="bg-blue-50 rounded-2xl p-6 mb-6 border border-blue-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="h-4 w-4 text-blue-600" fill="currentColor" />
                      <span className="text-sm font-semibold text-blue-800">Preview — {selectedMood?.label}</span>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed italic mb-4">
                      "{generatedNote.transcript}"
                    </p>
                    <button
                      onClick={() => {
                        if (previewAudioRef.current) {
                          previewAudioRef.current.currentTime = 0;
                          previewAudioRef.current.play();
                        }
                      }}
                      className="flex items-center gap-2 text-blue-600 text-sm font-semibold hover:text-blue-700 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      Play again
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setGeneratedNote(null); }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={saveVoiceNote}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Heart className="h-4 w-4" fill="currentColor" />
                      Save to Library
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
