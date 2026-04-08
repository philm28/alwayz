import React, { useState, useRef } from 'react';
import { Mic, StopCircle, Play, Pause, CheckCircle, ChevronRight, ChevronLeft, Heart, Sparkles, X, RotateCcw, Camera, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const LEGACY_QUESTIONS = [
  {
    id: 'wisdom_1',
    category: 'Life Wisdom',
    categoryColor: 'from-amber-500 to-orange-500',
    question: "What's the most important lesson you've learned in your life?",
    prompt: "Take your time. Speak from the heart."
  },
  {
    id: 'wisdom_2',
    category: 'Life Wisdom',
    categoryColor: 'from-amber-500 to-orange-500',
    question: "What advice would you give to someone facing a really hard time?",
    prompt: "Think about what has carried you through difficult moments."
  },
  {
    id: 'family_1',
    category: 'Family Love',
    categoryColor: 'from-pink-500 to-rose-500',
    question: "What do you most want your children or grandchildren to know about you?",
    prompt: "What would you want them to remember?"
  },
  {
    id: 'family_2',
    category: 'Family Love',
    categoryColor: 'from-pink-500 to-rose-500',
    question: "What are you most proud of when you look at your family?",
    prompt: "Speak directly to them if you'd like."
  },
  {
    id: 'family_3',
    category: 'Family Love',
    categoryColor: 'from-pink-500 to-rose-500',
    question: "What do you hope for the people you love most?",
    prompt: "Your wishes, your dreams for them."
  },
  {
    id: 'memories_1',
    category: 'Favorite Memories',
    categoryColor: 'from-blue-500 to-cyan-500',
    question: "What's one of your favorite memories with your family?",
    prompt: "A moment you'd want to relive."
  },
  {
    id: 'memories_2',
    category: 'Favorite Memories',
    categoryColor: 'from-blue-500 to-cyan-500',
    question: "Is there a moment in your life you're most proud of?",
    prompt: "Big or small — it counts."
  },
  {
    id: 'values_1',
    category: 'Values & Beliefs',
    categoryColor: 'from-purple-500 to-violet-500',
    question: "What values have guided your life?",
    prompt: "What principles have you tried to live by?"
  },
  {
    id: 'values_2',
    category: 'Values & Beliefs',
    categoryColor: 'from-purple-500 to-violet-500',
    question: "What do you believe about love?",
    prompt: "What has love meant to you?"
  },
  {
    id: 'future_1',
    category: 'The Future',
    categoryColor: 'from-green-500 to-emerald-500',
    question: "What do you hope the world looks like for your grandchildren?",
    prompt: "Your vision, your hopes."
  },
  {
    id: 'future_2',
    category: 'The Future',
    categoryColor: 'from-green-500 to-emerald-500',
    question: "Is there anything you want to say that you've never said out loud?",
    prompt: "This is your chance. No one has to hear it but them."
  },
  {
    id: 'goodbye_1',
    category: 'A Final Message',
    categoryColor: 'from-slate-500 to-gray-600',
    question: "If you could leave one message for the people you love — what would it be?",
    prompt: "Take all the time you need."
  }
];

interface RecordingState {
  [questionId: string]: {
    transcript: string;
    audioUrl: string;
    audioBlob?: Blob;
    status: 'pending' | 'recording' | 'transcribed' | 'saved';
  };
}

interface RecordYourLegacyProps {
  onClose: () => void;
}

export function RecordYourLegacy({ onClose }: RecordYourLegacyProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'intro' | 'setup' | 'recording' | 'review' | 'complete'>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recordings, setRecordings] = useState<RecordingState>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [personaName, setPersonaName] = useState('');
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [savingStep, setSavingStep] = useState('');

  // ✅ Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentQuestion = LEGACY_QUESTIONS[currentQuestionIndex];
  const currentRecording = recordings[currentQuestion?.id];
  const completedCount = Object.keys(recordings).filter(
    id => recordings[id]?.status === 'transcribed' || recordings[id]?.status === 'saved'
  ).length;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/mp4' });
        await transcribeRecording(blob);
      };

      recorder.start();
      setIsRecording(true);

      setRecordings(prev => ({
        ...prev,
        [currentQuestion.id]: {
          transcript: '',
          audioUrl: '',
          status: 'recording'
        }
      }));

    } catch {
      toast.error('Microphone access required');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const transcribeRecording = async (blob: Blob) => {
    try {
      const audioUrl = URL.createObjectURL(blob);

      const fd = new FormData();
      fd.append('file', blob, 'recording.mp4');
      fd.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` },
        body: fd
      });

      if (!response.ok) throw new Error('Transcription failed');

      const data = await response.json();
      const transcript = data.text || '';

      // ✅ Store blob for later voice cloning
      setRecordings(prev => ({
        ...prev,
        [currentQuestion.id]: {
          transcript,
          audioUrl,
          audioBlob: blob,
          status: 'transcribed'
        }
      }));

      toast.success('Recorded ✓', { duration: 1500 });

    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Could not transcribe. Please try again.');
      setRecordings(prev => ({
        ...prev,
        [currentQuestion.id]: {
          transcript: '',
          audioUrl: '',
          status: 'pending'
        }
      }));
    } finally {
      setIsTranscribing(false);
    }
  };

  const playRecording = () => {
    if (!currentRecording?.audioUrl) return;
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(currentRecording.audioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < LEGACY_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsPlaying(false);
    } else {
      setPhase('review');
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setIsPlaying(false);
    }
  };

  // ✅ Clone voice from all recorded audio blobs combined
  const cloneVoiceFromRecordings = async (personaId: string): Promise<string | null> => {
    try {
      setSavingStep('Cloning your voice...');

      const completedBlobs = Object.values(recordings)
        .filter(r => r.audioBlob && (r.status === 'transcribed' || r.status === 'saved'))
        .map(r => r.audioBlob as Blob);

      if (completedBlobs.length === 0) {
        console.warn('No audio blobs available for voice cloning');
        return null;
      }

      console.log(`✅ Using ${completedBlobs.length} recordings for voice cloning`);

      const formData = new FormData();
      formData.append('name', `Legacy - ${personaName}`);
      formData.append('description', `Self-recorded legacy voice for ${personaName}`);

      // Add all recordings as separate files
      completedBlobs.forEach((blob, i) => {
        formData.append('files', blob, `recording_${i}.mp4`);
      });

      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': import.meta.env.VITE_ELEVENLABS_API_KEY!
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('ElevenLabs error:', err);
        return null;
      }

      const data = await response.json();
      const voiceId = data.voice_id;

      if (voiceId) {
        // Save voice_model_id to persona
        await supabase
          .from('personas')
          .update({ voice_model_id: voiceId })
          .eq('id', personaId);

        console.log(`✅ Voice cloned successfully: ${voiceId}`);
        return voiceId;
      }

      return null;

    } catch (error) {
      console.error('Voice cloning error:', error);
      return null;
    }
  };

  const createPersonaAndSave = async () => {
    if (!user || !personaName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsCreatingPersona(true);

    try {
      setSavingStep('Creating your persona...');

      // ✅ Upload photo first if provided
      let avatarUrl = '';
      if (photoFile) {
        setSavingStep('Uploading your photo...');
        const fileName = `avatars/${user.id}/${Date.now()}.${photoFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage
          .from('persona-content')
          .upload(fileName, photoFile, { contentType: photoFile.type });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('persona-content')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      // Create persona
      const { data: persona, error: personaError } = await supabase
        .from('personas')
        .insert({
          user_id: user.id,
          name: personaName.trim(),
          relationship: 'self',
          gender: 'other',
          description: 'Self-recorded legacy persona',
          status: 'active',
          training_progress: 100,
          is_self_recorded: true,
          self_recorded_by: user.id,
          avatar_url: avatarUrl || null
        })
        .select()
        .single();

      if (personaError) throw personaError;
      setPersonaId(persona.id);

      // ✅ Clone voice from recordings automatically
      const voiceId = await cloneVoiceFromRecordings(persona.id);
      if (voiceId) {
        toast.success('Voice cloned successfully ✓', { duration: 2000 });
      } else {
        toast('Voice cloning skipped — you can add voice samples from the dashboard', {
          icon: 'ℹ️',
          duration: 4000
        });
      }

      // Save all recordings as memories
      setSavingStep('Saving your memories...');
      const completedRecordings = Object.entries(recordings).filter(
        ([_, r]) => r.status === 'transcribed' && r.transcript
      );

      for (const [questionId, recording] of completedRecordings) {
        const question = LEGACY_QUESTIONS.find(q => q.id === questionId);
        if (!question || !recording.transcript) continue;

        // Upload audio to storage
        let audioStorageUrl = '';
        try {
          if (recording.audioBlob) {
            const fileName = `legacy-recordings/${persona.id}/${questionId}.mp4`;
            const { error: uploadError } = await supabase.storage
              .from('persona-content')
              .upload(fileName, recording.audioBlob, { contentType: 'audio/mp4' });

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('persona-content')
                .getPublicUrl(fileName);
              audioStorageUrl = publicUrl;
            }
          }
        } catch {
          console.warn('Could not upload audio for', questionId);
        }

        await supabase.from('legacy_recordings').insert({
          user_id: user.id,
          persona_id: persona.id,
          question_id: questionId,
          question_text: question.question,
          category: question.category,
          transcript: recording.transcript,
          audio_url: audioStorageUrl,
          status: 'saved'
        });

        await supabase.from('persona_memories').insert({
          persona_id: persona.id,
          content: `${question.question}: ${recording.transcript}`,
          memory_type: 'legacy',
          source_type: 'self_recorded',
          importance: 0.98
        });
      }

      setPhase('complete');
      toast.success('Your legacy has been recorded 💙');

    } catch (error) {
      console.error('Error saving legacy:', error);
      toast.error('Could not save. Please try again.');
    } finally {
      setIsCreatingPersona(false);
      setSavingStep('');
    }
  };

  const categories = [...new Set(LEGACY_QUESTIONS.map(q => q.category))];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 z-50 overflow-y-auto">

      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 text-white/40 hover:text-white/70 transition-colors z-10"
      >
        <X className="h-6 w-6" />
      </button>

      {/* ── INTRO ── */}
      {phase === 'intro' && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-2xl w-full text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
              <Mic className="h-12 w-12 text-white" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Record Your Legacy
            </h1>

            <p className="text-xl text-white/70 mb-4 leading-relaxed">
              Answer a series of guided questions in your own voice.
            </p>
            <p className="text-lg text-white/50 mb-12 leading-relaxed max-w-xl mx-auto">
              Your answers become a living record — your family can talk to an AI version of you that knows your stories, your wisdom, and your love. This is your gift to them.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-12">
              {categories.map((cat, i) => {
                const q = LEGACY_QUESTIONS.find(q => q.category === cat);
                return (
                  <div key={i} className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
                    <div className={`w-10 h-10 bg-gradient-to-br ${q?.categoryColor} rounded-xl flex items-center justify-center mb-3`}>
                      <span className="text-white text-lg">
                        {cat === 'Life Wisdom' ? '💡' :
                         cat === 'Family Love' ? '💙' :
                         cat === 'Favorite Memories' ? '📷' :
                         cat === 'Values & Beliefs' ? '⭐' :
                         cat === 'The Future' ? '🌅' : '💌'}
                      </span>
                    </div>
                    <p className="text-white font-semibold text-sm">{cat}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => setPhase('setup')}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-5 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all flex items-center justify-center gap-2"
              >
                <Mic className="h-5 w-5" />
                Begin Recording My Legacy
              </button>
              <p className="text-white/30 text-sm">
                {LEGACY_QUESTIONS.length} questions · Answer as many as you like · Takes about 20 minutes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SETUP ── */}
      {phase === 'setup' && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="h-10 w-10 text-white" fill="currentColor" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">A few things first</h2>
              <p className="text-white/60">So your family knows exactly who they're talking to.</p>
            </div>

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-white/70 text-sm font-semibold mb-2">Your full name *</label>
                <input
                  type="text"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>

              {/* ✅ Photo upload */}
              <div>
                <label className="block text-white/70 text-sm font-semibold mb-2">
                  Your photo
                  <span className="text-white/30 font-normal ml-2">(Optional but recommended)</span>
                </label>

                {photoPreview ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20"
                    />
                    <div>
                      <p className="text-white text-sm font-semibold mb-1">Photo selected ✓</p>
                      <button
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="text-white/40 text-xs hover:text-white/60 transition-colors"
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full bg-white/10 border-2 border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-white/40 hover:bg-white/15 transition-all"
                  >
                    <Camera className="h-8 w-8 text-white/40" />
                    <div className="text-center">
                      <p className="text-white/70 text-sm font-semibold">Upload a photo</p>
                      <p className="text-white/30 text-xs mt-1">This will be shown to your family when they talk to you</p>
                    </div>
                  </button>
                )}

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>

              <div className="bg-white/10 rounded-2xl p-5 border border-white/10">
                <p className="text-white/80 text-sm leading-relaxed">
                  <strong className="text-white">How this works:</strong> You'll answer {LEGACY_QUESTIONS.length} questions by speaking naturally.
                  Your voice recordings will be used to create an AI clone of your voice.
                  Your family can then have conversations with you that feel real.
                </p>
              </div>

              <button
                onClick={() => {
                  if (!personaName.trim()) { toast.error('Please enter your name'); return; }
                  setPhase('recording');
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all flex items-center justify-center gap-2"
              >
                I'm Ready
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORDING ── */}
      {phase === 'recording' && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">

            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/50 text-sm">
                  Question {currentQuestionIndex + 1} of {LEGACY_QUESTIONS.length}
                </span>
                <span className="text-white/50 text-sm">
                  {completedCount} recorded
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-blue-400 to-purple-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${((currentQuestionIndex + 1) / LEGACY_QUESTIONS.length) * 100}%` }}
                />
              </div>
            </div>

            <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${currentQuestion.categoryColor} px-4 py-1.5 rounded-full text-white text-xs font-semibold mb-6`}>
              {currentQuestion.category}
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
              {currentQuestion.question}
            </h2>
            <p className="text-white/40 text-sm mb-10 italic">{currentQuestion.prompt}</p>

            <div className="bg-white/10 backdrop-blur rounded-3xl p-8 border border-white/10 mb-8">
              {!currentRecording || currentRecording.status === 'pending' ? (
                <div className="text-center">
                  <button
                    onClick={startRecording}
                    disabled={isRecording || isTranscribing}
                    className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50"
                  >
                    <Mic className="h-10 w-10 text-white" />
                  </button>
                  <p className="text-white/60 text-sm">Tap to start recording</p>
                </div>
              ) : currentRecording.status === 'recording' || isRecording ? (
                <div className="text-center">
                  <button
                    onClick={stopRecording}
                    className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse hover:scale-105 transition-all"
                  >
                    <StopCircle className="h-10 w-10 text-white" />
                  </button>
                  <p className="text-white text-sm font-semibold">Recording... tap to stop</p>
                  <div className="flex items-center justify-center gap-1 mt-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-400 rounded-full animate-pulse"
                        style={{ height: `${Math.random() * 20 + 8}px`, animationDelay: `${i * 100}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ) : isTranscribing ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
                  <p className="text-white/60 text-sm">Transcribing your answer...</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 text-sm font-semibold">Recorded</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed italic mb-4">
                    "{currentRecording.transcript}"
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={isPlaying ? stopPlayback : playRecording}
                      className="flex items-center gap-2 text-blue-400 text-sm font-semibold hover:text-blue-300 transition-colors"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlaying ? 'Stop' : 'Play back'}
                    </button>
                    <button
                      onClick={() => {
                        setRecordings(prev => ({
                          ...prev,
                          [currentQuestion.id]: { transcript: '', audioUrl: '', status: 'pending' }
                        }));
                      }}
                      className="flex items-center gap-2 text-white/40 text-sm hover:text-white/60 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Re-record
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={prevQuestion}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-5 py-3 bg-white/10 text-white rounded-xl font-semibold text-sm disabled:opacity-30 hover:bg-white/20 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              <button
                onClick={nextQuestion}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {currentQuestionIndex === LEGACY_QUESTIONS.length - 1
                  ? 'Review & Save'
                  : currentRecording?.status === 'transcribed' ? 'Next Question' : 'Skip'
                }
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <p className="text-center text-white/30 text-xs mt-4">
              You can skip any question — answer only what feels right
            </p>
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {phase === 'review' && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">

              {/* ✅ Show photo preview if uploaded */}
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={personaName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white/20 mx-auto mb-4"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
              )}

              <h2 className="text-3xl font-bold text-white mb-2">
                {completedCount} answers recorded
              </h2>
              <p className="text-white/60 mb-2">
                These become the foundation of your AI persona.
              </p>

              {/* ✅ Voice cloning notice */}
              <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
                <Mic className="h-3.5 w-3.5" />
                Your voice will be cloned automatically from your recordings
              </div>
            </div>

            <div className="space-y-3 mb-8">
              {categories.map(category => {
                const categoryQuestions = LEGACY_QUESTIONS.filter(q => q.category === category);
                const answered = categoryQuestions.filter(q => recordings[q.id]?.status === 'transcribed').length;
                const q = categoryQuestions[0];

                return (
                  <div key={category} className="bg-white/10 rounded-2xl p-4 border border-white/10 flex items-center gap-4">
                    <div className={`w-10 h-10 bg-gradient-to-br ${q?.categoryColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-sm">
                        {category === 'Life Wisdom' ? '💡' :
                         category === 'Family Love' ? '💙' :
                         category === 'Favorite Memories' ? '📷' :
                         category === 'Values & Beliefs' ? '⭐' :
                         category === 'The Future' ? '🌅' : '💌'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold text-sm">{category}</p>
                      <p className="text-white/40 text-xs">{answered} of {categoryQuestions.length} answered</p>
                    </div>
                    <div className="flex gap-1">
                      {categoryQuestions.map(q => (
                        <div
                          key={q.id}
                          className={`w-2 h-2 rounded-full ${
                            recordings[q.id]?.status === 'transcribed'
                              ? 'bg-green-400'
                              : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {completedCount === 0 ? (
              <div className="text-center mb-6">
                <p className="text-white/60 mb-4">You haven't recorded any answers yet.</p>
                <button
                  onClick={() => { setCurrentQuestionIndex(0); setPhase('recording'); }}
                  className="text-blue-400 font-semibold hover:text-blue-300 transition-colors"
                >
                  ← Go back and record
                </button>
              </div>
            ) : (
              <button
                onClick={createPersonaAndSave}
                disabled={isCreatingPersona}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-5 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
              >
                {isCreatingPersona ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    {savingStep || 'Saving your legacy...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Save My Legacy
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => { setCurrentQuestionIndex(0); setPhase('recording'); }}
              className="w-full text-white/40 hover:text-white/60 text-sm transition-colors py-2"
            >
              ← Go back and record more
            </button>
          </div>
        </div>
      )}

      {/* ── COMPLETE ── */}
      {phase === 'complete' && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-lg w-full text-center">
            <div className="relative mb-8">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={personaName}
                  className="w-32 h-32 rounded-full object-cover border-4 border-amber-400/50 mx-auto shadow-2xl"
                />
              ) : (
                <div className="w-28 h-28 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                  <Heart className="h-14 w-14 text-white" fill="currentColor" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full border border-amber-400/20 animate-ping" />
              </div>
            </div>

            <h2 className="text-4xl font-bold text-white mb-4">
              Your legacy is saved.
            </h2>

            <p className="text-xl text-white/70 mb-4 leading-relaxed">
              {personaName}, your family will be able to talk to you.
            </p>

            <p className="text-white/50 mb-10 leading-relaxed max-w-md mx-auto">
              Your voice has been cloned from your recordings. Your answers have been saved as memories.
              When the time comes, the people you love will find comfort in knowing
              you're still here — in your own words, in your own voice.
            </p>

            <div className="bg-white/10 rounded-2xl p-6 mb-8 border border-white/10">
              <p className="text-white/60 text-sm leading-relaxed">
                <strong className="text-white">What happens next:</strong> Your persona "{personaName}" now appears in your dashboard with a <span className="text-amber-400">My Legacy</span> badge.
                You can enrich memories and share access with your family when you're ready.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
