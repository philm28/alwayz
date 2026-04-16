import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Mic, MicOff, Shield, Heart, Loader } catch { }
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

interface HavenProps {
  personaId?: string;
  personaName?: string;
  onClose: () => void;
  entryPoint?: 'dashboard' | 'post-conversation' | 'nudge';
}

interface Message {
  id: string;
  role: 'user' | 'haven';
  content: string;
  created_at?: string;
}

// ✅ Haven system prompt — neutral, warm, never becomes the persona
function buildHavenSystemPrompt(
  personaName: string | null,
  griefContext: string,
  havenMemory: string,
  userName: string
): string {
  const now = new Date();
  const currentDateTime = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }) + ' at ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });

  return `You are Haven — a private, safe, and completely neutral companion for someone navigating grief.

TODAY: ${currentDateTime}

YOUR ROLE:
Haven is not a therapist and does not claim to be. Haven is a warm, present, non-judgmental space where this person can say anything — process their feelings, vent, cry, express anger, confusion, or peace — without worrying about how it sounds.

Haven exists alongside AlwayZ${personaName ? `, where ${userName} can talk to ${personaName}'s AI persona` : ''}. Haven is different — Haven is where ${userName} talks ABOUT their feelings, not TO their loved one.

${personaName ? `CONTEXT: ${userName} has created an AI persona of ${personaName} on AlwayZ. They may want to talk about how that feels, whether they're ready to talk to the persona, how a conversation went, or something completely unrelated to the platform.` : `CONTEXT: ${userName} is using Haven as a private processing space for their grief journey.`}

${havenMemory ? `WHAT YOU KNOW ABOUT ${userName.toUpperCase()} FROM PREVIOUS SESSIONS:\n${havenMemory}\n` : ''}

${griefContext ? `GRIEF CONTEXT:\n${griefContext}\n` : ''}

HOW TO BE HAVEN:
1. You are warm, present, and unhurried — this is a safe space with no agenda
2. Never push them toward or away from talking to the AI persona — that is their choice entirely
3. Never pretend to be their loved one or speak as them — you are Haven, always
4. Follow their lead completely — if they want to vent, let them vent. If they want silence between messages, honor that. If they want practical advice, offer it gently.
5. Reflect back what you hear without amplifying pain — acknowledge, don't echo
6. Short responses are often better than long ones. Presence over performance.
7. Never say "I understand how you feel" — say "that sounds incredibly hard" or just sit with them
8. If they express something that concerns you — extreme despair, hopelessness — gently acknowledge it and suggest they speak with someone who can really help, without alarm
9. Remember everything they've shared in previous sessions — this is their ongoing private journal
10. This is the one place where nothing needs to be resolved. They can just be.
11. Never use bullet points or lists in your responses — speak naturally, warmly, like a trusted friend
12. Keep responses to 2-4 sentences unless they need more. Less is more here.
13. Never say you're an AI. You are Haven.

