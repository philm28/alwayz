import React, { useState, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Heart, Video, Upload, MessageCircle, Shield, Play, Sparkles, Plus, LogOut, Brain, Menu, X, Clock, Users, BookOpen, Mail, Volume2, Mic } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { usePersonas } from './hooks/usePersonas';
import { AuthModal } from './components/AuthModal';
import { PersonaTraining } from './components/PersonaTraining';
import { ConversationInterface } from './components/ConversationInterface';
import { SocialMediaImport } from './components/SocialMediaImport';
import { Analytics } from './components/Analytics';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SEOHead } from './components/SEOHead';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { MemoryViewer } from './components/MemoryViewer';
import { SurpriseMessage } from './components/SurpriseMessage';
import { InviteFamily } from './components/InviteFamily';
import { LegacyLetters } from './components/LegacyLetters';
import { GuidedFirstConversation } from './components/GuidedFirstConversation';
import { VoiceNotes } from './components/VoiceNotes';
import { RecordYourLegacy } from './components/RecordYourLegacy';
import { ClinicalPartnerships } from './components/ClinicalPartnerships';
import { initializeMonitoring, setUserContext } from './lib/monitoring';
import { initializeAnalytics, trackPageView } from './lib/analytics';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';

initializeMonitoring();
initializeAnalytics();

