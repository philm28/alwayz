import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Video, VideoOff, Phone, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConversationInterfaceProps {
  personaId: string;
  personaName: string;
  conversationType: 'chat' | 'video_call' | 'voice_call';
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
  personaId, 
  personaName, 
  conversationType, 
  onEndCall 
}: ConversationInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializeConversation();
    // Add some initial messages to simulate conversation
    addInitialMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
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
    setInputMessage('');
    setIsTyping(true);

    try {
      // Save user message to database
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'user',
        content: inputMessage,
        message_type: 'text',
        metadata: {}
      });

      // Generate AI response
      const aiResponse = await generatePersonaResponse(inputMessage);
      
      const personaMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender_type: 'persona',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        message_type: 'text'
      };

      setMessages(prev => [...prev, personaMessage]);
      setIsTyping(false);

      // Save persona message to database
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'persona',
        content: aiResponse,
        message_type: 'text',
        metadata: {}
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // In production, implement actual voice recording
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">{personaName[0]}</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{personaName}</h2>
              <p className="text-sm text-green-500">Online</p>
            </div>
          </div>
          <button
            onClick={onEndCall}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Settings className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                message.sender_type === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-900 shadow-sm'
              }`}
            >
              <p>{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.sender_type === 'user' ? 'text-purple-200' : 'text-gray-500'
              }`}>
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 shadow-sm max-w-xs px-4 py-2 rounded-2xl">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleRecording}
            className={`p-2 rounded-full transition-colors ${
              isRecording ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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