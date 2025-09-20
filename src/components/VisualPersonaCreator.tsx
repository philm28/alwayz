import React, { useState, useEffect } from 'react';
import { Brain, Eye, Mic, Video, CheckCircle, AlertCircle, Zap, User } from 'lucide-react';
import { visualPersonaGenerator, VisualPersonaResult } from '../lib/visualPersonaGenerator';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface VisualPersonaCreatorProps {
  personaId: string;
  personaName: string;
  onPersonaGenerated?: (result: VisualPersonaResult) => void;
}

export function VisualPersonaCreator({ personaId, personaName, onPersonaGenerated }: VisualPersonaCreatorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VisualPersonaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableContent, setAvailableContent] = useState<{
    images: number;
    videos: number;
    audio: number;
  }>({ images: 0, videos: 0, audio: 0 });

  useEffect(() => {
    checkAvailableContent();
  }, [personaId]);

  const checkAvailableContent = async () => {
    try {
      const { data: content } = await supabase
        .from('persona_content')
        .select('content_type')
        .eq('persona_id', personaId)
        .eq('processing_status', 'completed');

      if (content) {
        const counts = {
          images: content.filter(c => c.content_type === 'image').length,
          videos: content.filter(c => c.content_type === 'video').length,
          audio: content.filter(c => c.content_type === 'audio').length
        };
        setAvailableContent(counts);
      }
    } catch (error) {
      console.error('Error checking available content:', error);
    }
  };

  const generateVisualPersona = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      setGenerationStep('Analyzing visual content...');
      setProgress(20);

      // Generate persona from existing uploaded content
      const personaResult = await visualPersonaGenerator.generatePersonaFromExistingContent(personaId);

      setGenerationStep('Processing voice characteristics...');
      setProgress(50);

      // Simulate processing time for voice analysis
      await new Promise(resolve => setTimeout(resolve, 1500));

      setGenerationStep('Extracting behavioral patterns...');
      setProgress(75);

      // Simulate processing time for mannerism analysis
      await new Promise(resolve => setTimeout(resolve, 1500));

      setGenerationStep('Synthesizing AI persona...');
      setProgress(90);

      // Simulate final synthesis
      await new Promise(resolve => setTimeout(resolve, 1000));

      setProgress(100);
      setResult(personaResult);
      setGenerationStep('Visual persona generation complete!');

      // Update persona status
      await supabase
        .from('personas')
        .update({
          status: 'active',
          training_progress: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', personaId);

      onPersonaGenerated?.(personaResult);
      toast.success(`Visual persona for ${personaName} created successfully!`);

    } catch (error) {
      console.error('Visual persona generation error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      toast.error('Failed to generate visual persona');
    } finally {
      setIsGenerating(false);
    }
  };

  const getContentQualityIndicator = () => {
    const total = availableContent.images + availableContent.videos + availableContent.audio;
    
    if (total === 0) return { quality: 'none', color: 'gray', message: 'No content uploaded' };
    if (total < 3) return { quality: 'basic', color: 'yellow', message: 'Basic quality - upload more content for better results' };
    if (total < 6) return { quality: 'good', color: 'blue', message: 'Good quality - sufficient content for persona creation' };
    return { quality: 'excellent', color: 'green', message: 'Excellent quality - comprehensive content for high-fidelity persona' };
  };

  const contentQuality = getContentQualityIndicator();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Visual AI Persona Generation</h2>
        <p className="text-gray-600">
          Create a lifelike AI persona that matches {personaName}'s appearance, voice, and mannerisms
        </p>
      </div>

      {/* Content Analysis */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Training Content</h3>
        
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Eye className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{availableContent.images}</div>
            <div className="text-sm text-gray-600">Images</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Video className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{availableContent.videos}</div>
            <div className="text-sm text-gray-600">Videos</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Mic className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{availableContent.audio}</div>
            <div className="text-sm text-gray-600">Audio Files</div>
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${
          contentQuality.color === 'green' ? 'bg-green-50 border-green-200' :
          contentQuality.color === 'blue' ? 'bg-blue-50 border-blue-200' :
          contentQuality.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              contentQuality.color === 'green' ? 'bg-green-400' :
              contentQuality.color === 'blue' ? 'bg-blue-400' :
              contentQuality.color === 'yellow' ? 'bg-yellow-400' :
              'bg-gray-400'
            }`}></div>
            <span className={`text-sm font-medium ${
              contentQuality.color === 'green' ? 'text-green-800' :
              contentQuality.color === 'blue' ? 'text-blue-800' :
              contentQuality.color === 'yellow' ? 'text-yellow-800' :
              'text-gray-800'
            }`}>
              {contentQuality.message}
            </span>
          </div>
        </div>
      </div>

      {/* Generation Progress */}
      {isGenerating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <h4 className="font-medium text-blue-900">Generating Visual Persona</h4>
          </div>
          
          <div className="mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-700">{generationStep}</span>
              <span className="text-sm font-medium text-blue-700">{progress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          
          <p className="text-sm text-blue-600">
            This process analyzes your uploaded content to create a comprehensive AI persona...
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800">Generation Failed</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
            <h4 className="font-medium text-green-800">Visual Persona Generated Successfully</h4>
          </div>
          
          <div className="space-y-4">
            <div>
              <h5 className="font-medium text-green-800 mb-2">Extracted Features:</h5>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Visual:</strong> {result.extracted_features.visual}</p>
                <p><strong>Voice:</strong> {result.extracted_features.voice}</p>
                <p><strong>Mannerisms:</strong> {result.extracted_features.mannerisms}</p>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-green-800 mb-2">Synthesized Persona:</h5>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Appearance:</strong> {result.synthesized_persona.appearance}</p>
                <p><strong>Voice Model:</strong> {result.synthesized_persona.voice_model}</p>
                <p><strong>Behavior:</strong> {result.synthesized_persona.behavior_emulation}</p>
              </div>
            </div>
            
            {result.limitations && (
              <div>
                <h5 className="font-medium text-green-800 mb-2">Limitations:</h5>
                <p className="text-sm text-green-700">{result.limitations}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="text-center">
        {availableContent.images === 0 && availableContent.videos === 0 && availableContent.audio === 0 ? (
          <div className="text-gray-500">
            <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="mb-4">Upload images, videos, or audio files first to generate a visual persona</p>
          </div>
        ) : !result && !isGenerating ? (
          <button
            onClick={generateVisualPersona}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center mx-auto"
          >
            <Zap className="h-5 w-5 mr-2" />
            Generate Visual Persona
          </button>
        ) : result ? (
          <div className="flex items-center justify-center text-green-600">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span className="font-medium">Visual persona ready for conversations!</span>
          </div>
        ) : null}
      </div>

      {/* Requirements */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">For Best Visual Persona Results:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Images:</strong> 3-5 clear photos showing different angles and expressions</li>
          <li>• <strong>Videos:</strong> 1-2 videos of them speaking naturally (30+ seconds each)</li>
          <li>• <strong>Audio:</strong> 5-10 minutes of voice recordings for accurate voice cloning</li>
          <li>• <strong>Quality:</strong> Good lighting, clear audio, and minimal background noise</li>
        </ul>
      </div>
    </div>
  );
}