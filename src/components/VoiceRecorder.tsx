import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface VoiceRecorderProps {
  onRecordingsComplete: (recordings: File[]) => Promise<void>;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecordingsComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<File[]>([]);
  const [currentRecordingBlob, setCurrentRecordingBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        setCurrentRecordingBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Recording stopped');
    }
  }, [isRecording]);

  const saveRecording = useCallback(() => {
    if (currentRecordingBlob) {
      const file = new File(
        [currentRecordingBlob],
        `recording_${Date.now()}.webm`,
        { type: 'audio/webm;codecs=opus' }
      );
      setRecordings(prev => [...prev, file]);
      setCurrentRecordingBlob(null);
      toast.success('Recording saved');
    }
  }, [currentRecordingBlob]);

  const discardRecording = useCallback(() => {
    setCurrentRecordingBlob(null);
    toast('Recording discarded', { icon: '🗑️' });
  }, []);

  const removeRecording = useCallback((index: number) => {
    setRecordings(prev => prev.filter((_, i) => i !== index));
    toast('Recording removed', { icon: '🗑️' });
  }, []);

  const handleComplete = async () => {
    if (recordings.length === 0) {
      toast.error('Please record at least one voice sample');
      return;
    }

    setIsProcessing(true);
    try {
      await onRecordingsComplete(recordings);
    } catch (error) {
      console.error('Error processing recordings:', error);
      toast.error('Failed to process recordings');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">Record Voice Samples</h3>

      <p className="text-gray-600 mb-6">
        Record at least 1 minute of clear speech to create your voice clone.
        The more samples you provide, the better the voice quality.
      </p>

      <div className="space-y-6">
        {/* Recording Controls */}
        <div className="flex flex-col items-center space-y-4">
          {!isRecording && !currentRecordingBlob && (
            <button
              onClick={startRecording}
              className="flex items-center justify-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full transition-all transform hover:scale-105 shadow-lg"
            >
              <Mic className="w-6 h-6" />
              <span className="font-semibold">Start Recording</span>
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-900 text-white px-8 py-4 rounded-full transition-all transform hover:scale-105 shadow-lg animate-pulse"
            >
              <Square className="w-6 h-6" />
              <span className="font-semibold">Stop Recording</span>
            </button>
          )}

          {currentRecordingBlob && (
            <div className="flex items-center space-x-4">
              <button
                onClick={saveRecording}
                className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors"
              >
                <Check className="w-5 h-5" />
                <span>Save Recording</span>
              </button>
              <button
                onClick={discardRecording}
                className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <span>Discard</span>
              </button>
            </div>
          )}
        </div>

        {/* Saved Recordings */}
        {recordings.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">
              Saved Recordings ({recordings.length})
            </h4>
            <div className="space-y-2">
              {recordings.map((recording, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white p-3 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Mic className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">Recording {index + 1}</span>
                    <span className="text-sm text-gray-500">
                      {(recording.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    onClick={() => removeRecording(index)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 inline mr-2" />
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={recordings.length === 0 || isProcessing}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-5 h-5 inline mr-2" />
                Complete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
