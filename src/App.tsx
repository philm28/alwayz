import React, { useState, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Heart, Video, Upload, MessageCircle, Shield, Star, Play, Sparkles, Plus, LogOut, Brain, Menu, X, Zap, Clock, Users } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { usePersonas } from './hooks/usePersonas';
import { AuthModal } from './components/AuthModal';
import { PersonaTraining } from './components/PersonaTraining';
import { ConversationInterface } from './components/ConversationInterface';
import { SocialMediaImport } from './components/SocialMediaImport';
import { SubscriptionManager } from './components/SubscriptionManager';
import { Analytics } from './components/Analytics';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SEOHead } from './components/SEOHead';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { MemoryViewer } from './components/MemoryViewer';
import { initializeMonitoring, setUserContext } from './lib/monitoring';
import { initializeAnalytics, trackPageView } from './lib/analytics';
import { Toaster } from 'react-hot-toast';

initializeMonitoring();
initializeAnalytics();

function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);

  const { user, loading: authLoading, signOut } = useAuth();
  const { personas, loading: personasLoading, createPersona } = usePersonas();

  useEffect(() => {
    if (user) {
      setUserContext({
        id: user.id,
        email: user.email || '',
        subscription: 'free'
      });
    }
  }, [user]);

  useEffect(() => {
    trackPageView(window.location.pathname);
  }, [currentView]);

  const Navigation = () => (
    <nav className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('landing')}>
            <div className="relative">
              <Heart className="h-8 w-8 text-blue-600" fill="currentColor" />
              <Sparkles className="h-4 w-4 text-purple-500 absolute -top-1 -right-1" />
            </div>
            <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AlwayZ
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            {user && (
              <>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentView === 'dashboard'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('analytics')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentView === 'analytics'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Analytics
                </button>
              </>
            )}

            {user ? (
              <div className="flex items-center gap-2 ml-2">
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="text-sm font-medium text-gray-900">{user.email?.split('@')[0]}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="ml-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
              >
                Get Started
              </button>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 space-y-2">
          {user && (
            <>
              <button
                onClick={() => {setCurrentView('dashboard'); setIsMenuOpen(false);}}
                className="block w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Dashboard
              </button>
              <button
                onClick={() => {setCurrentView('analytics'); setIsMenuOpen(false);}}
                className="block w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Analytics
              </button>
              <button
                onClick={() => {signOut(); setIsMenuOpen(false);}}
                className="block w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Sign Out
              </button>
            </>
          )}
          {!user && (
            <button
              onClick={() => {setIsAuthModalOpen(true); setIsMenuOpen(false);}}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full font-semibold"
            >
              Get Started
            </button>
          )}
        </div>
      )}
    </nav>
  );

  const LandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <SEOHead />
      <Navigation />

      <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8 animate-pulse">
              <Sparkles className="h-4 w-4" />
              AI-Powered Memory Preservation
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Keep Their Memory
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Alive Forever
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed">
              Create lifelike AI personas of loved ones. Have meaningful conversations
              that preserve their voice, personality, and memories.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={() => user ? setCurrentView('dashboard') : setIsAuthModalOpen(true)}
                className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                {user ? 'Go to Dashboard' : 'Start Free Trial'}
                <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" />
              </button>
              <button className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold px-6 py-4 rounded-full hover:bg-white transition-all">
                <Play className="h-5 w-5" />
                Watch Demo
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                Bank-level security
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                10,000+ memories preserved
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Three simple steps to preserve a lifetime of memories
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-gray-100 h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <Upload className="h-7 w-7 text-white" />
                </div>
                <div className="mb-4 text-sm font-bold text-blue-600">STEP 1</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload Content</h3>
                <p className="text-gray-600 leading-relaxed">
                  Share videos, voice notes, photos, and social media posts. Our AI learns
                  their unique personality, voice, and mannerisms.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-gray-100 h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <div className="mb-4 text-sm font-bold text-purple-600">STEP 2</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">AI Training</h3>
                <p className="text-gray-600 leading-relaxed">
                  Advanced AI analyzes thousands of data points to create an authentic
                  digital presence that captures their essence.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-gray-100 h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                  <MessageCircle className="h-7 w-7 text-white" />
                </div>
                <div className="mb-4 text-sm font-bold text-pink-600">STEP 3</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Connect & Heal</h3>
                <p className="text-gray-600 leading-relaxed">
                  Have natural conversations that help process grief and maintain
                  that irreplaceable connection forever.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-12 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium mb-6 w-fit">
                  <Shield className="h-3 w-3" />
                  Privacy First
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-6">
                  Your Memories Are Sacred
                </h2>
                <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                  We use enterprise-grade encryption and never share your data.
                  Your conversations remain completely private and secure.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">256-bit end-to-end encryption</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Shield className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-gray-700">GDPR & SOC 2 compliant</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Zap className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">You own and control your data</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-12 flex items-center justify-center">
                <div className="text-center text-white">
                  <Shield className="h-24 w-24 mx-auto mb-6 opacity-90" />
                  <div className="text-6xl font-bold mb-2">100%</div>
                  <div className="text-xl opacity-90">Secure & Private</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to Preserve Their Memory?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join thousands who are keeping their loved ones' memories alive
          </p>
          <button
            onClick={() => user ? setCurrentView('dashboard') : setIsAuthModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-5 rounded-full text-lg font-bold hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
          >
            {user ? 'Create Your First Persona' : 'Start Free Trial'}
          </button>
        </div>
      </section>
    </div>
  );

  const Dashboard = () => {
    if (personasLoading) {
      return (
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your personas...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <SEOHead title="Dashboard" />
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Personas</h1>
            <p className="text-gray-600">Create and manage AI personas of your loved ones</p>
          </div>

          {personas.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Create Your First Persona</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Start by creating a persona to preserve the memories and personality of someone special
              </p>
              <button
                onClick={() => setCurrentView('create-persona')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-5 w-5" />
                Create Persona
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setCurrentView('create-persona')}
                className="w-full bg-white border-2 border-dashed border-gray-300 rounded-2xl p-8 hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center justify-center gap-3">
                  <Plus className="h-6 w-6 text-gray-400 group-hover:text-blue-600" />
                  <span className="text-lg font-semibold text-gray-600 group-hover:text-blue-600">
                    Create New Persona
                  </span>
                </div>
              </button>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {personas.map((persona: any) => (
                  <div
                    key={persona.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                    onClick={() => {
                      setSelectedPersona(persona);
                      setCurrentView('conversation');
                    }}
                  >
                    <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 relative overflow-hidden">
                      {persona.avatar_url ? (
                        <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Heart className="h-16 w-16 text-white opacity-80" fill="currentColor" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {persona.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4 capitalize">{persona.relationship}</p>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>
                            {new Date(persona.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                          Open →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const CreatePersonaFlow = () => (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Persona</h1>
          <p className="text-gray-600">Build an AI persona that preserves their memory forever</p>
        </div>

        <PersonaTraining
          onComplete={() => {
            setCurrentView('dashboard');
          }}
        />
      </div>
    </div>
  );

  const ConversationView = () => {
    if (!selectedPersona) {
      setCurrentView('dashboard');
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <button
              onClick={() => {
                setSelectedPersona(null);
                setCurrentView('dashboard');
              }}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
            >
              ← Back to Dashboard
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                {selectedPersona.avatar_url ? (
                  <img src={selectedPersona.avatar_url} alt={selectedPersona.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <Heart className="h-8 w-8 text-white" fill="currentColor" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedPersona.name}</h1>
                <p className="text-gray-600 capitalize">{selectedPersona.relationship}</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ConversationInterface persona={selectedPersona} />
            </div>
            <div className="space-y-6">
              <MemoryViewer personaId={selectedPersona.id} personaName={selectedPersona.name} />
              <SocialMediaImport personaId={selectedPersona.id} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AnalyticsView = () => (
    <div className="min-h-screen bg-gray-50">
      <SEOHead title="Analytics" />
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">Track your conversations and persona performance</p>
        </div>
        <Analytics />
      </div>
    </div>
  );

  const SubscriptionView = () => (
    <div className="min-h-screen bg-gray-50">
      <SEOHead title="Subscription" />
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription</h1>
          <p className="text-gray-600">Manage your subscription and billing</p>
        </div>
        <SubscriptionManager />
      </div>
    </div>
  );

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <div className="min-h-screen">
          <PerformanceMonitor />
          <Toaster position="top-right" />

          {currentView === 'landing' && <LandingPage />}
          {currentView === 'dashboard' && user && <Dashboard />}
          {currentView === 'create-persona' && user && <CreatePersonaFlow />}
          {currentView === 'conversation' && user && <ConversationView />}
          {currentView === 'analytics' && user && <AnalyticsView />}
          {currentView === 'subscription' && user && <SubscriptionView />}

          {!user && currentView !== 'landing' && <LandingPage />}

          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={() => {
              setIsAuthModalOpen(false);
              setCurrentView('dashboard');
            }}
          />
        </div>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
