import React, { useState } from 'react';
import { Sparkles, Phone, X, Send, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const OCCASIONS = [
  { id: 'birthday', label: '🎂 Birthday', prompt: 'Wish them a heartfelt happy birthday in your voice and personality. Make it personal and warm.' },
  { id: 'graduation', label: '🎓 Graduation', prompt: 'Congratulate them on their graduation. Express how proud you are in your voice and personality.' },
  { id: 'just_thinking', label: '💭 Just Thinking of You', prompt: 'Reach out just to say you are thinking of them. Make it feel spontaneous and loving.' },
  { id: 'hard_time', label: '🤗 Going Through Hard Times', prompt: 'Offer comfort and support. Remind them of your love and their strength.' },
  { id: 'achievement', label: '⭐ Big Achievement', prompt: 'Celebrate their achievement. Express pride and joy in your voice and personality.' },
  { id: 'anniversary', label: '💔 Missing You Day', prompt: 'Acknowledge that today might be hard. Offer love and presence.' },
  { id: 'holiday', label: '🎄 Holiday', prompt: 'Send holiday warmth and love. Reference family traditions if you know them.' },
  { id: 'custom', label: '✍️ Custom Message', prompt: '' }
];

interface SurpriseMessageProps {
  persona: any;
  onClose: () => void;
}

export function SurpriseMessage({ persona, onClose }: SurpriseMessageProps) {
  const [step, setStep] = useState<'occasion' | 'details' | 'preview' | 'sent'>('occasion');
  const [selectedOccasion, setSelectedOccasion] = useState<any>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const generateMessage = async () => {
    if (!recipientName || !recipientPhone) {
      toast.error('Please enter the recipient\'s name and phone number');
      return;
    }

    setIsGenerating(true);

    try {
      const { data: memories } = await supabase
        .from('persona_memories')
        .select('content, memory_type, importance')
        .eq('persona_id', persona.id)
        .order('importance', { ascending: false })
        .limit(15);

      const memoryContext = memories && memories.length > 0
        ? memories.map(m => `• ${m.content}`).join('\n')
        : 'No specific memories available.';

      const occasionPrompt = selectedOccasion.id === 'custom'
        ? customContext
        : selectedOccasion.prompt;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: `You are ${persona.name}. You are sending a surprise SMS text message to ${recipientName}, who is your ${persona.relationship}.

YOUR MEMORIES AND PERSONALITY:
${memoryContext}

PERSONALITY: ${persona.personality_traits || 'warm, loving, genuine'}

Write a SHORT, personal SMS text message (3-5 sentences max) that:
- Sounds exactly like ${persona.name} would write
- References specific memories or details if relevant
- Feels spontaneous and genuine — not like an AI wrote it
- Is warm, loving, and personal
- Does NOT mention being deceased or being an AI
- Feels like a real text from someone who loves them

Occasion: ${occasionPrompt}
${customContext && selectedOccasion.id !== 'custom' ? `Additional context: ${customContext}` : ''}

Write ONLY the text message — no quotes, no preamble, just the message itself.`
          }],
          max_tokens: 200,
          temperature: 0.85
        })
      });

      const data = await response.json();
      const message = data.choices[0]?.message?.content || '';
      setGeneratedMessage(message);
      setStep('preview');

    } catch (error) {
      console.error('Error generating message:', error);
      toast.error('Could not generate message. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const sendMessage = async () => {
    if (!generatedMessage || !recipientPhone) return;
    setIsSending(true);

    try {
      const cleanPhone = recipientPhone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('1')
        ? `+${cleanPhone}`
        : `+1${cleanPhone}`;

      const response = await fetch('/.netlify/functions/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formattedPhone,
          message: generatedMessage
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send');
      }

      setStep('sent');
      toast.success('Surprise message sent! 💙');

    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Could not send message. Check the phone number and try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Surprise Message</h2>
                <p className="text-white/70 text-sm">From {persona.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-8">

          {/* Step 1 — Choose Occasion */}
          {step === 'occasion' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">What's the occasion?</h3>
              <p className="text-sm text-gray-500 mb-6">
                {persona.name} will send a surprise text to someone who loves them.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {OCCASIONS.map(occasion => (
                  <button
                    key={occasion.id}
                    onClick={() => {
                      setSelectedOccasion(occasion);
                      setStep('details');
                    }}
                    className="p-4 text-left rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <span className="text-sm font-semibold text-gray-700">{occasion.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Recipient Details */}
          {step === 'details' && (
            <div>
              <button
                onClick={() => setStep('occasion')}
                className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
              >
                ← Back
              </button>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Who is {persona.name} surprising?
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Occasion: <span className="font-medium text-blue-600">{selectedOccasion?.label}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Their name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Riley"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Their phone number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="(555) 555-5555"
                      className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {selectedOccasion?.id === 'custom' ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      What should {persona.name} say?
                    </label>
                    <textarea
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      placeholder="e.g. Riley just got a promotion at work and I want to congratulate him..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Any additional context? (optional)
                    </label>
                    <textarea
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      placeholder={`e.g. Riley just got promoted, mention how proud ${persona.name} always was of his work ethic...`}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
                    />
                  </div>
                )}

                <button
                  onClick={generateMessage}
                  disabled={isGenerating || !recipientName || !recipientPhone}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      {persona.name} is writing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Generate Message
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Preview */}
          {step === 'preview' && (
            <div>
              <button
                onClick={() => setStep('details')}
                className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
              >
                ← Edit
              </button>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Preview the message</h3>
              <p className="text-sm text-gray-500 mb-6">
                This will be sent to {recipientName} at {recipientPhone}
              </p>

              {/* SMS bubble preview */}
              <div className="bg-gray-100 rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Heart className="h-4 w-4 text-white" fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600">{persona.name}</p>
                    <p className="text-xs text-gray-400">Text Message</p>
                  </div>
                </div>
                <div className="bg-blue-500 text-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs">
                  <p className="text-sm leading-relaxed">{generatedMessage}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={generateMessage}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                >
                  {isGenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
                <button
                  onClick={sendMessage}
                  disabled={isSending}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send It
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Sent */}
          {step === 'sent' && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Heart className="h-10 w-10 text-white" fill="currentColor" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Message Sent 💙</h3>
              <p className="text-gray-600 mb-2">
                {persona.name} just surprised {recipientName}.
              </p>
              <p className="text-sm text-gray-400 mb-8">
                They'll receive a text any moment now.
              </p>
              <button
                onClick={onClose}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
