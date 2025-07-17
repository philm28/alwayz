import React, { useState } from 'react';
import { MessageCircle, X, Send, Mail, Phone, Book } from 'lucide-react';
import { emailService } from '../lib/email';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'contact' | 'help'>('chat');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      // In production, this would send to your support system
      await emailService.sendEmail({
        to: 'support@alwayz.app',
        subject: `Support Request from ${user?.email || email}`,
        html: `
          <h3>Support Request</h3>
          <p><strong>From:</strong> ${user?.email || email}</p>
          <p><strong>Subject:</strong> ${subject || 'General Support'}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        `
      });

      toast.success('Message sent! We\'ll get back to you soon.');
      setMessage('');
      setSubject('');
      setEmail('');
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const helpArticles = [
    {
      title: 'Getting Started with AlwayZ',
      description: 'Learn how to create your first AI persona',
      link: '/help/getting-started'
    },
    {
      title: 'Training Your AI Persona',
      description: 'Best practices for uploading content and training',
      link: '/help/training'
    },
    {
      title: 'Video Calls and Conversations',
      description: 'How to have meaningful conversations with your personas',
      link: '/help/conversations'
    },
    {
      title: 'Subscription and Billing',
      description: 'Manage your subscription and billing information',
      link: '/help/billing'
    },
    {
      title: 'Privacy and Security',
      description: 'How we protect your data and memories',
      link: '/help/privacy'
    }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">AlwayZ Support</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex space-x-1 mt-3">
          {[
            { id: 'chat', label: 'Chat', icon: MessageCircle },
            { id: 'contact', label: 'Contact', icon: Mail },
            { id: 'help', label: 'Help', icon: Book }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center px-3 py-1 rounded-lg text-sm transition-colors ${
                activeTab === id ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <Icon className="h-3 w-3 mr-1" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'chat' && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                👋 Hi! How can we help you today? Send us a message and we'll get back to you as soon as possible.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject (optional)
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
              />
            </div>

            {!user && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            )}

            <button
              onClick={handleSendMessage}
              disabled={sending || !message.trim() || (!user && !email.trim())}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4">
            <div className="text-center">
              <h4 className="font-semibold text-gray-900 mb-2">Get in Touch</h4>
              <p className="text-sm text-gray-600 mb-4">
                We're here to help with any questions or concerns.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-purple-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Email Support</p>
                  <p className="text-sm text-gray-600">support@alwayz.app</p>
                </div>
              </div>

              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-purple-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Phone Support</p>
                  <p className="text-sm text-gray-600">1-800-ALWAYZ-1</p>
                </div>
              </div>

              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <MessageCircle className="h-5 w-5 text-purple-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Live Chat</p>
                  <p className="text-sm text-gray-600">Available 24/7</p>
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>Average response time: 2-4 hours</p>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="space-y-4">
            <div className="text-center">
              <h4 className="font-semibold text-gray-900 mb-2">Help Center</h4>
              <p className="text-sm text-gray-600 mb-4">
                Find answers to common questions and learn how to use AlwayZ.
              </p>
            </div>

            <div className="space-y-2">
              {helpArticles.map((article, index) => (
                <a
                  key={index}
                  href={article.link}
                  className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <h5 className="font-medium text-gray-900 text-sm">{article.title}</h5>
                  <p className="text-xs text-gray-600 mt-1">{article.description}</p>
                </a>
              ))}
            </div>

            <div className="text-center">
              <a
                href="/help"
                className="text-purple-600 hover:text-purple-700 font-medium text-sm"
              >
                View All Help Articles →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}