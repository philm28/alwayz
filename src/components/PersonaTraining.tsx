import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle, Clock, AlertCircle, Zap, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PersonaTrainingProps {
  personaId: string;
  onTrainingComplete?: () => void;
}

interface TrainingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
}

export function PersonaTraining({ personaId, onTrainingComplete }: PersonaTrainingProps) {
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

  useEffect(() => {
    // Calculate overall progress
    const totalProgress = trainingSteps.reduce((sum, step) => sum + step.progress, 0);
    const avgProgress = totalProgress / trainingSteps.length;
    setOverallProgress(avgProgress);

    // Check if training is complete
    const allCompleted = trainingSteps.every(step => step.status === 'completed');
    if (allCompleted && isTraining) {
      setIsTraining(false);
      updatePersonaStatus('active', 100);
      onTrainingComplete?.();
    }
  }, [trainingSteps, isTraining, onTrainingComplete]);

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
            const trainingResult = await trainPersonaFromContent(personaId, content);
            
            if (trainingResult.success) {
              // Complete all steps
              setTrainingSteps(prev => 
                prev.map(s => ({ ...s, status: 'completed', progress: 100 }))
              );
            } else {
              throw new Error(trainingResult.errorMessage || 'AI training failed');
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