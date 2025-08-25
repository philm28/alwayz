import React, { useState, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Heart, Video, Upload, MessageCircle, Shield, Star, Play, Phone, Plus, Settings, User, Menu, X, LogOut, Brain, FileText } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { usePersonas } from './hooks/usePersonas';
import { AuthModal } from './components/AuthModal';
import { FileUpload } from './components/FileUpload';
import { PersonaTraining } from './components/PersonaTraining';
import { ConversationInterface } from './components/ConversationInterface';
import { DatabaseSetup } from './components/DatabaseSetup';
import { SocialMediaImport } from './components/SocialMediaImport';
import { SubscriptionManager } from './components/SubscriptionManager';
import { Analytics } from './components/Analytics';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SEOHead } from './components/SEOHead';
import { SupportWidget } from './components/SupportWidget';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { SupabaseConnectionTest } from './components/SupabaseConnectionTest';
import { SupabaseStorageTest } from './components/SupabaseStorageTest';
import { TemporaryLogin } from './components/TemporaryLogin';
import { OpenAIStatus } from './components/OpenAIStatus';
import { OAuthCallback } from './components/OAuthCallback';
import { AvatarUpload } from './components/AvatarUpload';
import { RealisticVideoCall } from './components/RealisticVideoCall';
import { initializeMonitoring, setUserContext } from './lib/monitoring';
import { initializeAnalytics, trackPageView } from './lib/analytics';
import { emailService } from './lib/email';
import { Toaster } from 'react-hot-toast';

// Initialize monitoring and analytics
initializeMonitoring();
initializeAnalytics();

