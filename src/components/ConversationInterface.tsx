import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Video, VideoOff, Phone, Settings, Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import toast from 'react-hot-toast';

interface ConversationInterfaceProps {
  persona: any;
  conversationType?: 'chat' | 'video_call' | 'voice_call';
  onEndCall?: () => void;
}

interface Message {
  id: string;
  sender_type: 'user' | 'persona';
  content: string;
  timestamp: string;
  message_type: 'text' | 'audio' | 'video';
}

export function ConversationInterface({
  persona,
  conversationType = 'chat',
  onEndCall
}: ConversationInterfaceProps) {
  const personaId = persona?.id;
  const personaName = persona?.name || 'Persona';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [autoPlayVoice, setAutoPlayVoice] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: speechRecognitionSupported,
    error: speechError
  } = useSpeechRecognition({ continuous: false, interimResults: true });

  const {
    speak,
    stop: stopSpeaking,
    pause: pauseSpeaking,
    resume: resumeSpeaking,
    isSpeaking,
    isPaused,
    isSupported: ttsSupported,
    voices,
    settings: voiceSettings,
    updateSettings: updateVoiceSettings
  } = useTextToSpeech();

  useEffect(() => {
    if (user && personaId) {
      initializeConversation();
      addInitialMessages();
    }
  }, [user, personaId]);

  if (!persona || !personaId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No persona selected</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (speechError) {
      toast.error('Speech recognition error: ' + speechError);
    }
  }, [speechError]);

  useEffect(() => {
    return () => {
      stopAllVoice();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeConversation = async () => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          persona_id: personaId,
          conversation_type: conversationType,
          started_at: new Date().toISOString(),
          metadata: {}
        })
        .select()
        .single();

      if (error) throw error;
      setConversationId(data.id);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const addInitialMessages = () => {
    const initialMessages: Message[] = [
      {
        id: '1',
        sender_type: 'persona',
        content: `Hello! It's so wonderful to see you. I've missed our conversations. How are you feeling today?`,
        timestamp: new Date().toISOString(),
        message_type: 'text'
      }
    ];
    setMessages(initialMessages);
  };

  const generatePersonaResponse = async (userMessage: string): Promise<string> => {
    try {
      // Get persona data from database
      const { data: persona } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      if (!persona) {
        throw new Error('Persona not found');
      }

      // Get recent conversation history for context
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: false })
        .limit(10);

      // Create persona context
      const personaContext = {
        id: persona.id,
        name: persona.name,
        personality_traits: persona.personality_traits || '',
        common_phrases: persona.common_phrases || [],
        relationship: persona.relationship || '',
        memories: [],
        conversationHistory: (recentMessages || []).reverse().map(msg => ({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp
        }))
      };

      // Use AI engine to generate response
      const { AIPersonaEngine } = await import('../lib/ai');
      const aiEngine = new AIPersonaEngine(personaContext);
      
      return await aiEngine.generateResponse(userMessage);
    } catch (error) {
      console.error('Error generating persona response:', error);
      
      // Fallback to basic response
      const fallbackResponses = [
        "I understand how you're feeling. That reminds me of when we used to talk about similar things.",
        "You know, I've been thinking about our memories together. Tell me more about what's on your mind.",
        "I'm here for you, just like I always was. What would you like to talk about?"
      ];
      
      return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversationId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender_type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
      message_type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    resetTranscript();
    setIsTyping(true);

    if (isListening) {
      stopListening();
    }

    if (isSpeaking) {
      stopSpeaking();
    }

    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'user',
        content: messageToSend,
        message_type: 'text',
        metadata: {}
      });

      const aiResponse = await generatePersonaResponse(messageToSend);

      const personaMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender_type: 'persona',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        message_type: 'text'
      };

      setMessages(prev => [...prev, personaMessage]);
      setIsTyping(false);

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'persona',
        content: aiResponse,
        message_type: 'text',
        metadata: {}
      });

      if (autoPlayVoice && ttsSupported) {
        setTimeout(() => {
          speak(aiResponse);
        }, 100);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoiceRecording = () => {
    if (!speechRecognitionSupported) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
      toast.success('Listening... Speak now', { duration: 2000 });
    }
  };

  const toggleVoiceSpeaking = () => {
    if (isSpeaking) {
      if (isPaused) {
        resumeSpeaking();
      } else {
        pauseSpeaking();
      }
    }
  };

  const stopAllVoice = () => {
    if (isListening) {
      stopListening();
    }
    if (isSpeaking) {
      stopSpeaking();
    }
  };

  const endConversation = async () => {
    if (conversationId) {
      try {
        await supabase
          .from('conversations')
          .update({
            ended_at: new Date().toISOString(),
            duration_seconds: Math.floor((Date.now() - Date.parse(messages[0]?.timestamp || '')) / 1000)
          })
          .eq('id', conversationId);
      } catch (error) {
        console.error('Error ending conversation:', error);
      }
    }
    onEndCall?.();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (conversationType === 'video_call') {
    return (
      <div className="h-screen bg-black flex flex-col">
        {/* Video Area */}
        <div className="flex-1 relative">
          {/* Main video (persona) */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-4xl font-bold">{personaName[0]}</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">{personaName}</h2>
              <p className="text-gray-300">Connected</p>
            </div>
          </div>

          {/* Self video */}
          <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg border-2 border-white/20 flex items-center justify-center">
            {isVideoOn ? (
              <div className="text-white text-xs">Your Video</div>
            ) : (
              <VideoOff className="h-6 w-6 text-gray-400" />
            )}
          </div>

          {/* Chat overlay */}
          <div className="absolute bottom-20 left-4 right-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {messages.slice(-3).map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg max-w-xs ${
                    message.sender_type === 'user'
                      ? 'bg-purple-600 text-white ml-auto'
                      : 'bg-white/90 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              ))}
              {isTyping && (
                <div className="bg-white/90 text-gray-900 p-3 rounded-lg max-w-xs">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 bg-black/50 backdrop-blur">
          <div className="flex justify-center items-center space-x-6 mb-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-4 rounded-full transition-colors ${
                isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
            </button>
            
            <button
              onClick={endConversation}
              className="p-4 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
            >
              <Phone className="h-6 w-6 text-white" />
            </button>
            
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`p-4 rounded-full transition-colors ${
                !isVideoOn ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isVideoOn ? <Video className="h-6 w-6 text-white" /> : <VideoOff className="h-6 w-6 text-white" />}
            </button>
          </div>

          {/* Message input */}
          <div className="flex items-center space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-white/20 backdrop-blur text-white placeholder-gray-300 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim()}
              className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Send className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 p-4 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">{personaName[0]}</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{personaName}</h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-sm text-green-600 font-medium">
                  {isSpeaking ? 'Speaking...' : 'Online'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoPlayVoice(!autoPlayVoice)}
              className={`p-2 rounded-lg transition-all ${
                autoPlayVoice
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={autoPlayVoice ? 'Voice responses ON' : 'Voice responses OFF'}
            >
              {autoPlayVoice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className="p-2 hover:bg-white rounded-lg transition-colors"
              title="Voice Settings"
            >
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {showVoiceSettings && (
          <div className="mt-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Voice Settings</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Voice</label>
                <select
                  value={voiceSettings.voice?.name || ''}
                  onChange={(e) => {
                    const selectedVoice = voices.find(v => v.name === e.target.value);
                    if (selectedVoice) {
                      updateVoiceSettings({ voice: selectedVoice });
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Speed: {voiceSettings.rate.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.rate}
                  onChange={(e) => updateVoiceSettings({ rate: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Pitch: {voiceSettings.pitch.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={voiceSettings.pitch}
                  onChange={(e) => updateVoiceSettings({ pitch: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Volume: {Math.round(voiceSettings.volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={voiceSettings.volume}
                  onChange={(e) => updateVoiceSettings({ volume: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.length === 0 && !isTyping && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium mb-2">Start a conversation</p>
              <p className="text-sm">Say hello to {personaName}!</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-sm lg:max-w-md px-5 py-3 rounded-2xl ${
                message.sender_type === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-900 shadow-sm border border-gray-100'
              }`}
            >
              <p className="leading-relaxed">{message.content}</p>
              <p className={`text-xs mt-1.5 ${
                message.sender_type === 'user' ? 'text-blue-100' : 'text-gray-400'
              }`}>
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 shadow-sm border border-gray-100 px-5 py-3 rounded-2xl">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4 rounded-b-2xl">
        {isListening && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="flex space-x-1">
              <div className="w-1 h-6 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-1 h-8 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-1 h-6 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Listening...</p>
              <p className="text-xs text-blue-600">{transcript || 'Speak now'}</p>
            </div>
            <button
              onClick={toggleVoiceRecording}
              className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700"
            >
              Stop
            </button>
          </div>
        )}

        {isSpeaking && (
          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-900">
                  {isPaused ? 'Paused' : 'Speaking...'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleVoiceSpeaking}
                className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="h-4 w-4 text-purple-600" /> : <Pause className="h-4 w-4 text-purple-600" />}
              </button>
              <button
                onClick={stopSpeaking}
                className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                title="Stop"
              >
                <VolumeX className="h-4 w-4 text-red-600" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleVoiceRecording}
            disabled={!speechRecognitionSupported}
            className={`p-3 rounded-full transition-all ${
              isListening
                ? 'bg-red-500 text-white shadow-lg animate-pulse'
                : speechRecognitionSupported
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }`}
            title={
              !speechRecognitionSupported
                ? 'Speech recognition not supported'
                : isListening
                ? 'Stop listening'
                : 'Start voice input'
            }
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? 'Listening...' : `Message ${personaName}...`}
              disabled={isListening}
              className="w-full px-5 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500"
            />
            {transcript && !isListening && (
              <button
                onClick={resetTranscript}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear transcription"
              >
                <VolumeX className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isListening}
            className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            <Send className="h-5 w-5 text-white" />
          </button>
        </div>

        {!speechRecognitionSupported && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            Voice input not supported in this browser. Try Chrome or Edge.
          </p>
        )}
      </div>
    </div>
  );
}