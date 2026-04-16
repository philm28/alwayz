import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, Video, Music, Image, FileText, X, CheckCircle, AlertCircle, Mic, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { VoiceRecorder } from './VoiceRecorder';

interface FileUploadProps {
  personaId: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export function FileUpload({ personaId, onUploadComplete }: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const [bucketChecked, setBucketChecked] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'memories'>('voice');

  useEffect(() => {
    checkAndCreateBucket();
  }, []);

  const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const isPersonaIdValid = personaId && isValidUUID(personaId);

  const getFileIcon = (type: string) => {
    if (type.startsWith('video/')) return Video;
    if (type.startsWith('audio/')) return Music;
    if (type.startsWith('image/')) return Image;
    if (type.startsWith('text/') || type.includes('document')) return FileText;
    return File;
  };

  const getContentType = (mimeType: string): string => {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('text/') || mimeType.includes('document')) return 'text';
    return 'text';
  };

  const checkAndCreateBucket = async (): Promise<boolean> => {
    try {
      setBucketChecked(false);
      const { error: listError } = await supabase.storage
        .from('persona-content')
        .list('', { limit: 1 });

      if (listError) {
        if (listError.message.includes('not found') || listError.message.includes('does not exist')) {
          setBucketError('Storage bucket "persona-content" not found. Please create it in your Supabase dashboard.');
        } else if (listError.message.includes('permission denied') || listError.message.includes('row-level security')) {
          setBucketError('Storage bucket permissions not configured. Please run the RLS policy setup SQL.');
        } else {
          setBucketError(`Storage configuration error: ${listError.message}`);
        }
        setBucketChecked(true);
        return false;
      }

      setBucketError(null);
      setBucketChecked(true);
      return true;
    } catch (error) {
      setBucketError('Storage configuration error. Please check your Supabase setup.');
      setBucketChecked(true);
      return false;
    }
  };

  const uploadFile = async (file: File, existingFileId?: string): Promise<UploadedFile> => {
    const fileId = existingFileId || `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = fileId;

    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: '',
      status: 'uploading',
      progress: 0
    };

    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size exceeds 50MB limit.');
      }

      if (!personaId || !isValidUUID(personaId)) {
        throw new Error('No valid persona selected.');
      }

      const bucketReady = await checkAndCreateBucket();
      if (!bucketReady) throw new Error('Storage bucket not available');

      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, progress: 10 } : f
      ));

      const { error: uploadError } = await supabase.storage
        .from('persona-content')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('persona-content')
        .getPublicUrl(filePath);

      uploadedFile.url = publicUrl;
      uploadedFile.status = 'processing';
      uploadedFile.progress = 50;

      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, progress: 50, status: 'processing', url: publicUrl } : f
      ));

      let extractedText = '';
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        try {
          extractedText = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string || '');
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
          });
        } catch {
          extractedText = `Text document: ${file.name}`;
        }
      } else if (file.type.startsWith('audio/')) {
        extractedText = `Voice recording: ${file.name}. This audio captures the person's voice, speech patterns, tone, and natural way of speaking.`;
      } else if (file.type.startsWith('video/')) {
        extractedText = `Video recording: ${file.name}. This video captures the person speaking, their mannerisms, expressions, and natural communication style.`;
      } else if (file.type.startsWith('image/')) {
        extractedText = `Photo: ${file.name}. This image shows the person and provides visual context about their appearance and personality.`;
      } else {
        extractedText = `Document: ${file.name}. This file contains content related to the person's life and interests.`;
      }

      const { error: dbError } = await supabase
        .from('persona_content')
        .insert({
          persona_id: personaId,
          content_type: getContentType(file.type),
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          content_text: extractedText,
          metadata: {
            original_name: file.name,
            mime_type: file.type,
            upload_date: new Date().toISOString()
          },
          processing_status: 'processing'
        });

      if (dbError) throw new Error(`Database save failed: ${dbError.message}`);

      uploadedFile.status = 'completed';
      uploadedFile.progress = 100;

      setUploadedFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, progress: 100, status: 'completed' } : f
      ));

      return uploadedFile;
    } catch (error) {
      uploadedFile.status = 'error';
      uploadedFile.progress = 0;
      uploadedFile.error = error instanceof Error ? error.message : 'Upload failed';
      toast.error(`Upload failed: ${uploadedFile.error}`);
      return uploadedFile;
    }
  };

  // ✅ Fixed processVoiceCloning — no redundant save
  const processVoiceCloning = async (audioFiles: File[]) => {
    if (audioFiles.length === 0) return;

    try {
      const { VoiceCloning } = await import('../lib/voiceCloning');
      const voiceCloning = new VoiceCloning();

      console.log(`Starting voice cloning with ${audioFiles.length} samples`);
      const voiceProfile = await voiceCloning.createVoiceProfile(personaId, audioFiles);

      // ✅ voiceCloning.ts already saved the real ID to Supabase
      // No save needed here — just show the right toast
      if (voiceProfile.isCloned) {
        toast.success(`Voice cloned successfully! ✓`, { duration: 4000 });
      } else {
        toast.success(
          `${audioFiles.length} voice sample${audioFiles.length > 1 ? 's' : ''} uploaded. Add more for best results.`,
          { duration: 4000 }
        );
      }
    } catch (error) {
      console.error('Voice cloning error:', error);
      if (error instanceof Error) {
        if (error.message.includes('ELEVENLABS_VALIDATION_ERROR')) {
          toast.error('Audio too short. Please upload at least 1 minute of audio total.', { duration: 6000 });
        } else if (error.message.includes('ELEVENLABS_PERMISSIONS_ERROR')) {
          toast.error('ElevenLabs account needs voice cloning permissions. Check your plan.', { duration: 6000 });
        } else {
          toast.error('Voice cloning failed. Will use standard voice instead.', { duration: 5000 });
        }
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[], isVoice = false) => {
    if (!isPersonaIdValid) {
      toast.error('Please select a persona before uploading files');
      return;
    }

    if (!bucketChecked) await checkAndCreateBucket();

    setIsUploading(true);

    const validFiles = acceptedFiles.filter(file => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum size is 50MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      setIsUploading(false);
      return;
    }

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: '',
      status: 'uploading' as const,
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    try {
      const results = await Promise.all(
        validFiles.map(async (file, index) => {
          const result = await uploadFile(file, newFiles[index].id);
          setUploadedFiles(prev => prev.map(f => f.id === result.id ? result : f));
          return result;
        })
      );

      // ✅ Handle voice cloning for audio/video files
      const voiceFiles = validFiles.filter(f =>
        f.type.startsWith('audio/') || f.type.startsWith('video/')
      );

      if (voiceFiles.length > 0) {
        await processVoiceCloning(voiceFiles);
      }

      onUploadComplete?.(results.filter(r => r.status === 'completed'));
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Some files failed to upload. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [personaId, onUploadComplete, bucketChecked, isPersonaIdValid]);

  // Voice-specific dropzone
  const {
    getRootProps: getVoiceRootProps,
    getInputProps: getVoiceInputProps,
    isDragActive: isVoiceDragActive
  } = useDropzone({
    onDrop: (files) => onDrop(files, true),
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.m4v']
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
    disabled: !!bucketError || !isPersonaIdValid
  });

  // General content dropzone
  const {
    getRootProps: getGeneralRootProps,
    getInputProps: getGeneralInputProps,
    isDragActive: isGeneralDragActive
  } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'text/*': ['.txt', '.md'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
    disabled: !!bucketError || !isPersonaIdValid
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleVoiceRecordingsComplete = async (recordings: File[]) => {
    setShowVoiceRecorder(false);
    if (!isPersonaIdValid) {
      toast.error('Please select a persona before uploading voice samples');
      return;
    }
    await onDrop(recordings, true);
  };

  if (showVoiceRecorder) {
    return (
      <VoiceRecorder
        onRecordingsComplete={handleVoiceRecordingsComplete}
        onCancel={() => setShowVoiceRecorder(false)}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'voice'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🎤 Voice Samples
        </button>
        <button
          onClick={() => setActiveTab('memories')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'memories'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ❤️ Photos & Memories
        </button>
      </div>

      {/* VOICE TAB */}
      {activeTab === 'voice' && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>The more audio the better.</strong> Upload voicemails, video clips, home videos,
              phone recordings — anything with their voice. Even 30 seconds helps.
              3+ minutes gives the best clone quality.
            </p>
          </div>

          {/* Upload existing audio/video */}
          <div
            {...getVoiceRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
              isVoiceDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/50'
            }`}
          >
            <input {...getVoiceInputProps()} />
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Music className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Voice Recordings
            </h3>
            <p className="text-gray-600 mb-2">
              Drag voicemails, videos, or audio files here
            </p>
            <p className="text-sm text-gray-400">
              MP3, WAV, M4A, MP4, MOV — up to 50MB each
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400">or record live</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Record live */}
          <button
            onClick={() => setShowVoiceRecorder(true)}
            disabled={!isPersonaIdValid || !!bucketError}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl hover:border-purple-400 hover:bg-purple-50/50 transition-all duration-300 flex flex-col items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Mic className="h-6 w-6 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Record Voice Now</span>
            <span className="text-sm text-gray-500">3 guided scripts, takes 2-3 minutes</span>
          </button>
        </div>
      )}

      {/* MEMORIES TAB */}
      {activeTab === 'memories' && (
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
            <p className="text-sm text-pink-800 leading-relaxed">
              <strong>Upload photos and documents.</strong> Photos help us show their face
              during conversations. Documents, letters, and notes help the AI understand
              who they were.
            </p>
          </div>

          <div
            {...getGeneralRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
              isGeneralDragActive
                ? 'border-pink-500 bg-pink-50'
                : 'border-pink-200 hover:border-pink-400 hover:bg-pink-50/50'
            }`}
          >
            <input {...getGeneralInputProps()} />
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-8 w-8 text-white" fill="currentColor" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Photos & Documents
            </h3>
            <p className="text-gray-600 mb-2">
              Photos, letters, notes, documents
            </p>
            <p className="text-sm text-gray-400">
              JPG, PNG, PDF, DOC, TXT — up to 50MB each
            </p>
          </div>
        </div>
      )}

      {/* Storage error */}
      {bucketError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-red-800 font-medium">Storage Configuration Required</h4>
              <p className="text-red-700 text-sm mt-1">{bucketError}</p>
              <button
                onClick={checkAndCreateBucket}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">
            Uploaded ({uploadedFiles.filter(f => f.status === 'completed').length} of {uploadedFiles.length} complete)
          </h4>
          {uploadedFiles.map((file) => {
            const IconComponent = getFileIcon(file.type);
            return (
              <div key={file.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <IconComponent className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      {file.error && (
                        <p className="text-xs text-red-600 mt-0.5">{file.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {file.status === 'uploading' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    )}
                    {file.status === 'processing' && (
                      <div className="animate-pulse h-4 w-4 bg-yellow-400 rounded-full" />
                    )}
                    {file.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {(file.status === 'uploading' || file.status === 'processing') && (
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
