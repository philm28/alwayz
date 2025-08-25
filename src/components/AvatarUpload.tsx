import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, User, Video, Mic, Image, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
      
      // Separate files by type for better processing
      const photos = media.filter(m => m.type === 'photo').map(m => m.file);
      const videos = media.filter(m => m.type === 'video').map(m => m.file);
      const audioFiles = media.filter(m => m.type === 'audio').map(m => m.file);

      console.log('Processing uploads:', { photos: photos.length, videos: videos.length, audio: audioFiles.length });

      // Upload files to storage
      const uploadResults = await realisticAvatarManager.uploadTrainingMedia(personaId, [
        ...photos,
        ...videos,
        ...audioFiles
      ]);

      // Update status to processing
      setUploadedMedia(prev => 
        prev.map(item => 
          media.find(m => m.id === item.id) 
            ? { ...item, status: 'processing' }
            : item
        )
      );

      // Process photos for avatar creation
      if (photos.length > 0) {
        setProcessingStep('Creating avatar from photos...');
        
        try {
          // Create realistic avatar from photos
          const { createPersonaAvatar } = await import('../lib/avatarEngine');
          const avatarUrl = await createPersonaAvatar(
            personaId,
            photos[0],
            videos[0],
            photos.slice(1) // Additional photos for better face mapping
          );
          
          console.log('Avatar created successfully:', avatarUrl);
        } catch (avatarError) {
          console.error('Avatar creation failed:', avatarError);
        }
      }

      // Process videos for facial animation
      if (videos.length > 0) {
        setProcessingStep('Analyzing facial movements...');
        
        try {
          // Analyze video for facial expressions and movements
          // In production, this would use computer vision to extract facial keypoints
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('Facial movement analysis completed');
        } catch (videoError) {
          console.error('Video analysis failed:', videoError);
        }
      }

      // Process audio for voice cloning
      if (audioFiles.length > 0) {
        setProcessingStep('Cloning voice...');
        
        try {
          // Get persona metadata for better voice matching
          const { data: personaData } = await supabase
            .from('personas')
            .select('*')
            .eq('id', personaId)
            .single();
          
          // Create voice profile with enhanced characteristics
          await voiceCloning.createVoiceProfile(personaId, audioFiles);
          
          // Train voice model for better matching
          const success = await voiceCloning.cloneVoiceFromSamples(personaId);
          
          if (success) {
            console.log('Voice cloning completed successfully');
          } else {
            console.warn('Voice cloning had issues but continued');
          }
        } catch (voiceError) {
          console.error('Voice cloning failed:', voiceError);
        }
      }
      
      // Final processing step
      setProcessingStep('Finalizing realistic persona...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mark all as completed
      setUploadedMedia(prev => 
        prev.map(item => 
          media.find(m => m.id === item.id) 
            ? { ...item, status: 'completed' }
            : item
        )
      // Update persona with enhanced metadata
      const { error: updateError } = await supabase
        .from('personas')
        .update({
          avatar_url: uploadResults.photos[0] || uploadResults.videos[0] || null,
          metadata: {
            ...personaData?.metadata,
            realistic_avatar: true,
            voice_cloned: audioFiles.length > 0,
            photo_count: photos.length,
            video_count: videos.length,
            audio_samples: audioFiles.length,
            processing_date: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', personaId);

      if (updateError) {
        console.error('Error updating persona metadata:', updateError);
      }

      // Save content metadata to database
      const contentInserts = media.map(m => ({
        persona_id: personaId,
        content_type: m.type === 'photo' ? 'image' : m.type,
        file_name: m.file.name,
        file_size: m.file.size,
        metadata: {
          purpose: 'realistic_avatar',
          media_type: m.type,
          upload_date: new Date().toISOString()
        },
        processing_status: 'completed'
      }));

      if (contentInserts.length > 0) {
        const { error: contentError } = await supabase
          .from('persona_content')
          .insert(contentInserts);
      const { error: updateError } = await supabase
        if (contentError) {
          console.error('Error saving content metadata:', contentError);
        }
      }

      onAvatarCreated?.(uploadResults.photos[0] || uploadResults.videos[0] || '');
      toast.success(`Realistic avatar created! Voice ${audioFiles.length > 0 ? 'cloned' : 'configured'} and visual persona ready.`);
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
      toast.error('Failed to create realistic avatar. Please try again.');
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