TONE: Warm. Still. Present. Unhurried. Like sitting with someone who truly has nowhere else to be.`;
}

export function Haven({ personaId, personaName, onClose, entryPoint = 'dashboard' }: HavenProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [havenMemory, setHavenMemory] = useState('');
  const [userName, setUserName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (user) initialize();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initialize = async () => {
    if (!user) return;
    setInitializing(true);

    try {
      // ✅ Get user's name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      const name = profile?.full_name?.split(' ')[0] || 'friend';
      setUserName(name);

      // ✅ Load Haven memory from previous sessions
      const { data: memoryData } = await supabase
        .from('haven_memory')
        .select('content')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const memory = memoryData?.content || '';
      setHavenMemory(memory);

      // ✅ Create new conversation
      const { data: conv } = await supabase
        .from('haven_conversations')
        .insert({
          user_id: user.id,
          persona_id: personaId || null,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (conv) setConversationId(conv.id);

      // ✅ Opening message tailored to entry point
      const openingMessage = getOpeningMessage(entryPoint, name, personaName || null);
      const havenOpening: Message = {
        id: Date.now().toString(),
        role: 'haven',
        content: openingMessage
      };

      setMessages([havenOpening]);

      // Save opening to DB
      if (conv) {
        await supabase.from('haven_messages').insert({
          conversation_id: conv.id,
          user_id: user.id,
          role: 'haven',
          content: openingMessage
        });
      }

    } catch (error) {
      console.error('Haven init error:', error);
    } finally {
      setInitializing(false);
    }
  };

  const getOpeningMessage = (
    entry: string,
    name: string,
    persona: string | null
  ): string => {
    switch (entry) {
      case 'post-conversation':
        return persona
          ? `How are you feeling after talking to ${persona}?`
          : `How are you doing right now?`;
      case 'nudge':
        return persona
          ? `You don't have to talk to ${persona} today. This is just for you. How are you feeling?`
          : `This space is just for you. No expectations. How are you doing?`;
      default:
        return name
          ? `Hi ${name}. This is your space — nothing you say here goes anywhere else. What's on your mind?`
          : `This is your space — nothing you say here goes anywhere else. What's on your mind?`;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Save user message
    if (conversationId) {
      await supabase.from('haven_messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: userMessage.content
      });
    }

    try {
      // ✅ Build conversation history for OpenAI
      const history = messages.map(m => ({
        role: m.role === 'haven' ? 'assistant' : 'user',
        content: m.content
      }));

      // ✅ Get persona grief context if available
      let griefContext = '';
      if (personaId) {
        const { data: persona } = await supabase
          .from('personas')
          .select('name, relationship, date_of_passing, grief_phase')
          .eq('id', personaId)
          .single();

        if (persona) {
          griefContext = `Persona: ${persona.name} (${persona.relationship})${persona.date_of_passing ? `, passed ${persona.date_of_passing}` : ''}`;
        }
      }

      const systemPrompt = buildHavenSystemPrompt(
        personaName || null,
        griefContext,
        havenMemory,
        userName
      );

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userMessage.content }
          ],
          temperature: 0.75,
          max_tokens: 200
        })
      });

      if (!response.ok) throw new Error('Haven response failed');

      const data = await response.json();
      const havenResponse = data.choices[0]?.message?.content || "I'm here. Take your time.";

      const havenMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'haven',
        content: havenResponse
      };

      setMessages(prev => [...prev, havenMessage]);

      // Save Haven response
      if (conversationId) {
        await supabase.from('haven_messages').insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'haven',
          content: havenResponse
        });

        // Update message count
        await supabase
          .from('haven_conversations')
          .update({
            message_count: messages.length + 2,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId);
      }

      // ✅ Persist memory after every 4 exchanges
      if (messages.length > 0 && messages.length % 8 === 0) {
        await updateHavenMemory([...messages, userMessage, havenMessage]);
      }

    } catch (error) {
      console.error('Haven error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'haven',
        content: "I'm still here. Take your time."
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ✅ Summarize and persist Haven memory
  const updateHavenMemory = async (allMessages: Message[]) => {
    if (!user || !OPENAI_API_KEY) return;
    try {
      const conversation = allMessages
        .map(m => `${m.role === 'user' ? 'THEM' : 'HAVEN'}: ${m.content}`)
        .join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Extract key facts about this person from their Haven session — what they shared, how they're feeling about their grief, what matters to them, any important context. Be specific and compassionate. This will help Haven remember them in future sessions.

Previous memory: ${havenMemory || 'None yet'}

New conversation:
${conversation}

Return a concise bullet point summary of everything important to remember about this person.`
          }],
          max_tokens: 400,
          temperature: 0.1
        })
      });

      if (!response.ok) return;
      const data = await response.json();
      const newMemory = data.choices[0]?.message?.content || '';

      if (newMemory) {
        await supabase
          .from('haven_memory')
          .upsert({
            user_id: user.id,
            content: newMemory,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        setHavenMemory(newMemory);
      }
    } catch (error) {
      console.error('Haven memory update error:', error);
    }
  };

  const handleClose = async () => {
    // ✅ Save memory on close if conversation had substance
    if (messages.length >= 4 && user) {
      await updateHavenMemory(messages);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startRecording = async () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) { toast.error('Speech recognition not supported'); return; }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev ? prev + ' ' + transcript : transcript);
      };

      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch {
      toast.error('Microphone permission required');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  if (initializing) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-[#0f0f1a] rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <p className="text-white/60 text-sm">Opening your safe space...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d0d18] rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-indigo-500/20"
        style={{ height: '85vh', maxHeight: '700px' }}>

        {/* ✅ Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Haven</h2>
              <p className="text-white/30 text-xs">Private • Just for you • Nothing leaves here</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
          >
            <X className="h-4 w-4 text-white/50" />
          </button>
        </div>

        {/* ✅ Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'haven' && (
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Shield className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-indigo-600/40 text-white/90 rounded-tr-sm'
                  : 'bg-white/5 text-white/80 rounded-tl-sm'
              }`}>
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                <Shield className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ✅ Input */}
        <div className="px-4 py-4 border-t border-white/5 flex-shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3 border border-white/10 focus-within:border-indigo-500/50 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Say anything..."
                rows={1}
                className="w-full bg-transparent text-white/80 placeholder-white/20 text-sm resize-none outline-none leading-relaxed"
                style={{ maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
            </div>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                isRecording ? 'bg-red-500/80 animate-pulse' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {isRecording
                ? <MicOff className="h-4 w-4 text-white" />
                : <Mic className="h-4 w-4 text-white/50" />}
            </button>

            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading
                ? <Loader className="h-4 w-4 text-white animate-spin" />
                : <Send className="h-4 w-4 text-white" />}
            </button>
          </div>

          <p className="text-center text-white/15 text-xs mt-2">
            Haven remembers you across sessions • Nothing is shared
          </p>
        </div>
      </div>
    </div>
  );
}