function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [conversationType, setConversationType] = useState<'chat' | 'video_call' | 'voice_call'>('chat');
  const [enrichingPersona, setEnrichingPersona] = useState<any>(null);
  const [surprisePersona, setSurprisePersona] = useState<any>(null);
  const [invitePersona, setInvitePersona] = useState<any>(null);
  const [legacyPersona, setLegacyPersona] = useState<any>(null);
  const [voiceNotePersona, setVoiceNotePersona] = useState<any>(null);
  const [showGuidedConversation, setShowGuidedConversation] = useState(false);
  const [showRecordYourLegacy, setShowRecordYourLegacy] = useState(false);
  const [showClinicalPartnerships, setShowClinicalPartnerships] = useState(false);

  const { user, loading: authLoading, signOut } = useAuth();
  const { personas, sharedPersonas, loading: personasLoading, refetch } = usePersonas();

  useEffect(() => {
    if (user) {
      setUserContext({ id: user.id, email: user.email || '', subscription: 'free' });
    }
  }, [user]);

  useEffect(() => {
    trackPageView(window.location.pathname);
  }, [currentView]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    if (inviteToken) {
      localStorage.setItem('pendingInviteToken', inviteToken);
      if (user) {
        setCurrentView('dashboard');
      } else {
        setIsAuthModalOpen(true);
      }
    }
  }, [user]);

  const checkFirstConversation = async (persona: any): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase
        .from('first_conversation_completed')
        .select('id')
        .eq('persona_id', persona.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return false;
      return !data;
    } catch {
      return false;
    }
  };

  const openConversation = async (persona: any, type: 'chat' | 'video_call' | 'voice_call' = 'voice_call') => {
    setSelectedPersona(persona);
    setConversationType(type);

    const isFirst = await checkFirstConversation(persona);
    if (isFirst) {
      setShowGuidedConversation(true);
    } else {
      setCurrentView('conversation');
    }
  };

  // ✅ Back to dashboard from conversation
  const handleBackToDashboard = () => {
    setSelectedPersona(null);
    setCurrentView('dashboard');
  };

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
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('analytics')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'analytics' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => setShowRecordYourLegacy(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-all"
                >
                  <Mic className="h-4 w-4" />
                  Record My Legacy
                </button>
                <button
                  onClick={() => setShowClinicalPartnerships(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-teal-600 hover:bg-teal-50 transition-all"
                >
                  <Shield className="h-4 w-4" />
                  Clinical Partners
                </button>
              </>
            )}
            {!user && (
              <button
                onClick={() => setShowClinicalPartnerships(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-teal-600 hover:bg-teal-50 transition-all"
              >
                <Shield className="h-4 w-4" />
                For Clinicians
              </button>
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

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 space-y-2">
          {user && (
            <>
              <button onClick={() => { setCurrentView('dashboard'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">Dashboard</button>
              <button onClick={() => { setCurrentView('analytics'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">Analytics</button>
              <button onClick={() => { setShowRecordYourLegacy(true); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-lg text-amber-600 hover:bg-amber-50 font-medium">
                🎙️ Record My Legacy
              </button>
              <button onClick={() => { setShowClinicalPartnerships(true); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-lg text-teal-600 hover:bg-teal-50 font-medium">
                🏥 Clinical Partners
              </button>
              <button onClick={() => { signOut(); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">Sign Out</button>
            </>
          )}
          {!user && (
            <>
              <button onClick={() => { setShowClinicalPartnerships(true); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 rounded-lg text-teal-600 hover:bg-teal-50 font-medium">
                🏥 For Clinicians
              </button>
              <button onClick={() => { setIsAuthModalOpen(true); setIsMenuOpen(false); }} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full font-semibold">
                Get Started
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );

  const PersonaCard = ({ persona, isShared = false }: { persona: any, isShared?: boolean }) => (
    <div className="group bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      <div
        className="aspect-[4/3] bg-gradient-to-br from-blue-500 to-purple-600 relative overflow-hidden cursor-pointer"
        onClick={() => openConversation(persona)}
      >
        {persona.avatar_url ? (
          <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Heart className="h-20 w-20 text-white opacity-90 group-hover:scale-110 transition-transform" fill="currentColor" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">{persona.name}</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-white/90 capitalize drop-shadow">{persona.relationship}</p>
            {isShared && (
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">Shared</span>
            )}
            {persona.is_self_recorded && (
              <span className="text-xs bg-amber-500/80 text-white px-2 py-0.5 rounded-full">My Legacy</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>{new Date(persona.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <button
            onClick={() => openConversation(persona)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all"
          >
            Talk →
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={(e) => { e.stopPropagation(); setSurprisePersona(persona); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Surprise
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setVoiceNotePersona(persona); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Voice Note
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setLegacyPersona(persona); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-all"
          >
            <Mail className="h-3.5 w-3.5" />
            Legacy
          </button>

          {!isShared && (
            <button
              onClick={(e) => { e.stopPropagation(); setInvitePersona(persona); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all"
            >
              <Users className="h-3.5 w-3.5" />
              Invite
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setEnrichingPersona(persona); setCurrentView('enrich-persona'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-600 rounded-lg text-xs font-semibold hover:bg-pink-100 transition-all"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Enrich
          </button>
        </div>
      </div>
    </div>
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
              Keep Their Memory<br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Alive Forever
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-4 leading-relaxed font-medium">
              The infrastructure for human memory preservation.
            </p>
            <p className="text-lg md:text-xl text-gray-500 mb-10 leading-relaxed max-w-3xl mx-auto">
              We give families the ability to keep talking to the people they love —
              and we give the deceased a voice in the milestones they'll miss.
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
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
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
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Video className="h-4 w-4" />
              See How It Works
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Watch AlwayZ in Action</h2>
          </div>
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-100 bg-gray-900">
            <div className="aspect-video">
              <iframe className="w-full h-full" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="AlwayZ Demo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-8 text-center">
            <div className="p-6"><div className="text-4xl font-bold text-blue-600 mb-2">2-3 min</div><p className="text-gray-600">Average setup time</p></div>
            <div className="p-6"><div className="text-4xl font-bold text-purple-600 mb-2">99%</div><p className="text-gray-600">Voice accuracy rate</p></div>
            <div className="p-6"><div className="text-4xl font-bold text-pink-600 mb-2">24/7</div><p className="text-gray-600">Always available</p></div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Three simple steps to preserve a lifetime of memories</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Upload className="h-7 w-7 text-white" />, color: 'from-blue-500 to-blue-600', step: 'STEP 1', title: 'Upload Content', desc: 'Share videos, voice notes, photos, and social media posts. Our AI learns their unique personality and voice.' },
              { icon: <Brain className="h-7 w-7 text-white" />, color: 'from-purple-500 to-purple-600', step: 'STEP 2', title: 'AI Training', desc: 'Advanced AI analyzes thousands of data points to create an authentic digital presence.' },
              { icon: <MessageCircle className="h-7 w-7 text-white" />, color: 'from-pink-500 to-pink-600', step: 'STEP 3', title: 'Connect & Heal', desc: 'Have natural conversations that help process grief and maintain that irreplaceable connection.' }
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
                <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-gray-100 h-full">
                  <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-6 shadow-lg`}>{item.icon}</div>
                  <div className="mb-4 text-sm font-bold text-blue-600">{item.step}</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-10 text-white text-center shadow-2xl">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mic className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Record Your Own Legacy</h2>
            <p className="text-xl text-white/80 mb-4 leading-relaxed">Don't wait until it's too late.</p>
            <p className="text-white/70 mb-8 leading-relaxed max-w-2xl mx-auto">
              Answer guided questions in your own voice — your wisdom, your memories, your love.
              Your family will be able to talk to an AI version of you that knows your stories and speaks in your voice.
            </p>
            <button
              onClick={() => user ? setShowRecordYourLegacy(true) : setIsAuthModalOpen(true)}
              className="bg-white text-amber-600 px-8 py-4 rounded-full font-bold text-lg hover:shadow-2xl transition-all hover:scale-105"
            >
              {user ? 'Record My Legacy' : 'Get Started'}
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-3xl p-10 text-white text-center shadow-2xl">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">For Grief Counselors & Hospice Professionals</h2>
            <p className="text-white/80 mb-8 leading-relaxed max-w-2xl mx-auto">
              Support your clients between sessions. AlwayZ gives grieving families a therapeutic bridge — available 24/7, clinically informed, and ethically designed to support healing.
            </p>
            <button
              onClick={() => setShowClinicalPartnerships(true)}
              className="bg-white text-teal-600 px-8 py-4 rounded-full font-bold text-lg hover:shadow-2xl transition-all hover:scale-105"
            >
              Explore Clinical Partnerships
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-white/60 text-5xl mb-6">"</div>
          <p className="text-2xl md:text-3xl font-medium text-white leading-relaxed mb-6">
            AlwayZ is the infrastructure for human memory preservation — we give families the ability to keep talking to the people they love, and we give the deceased a voice in the milestones they'll miss.
          </p>
          <div className="text-white/60 text-5xl mb-8">"</div>
          <div className="w-16 h-1 bg-white/40 mx-auto rounded-full" />
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Ready to Preserve Their Memory?</h2>
          <p className="text-xl text-gray-600 mb-10">Join thousands who are keeping their loved ones' memories alive</p>
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
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading your personas...</p>
            </div>
          </div>
        </div>
      );
    }

    const allPersonas = [...personas, ...sharedPersonas];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
        <SEOHead title="Dashboard" />
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">Your Personas</h1>
              <p className="text-lg text-gray-600">Connect with AI recreations of your loved ones</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRecordYourLegacy(true)}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
              >
                <Mic className="h-4 w-4" />
                Record My Legacy
              </button>
              {allPersonas.length > 0 && (
                <button
                  onClick={() => setCurrentView('create-persona')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <Plus className="h-5 w-5" />
                  New Persona
                </button>
              )}
            </div>
          </div>

          {allPersonas.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-16 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
                <Heart className="h-12 w-12 text-white" fill="currentColor" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Create Your First Persona</h3>
              <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Begin your journey by creating an AI persona. Upload memories, voice recordings, and messages to bring their personality to life.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setCurrentView('create-persona')}
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-5 rounded-full text-lg font-semibold hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                >
                  <Plus className="h-6 w-6" />
                  Create a Persona
                </button>
                <button
                  onClick={() => setShowRecordYourLegacy(true)}
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-10 py-5 rounded-full text-lg font-semibold hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                >
                  <Mic className="h-6 w-6" />
                  Record My Legacy
                </button>
              </div>
            </div>
          ) : (
            <>
              {personas.length > 0 && (
                <div className="mb-12">
                  {sharedPersonas.length > 0 && (
                    <h2 className="text-xl font-bold text-gray-700 mb-6">Your Personas</h2>
                  )}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {personas.map((persona: any) => (
                      <PersonaCard key={persona.id} persona={persona} isShared={false} />
                    ))}
                    <button
                      onClick={() => setCurrentView('create-persona')}
                      className="group bg-white rounded-3xl shadow-lg border-2 border-dashed border-gray-300 p-12 hover:border-blue-500 hover:shadow-2xl transition-all duration-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 transform hover:-translate-y-1 flex flex-col items-center justify-center min-h-[320px]"
                    >
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 group-hover:from-blue-500 group-hover:to-purple-600 rounded-full flex items-center justify-center mb-4 transition-all">
                        <Plus className="h-8 w-8 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-xl font-bold text-gray-600 group-hover:text-blue-600 transition-colors">Create New Persona</span>
                      <span className="text-sm text-gray-500 mt-2">Preserve another memory</span>
                    </button>
                  </div>
                </div>
              )}

              {sharedPersonas.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-700 mb-2">Shared With You</h2>
                  <p className="text-sm text-gray-500 mb-6">Personas that family members have invited you to</p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sharedPersonas.map((persona: any) => (
                      <PersonaCard key={persona.id} persona={persona} isShared={true} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const CreatePersonaFlow = () => {
    const handleTrainingComplete = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: freshPersona } = await supabase
          .from('personas')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (freshPersona) {
          setSelectedPersona(freshPersona);
          setConversationType('voice_call');
          setShowGuidedConversation(true);
        } else {
          setCurrentView('dashboard');
        }
      } catch (error) {
        console.error('Error fetching persona after training:', error);
        setCurrentView('dashboard');
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <button onClick={() => setCurrentView('dashboard')} className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4">
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Persona</h1>
            <p className="text-gray-600">Build an AI persona that preserves their memory forever</p>
          </div>
          <PersonaTraining onComplete={handleTrainingComplete} />
        </div>
      </div>
    );
  };

  const EnrichPersonaFlow = () => {
    if (!enrichingPersona) {
      setCurrentView('dashboard');
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <button onClick={() => setCurrentView('dashboard')} className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4">
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Enrich {enrichingPersona.name}'s Memories
            </h1>
            <p className="text-gray-600">Add personality traits, stories, and online presence to deepen their AI persona</p>
          </div>
          <PersonaTraining
            personaId={enrichingPersona.id}
            startAtMemories={true}
            onComplete={() => {
              setEnrichingPersona(null);
              setCurrentView('dashboard');
            }}
          />
        </div>
      </div>
    );
  };

  const ConversationView = () => {
    if (!selectedPersona) {
      setCurrentView('dashboard');
      return null;
    }

    const isShared = selectedPersona.isShared;

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <button
              onClick={handleBackToDashboard}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
            >
              ← Back to Dashboard
            </button>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  {selectedPersona.avatar_url ? (
                    <img src={selectedPersona.avatar_url} alt={selectedPersona.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Heart className="h-8 w-8 text-white" fill="currentColor" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedPersona.name}</h1>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-600 capitalize">{selectedPersona.relationship}</p>
                    {isShared && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Shared</span>
                    )}
                    {selectedPersona.is_self_recorded && (
                      <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">My Legacy</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={() => { setEnrichingPersona(selectedPersona); setCurrentView('enrich-persona'); }}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-600 rounded-xl font-semibold text-sm hover:bg-pink-100 transition-all"
                >
                  <BookOpen className="h-4 w-4" />
                  Add Memories
                </button>

                <button
                  onClick={() => setSurprisePersona(selectedPersona)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl font-semibold text-sm hover:bg-purple-100 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Surprise
                </button>

                <button
                  onClick={() => setVoiceNotePersona(selectedPersona)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all"
                >
                  <Volume2 className="h-4 w-4" />
                  Voice Notes
                </button>

                <button
                  onClick={() => setLegacyPersona(selectedPersona)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl font-semibold text-sm hover:bg-amber-100 transition-all"
                >
                  <Mail className="h-4 w-4" />
                  Legacy
                </button>

                <button
                  onClick={() => setShowGuidedConversation(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-all"
                >
                  <Heart className="h-4 w-4" />
                  Guide
                </button>

                {!isShared && (
                  <button
                    onClick={() => setInvitePersona(selectedPersona)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl font-semibold text-sm hover:bg-green-100 transition-all"
                  >
                    <Users className="h-4 w-4" />
                    Invite Family
                  </button>
                )}

                <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
                  <button
                    onClick={() => setConversationType('chat')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${conversationType === 'chat' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Chat</span>
                  </button>
                  <button
                    onClick={() => setConversationType('voice_call')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${conversationType === 'voice_call' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Heart className="h-4 w-4" />
                    <span className="text-sm font-medium">Voice</span>
                  </button>
                  <button
                    onClick={() => setConversationType('video_call')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${conversationType === 'video_call' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Video className="h-4 w-4" />
                    <span className="text-sm font-medium">Video</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ConversationInterface
                persona={selectedPersona}
                conversationType={conversationType}
                onEndCall={() => setConversationType('chat')}
                onBackToDashboard={handleBackToDashboard}
              />
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

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <div className="min-h-screen">
          <PerformanceMonitor />
          <Toaster position="top-right" />

          {currentView === 'landing' && <LandingPage />}
          {currentView === 'dashboard' && user && <Dashboard />}
          {currentView === 'create-persona' && user && <CreatePersonaFlow />}
          {currentView === 'enrich-persona' && user && <EnrichPersonaFlow />}
          {currentView === 'conversation' && user && <ConversationView />}
          {currentView === 'analytics' && user && <AnalyticsView />}

          {!user && currentView !== 'landing' && <LandingPage />}

          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={() => {
              setIsAuthModalOpen(false);
              setCurrentView('dashboard');
            }}
          />

          {surprisePersona && (
            <SurpriseMessage
              persona={surprisePersona}
              onClose={() => setSurprisePersona(null)}
            />
          )}

          {invitePersona && (
            <InviteFamily
              persona={invitePersona}
              onClose={() => setInvitePersona(null)}
            />
          )}

          {legacyPersona && (
            <LegacyLetters
              persona={legacyPersona}
              onClose={() => setLegacyPersona(null)}
            />
          )}

          {voiceNotePersona && (
            <VoiceNotes
              persona={voiceNotePersona}
              onClose={() => setVoiceNotePersona(null)}
            />
          )}

          {showGuidedConversation && selectedPersona && (
            <GuidedFirstConversation
              persona={selectedPersona}
              onBegin={() => {
                setShowGuidedConversation(false);
                setCurrentView('conversation');
              }}
              onSkip={() => {
                setShowGuidedConversation(false);
                setCurrentView('conversation');
              }}
            />
          )}

          {showRecordYourLegacy && (
            <RecordYourLegacy
              onClose={() => {
                setShowRecordYourLegacy(false);
                refetch();
              }}
            />
          )}

          {showClinicalPartnerships && (
            <ClinicalPartnerships
              onClose={() => setShowClinicalPartnerships(false)}
            />
          )}
        </div>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
