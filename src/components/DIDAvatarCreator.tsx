import React, { useState } from 'react';
import { Video, Upload, Loader, CheckCircle, AlertCircle, PlayCircle } from 'lucide-react';
import { didService } from '../lib/didAvatar';
import { voiceCloning } from '../lib/voiceCloning';
import toast from 'react-hot-toast';

interface DIDAvatarCreatorProps {
  personaId: string;
  personaName: string;
  onComplete?: (videoUrl: string) => void;
}

export function DIDAvatarCreator({ personaId, personaName, onComplete }: DIDAvatarCreatorProps) {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [credits, setCredits] = useState<{ remaining: number; total: number } | null>(null);

  React.useEffect(() => {
    loadCredits();
  }, []);

  const loadCredits = async () => {
    try {
      const creditsData = await didService.getCredits();
      setCredits(creditsData);
    } catch (error) {
      console.error('Error loading credits:', error);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setSourceImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      toast.success('Image uploaded successfully');
    }
  };

  const generateTestVideo = async () => {
    if (!sourceImage || !testMessage.trim()) {
      toast.error('Please upload an image and enter a test message');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setGeneratedVideoUrl(null);

    try {
      setProgress(20);
      toast.loading('Creating your talking avatar...', { id: 'did-generation' });

      const videoUrl = await didService.generateTalkingVideoWithText(
        personaId,
        sourceImage,
        testMessage,
        'en-US-JennyNeural'
      );

      setProgress(100);
      setGeneratedVideoUrl(videoUrl);
      toast.success('Avatar video created successfully!', { id: 'did-generation' });

      onComplete?.(videoUrl);
      await loadCredits();
    } catch (error) {
      console.error('Error generating video:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate video',
        { id: 'did-generation' }
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Video className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Create 3D Talking Avatar with D-ID
        </h2>
        <p className="text-gray-600">
          Upload a photo of {personaName} and create a realistic talking avatar
        </p>
      </div>

      {credits && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">D-ID Credits</span>
            <span className="text-lg font-bold text-blue-600">
              {credits.remaining} / {credits.total}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            1. Upload Source Image
          </label>

          {!sourceImage ? (
            <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 block">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Click to upload a photo</p>
              <p className="text-sm text-gray-500">
                Use a clear, front-facing photo for best results
              </p>
            </label>
          ) : (
            <div className="relative">
              <img
                src={sourceImage}
                alt="Source"
                className="w-full h-64 object-cover rounded-xl"
              />
              <button
                onClick={() => {
                  setSourceImage(null);
                  setImageFile(null);
                }}
                className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
              >
                <AlertCircle className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Image Ready</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            2. Enter Test Message
          </label>
          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Enter what your avatar should say..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
          <p className="text-sm text-gray-500 mt-2">
            Example: "Hello! I'm {personaName}. It's great to connect with you today."
          </p>
        </div>

        {isGenerating && (
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="font-medium text-gray-900">
                Generating talking avatar...
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              This may take 30-60 seconds...
            </p>
          </div>
        )}

        {generatedVideoUrl && (
          <div className="bg-green-50 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Video Generated Successfully!</h3>
            </div>

            <video
              src={generatedVideoUrl}
              controls
              className="w-full rounded-lg mb-4"
            />

            <div className="flex gap-3">
              <a
                href={generatedVideoUrl}
                download
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
              >
                Download Video
              </a>
              <button
                onClick={() => setGeneratedVideoUrl(null)}
                className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        )}

        <button
          onClick={generateTestVideo}
          disabled={!sourceImage || !testMessage.trim() || isGenerating}
          className={`w-full py-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
            !sourceImage || !testMessage.trim() || isGenerating
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <PlayCircle className="h-5 w-5" />
              Generate Talking Avatar
            </>
          )}
        </button>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Best Practices
          </h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Use a clear, well-lit front-facing photo</li>
            <li>• Ensure the face is clearly visible without obstructions</li>
            <li>• Keep messages concise (under 500 characters works best)</li>
            <li>• Each video generation uses D-ID credits</li>
            <li>• Videos are combined with your ElevenLabs voice for conversations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
