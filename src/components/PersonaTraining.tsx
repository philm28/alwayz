import React, { useState, useEffect, useRef } from 'react';
import { Brain, CheckCircle, Clock, AlertCircle, Zap, User, Heart, Upload, Share2, MessageCircle, BookOpen, Plus, Mic, StopCircle, Globe, X, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { FileUpload } from './FileUpload';
import { SocialMediaImport } from './SocialMediaImport';

interface PersonaTrainingProps {
  personaId?: string;
  onTrainingComplete?: () => void;
  onComplete?: () => void;
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

export function PersonaTraining({ personaId: initialPersonaId, onTrainingComplete, onComplete }: PersonaTrainingProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<'form' | 'upload' | 'memories' | 'training'>(!initialPersonaId ? 'form' : 'upload');
  const [personaId, setPersonaId] = useState<string | undefined>(initialPersonaId);
  const [personaName, setPersonaName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<PersonaFormData>({
    name: '',
    relationship: '',
    gender: '',
    description: ''
  });

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
  const [isSavingMemories, setIsSavingMemories] = useState(false);
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
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  useEffect(() => {
    const totalProgress = trainingSteps.reduce((sum, step) => sum + step.progress, 0);
    const avgProgress = totalProgress / trainingSteps.length;
    setOverallProgress(avgProgress);

    const allCompleted = trainingSteps.every(step => step.status === 'completed');
    if (allCompleted && isTraining && avgProgress === 100) {
      setIsTraining(false);
      setTrainingCompleted(true);
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

  const simulateTrainingStep = (stepId: string, duration: number) => {
    return new Promise<void>((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTrainingSteps(prev => prev.map(step => step.id === stepId ? { ...step, status: 'completed', progress: 100 } : step));
          resolve();
        } else {
          setTrainingSteps(prev => prev.map(step => step.id === stepId ? { ...step, status: 'processing', progress: Math.floor(progress) } : step));
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
              const trainingResult = await trainPersonaFromContent(personaId, content);
              if (trainingResult.success) {
                setTrainingSteps(prev => prev.map(s => ({ ...s, status: 'completed', progress: 100 })));
              } else {
                throw new Error(trainingResult.errorMessage || 'AI training failed');
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
      console.error('Training error:', error);
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
      const { data, error } = await supabase
        .from('personas')
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          relationship: formData.relationship,
          gender: formData.gender,
          description: formData.description.trim() || null,
          status: 'training',
          training_progress: 0
        })
        .select()
        .single();

      if (error) throw error;

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

  const toggleTrait = (trait: string) => {
    setSelectedTraits(prev =>
      prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]
    );
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const addMemory = () => {
    if (!newMemoryText.trim()) return;
    setMemories(prev => [...prev, {
      id: Date.now().toString(),
      text: newMemoryText.trim(),
      type: newMemoryType
    }]);
    setNewMemoryText('');
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

        // Transcribe with OpenAI Whisper
        try {
          const formData = new FormData();
          formData.append('file', blob, 'memory.mp4');
          formData.append('model', 'whisper-1');

          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` },
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            setNewMemoryText(data.text);
            toast.success('Voice recorded and transcribed!');
          } else {
            toast.error('Could not transcribe. Please type the memory instead.');
          }
        } catch {
          toast.error('Transcription failed. Please type the memory instead.');
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
      // Use a CORS proxy to fetch the URL content
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) throw new Error('Could not fetch URL');

      const data = await response.json();
      const html = data.contents;

      // Strip HTML tags to get plain text
      const div = document.createElement('div');
      div.innerHTML = html;
      const text = div.innerText || div.textContent || '';
      const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 8000);

      if (!cleanText) throw new Error('No content found');

      // Use OpenAI to extract personality insights
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
            content: `Extract key personality traits, career information, interests, achievements, and personal details from this content. Write it as a warm, personal summary that captures who this person is. Be specific and factual — only include what's actually in the content. Content: ${cleanText}`
          }],
          max_tokens: 500
        })
      });

      if (openAiResponse.ok) {
        const aiData = await openAiResponse.json();
        const summary = aiData.choices[0]?.message?.content || '';
        setFetchedUrlContent(summary);
        toast.success('Content extracted successfully!');
      } else {
        throw new Error('AI analysis failed');
      }
    } catch (error) {
      toast.error('Could not fetch that URL. Try a different one or paste the text manually.');
      console.error('URL fetch error:', error);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const saveMemoriesAndContinue = async () => {
    setIsSavingMemories(true);

    try {
      const memoryEntries = [];

      // Save personality traits
      if (selectedTraits.length > 0) {
        memoryEntries.push({
          persona_id: personaId,
          content: `Personality traits: ${selectedTraits.join(', ')}`,
          memory_type: 'personality',
          source_type: 'manual',
          importance: 0.9
        });
      }

      // Save speaking styles
      if (selectedStyles.length > 0) {
        memoryEntries.push({
          persona_id: personaId,
          content: `Communication style: ${selectedStyles.join(', ')}`,
          memory_type: 'personality',
          source_type: 'manual',
          importance: 0.9
        });
      }

      // Save individual memories
      for (const memory of memories) {
        memoryEntries.push({
          persona_id: personaId,
          content: memory.text,
          memory_type: memory.type,
          source_type: 'manual',
          importance: 0.8
        });
      }

      // Save URL content if any
      if (fetchedUrlContent) {
        memoryEntries.push({
          persona_id: personaId,
          content: fetchedUrlContent,
          memory_type: 'biography',
          source_type: 'web',
          importance: 0.85
        });
      }

      // Save all to Supabase
      if (memoryEntries.length > 0) {
        const { error } = await supabase
          .from('persona_memories')
          .insert(memoryEntries);

        if (error) throw error;
      }

      // Also update persona description with traits
      if (selectedTraits.length > 0 || selectedStyles.length > 0) {
        await supabase
          .from('personas')
          .update({
            personality_traits: [...selectedTraits, ...selectedStyles].join(', ')
          })
          .eq('id', personaId);
      }

      toast.success(memoryEntries.length > 0
        ? `${memoryEntries.length} memories saved!`
        : 'Moving to training...'
      );

      setCurrentStep('training');
    } catch (error) {
      console.error('Error saving memories:', error);
      toast.error('Could not save memories. Moving to training anyway.');
      setCurrentStep('training');
    } finally {
      setIsSavingMemories(false);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing': return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  // ── FORM STEP ──────────────────────────────────────────────
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
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating...
                </span>
              ) : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── UPLOAD STEP ────────────────────────────────────────────
  if (currentStep === 'upload') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Add Their Voice</h2>
              <p className="text-gray-600">Upload voicemails, videos, or record live — this is the most important step</p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Even a single voicemail or short video clip is enough to get started.
              The more audio you provide, the more accurate the voice clone will be.
            </p>
          </div>

          {personaId && (
            <FileUpload
              personaId={personaId}
              onUploadComplete={() => toast.success('Uploaded successfully!')}
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setCurrentStep('memories')}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            Continue
            <ChevronRight className="h-5 w-5" />
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

  // ── MEMORIES STEP ──────────────────────────────────────────
  if (currentStep === 'memories') {
    return (
      <div className="space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Getting to Know {personaName || 'Your Loved One'}
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto">
            The more you share, the more {personaName || 'they'} will feel like themselves.
            Everything here is optional — share what feels right.
          </p>
        </div>

        {/* Personality Traits */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-2">How would you describe them?</h3>
          <p className="text-sm text-gray-500 mb-4">Select all that apply</p>
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
          <h3 className="text-lg font-bold text-gray-900 mb-2">How did they communicate?</h3>
          <p className="text-sm text-gray-500 mb-4">Select all that apply</p>
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
          <h3 className="text-lg font-bold text-gray-900 mb-2">Share a memory or detail</h3>
          <p className="text-sm text-gray-500 mb-4">
            Stories, favorite sayings, career details, people they loved — anything that captures who they were
          </p>

          {/* Memory type selector */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['story', 'phrase', 'career', 'interest', 'relationship'] as Memory['type'][]).map(type => (
              <button
                key={type}
                onClick={() => setNewMemoryType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  newMemoryType === type
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Text input */}
          <div className="flex gap-2 mb-3">
            <textarea
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder={
                newMemoryType === 'story' ? 'e.g., Every Sunday morning she made pancakes and we\'d all gather in the kitchen...' :
                newMemoryType === 'phrase' ? 'e.g., He always said "work hard, be kind, and the rest will follow"...' :
                newMemoryType === 'career' ? 'e.g., She was a VP at IBM for 15 years, led a team of 50...' :
                newMemoryType === 'interest' ? 'e.g., He loved fishing, could spend all day on the lake...' :
                'e.g., Her best friend was Mary, they met in college and talked every week...'
              }
              rows={3}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
            />
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={addMemory}
              disabled={!newMemoryText.trim()}
              className="flex-1 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Memory
            </button>
            <button
              onClick={isRecordingMemory ? stopMemoryRecording : startMemoryRecording}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                isRecordingMemory
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
              }`}
            >
              {isRecordingMemory ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isRecordingMemory ? 'Stop' : 'Record'}
            </button>
          </div>

          {/* Saved memories */}
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
          <h3 className="text-lg font-bold text-gray-900 mb-2">Find them online</h3>
          <p className="text-sm text-gray-500 mb-4">
            Paste a link to their LinkedIn, blog, website, or any page about them.
            We'll extract what we can automatically.
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
              {isFetchingUrl ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : 'Fetch'}
            </button>
          </div>

          {fetchedUrlContent && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-800">Content extracted successfully</span>
              </div>
              <p className="text-sm text-green-700 line-clamp-4">{fetchedUrlContent}</p>
            </div>
          )}
        </div>

        {/* Continue buttons */}
        <div className="flex gap-3">
          <button
            onClick={saveMemoriesAndContinue}
            disabled={isSavingMemories}
            className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {isSavingMemories ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Saving...
              </>
            ) : (
              <>
                Save & Continue
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
          <button
            onClick={() => setCurrentStep('training')}
            className="px-6 py-4 text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-sm"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // ── TRAINING STEP ──────────────────────────────────────────
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
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center mx-auto"
            >
              <Zap className="h-5 w-5 mr-2" />
              Start Training
            </button>
          )}

          {isTraining && (
            <div className="flex items-center justify-center text-purple-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mr-2"></div>
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
                className="mx-auto bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center"
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
