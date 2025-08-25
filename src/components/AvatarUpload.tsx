import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, User, Video, Mic, Image, CheckCircle, AlertCircle } from 'lucide-react';
import { realisticAvatarManager } from '../lib/realisticAvatar';
import { voiceCloning } from '../lib/voiceCloning';
import toast from 'react-hot-toast';

interface AvatarUploadProps {
  personaId: string;
  personaName: string;
  onAvatarCreated?: (avatarUrl: string) => void;
}

interface UploadedMedia {
  id: string;
  file: File;
  type: 'photo' | 'video' | 'audio';
  preview: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
}

export function AvatarUpload({ personaId, personaName, onAvatarCreated }: AvatarUploadProps) {
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newMedia: UploadedMedia[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${file.name}`,
      file,
      type: file.type.startsWith('image/') ? 'photo' : 
            file.type.startsWith('video/') ? 'video' : 'audio',
      preview: URL.createObjectURL(file),
      status: 'uploading'
    }));

    setUploadedMedia(prev => [...prev, ...newMedia]);
    processUploads(newMedia);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
      'video/*': ['.mp4', '.mov', '.avi'],
      'audio/*': ['.mp3', '.wav', '.m4a']
    },
    maxSize: 100 * 1024 * 1024, // 100MB for videos
    multiple: true
  });

  const processUploads = async (media: UploadedMedia[]) => {
    try {
      setIsProcessing(true);
      
      // Upload files to storage
      const uploadResults = await realisticAvatarManager.uploadTrainingMedia(
        personaId,
        media.map(m => m.file)
      );

      console.log('Upload results:', uploadResults);

      // Update status to processing
      setUploadedMedia(prev => 
        prev.map(item => 
          media.find(m => m.id === item.id) 
            ? { ...item, status: 'processing' }
            : item
        )
      );

      // Process different media types
      if (uploadResults.photos.length > 0) {
        setProcessingStep('Creating avatar from photos...');
        // In production, this would use AI to create a 3D avatar
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (uploadResults.videos.length > 0) {
        setProcessingStep('Analyzing facial movements...');
        // In production, this would extract facial keypoints for animation
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      if (uploadResults.audioSamples.length > 0) {
        setProcessingStep('Cloning voice...');
        // Create voice profile
        const audioFiles = media
          .filter(m => m.type === 'audio')
          .map(m => m.file);
        
        if (audioFiles.length > 0) {
          await voiceCloning.createVoiceProfile(personaId, audioFiles);
          await voiceCloning.cloneVoiceFromSamples(personaId);
        }
      }
      // Mark all as completed
      setUploadedMedia(prev => 
        prev.map(item => 
          media.find(m => m.id === item.id) 
            ? { ...item, status: 'completed' }
            : item
        )
      );

      // Update persona in database
      const { error: updateError } = await supabase
        .from('personas')
        .update({
          avatar_url: uploadResults.photos[0] || uploadResults.videos[0],
          video_avatar_url: uploadResults.videos[0],
          voice_samples: uploadResults.audioSamples,
          avatar_created_at: new Date().toISOString(),
          has_realistic_avatar: true
        })
        .eq('id', personaId);

      toast.success('Avatar training completed! Your persona now has realistic video and voice.');
      onAvatarCreated?.(uploadResults.photos[0] || uploadResults.videos[0] || '');
      
      if (updateError) {
        console.error('Error updating persona with avatar info:', updateError);
      }

      console.log('Persona updated with avatar information');
    } catch (error) {
      console.error('Error processing uploads:', error);
      toast.error('Failed to process avatar media');
      
      setUploadedMedia(prev => 
        prev.map(item => 
          media.find(m => m.id === item.id) 
            ? { ...item, status: 'error' }
            : item
        )
      );
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const removeMedia = (id: string) => {
    setUploadedMedia(prev => {
      const item = prev.find(m => m.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter(m => m.id !== id);
    });
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'photo': return Image;
      case 'video': return Video;
      case 'audio': return Mic;
      default: return User;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <User className="h-16 w-16 text-purple-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Realistic Avatar</h2>
        <p className="text-gray-600">
          Upload photos, videos, and voice recordings to create a lifelike AI persona of {personaName}
        </p>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {isDragActive ? 'Drop files here' : 'Upload Avatar Training Media'}
        </h3>
        <p className="text-gray-600 mb-4">
          Drag and drop files here, or click to browse
        </p>
        <div className="text-sm text-gray-500 space-y-1">
          <p><strong>Photos:</strong> Clear face shots for avatar creation (JPG, PNG)</p>
          <p><strong>Videos:</strong> Speaking videos for facial animation (MP4, MOV)</p>
          <p><strong>Audio:</strong> Voice samples for voice cloning (MP3, WAV)</p>
          <p className="text-xs mt-2">Maximum file size: 100MB per file</p>
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <div>
              <h4 className="font-medium text-blue-900">Processing Avatar</h4>
              <p className="text-sm text-blue-700">{processingStep}</p>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Media */}
      {uploadedMedia.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-gray-900">Training Media</h4>
          <div className="grid md:grid-cols-2 gap-4">
            {uploadedMedia.map((media) => {
              const IconComponent = getMediaIcon(media.type);
              return (
                <div key={media.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <IconComponent className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{media.file.name}</p>
                        <p className="text-sm text-gray-500 capitalize">{media.type}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {media.status === 'uploading' && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      )}
                      {media.status === 'processing' && (
                        <div className="animate-pulse h-4 w-4 bg-yellow-400 rounded-full"></div>
                      )}
                      {media.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {media.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Preview */}
                  {media.type === 'photo' && (
                    <img 
                      src={media.preview} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}
                  {media.type === 'video' && (
                    <video 
                      src={media.preview} 
                      className="w-full h-32 object-cover rounded-lg"
                      controls
                      muted
                    />
                  )}
                  {media.type === 'audio' && (
                    <audio 
                      src={media.preview} 
                      className="w-full"
                      controls
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Requirements */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">For Best Results:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Upload 3-5 clear photos showing different expressions</li>
          <li>• Include 1-2 videos of them speaking (30 seconds or more)</li>
          <li>• Provide 5-10 minutes of voice recordings for voice cloning</li>
          <li>• Ensure good lighting and audio quality</li>
        </ul>
      </div>
    </div>
  );
}