import React, { useState, useEffect } from 'react';
import { Mail, Plus, X, Calendar, Phone, Heart, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const OCCASIONS = [
  { id: 'birthday', label: '🎂 Birthday', desc: 'Annual birthday message' },
  { id: 'graduation', label: '🎓 Graduation', desc: 'Academic milestone' },
  { id: 'wedding', label: '💍 Wedding Day', desc: 'Their special day' },
  { id: 'new_baby', label: '👶 New Baby', desc: 'Welcoming a new life' },
  { id: 'anniversary', label: '💕 Anniversary', desc: 'Relationship milestone' },
  { id: 'holiday', label: '🎄 Holiday', desc: 'Christmas, Thanksgiving etc.' },
  { id: 'hard_day', label: '🤗 A Hard Day', desc: 'When they need comfort' },
  { id: 'custom', label: '✍️ Custom', desc: 'Any occasion you choose' }
];

interface LegacyLetter {
  id: string;
  persona_id: string;
  recipient_name: string;
  recipient_phone: string;
  occasion: string;
  scheduled_date: string;
  custom_context: string;
  generated_message: string;
  status: 'scheduled' | 'sent' | 'failed';
  sent_at: string | null;
  created_at: string;
}

interface LegacyLettersProps {
  persona: any;
  onClose: () => void;
}

export function LegacyLetters({ persona, onClose }: LegacyLettersProps) {
  const { user } = useAuth();
  const [letters, setLetters] = useState<LegacyLetter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');

  useEffect(() => {
    loadLetters();
  }, []);

  const loadLetters = async () => {
    try {
      const { data, error } = await supabase
        .from('legacy_letters')
        .select('*')
        .eq('persona_id', persona.id)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setLetters(data || []);
    } catch (error) {
      console.error('Error loading letters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMessage = async () => {
    if (!recipientName || !selectedOccasion) {
      toast.error('Please fill in the recipient name and occasion first');
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

      const occasionLabel = OCCASIONS.find(o => o.id === selectedOccasion)?.label || selectedOccasion;

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
            content: `You are ${persona.name}. You are writing a heartfelt legacy letter to ${recipientName} for their ${occasionLabel}. This letter will be delivered on a special date as a surprise from beyond.

YOUR MEMORIES AND PERSONALITY:
${memoryContext}

PERSONALITY: ${persona.personality_traits || 'warm, loving, genuine'}

Write a deeply personal, heartfelt letter (4-6 sentences) that:
- Sounds authentically like ${persona.name} wrote it
- References specific memories or relationships if relevant
- Acknowledges the milestone with genuine emotion
- Offers love, wisdom, or encouragement appropriate to the occasion
- Feels like a treasured final message — warm but not morbid
- Does NOT mention being deceased or being an AI
${customContext ? `\nAdditional context: ${customContext}` : ''}

Write ONLY the letter — no subject line, no "Dear X", just the heartfelt message itself.`
          }],
          max_tokens: 300,
          temperature: 0.85
        })
      });

      const data = await response.json();
      const message = data.choices[0]?.message?.content || '';
      setPreviewMessage(message);
      toast.success('Letter generated! Review and save it.');

    } catch (error) {
      console.error('Error generating letter:', error);
      toast.error('Could not generate letter. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveLetter = async () => {
    if (!recipientName || !recipientPhone || !selectedOccasion || !scheduledDate || !previewMessage) {
      toast.error('Please complete all fields and generate a message first');
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('legacy_letters')
        .insert({
          persona_id: persona.id,
          user_id: user?.id,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          occasion: selectedOccasion,
          scheduled_date: scheduledDate,
          custom_context: customContext,
          generated_message: previewMessage,
          status: 'scheduled'
        })
        .select()
        .single();

      if (error) throw error;

      setLetters(prev => [...prev, data]);
      toast.success(`Legacy letter scheduled for ${new Date(scheduledDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} 💙`);

      // Reset form
      setRecipientName('');
      setRecipientPhone('');
      setSelectedOccasion('');
      setScheduledDate('');
      setCustomContext('');
      setPreviewMessage('');
      setShowForm(false);

    } catch (error) {
      console.error('Error saving letter:', error);
      toast.error('Could not save letter. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLetter = async (id: string) => {
    try {
      const { error } = await supabase
        .from('legacy_letters')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLetters(prev => prev.filter(l => l.id !== id));
      toast.success('Letter removed');
    } catch (error) {
      console.error('Error deleting letter:', error);
      toast.error('Could not remove letter');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusLabel = (status: string, date: string) => {
    if (status === 'sent') return 'Sent';
    if (status === 'failed') return 'Failed';
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Sending today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return 'Overdue';
    return `In ${days} days`;
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Legacy Letters</h2>
                <p className="text-white/70 text-sm">From {persona.name} — delivered on special days</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-8">

          {/* Existing letters */}
          {!showForm && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Scheduled Letters</h3>
                  <p className="text-sm text-gray-500">{letters.length} letter{letters.length !== 1 ? 's' : ''} scheduled</p>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" />
                  New Letter
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              ) : letters.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-blue-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">No letters yet</h4>
                  <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                    Schedule heartfelt messages from {persona.name} to be delivered on special days — birthdays, graduations, weddings, and more.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Create First Letter
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {letters.map(letter => (
                    <div key={letter.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">{letter.recipient_name}</h4>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {OCCASIONS.find(o => o.id === letter.occasion)?.label || letter.occasion}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{new Date(letter.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(letter.status)}
                              <span>{getStatusLabel(letter.status, letter.scheduled_date)}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteLetter(letter.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-all"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 bg-white rounded-xl p-3 border border-gray-100">
                        {letter.generated_message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Create form */}
          {showForm && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setShowForm(false); setPreviewMessage(''); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <h3 className="text-lg font-bold text-gray-900">New Legacy Letter</h3>
              </div>

              <div className="space-y-5">
                {/* Recipient */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Name</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Emma"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Their Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="(555) 555-5555"
                        className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Occasion */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Occasion</label>
                  <div className="grid grid-cols-2 gap-2">
                    {OCCASIONS.map(occasion => (
                      <button
                        key={occasion.id}
                        onClick={() => setSelectedOccasion(occasion.id)}
                        className={`p-3 text-left rounded-xl border-2 transition-all ${
                          selectedOccasion === occasion.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-100 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-sm font-semibold text-gray-700">{occasion.label}</div>
                        <div className="text-xs text-gray-400">{occasion.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Delivery Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={scheduledDate}
                      min={minDateStr}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Context */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Additional Context (optional)
                  </label>
                  <textarea
                    value={customContext}
                    onChange={(e) => setCustomContext(e.target.value)}
                    placeholder={`e.g. Emma is graduating from UT Austin with a degree in nursing — ${persona.name} was incredibly proud of her choice to help others...`}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
                  />
                </div>

                {/* Generate button */}
                <button
                  onClick={generateMessage}
                  disabled={isGenerating || !recipientName || !selectedOccasion}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      {persona.name} is writing...
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4" />
                      Generate Letter
                    </>
                  )}
                </button>

                {/* Preview */}
                {previewMessage && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Preview — Edit if needed
                    </label>
                    <textarea
                      value={previewMessage}
                      onChange={(e) => setPreviewMessage(e.target.value)}
                      rows={5}
                      className="w-full px-4 py-3 border border-blue-200 bg-blue-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm text-gray-700 leading-relaxed"
                    />

                    <button
                      onClick={saveLetter}
                      disabled={isSaving || !scheduledDate}
                      className="w-full mt-3 bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4" />
                          Schedule This Letter
                        </>
                      )}
                    </button>

                    {!scheduledDate && (
                      <p className="text-xs text-orange-600 mt-2 text-center">
                        ⚠️ Please set a delivery date above before scheduling
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