function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTempLoginModalOpen, setIsTempLoginModalOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  
  const { user, loading: authLoading, signOut } = useAuth();
  const { personas, loading: personasLoading, createPersona } = usePersonas();

  // Set user context for monitoring
  useEffect(() => {
    if (user) {
      setUserContext({
        id: user.id,
        email: user.email || '',
        subscription: 'free' // This would come from subscription data
      });
    }
  }, [user]);

  // Track page views
  useEffect(() => {
    trackPageView(window.location.pathname);
  }, [currentView]);

  // Send welcome email for new users
  useEffect(() => {
    if (user && user.email_confirmed_at) {
      const isNewUser = new Date(user.created_at).getTime() > Date.now() - 60000; // Within last minute
      if (isNewUser) {
        emailService.sendWelcomeEmail(user.email!, user.user_metadata?.full_name || 'there');
      }
    }
  }, [user]);

  const Navigation = () => (
    <nav className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Heart className="h-8 w-8 text-purple-600 mr-3" />
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AlwayZ
            </span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => setCurrentView('landing')}
              className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'landing' ? 'text-purple-600 font-medium' : ''}`}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentView('database-setup')}
              className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'database-setup' ? 'text-purple-600 font-medium' : ''}`}
            >
              Database Setup
            </button>
            <button
              onClick={() => setCurrentView('connection-test')}
              className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'connection-test' ? 'text-purple-600 font-medium' : ''}`}
            >
              Connection Test
            </button>
            <button
              onClick={() => setCurrentView('storage-test')}
              className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'storage-test' ? 'text-purple-600 font-medium' : ''}`}
            >
              Storage Test
            </button>
            <button
              onClick={() => setCurrentView('openai-status')}
              className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'openai-status' ? 'text-purple-600 font-medium' : ''}`}
            >
              OpenAI Status
            </button>
            {user && (
              <>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'dashboard' ? 'text-purple-600 font-medium' : ''}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('analytics')}
                  className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'analytics' ? 'text-purple-600 font-medium' : ''}`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => setCurrentView('subscription')}
                  className={`text-gray-700 hover:text-purple-600 transition-colors ${currentView === 'subscription' ? 'text-purple-600 font-medium' : ''}`}
                >
                  Subscription
                </button>
              </>
            )}
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">Welcome back!</span>
                <button
                  onClick={() => setIsTempLoginModalOpen(true)}
                  className="text-gray-700 hover:text-purple-600 transition-colors mr-4"
                >
                  Create Guest Login
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center text-gray-700 hover:text-purple-600 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-full hover:shadow-lg transition-all duration-300"
              >
                Sign In
              </button>
            )}
          </div>

          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 py-3 space-y-3">
            <button
              onClick={() => {setCurrentView('landing'); setIsMenuOpen(false);}}
              className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'landing' ? 'text-purple-600 font-medium' : ''}`}
            >
              Home
            </button>
            <button
              onClick={() => {setCurrentView('database-setup'); setIsMenuOpen(false);}}
              className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'database-setup' ? 'text-purple-600 font-medium' : ''}`}
            >
              Database Setup
            </button>
            <button
              onClick={() => {setCurrentView('connection-test'); setIsMenuOpen(false);}}
              className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'connection-test' ? 'text-purple-600 font-medium' : ''}`}
            >
              Connection Test
            </button>
            <button
              onClick={() => {setCurrentView('storage-test'); setIsMenuOpen(false);}}
              className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'storage-test' ? 'text-purple-600 font-medium' : ''}`}
            >
              Storage Test
            </button>
            <button
              onClick={() => {setCurrentView('openai-status'); setIsMenuOpen(false);}}
              className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'openai-status' ? 'text-purple-600 font-medium' : ''}`}
            >
              OpenAI Status
            </button>
            {user && (
              <>
                <button
                  onClick={() => {setCurrentView('dashboard'); setIsMenuOpen(false);}}
                  className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'dashboard' ? 'text-purple-600 font-medium' : ''}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {setCurrentView('analytics'); setIsMenuOpen(false);}}
                  className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'analytics' ? 'text-purple-600 font-medium' : ''}`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => {setCurrentView('subscription'); setIsMenuOpen(false);}}
                  className={`block w-full text-left text-gray-700 hover:text-purple-600 ${currentView === 'subscription' ? 'text-purple-600 font-medium' : ''}`}
                >
                  Subscription
                </button>
              </>
            )}
            {user ? (
              <button
                onClick={() => {signOut(); setIsMenuOpen(false);}}
                className="block w-full text-left text-gray-700 hover:text-purple-600"
              >
                Sign Out
              </button>
            ) : (
              <button 
                onClick={() => {setIsAuthModalOpen(true); setIsMenuOpen(false);}}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-full"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );

  const LandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <SEOHead />
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Keep Their
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"> Memory </span>
            Alive
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
            Create AI personas of loved ones using their voice, mannerisms, and memories. 
            Have meaningful conversations that help you through the grieving process.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => user ? setCurrentView('create-persona') : setIsAuthModalOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {user ? 'Create a Persona' : 'Get Started'}
            </button>
            <button className="flex items-center text-purple-600 hover:text-purple-700 font-semibold">
              <Play className="h-5 w-5 mr-2" />
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Upload Memories</h3>
              <p className="text-gray-600 leading-relaxed">
                Share videos, voice recordings, texts, and social media posts to help us understand their unique personality and speaking patterns.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">AI Training</h3>
              <p className="text-gray-600 leading-relaxed">
                Our advanced AI learns their voice, mannerisms, and conversation style to create an authentic digital presence.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Connect & Heal</h3>
              <p className="text-gray-600 leading-relaxed">
                Have natural video conversations that feel real, helping you process grief and maintain that special connection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <Shield className="h-16 w-16 text-purple-600 mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Privacy & Security First</h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Your loved one's memories are sacred. We use enterprise-grade encryption and never share your data.
            Your conversations remain private and secure, always.
          </p>
          <div className="flex justify-center items-center space-x-8 text-gray-500">
            <div className="flex items-center">
              <Star className="h-5 w-5 text-yellow-400 mr-2" />
              <span>256-bit Encryption</span>
            </div>
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-green-500 mr-2" />
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const Dashboard = () => (
    <div className="min-h-screen bg-gray-50">
      <SEOHead title="Dashboard" />
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Personas</h1>
          <button 
            onClick={() => setCurrentView('create-persona')}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-300 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create New Persona
          </button>
        </div>

        {personasLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading your personas...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {personas.map((persona) => (
              <div key={persona.id} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center mr-4">
                      {persona.avatar_url ? (
                        <img 
                          src={persona.avatar_url} 
                          alt={persona.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-8 w-8 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{persona.name}</h3>
                      <p className="text-gray-500">{persona.relationship || 'Loved one'}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      persona.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : persona.status === 'training'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {persona.status === 'active' ? 'Ready to chat' : 
                       persona.status === 'training' ? `Training... ${persona.training_progress}%` : 'Needs training'}
                    </span>
                  </div>

                  <div className="flex space-x-2">
                    {persona.status === 'active' ? (
                      <>
                        <button 
                          onClick={() => {
                            setSelectedPersona(persona);
                            setCurrentView('chat');
                          }}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Chat
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedPersona(persona);
                            setCurrentView('video-call');
                          }}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-300 flex items-center justify-center"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Video
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => {
                          setSelectedPersona(persona);
                          setCurrentView('persona-setup');
                        }}
                        className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center justify-center"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Setup Training
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {personas.length === 0 && (
              <div className="col-span-full text-center py-12">
                <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No personas yet</h3>
                <p className="text-gray-500 mb-6">Create your first AI persona to get started</p>
                <button 
                  onClick={() => setCurrentView('create-persona')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-full font-semibold"
                >
                  Create First Persona
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const CreatePersona = () => {
    const [formData, setFormData] = useState({
      name: '',
      relationship: '',
      description: '',
      personality_traits: '',
      common_phrases: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      const personaData = {
        ...formData,
        common_phrases: formData.common_phrases.split(',').map(phrase => phrase.trim()).filter(Boolean),
        status: 'training' as const,
        training_progress: 0
      };

      const result = await createPersona(personaData);
      
      if (result) {
        setSelectedPersona(result);
        setCurrentView('persona-setup');
      }
      
      setIsSubmitting(false);
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <SEOHead title="Create New Persona" />
        <Navigation />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Persona</h1>
            <p className="text-gray-600 mb-8">Help us learn about your loved one by sharing their memories and personality</p>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter their full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Relationship</label>
                    <select 
                      value={formData.relationship}
                      onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select relationship</option>
                      <option value="Parent">Parent</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Personality Questions */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Personality & Traits</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Describe their personality in a few sentences
                    </label>
                    <textarea 
                      rows={4}
                      value={formData.personality_traits}
                      onChange={(e) => setFormData(prev => ({ ...prev, personality_traits: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="How would you describe their personality, humor, and way of speaking?"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Common phrases or expressions they used (separate with commas)
                    </label>
                    <input 
                      type="text" 
                      value={formData.common_phrases}
                      onChange={(e) => setFormData(prev => ({ ...prev, common_phrases: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., You know what I mean?, Back in my day..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button 
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const PersonaSetup = () => {
    const [activeTab, setActiveTab] = useState<'upload' | 'social'>('upload');

    return (
      <div className="min-h-screen bg-gray-50">
        <SEOHead title={`Setup ${selectedPersona?.name}'s AI Persona`} />
        <Navigation />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Setup {selectedPersona?.name}'s AI Persona
            </h1>
            <p className="text-gray-600">
              Upload content and train the AI to create an authentic digital presence
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Manual Upload
            </button>
            <button
              onClick={() => setActiveTab('social')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'social'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Social Media Import
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Content Upload/Import Section */}
            <div>
              {activeTab === 'upload' ? (
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                  <div className="flex items-center mb-4">
                    <FileText className="h-6 w-6 text-purple-600 mr-3" />
                    <h2 className="text-xl font-semibold text-gray-900">Upload Content</h2>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Upload videos, audio recordings, photos, and documents to help train the AI
                  </p>
                  <FileUpload 
                    personaId={selectedPersona?.id || ''} 
                    onUploadComplete={(files) => {
                      console.log('Files uploaded:', files);
                    }}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                  <SocialMediaImport
                    personaId={selectedPersona?.id || ''}
                    onImportComplete={(data) => {
                      console.log('Social media data imported:', data);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Training Section */}
            <div>
              <PersonaTraining 
                personaId={selectedPersona?.id || ''} 
                onTrainingComplete={() => {
                  setCurrentView('dashboard');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentView = () => {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'database-setup':
        return <DatabaseSetup />;
      case 'connection-test':
        return (
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-6">Supabase Connection Test</h1>
              <SupabaseConnectionTest />
            </div>
          </div>
        );
      case 'storage-test':
        return (
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-6">Supabase Storage Test</h1>
              <SupabaseStorageTest />
            </div>
          </div>
        );
      case 'openai-status':
        return (
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-6">OpenAI Integration Status</h1>
              <OpenAIStatus />
            </div>
          </div>
        );
      case 'dashboard':
        return user ? <Dashboard /> : <LandingPage />;
      case 'create-persona':
        return user ? <CreatePersona /> : <LandingPage />;
      case 'persona-setup':
        return user && selectedPersona ? <PersonaSetup /> : <LandingPage />;
      case 'analytics':
        return user ? <Analytics /> : <LandingPage />;
      case 'subscription':
        return user ? <SubscriptionManager /> : <LandingPage />;
      case 'chat':
        return user && selectedPersona ? (
          <ConversationInterface
            personaId={selectedPersona.id}
            personaName={selectedPersona.name}
            conversationType="chat"
            onEndCall={() => setCurrentView('dashboard')}
          />
        ) : <LandingPage />;
      case 'video-call':
        return user && selectedPersona ? (
          <RealisticVideoCall
            personaId={selectedPersona.id}
            personaName={selectedPersona.name}
            onEndCall={() => setCurrentView('dashboard')}
          />
        ) : <LandingPage />;
      case 'avatar-setup':
        return user && selectedPersona ? (
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="mb-8">
                <button
                  onClick={() => setCurrentView('persona-setup')}
                  className="flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
                >
                  ← Back to Persona Setup
                </button>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Create Realistic Avatar for {selectedPersona.name}
                </h1>
                <p className="text-gray-600">
                  Upload photos, videos, and voice recordings to create a lifelike AI persona
                </p>
              </div>
              <AvatarUpload
                personaId={selectedPersona.id}
                personaName={selectedPersona.name}
                onAvatarCreated={(avatarUrl) => {
                  console.log('Avatar created:', avatarUrl);
                  setCurrentView('persona-setup');
                }}
              />
            </div>
          </div>
        ) : <LandingPage />;
      case 'oauth-callback':
        return (
          <OAuthCallback
            onSuccess={(platform, token) => {
              console.log(`Successfully connected to ${platform}`);
              setCurrentView('persona-setup');
            }}
            onError={(error) => {
              console.error('OAuth error:', error);
              setCurrentView('persona-setup');
            }}
            onCancel={() => setCurrentView('persona-setup')}
          />
        );
      default:
        return <LandingPage />;
    }
  };

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <PerformanceMonitor />
        {renderCurrentView()}
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
        />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
        {isTempLoginModalOpen && (
          <TemporaryLogin onClose={() => setIsTempLoginModalOpen(false)} />
        )}
        <SupportWidget />
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;