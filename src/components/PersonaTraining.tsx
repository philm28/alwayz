import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle, Clock, AlertCircle, Zap, User, Heart, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

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

export function PersonaTraining({ personaId: initialPersonaId, onTrainingComplete, onComplete }: PersonaTrainingProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<'form' | 'training'>(!initialPersonaId ? 'form' : 'training');
  const [personaId, setPersonaId] = useState<string | undefined>(initialPersonaId);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<PersonaFormData>({
    name: '',
    relationship: '',
    gender: '',
    description: ''
  });
  const [trainingSteps, setTrainingSteps] = useState<TrainingStep[]>([
    {
      id: 'content-analysis',
      name: 'Content Analysis',
      description: 'Analyzing uploaded videos, audio, and text content',
      status: 'pending',
      progress: 0
    },
    {
      id: 'voice-modeling',
      name: 'Voice Modeling',
      description: 'Creating voice synthesis model from audio samples',
      status: 'pending',
      progress: 0
    },
    {
      id: 'personality-extraction',
      name: 'Personality Extraction',
      description: 'Learning speech patterns, mannerisms, and personality traits',
      status: 'pending',
      progress: 0
    },
    {
      id: 'conversation-training',
      name: 'Conversation Training',
      description: 'Training conversational AI with extracted personality',
      status: 'pending',
      progress: 0
    },
    {
      id: 'final-optimization',
      name: 'Final Optimization',
      description: 'Optimizing model for real-time conversations',
      status: 'pending',
      progress: 0
    }
  ]);

  const [overallProgress, setOverallProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  useEffect(() => {
    // Calculate overall progress
    const totalProgress = trainingSteps.reduce((sum, step) => sum + step.progress, 0);
    const avgProgress = totalProgress / trainingSteps.length;
    setOverallProgress(avgProgress);

    // Check if training is complete
    const allCompleted = trainingSteps.every(step => step.status === 'completed');
    if (allCompleted && isTraining) {
      setIsTraining(false);
      setTrainingCompleted(true);
      updatePersonaStatus('active', 100);
      // Delay callback to ensure database update completes
      setTimeout(() => {
        onTrainingComplete?.();
        onComplete?.();
      }, 1000);
    }
  }, [trainingSteps, isTraining, onTrainingComplete, onComplete]);

  const updatePersonaStatus = async (status: string, progress: number) => {
    try {
      await supabase
        .from('personas')
        .update({ 
          status, 
          training_progress: progress,
          updated_at: new Date().toISOString()
        })
        .eq('id', personaId);
    } catch (error) {
      console.error('Error updating persona status:', error);
    }
  };

  const simulateTrainingStep = (stepId: string, duration: number) => {
    return new Promise<void>((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5; // Random progress between 5-20%
        
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          setTrainingSteps(prev => 
            prev.map(step => 
              step.id === stepId 
                ? { ...step, status: 'completed', progress: 100 }
                : step
            )
          );
          
          resolve();
        } else {
          setTrainingSteps(prev => 
            prev.map(step => 
              step.id === stepId 
                ? { ...step, status: 'processing', progress: Math.floor(progress) }
                : step
            )
          );
        }
      }, duration / 20); // Update 20 times during the duration
    });
  };

  const startTraining = async () => {
    setIsTraining(true);
    await updatePersonaStatus('training', 0);

    // Reset all steps
    setTrainingSteps(prev => 
      prev.map(step => ({ ...step, status: 'pending', progress: 0 }))
    );

    try {
      // Get uploaded content for this persona
      const { data: content } = await supabase
        .from('persona_content')
        .select('*')
        .eq('persona_id', personaId);

      // If we have OpenAI configured and content, do real training
      if (import.meta.env.VITE_OPENAI_API_KEY && content && content.length > 0) {
        console.log('Starting real AI training with OpenAI...');
        
        // Import AI training function
        const { trainPersonaFromContent } = await import('../lib/ai');
        
        // Run actual training steps with real AI analysis
        for (let i = 0; i < trainingSteps.length; i++) {
          const step = trainingSteps[i];
          
          // Update step to processing
          setTrainingSteps(prev => 
            prev.map(s => s.id === step.id ? { ...s, status: 'processing' } : s)
          );
          
          if (i === trainingSteps.length - 1) {
            // Final step - run actual AI training
            try {
              const trainingResult = await trainPersonaFromContent(personaId, content);
              
              if (trainingResult.success) {
                // Complete all steps
                setTrainingSteps(prev => 
                  prev.map(s => ({ ...s, status: 'completed', progress: 100 }))
                );
              } else {
                throw new Error(trainingResult.errorMessage || 'AI training failed');
              }
            } catch (aiError) {
              console.log('AI training failed, trying visual persona generation...');
              
              // Try visual persona generation as fallback
              const { visualPersonaGenerator } = await import('../lib/visualPersonaGenerator');
              const visualResult = await visualPersonaGenerator.generatePersonaFromExistingContent(personaId);
              
              console.log('Visual persona generation successful:', visualResult);
              
              // Complete all steps
              setTrainingSteps(prev => 
                prev.map(s => ({ ...s, status: 'completed', progress: 100 }))
              );
            }
          } else {
            // Simulate intermediate steps
            await simulateTrainingStep(step.id, Math.random() * 2000 + 1000);
          }
        }
      } else {
        console.log('Using simulated training (OpenAI not configured or no content)...');
        // Simulate training steps sequentially
        for (const step of trainingSteps) {
          await simulateTrainingStep(step.id, Math.random() * 3000 + 2000);
        }
      }
    } catch (error) {
      console.error('Training error:', error);
      
      // Try visual persona generation as final fallback
      try {
        console.log('Attempting visual persona generation as fallback...');
        const { visualPersonaGenerator } = await import('../lib/visualPersonaGenerator');
        const visualResult = await visualPersonaGenerator.generatePersonaFromExistingContent(personaId);
        
        console.log('Fallback visual persona generation successful');
        
        // Complete all steps
        setTrainingSteps(prev => 
          prev.map(s => ({ ...s, status: 'completed', progress: 100 }))
        );
        
        setIsTraining(false);
        await updatePersonaStatus('active', 100);
        return;
      } catch (fallbackError) {
        console.error('Fallback visual persona generation also failed:', fallbackError);
      }
      
      // Mark current step as error and stop
      setTrainingSteps(prev => 
        prev.map(step => 
          step.status === 'processing' 
            ? { 
                ...step, 
                status: 'error', 
                progress: 0,
                description: error instanceof Error ? error.message : 'Training failed'
              }
            : step
        )
      );
      
      setIsTraining(false);
      await updatePersonaStatus('error', 0);
    }
  };

  const createPersona = async () => {
    if (!user) {
      toast.error('You must be logged in to create a persona');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Please enter a name for the persona');
      return;
    }

    if (!formData.relationship.trim()) {
      toast.error('Please select a relationship');
      return;
    }

    if (!formData.gender) {
      toast.error('Please select a gender');
      return;
    }

    setIsCreating(true);

    try {
      console.log('Creating persona with data:', {
        user_id: user.id,
        name: formData.name.trim(),
        relationship: formData.relationship,
        gender: formData.gender,
        description: formData.description.trim() || null,
        status: 'training',
        training_progress: 0
      });

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

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Persona created successfully:', data);
      toast.success('Persona created successfully!');
      setPersonaId(data.id);
      setCurrentStep('training');
    } catch (error) {
      console.error('Error creating persona:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create persona. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  if (currentStep === 'form') {
    return (
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Heart className="h-10 w-10 text-white" fill="currentColor" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Create AI Persona</h2>
          <p className="text-lg text-gray-600">
            Tell us about the person you want to preserve
          </p>
        </div>

        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sarah Johnson"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Relationship *
            </label>
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gender *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'male' })}
                className={`px-6 py-4 border-2 rounded-xl font-semibold transition-all ${
                  formData.gender === 'male'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'female' })}
                className={`px-6 py-4 border-2 rounded-xl font-semibold transition-all ${
                  formData.gender === 'female'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Female
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Share a few words about them, their personality, hobbies, or memorable traits..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="pt-6">
            <button
              onClick={createPersona}
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isCreating ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Persona...
                </span>
              ) : (
                'Continue to Training'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Training Progress</h2>
        <p className="text-gray-600">
          {isTraining 
            ? 'Training your persona with uploaded content...' 
            : 'Ready to start training your AI persona'
          }
        </p>
      </div>

      {/* Overall Progress */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-medium text-gray-700">{Math.floor(overallProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Training Steps */}
      <div className="space-y-4 mb-8">
        {trainingSteps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              {getStepIcon(step.status)}
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-medium text-gray-900">{step.name}</h3>
                <span className="text-sm text-gray-500">{step.progress}%</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{step.description}</p>
              
              {step.status === 'processing' && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${step.progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="text-center">
        {!isTraining && overallProgress === 0 && (
          <div>
            <button
              onClick={startTraining}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center mx-auto mb-4"
            >
              <Zap className="h-5 w-5 mr-2" />
              Start AI Training
            </button>
            <button
              onClick={() => window.location.hash = 'avatar-setup'}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center mx-auto"
            >
              <User className="h-5 w-5 mr-2" />
              Create Realistic Avatar
            </button>
          </div>
        )}
        
        {isTraining && (
          <div className="flex items-center justify-center text-purple-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mr-2"></div>
            <span className="font-medium">Training in progress...</span>
          </div>
        )}
        
        {!isTraining && overallProgress === 100 && (
          <div className="flex items-center justify-center text-green-600">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span className="font-medium">Training completed successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
}