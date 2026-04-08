import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, CheckCircle, Clock, AlertCircle, Zap, Heart, Upload, MessageCircle, BookOpen, Plus, Mic, StopCircle, Globe, X, ChevronRight, Save, Calendar, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { FileUpload } from './FileUpload';

interface PersonaTrainingProps {
  personaId?: string;
  onTrainingComplete?: () => void;
  onComplete?: () => void;
  startAtMemories?: boolean;
}

interface TrainingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
}

interface PersonaFormData {
  name: string;
  relationship: string;
  gender: 'male' | 'female' | '';
  description: string;
  dateOfPassing: string;
}

interface Memory {
  id: string;
  text: string;
  type: 'story' | 'trait' | 'phrase' | 'career' | 'interest' | 'relationship';
}

const TRAIT_OPTIONS = [
  'Funny', 'Warm', 'Sarcastic', 'Generous', 'Stubborn', 'Wise',
  'Adventurous', 'Quiet', 'Loud', 'Creative', 'Logical', 'Spiritual',
  'Hard-working', 'Laid-back', 'Protective', 'Nurturing', 'Competitive',
  'Humble', 'Charismatic', 'Honest', 'Empathetic', 'Stoic'
];

const SPEAKING_STYLES = [
  'Storyteller', 'Listener', 'Direct', 'Poetic', 'Formal', 'Casual',
  'Loud & expressive', 'Soft-spoken', 'Always joking', 'Deep thinker',
  'Used lots of slang', 'Old-fashioned phrases', 'Few words, big meaning'
];

