import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, PlayCircle, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingsComplete: (recordings: File[]) => void;
  onCancel?: () => void;
}

interface RecordingScript {
  id: number;
  text: string;
  purpose: string;
  duration: string;
}

const RECORDING_SCRIPTS: RecordingScript[] = [
  {
    id: 1,
    text: "Hello! I'm excited to share my thoughts and ideas with you. Communication is such an important part of connecting with others, and I believe that every conversation is an opportunity to learn something new. Whether we're discussing work, hobbies, or just catching up, I always try to bring my authentic self to the table.",
    purpose: "Natural conversational tone and pacing",
    duration: "~15-20 seconds"
  },
  {
    id: 2,
    text: "You know, I've been thinking about this a lot lately. Life has its ups and downs, moments of joy and challenges we need to overcome. But what really matters is how we respond to those situations. I try to stay positive, keep learning, and always look for ways to grow as a person. That's what makes every day interesting and meaningful.",
    purpose: "Emotional range and expression",
    duration: "~15-20 seconds"
  },
  {
    id: 3,
    text: "Let me tell you about something I'm passionate about. When I get excited about a topic, I can't help but dive deep into it. I love asking questions, exploring different perspectives, and really understanding the nuances. Sometimes I speak quickly when I'm enthusiastic, other times I slow down to emphasize an important point. That variety keeps conversations dynamic and engaging.",
    purpose: "Voice dynamics and emphasis patterns",
    duration: "~20-25 seconds"
  }
];

export function VoiceRecorder({ onRecordingsComplete, onCancel }: VoiceRecorderProps) {
  const [currentScript, setCurrentScript] = useState(0);
  const [recordings, setRecordings] = useState<{ [key: number]: Blob | null }>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      streamRef.current = stream;
      setPermissionGranted(true);
      setError(null);
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setError('Microphone access is required to record voice samples. Please allow microphone access and try again.');
      setPermissionGranted(false);
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await requestMicrophonePermission();
      if (!streamRef.current) return;
    }

    try {
      audioChunksRef.current = [];

      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      };

      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordings(prev => ({ ...prev, [currentScript]: audioBlob }));
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Recording error:', err);
      setError('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playRecording = (scriptIndex: number) => {
    const recording = recordings[scriptIndex];
    if (!recording) return;

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    const audio = new Audio(URL.createObjectURL(recording));
    audioPlayerRef.current = audio;

    audio.onended = () => {
      setIsPlaying(null);
      audioPlayerRef.current = null;
    };

    audio.play();
    setIsPlaying(scriptIndex);
  };

  const stopPlaying = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setIsPlaying(null);
    }
  };

  const deleteRecording = (scriptIndex: number) => {
    setRecordings(prev => {
      const newRecordings = { ...prev };
      delete newRecordings[scriptIndex];
      return newRecordings;
    });

    if (isPlaying === scriptIndex) {
      stopPlaying();
    }
  };

  const moveToNextScript = () => {
    if (currentScript < RECORDING_SCRIPTS.length - 1) {
      setCurrentScript(currentScript + 1);
    }
  };

  const moveToPreviousScript = () => {
    if (currentScript > 0) {
      setCurrentScript(currentScript - 1);
    }
  };

  const handleComplete = () => {
    const recordingFiles: File[] = [];

    RECORDING_SCRIPTS.forEach((script) => {
      const recording = recordings[script.id - 1];
      if (recording) {
        const file = new File(
          [recording],
          `voice-sample-${script.id}.webm`,
          { type: 'audio/webm' }
        );
        recordingFiles.push(file);
      }
    });

    if (recordingFiles.length === RECORDING_SCRIPTS.length) {
      onRecordingsComplete(recordingFiles);
    }
  };

  const allRecordingsComplete = RECORDING_SCRIPTS.every((script) =>
    recordings[script.id - 1] !== undefined && recordings[script.id - 1] !== null
  );

  const currentRecordingExists = recordings[currentScript] !== undefined;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!permissionGranted && !error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mic className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Voice Recording Setup</h3>
        <p className="text-gray-600 mb-6">
          To create a high-quality voice clone, we'll need to record 3 short voice samples using optimized scripts.
        </p>
        <button
          onClick={requestMicrophonePermission}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300"
        >
          Enable Microphone
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Microphone Access Required</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={requestMicrophonePermission}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300"
          >
            Try Again
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="bg-gray-200 text-gray-700 px-8 py-3 rounded-full font-semibold hover:bg-gray-300 transition-all duration-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  const script = RECORDING_SCRIPTS[currentScript];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Record Voice Samples</h3>
        <p className="text-gray-600">
          Recording {currentScript + 1} of {RECORDING_SCRIPTS.length}
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        {RECORDING_SCRIPTS.map((s, index) => (
          <div
            key={s.id}
            className={`flex-1 h-2 rounded-full transition-all duration-300 ${
              recordings[index] !== undefined
                ? 'bg-green-500'
                : index === currentScript
                ? 'bg-blue-500'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
            {script.id}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-1">{script.purpose}</h4>
            <p className="text-sm text-gray-600">Target duration: {script.duration}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border-l-4 border-blue-600">
          <p className="text-gray-800 leading-relaxed text-lg">
            "{script.text}"
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isRecording ? (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-semibold text-gray-900">Recording...</span>
              </>
            ) : currentRecordingExists ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-gray-900">Recording Complete</span>
              </>
            ) : (
              <span className="font-semibold text-gray-600">Ready to Record</span>
            )}
          </div>

          {isRecording && (
            <span className="text-2xl font-mono font-bold text-gray-900">
              {formatTime(recordingTime)}
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {!isRecording && !currentRecordingExists && (
            <button
              onClick={startRecording}
              className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <StopCircle className="h-5 w-5" />
              Stop Recording
            </button>
          )}

          {!isRecording && currentRecordingExists && (
            <>
              <button
                onClick={() => isPlaying === currentScript ? stopPlaying() : playRecording(currentScript)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
              >
                <PlayCircle className="h-5 w-5" />
                {isPlaying === currentScript ? 'Stop Playback' : 'Play Recording'}
              </button>

              <button
                onClick={() => deleteRecording(currentScript)}
                className="px-6 bg-red-100 text-red-600 py-3 rounded-lg font-semibold hover:bg-red-200 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-5 w-5" />
                Re-record
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h5 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Recording Tips
        </h5>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Find a quiet environment with minimal background noise</li>
          <li>• Speak naturally at your normal pace and volume</li>
          <li>• Maintain consistent distance from your microphone</li>
          <li>• Read with emotion and natural inflection</li>
          <li>• Each recording should be 15-25 seconds long</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          onClick={moveToPreviousScript}
          disabled={currentScript === 0}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            currentScript === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Previous
        </button>

        {currentScript < RECORDING_SCRIPTS.length - 1 ? (
          <button
            onClick={moveToNextScript}
            disabled={!currentRecordingExists}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
              currentRecordingExists
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Next Recording
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={!allRecordingsComplete}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
              allRecordingsComplete
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Complete Voice Setup
          </button>
        )}

        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all duration-300"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