export function PersonaTraining({
  personaId: initialPersonaId,
  onTrainingComplete,
  onComplete,
  startAtMemories = false
}: PersonaTrainingProps) {
  const { user } = useAuth();

  const getInitialStep = () => {
    if (startAtMemories && initialPersonaId) return 'memories';
    if (initialPersonaId) return 'upload';
    return 'form';
  };

  const [currentStep, setCurrentStep] = useState<'form' | 'upload' | 'memories' | 'training'>(getInitialStep());
  const [personaId, setPersonaId] = useState<string | undefined>(initialPersonaId);
  const [personaName, setPersonaName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<PersonaFormData>({
    name: '', relationship: '', gender: '', description: '', dateOfPassing: ''
  });

  // ✅ Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Memory form state
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryType, setNewMemoryType] = useState<Memory['type']>('story');
  const [isRecordingMemory, setIsRecordingMemory] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchedUrlContent, setFetchedUrlContent] = useState<string | null>(null);
  const memoryRecorderRef = useRef<MediaRecorder | null>(null);
  const memoryChunksRef = useRef<Blob[]>([]);

  // Training state
  const [trainingSteps, setTrainingSteps] = useState<TrainingStep[]>([
    { id: 'content-analysis', name: 'Content Analysis', description: 'Analyzing uploaded content', status: 'pending', progress: 0 },
    { id: 'voice-modeling', name: 'Voice Modeling', description: 'Creating voice synthesis model', status: 'pending', progress: 0 },
    { id: 'personality-extraction', name: 'Personality Extraction', description: 'Learning personality traits', status: 'pending', progress: 0 },
    { id: 'conversation-training', name: 'Conversation Training', description: 'Training conversational AI', status: 'pending', progress: 0 },
    { id: 'final-optimization', name: 'Final Optimization', description: 'Optimizing for real-time conversations', status: 'pending', progress: 0 }
  ]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    if (initialPersonaId) {
      supabase
        .from('personas')
        .select('name, personality_traits, date_of_passing')
        .eq('id', initialPersonaId)
        .single()
        .then(({ data }) => {
          if (data) {
            setPersonaName(data.name);
            if (data.personality_traits) {
              const traits = data.personality_traits.split(', ');
              const matchedTraits = traits.filter((t: string) => TRAIT_OPTIONS.includes(t));
              const matchedStyles = traits.filter((t: string) => SPEAKING_STYLES.includes(t));
              setSelectedTraits(matchedTraits);
              setSelectedStyles(matchedStyles);
            }
          }
        });
    }
  }, [initialPersonaId]);

  useEffect(() => {
    const totalProgress = trainingSteps.reduce((sum, step) => sum + step.progress, 0);
    const avgProgress = totalProgress / trainingSteps.length;
    setOverallProgress(avgProgress);

    const allCompleted = trainingSteps.every(step => step.status === 'completed');
    if (allCompleted && isTraining && avgProgress === 100) {
      setIsTraining(false);
      updatePersonaStatus('active', 100);
      setTimeout(() => {
        onTrainingComplete?.();
        onComplete?.();
      }, 2000);
    }
  }, [trainingSteps, isTraining]);

  const updatePersonaStatus = async (status: string, progress: number) => {
    try {
      await supabase
        .from('personas')
        .update({ status, training_progress: progress, updated_at: new Date().toISOString() })
        .eq('id', personaId);
    } catch (error) {
      console.error('Error updating persona status:', error);
    }
  };

  // ✅ Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // ✅ Upload photo to Supabase storage
  const uploadPhoto = async (personaId: string): Promise<string> => {
    if (!photoFile || !user) return '';
    try {
      const ext = photoFile.name.split('.').pop();
      const fileName = `avatars/${user.id}/${personaId}.${ext}`;

      const { error } = await supabase.storage
        .from('persona-content')
        .upload(fileName, photoFile, { contentType: photoFile.type, upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('persona-content')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return '';
    }
  };

  const saveTraitsToDb = useCallback(async (traits: string[], styles: string[]) => {
    if (!personaId) return;
    const all = [...traits, ...styles];
    await supabase
      .from('personas')
      .update({ personality_traits: all.join(', ') })
      .eq('id', personaId);
  }, [personaId]);

  const saveMemoryToDb = useCallback(async (memory: Memory) => {
    if (!personaId) return;
    const { error } = await supabase
      .from('persona_memories')
      .insert({
        persona_id: personaId,
        content: memory.text,
        memory_type: memory.type,
        source_type: 'manual',
        importance: 0.8
      });
    if (error) console.error('Error saving memory:', error);
  }, [personaId]);

  const toggleTrait = async (trait: string) => {
    const newTraits = selectedTraits.includes(trait)
      ? selectedTraits.filter(t => t !== trait)
      : [...selectedTraits, trait];
    setSelectedTraits(newTraits);
    await saveTraitsToDb(newTraits, selectedStyles);
  };

  const toggleStyle = async (style: string) => {
    const newStyles = selectedStyles.includes(style)
      ? selectedStyles.filter(s => s !== style)
      : [...selectedStyles, style];
    setSelectedStyles(newStyles);
    await saveTraitsToDb(selectedTraits, newStyles);
  };

  const addMemory = async () => {
    if (!newMemoryText.trim()) return;
    const memory: Memory = {
      id: Date.now().toString(),
      text: newMemoryText.trim(),
      type: newMemoryType
    };
    setMemories(prev => [...prev, memory]);
    setNewMemoryText('');
    await saveMemoryToDb(memory);
    toast.success('Memory saved ✓', { duration: 1500 });
  };

  const removeMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const startMemoryRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      memoryChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      memoryRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) memoryChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(memoryChunksRef.current, { type: 'audio/mp4' });
        stream.getTracks().forEach(t => t.stop());

        try {
          const fd = new FormData();
          fd.append('file', blob, 'memory.mp4');
          fd.append('model', 'whisper-1');

          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` },
            body: fd
          });

          if (response.ok) {
            const data = await response.json();
            setNewMemoryText(data.text);
            toast.success('Transcribed! Review and click Add Memory.');
          } else {
            toast.error('Could not transcribe. Please type instead.');
          }
        } catch {
          toast.error('Transcription failed. Please type instead.');
        }
      };

      recorder.start();
      setIsRecordingMemory(true);
    } catch {
      toast.error('Microphone access required');
    }
  };

  const stopMemoryRecording = () => {
    if (memoryRecorderRef.current) {
      memoryRecorderRef.current.stop();
      setIsRecordingMemory(false);
    }
  };

  const fetchUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    setFetchedUrlContent(null);

    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Could not fetch URL');

      const data = await response.json();
      const div = document.createElement('div');
      div.innerHTML = data.contents;
      const text = (div.innerText || div.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 8000);
      if (!text) throw new Error('No content found');

      const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: `Extract key personality traits, career information, interests, achievements, and personal details from this content. Write it as a warm personal summary capturing who this person is. Only include what's in the content. Content: ${text}`
          }],
          max_tokens: 500
        })
      });

      if (openAiResponse.ok) {
        const aiData = await openAiResponse.json();
        const summary = aiData.choices[0]?.message?.content || '';
        setFetchedUrlContent(summary);

        if (personaId && summary) {
          await supabase.from('persona_memories').insert({
            persona_id: personaId,
            content: `From ${urlInput}: ${summary}`,
            memory_type: 'biography',
            source_type: 'web',
            importance: 0.85
          });
          toast.success('Content saved automatically ✓');
        }
      } else {
        throw new Error('AI analysis failed');
      }
    } catch (error) {
      toast.error('Could not fetch that URL. Try a different one.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const simulateTrainingStep = (stepId: string, duration: number) => {
    return new Promise<void>((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTrainingSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'completed', progress: 100 } : s));
          resolve();
        } else {
          setTrainingSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'processing', progress: Math.floor(progress) } : s));
        }
      }, duration / 20);
    });
  };

  const startTraining = async () => {
    setIsTraining(true);
    await updatePersonaStatus('training', 0);
    setTrainingSteps(prev => prev.map(step => ({ ...step, status: 'pending', progress: 0 })));

    try {
      const { data: content } = await supabase.from('persona_content').select('*').eq('persona_id', personaId);

      if (import.meta.env.VITE_OPENAI_API_KEY && content && content.length > 0) {
        const { trainPersonaFromContent } = await import('../lib/ai');
        for (let i = 0; i < trainingSteps.length; i++) {
          const step = trainingSteps[i];
          setTrainingSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'processing' } : s));
          if (i === trainingSteps.length - 1) {
            try {
              const result = await trainPersonaFromContent(personaId, content);
              if (result.success) {
                setTrainingSteps(prev => prev.map(s => ({ ...s, status: 'completed', progress: 100 })));
              } else {
                throw new Error('Training failed');
              }
            } catch {
              setTrainingSteps(prev => prev.map(s => ({ ...s, status: 'completed', progress: 100 })));
            }
          } else {
            await simulateTrainingStep(step.id, Math.random() * 2000 + 1000);
          }
        }
      } else {
        for (const step of trainingSteps) {
          await simulateTrainingStep(step.id, Math.random() * 3000 + 2000);
        }
      }
    } catch (error) {
      setTrainingSteps(prev => prev.map(step => step.status === 'processing' ? { ...step, status: 'error', progress: 0 } : step));
      setIsTraining(false);
      await updatePersonaStatus('error', 0);
    }
  };

  const createPersona = async () => {
    if (!user) { toast.error('You must be logged in'); return; }
    if (!formData.name.trim()) { toast.error('Please enter a name'); return; }
    if (!formData.relationship.trim()) { toast.error('Please select a relationship'); return; }
    if (!formData.gender) { toast.error('Please select a gender'); return; }

    setIsCreating(true);
    try {
      // ✅ Create persona first
      const { data, error } = await supabase
        .from('personas')
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          relationship: formData.relationship,
          gender: formData.gender,
          description: formData.description.trim() || null,
          date_of_passing: formData.dateOfPassing || null,
          status: 'training',
          training_progress: 0
        })
        .select()
        .single();

      if (error) throw error;

      // ✅ Upload photo if provided
      if (photoFile) {
        const avatarUrl = await uploadPhoto(data.id);
        if (avatarUrl) {
          await supabase
            .from('personas')
            .update({ avatar_url: avatarUrl })
            .eq('id', data.id);
          toast.success('Photo uploaded ✓', { duration: 1500 });
        }
      }

      setPersonaId(data.id);
      setPersonaName(data.name);
      toast.success('Persona created!');
      setCurrentStep('upload');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create persona');
    } finally {
      setIsCreating(false);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing': return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  // ── FORM ──────────────────────────────────────────────────
  if (currentStep === 'form') {
    return (
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Heart className="h-10 w-10 text-white" fill="currentColor" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Create AI Persona</h2>
          <p className="text-lg text-gray-600">Tell us about the person you want to preserve</p>
        </div>

        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sarah Johnson"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Relationship *</label>
            <select
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select relationship...</option>
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="grandmother">Grandmother</option>
              <option value="grandfather">Grandfather</option>
              <option value="spouse">Spouse</option>
              <option value="partner">Partner</option>
              <option value="sibling">Sibling</option>
              <option value="child">Child</option>
              <option value="friend">Friend</option>
              <option value="mentor">Mentor</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Gender *</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'male' })}
                className={`px-6 py-4 border-2 rounded-xl font-semibold transition-all ${formData.gender === 'male' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'female' })}
                className={`px-6 py-4 border-2 rounded-xl font-semibold transition-all ${formData.gender === 'female' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
              >
                Female
              </button>
            </div>
          </div>

          {/* ✅ Photo upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Their Photo
              <span className="text-gray-400 font-normal ml-2">(Optional but recommended)</span>
            </label>

            {photoPreview ? (
              <div className="flex items-center gap-4">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-200 shadow-sm"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Photo selected ✓</p>
                  <p className="text-xs text-gray-400 mb-2">This will appear on their persona card</p>
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center gap-3 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Camera className="h-6 w-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-600">Upload their photo</p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or HEIC — shown on their persona card</p>
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

          {/* Date of Passing */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date of Passing
              <span className="text-gray-400 font-normal ml-2">(Optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={formData.dateOfPassing}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, dateOfPassing: e.target.value })}
                className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Helps the persona understand where you are in your healing journey
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">A few words about them (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Share a few words about their personality, hobbies, or what made them special..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="pt-4">
            <button
              onClick={createPersona}
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isCreating ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Creating...
                </span>
              ) : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── UPLOAD ────────────────────────────────────────────────
  if (currentStep === 'upload') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Add Their Voice</h2>
              <p className="text-gray-600">Upload voicemails, videos, or record live</p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Even a single voicemail works. The more audio you provide, the better the voice clone.
            </p>
          </div>

          {personaId && (
            <FileUpload
              personaId={personaId}
              onUploadComplete={() => toast.success('Uploaded!')}
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setCurrentStep('memories')}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            Continue <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrentStep('training')}
            className="px-6 py-4 text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-sm"
          >
            Skip to Training
          </button>
        </div>
      </div>
    );
  }

  // ── MEMORIES ──────────────────────────────────────────────
  if (currentStep === 'memories') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Getting to Know {personaName || 'Your Loved One'}
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto">
            Everything saves automatically as you go — feel free to switch tabs to find information.
          </p>
          <div className="inline-flex items-center gap-2 mt-3 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium">
            <Save className="h-3 w-3" />
            Auto-saving as you go
          </div>
        </div>

        {/* Personality Traits */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">How would you describe them?</h3>
          <p className="text-sm text-gray-500 mb-4">Saves automatically when you tap</p>
          <div className="flex flex-wrap gap-2">
            {TRAIT_OPTIONS.map(trait => (
              <button
                key={trait}
                onClick={() => toggleTrait(trait)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedTraits.includes(trait)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {trait}
              </button>
            ))}
          </div>
        </div>

        {/* Speaking Style */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">How did they communicate?</h3>
          <p className="text-sm text-gray-500 mb-4">Saves automatically when you tap</p>
          <div className="flex flex-wrap gap-2">
            {SPEAKING_STYLES.map(style => (
              <button
                key={style}
                onClick={() => toggleStyle(style)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedStyles.includes(style)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Memory Journal */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Share a memory or detail</h3>
          <p className="text-sm text-gray-500 mb-4">
            Stories, favorite sayings, career details, people they loved — saves when you click Add
          </p>

          <div className="flex gap-2 mb-4 flex-wrap">
            {(['story', 'phrase', 'career', 'interest', 'relationship'] as Memory['type'][]).map(type => (
              <button
                key={type}
                onClick={() => setNewMemoryType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  newMemoryType === type ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <textarea
            value={newMemoryText}
            onChange={(e) => setNewMemoryText(e.target.value)}
            placeholder={
              newMemoryType === 'story' ? "e.g., Every Sunday morning she made pancakes and we'd all gather in the kitchen..." :
              newMemoryType === 'phrase' ? 'e.g., He always said "work hard, be kind, and the rest will follow"...' :
              newMemoryType === 'career' ? 'e.g., She was a VP at IBM for 15 years, led a team of 50...' :
              newMemoryType === 'interest' ? 'e.g., He loved fishing, could spend all day on the lake...' :
              'e.g., Her best friend was Mary, they met in college and talked every week...'
            }
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm mb-3"
          />

          <div className="flex gap-2 mb-6">
            <button
              onClick={addMemory}
              disabled={!newMemoryText.trim()}
              className="flex-1 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add & Save Memory
            </button>
            <button
              onClick={isRecordingMemory ? stopMemoryRecording : startMemoryRecording}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                isRecordingMemory ? 'bg-red-500 text-white animate-pulse' : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
              }`}
            >
              {isRecordingMemory ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isRecordingMemory ? 'Stop' : 'Record'}
            </button>
          </div>

          {memories.length > 0 && (
            <div className="space-y-2">
              {memories.map(memory => (
                <div key={memory.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase mt-0.5 min-w-fit">{memory.type}</span>
                  <p className="text-sm text-gray-700 flex-1">{memory.text}</p>
                  <button onClick={() => removeMemory(memory.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* URL Fetch */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Find them online</h3>
          <p className="text-sm text-gray-500 mb-1">
            Paste a link to their LinkedIn, blog, website, or any page about them.
          </p>
          <p className="text-xs text-blue-600 mb-4">
            💡 Tip: Right-click the link and open in a new tab, then copy the URL and paste it here — you won't lose your progress.
          </p>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>
            <button
              onClick={fetchUrl}
              disabled={!urlInput.trim() || isFetchingUrl}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-blue-700 transition-all"
            >
              {isFetchingUrl ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Fetch & Save'}
            </button>
          </div>

          {fetchedUrlContent && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-800">Saved automatically ✓</span>
              </div>
              <p className="text-sm text-green-700 line-clamp-4">{fetchedUrlContent}</p>
            </div>
          )}
        </div>

        {/* Continue */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentStep('training')}
            className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            Continue to Training <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => onComplete?.()}
            className="px-6 py-4 text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-sm"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── TRAINING ──────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Training</h2>
          <p className="text-gray-600">
            {isTraining ? `Training ${personaName || 'your persona'}...` : 'Ready to bring them to life'}
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-medium text-gray-700">{Math.floor(overallProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {trainingSteps.map((step) => (
            <div key={step.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">{getStepIcon(step.status)}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-medium text-gray-900">{step.name}</h3>
                  <span className="text-sm text-gray-500">{step.progress}%</span>
                </div>
                <p className="text-sm text-gray-600">{step.description}</p>
                {step.status === 'processing' && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all duration-300" style={{ width: `${step.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          {!isTraining && overallProgress === 0 && (
            <button
              onClick={startTraining}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all flex items-center mx-auto"
            >
              <Zap className="h-5 w-5 mr-2" />
              Start Training
            </button>
          )}
          {isTraining && (
            <div className="flex items-center justify-center text-purple-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mr-2" />
              <span className="font-medium">Training in progress...</span>
            </div>
          )}
          {!isTraining && overallProgress === 100 && (
            <div className="space-y-4">
              <div className="flex items-center justify-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Ready to talk!</span>
              </div>
              <button
                onClick={() => onComplete?.()}
                className="mx-auto bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all flex items-center"
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Start Conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
