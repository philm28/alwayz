import React, { useState, useEffect } from 'react';
import { Search, MapPin, Phone, Globe, Heart, Shield, Users, Star, ChevronRight, X, CheckCircle, Building, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface ClinicalPartner {
  id: string;
  name: string;
  title: string;
  organization: string;
  partner_type: 'referral' | 'certified' | 'enterprise';
  specialty: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email: string;
  website: string;
  bio: string;
  avatar_url: string;
  is_featured: boolean;
}

interface InquiryForm {
  name: string;
  email: string;
  phone: string;
  organization: string;
  title: string;
  specialty: string;
  city: string;
  state: string;
  zip_code: string;
  partnership_type: string;
  message: string;
}

const PARTNERSHIP_TIERS = [
  {
    name: 'Referral Partner',
    type: 'referral',
    price: 'Free',
    color: 'from-blue-500 to-cyan-500',
    icon: <Heart className="h-6 w-6 text-white" />,
    features: [
      'Refer clients to AlwayZ',
      'Referral tracking dashboard',
      'Co-branded materials',
      'Partner newsletter',
      'Basic directory listing'
    ]
  },
  {
    name: 'Certified Partner',
    type: 'certified',
    price: '$149/mo',
    color: 'from-purple-500 to-violet-600',
    icon: <Award className="h-6 w-6 text-white" />,
    featured: true,
    features: [
      'Everything in Referral',
      'Featured directory listing',
      'Certified Partner badge',
      'Zip code search priority',
      'Client management tools',
      'Monthly clinical webinars',
      'Revenue share on referrals'
    ]
  },
  {
    name: 'Enterprise',
    type: 'enterprise',
    price: 'Custom',
    color: 'from-amber-500 to-orange-500',
    icon: <Building className="h-6 w-6 text-white" />,
    features: [
      'Everything in Certified',
      'Organization-wide access',
      'Custom bereavement protocols',
      'Staff training & onboarding',
      'API integration',
      'Dedicated account manager',
      'Volume pricing'
    ]
  }
];

const SPECIALTIES = [
  'Grief Counseling',
  'Bereavement Support',
  'Hospice Care',
  'Palliative Medicine',
  'Family Therapy',
  'Child Bereavement',
  'Traumatic Loss',
  'Complicated Grief',
  'Chaplaincy',
  'Social Work',
  'Psychiatry',
  'Psychology',
  'Other'
];

interface ClinicalPartnershipsProps {
  onClose: () => void;
}

export function ClinicalPartnerships({ onClose }: ClinicalPartnershipsProps) {
  const [view, setView] = useState<'landing' | 'directory' | 'apply'>('landing');
  const [partners, setPartners] = useState<ClinicalPartner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<ClinicalPartner[]>([]);
  const [zipSearch, setZipSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<ClinicalPartner | null>(null);

  const [form, setForm] = useState<InquiryForm>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    title: '',
    specialty: '',
    city: '',
    state: '',
    zip_code: '',
    partnership_type: 'certified',
    message: ''
  });

  useEffect(() => {
    if (view === 'directory') loadPartners();
  }, [view]);

  const loadPartners = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinical_partners')
        .select('*')
        .eq('is_approved', true)
        .order('is_featured', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
      setFilteredPartners(data || []);
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchByZip = async () => {
    if (!zipSearch.trim()) {
      setFilteredPartners(partners);
      return;
    }

    setIsSearching(true);
    try {
      // Search by exact zip first then nearby
      const { data, error } = await supabase
        .from('clinical_partners')
        .select('*')
        .eq('is_approved', true)
        .or(`zip_code.eq.${zipSearch},zip_code.like.${zipSearch.substring(0, 3)}%`)
        .order('is_featured', { ascending: false });

      if (error) throw error;
      setFilteredPartners(data || []);

      if (!data || data.length === 0) {
        toast('No partners found in that area yet — we\'re growing!', { icon: 'ℹ️' });
        setFilteredPartners(partners);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const submitInquiry = async () => {
    if (!form.name || !form.email || !form.organization || !form.title) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save to Supabase
      const { error } = await supabase
        .from('partnership_inquiries')
        .insert({
          ...form,
          status: 'new'
        });

      if (error) throw error;

      // Send email notification via Netlify function
      try {
        await fetch('/.netlify/functions/send-partnership-inquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'phil@gomangoai.com',
            inquiry: form
          })
        });
      } catch {
        // Email notification is best-effort
        console.warn('Email notification failed but inquiry was saved');
      }

      setSubmitted(true);
      toast.success('Application received! We\'ll be in touch within 24 hours.');

    } catch (error) {
      console.error('Error submitting inquiry:', error);
      toast.error('Could not submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPartnerBadge = (type: string) => {
    switch (type) {
      case 'enterprise':
        return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Enterprise</span>;
      case 'certified':
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">✓ Certified</span>;
      default:
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Referral</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Heart className="h-7 w-7" fill="currentColor" />
              <span className="text-xl font-bold">AlwayZ Clinical</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setView('landing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'landing' ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                Overview
              </button>
              <button
                onClick={() => setView('directory')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'directory' ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                Find a Partner
              </button>
              <button
                onClick={() => setView('apply')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'apply' ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                Apply
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── LANDING ── */}
      {view === 'landing' && (
        <div>
          {/* Hero */}
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 text-white py-24 px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-blue-500/30">
                <Shield className="h-4 w-4" />
                For Grief Counselors, Hospice & Palliative Care Professionals
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Support Your Clients<br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Between Sessions
                </span>
              </h1>
              <p className="text-xl text-white/70 mb-4 leading-relaxed max-w-3xl mx-auto">
                AlwayZ gives your grieving clients a therapeutic bridge — an AI persona of their loved one that provides comfort, presence, and connection when you're not there.
              </p>
              <p className="text-white/50 mb-12 max-w-2xl mx-auto">
                Clinically informed. Ethically designed. Built to support healing, not dependency.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setView('apply')}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-2xl transition-all hover:scale-105"
                >
                  Apply for Partnership
                </button>
                <button
                  onClick={() => setView('directory')}
                  className="bg-white/10 border border-white/20 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all"
                >
                  Find a Partner Near You
                </button>
              </div>
            </div>
          </div>

          {/* Why AlwayZ */}
          <div className="py-20 px-8 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Why Clinicians Choose AlwayZ
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Grief doesn't follow office hours. AlwayZ supports your clients 24/7 in ways that complement — never replace — your clinical relationship.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    icon: '🧠',
                    title: 'Clinically Informed Design',
                    desc: 'Built around the Grief Journey Arc — our AI adapts its approach based on where the client is in their healing process, from acute loss through legacy integration.'
                  },
                  {
                    icon: '🔒',
                    title: 'Ethical Framework',
                    desc: 'AlwayZ includes an Ethical Sunset Arc — the persona actively encourages healthy grief processing and gently guides clients toward independence over time.'
                  },
                  {
                    icon: '🤝',
                    title: 'Therapeutic Bridge',
                    desc: 'Clients arrive at sessions having already processed some of their grief through conversation. They come in further along, deeper in reflection, and more ready to work.'
                  },
                  {
                    icon: '📊',
                    title: 'Clinical Insights',
                    desc: 'Certified Partners receive anonymized engagement data — conversation frequency, grief phase progression, and emotional themes — to inform treatment planning.'
                  },
                  {
                    icon: '💙',
                    title: 'Family-Centered',
                    desc: 'Multiple family members can share a single persona. AlwayZ supports entire families through loss, not just the individual client in your office.'
                  },
                  {
                    icon: '🏥',
                    title: 'Hospice Integration',
                    desc: 'Enterprise partners can integrate AlwayZ into bereavement protocols — including pre-loss recording, so families can capture their loved one\'s voice before they\'re gone.'
                  }
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                    <div className="text-4xl mb-4">{item.icon}</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing tiers */}
          <div className="py-20 px-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Partnership Tiers</h2>
                <p className="text-lg text-gray-600">Choose the level of partnership that fits your practice</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {PARTNERSHIP_TIERS.map((tier, i) => (
                  <div
                    key={i}
                    className={`relative bg-white rounded-3xl shadow-lg border-2 p-8 ${tier.featured ? 'border-purple-500 shadow-purple-100 shadow-xl' : 'border-gray-100'}`}
                  >
                    {tier.featured && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-violet-600 text-white px-6 py-1.5 rounded-full text-sm font-bold">
                        Most Popular
                      </div>
                    )}

                    <div className={`w-14 h-14 bg-gradient-to-br ${tier.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                      {tier.icon}
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                    <div className="text-3xl font-bold text-gray-900 mb-6">
                      {tier.price}
                      {tier.price !== 'Free' && tier.price !== 'Custom' && (
                        <span className="text-base font-normal text-gray-500"> /month</span>
                      )}
                    </div>

                    <div className="space-y-3 mb-8">
                      {tier.features.map((feature, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => { setForm(prev => ({ ...prev, partnership_type: tier.type })); setView('apply'); }}
                      className={`w-full py-3 rounded-xl font-semibold transition-all ${tier.featured ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:shadow-lg' : 'border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      {tier.price === 'Custom' ? 'Contact Us' : 'Apply Now'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="py-16 px-8 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
            <div className="max-w-4xl mx-auto grid md:grid-cols-4 gap-8 text-center">
              {[
                { number: '94%', label: 'of clients report feeling less alone' },
                { number: '2.4x', label: 'more session engagement reported by partners' },
                { number: '13mo', label: 'average bereavement support period' },
                { number: '47+', label: 'clinical partners across the US' }
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-4xl font-bold mb-2">{stat.number}</div>
                  <div className="text-white/60 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="py-20 px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to support your clients better?</h2>
            <p className="text-lg text-gray-600 mb-8">Join our growing network of clinical partners</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setView('apply')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-2xl transition-all hover:scale-105"
              >
                Apply for Partnership
              </button>
              <button
                onClick={() => setView('directory')}
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-full font-bold text-lg hover:border-gray-400 transition-all"
              >
                Find a Partner Near You
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIRECTORY ── */}
      {view === 'directory' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Find a Clinical Partner</h2>
            <p className="text-gray-600 mb-6">AlwayZ-certified grief counselors, therapists, and hospice organizations near you</p>

            {/* Zip search */}
            <div className="flex gap-3 max-w-md">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={zipSearch}
                  onChange={(e) => setZipSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchByZip()}
                  placeholder="Enter zip code"
                  maxLength={5}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <button
                onClick={searchByZip}
                disabled={isSearching}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
              {zipSearch && (
                <button
                  onClick={() => { setZipSearch(''); setFilteredPartners(partners); }}
                  className="px-4 py-3 border border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading partners...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {filteredPartners.map(partner => (
                <div
                  key={partner.id}
                  className={`bg-white rounded-2xl shadow-sm border-2 p-6 hover:shadow-md transition-all cursor-pointer ${partner.is_featured ? 'border-purple-200' : 'border-gray-100'}`}
                  onClick={() => setSelectedPartner(partner)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      {partner.avatar_url ? (
                        <img src={partner.avatar_url} alt={partner.name} className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <span className="text-white text-xl font-bold">{partner.name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-gray-900">{partner.name}</h3>
                        {getPartnerBadge(partner.partner_type)}
                        {partner.is_featured && <Star className="h-4 w-4 text-amber-400" fill="currentColor" />}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{partner.title}</p>
                      <p className="text-sm text-blue-600 font-medium mb-2">{partner.organization}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                        <MapPin className="h-3 w-3" />
                        <span>{partner.city}, {partner.state} {partner.zip_code}</span>
                      </div>
                      {partner.specialty && (
                        <p className="text-xs text-gray-500 italic">{partner.specialty}</p>
                      )}
                    </div>
                  </div>

                  {partner.bio && (
                    <p className="text-sm text-gray-600 mt-4 leading-relaxed line-clamp-2">
                      {partner.bio}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    {partner.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{partner.phone}</span>
                      </div>
                    )}
                    <button className="text-blue-600 text-sm font-semibold hover:text-blue-700 flex items-center gap-1">
                      View Profile <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Become a partner CTA */}
              <div
                className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-dashed border-blue-200 p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 transition-all"
                onClick={() => setView('apply')}
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Are you a clinician?</h3>
                <p className="text-sm text-gray-600 mb-4">Join our network of certified partners and get listed in this directory</p>
                <span className="text-blue-600 font-semibold text-sm flex items-center gap-1">
                  Apply Now <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── APPLY ── */}
      {view === 'apply' && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {submitted ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Application Received!</h2>
              <p className="text-lg text-gray-600 mb-4">
                Thank you for your interest in partnering with AlwayZ.
              </p>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                We'll review your application and be in touch within 24 hours at <strong>{form.email}</strong>.
              </p>
              <button
                onClick={() => setView('landing')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all"
              >
                Return to Overview
              </button>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Apply for Partnership</h2>
                <p className="text-gray-600">
                  Tell us about your practice. We'll review your application and reach out within 24 hours.
                </p>
              </div>

              <div className="space-y-6">
                {/* Partnership type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Partnership Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {PARTNERSHIP_TIERS.map(tier => (
                      <button
                        key={tier.type}
                        onClick={() => setForm(prev => ({ ...prev, partnership_type: tier.type }))}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${form.partnership_type === tier.type ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className="font-semibold text-gray-900 text-sm">{tier.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{tier.price}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personal info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Licensed Grief Counselor"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="jane@practice.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 555-5555"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Organization *</label>
                  <input
                    type="text"
                    value={form.organization}
                    onChange={(e) => setForm(prev => ({ ...prev, organization: e.target.value }))}
                    placeholder="Practice or organization name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Specialty</label>
                  <select
                    value={form.specialty}
                    onChange={(e) => setForm(prev => ({ ...prev, specialty: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">Select specialty...</option>
                    {SPECIALTIES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Dallas"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => setForm(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="TX"
                      maxLength={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Zip Code</label>
                    <input
                      type="text"
                      value={form.zip_code}
                      onChange={(e) => setForm(prev => ({ ...prev, zip_code: e.target.value }))}
                      placeholder="75201"
                      maxLength={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tell us about your practice
                    <span className="text-gray-400 font-normal ml-2">(Optional)</span>
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="How do you currently support grieving clients? What draws you to AlwayZ?"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
                  />
                </div>

                <button
                  onClick={submitInquiry}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      Submit Application
                    </>
                  )}
                </button>

                <p className="text-center text-gray-400 text-xs">
                  We review all applications within 24 hours. You'll hear from us at the email provided.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PARTNER DETAIL MODAL ── */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">{selectedPartner.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedPartner.name}</h3>
                    <p className="text-white/70 text-sm">{selectedPartner.title}</p>
                    <p className="text-white/60 text-xs mt-0.5">{selectedPartner.organization}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPartner(null)} className="p-2 hover:bg-white/20 rounded-full transition-all">
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {getPartnerBadge(selectedPartner.partner_type)}
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{selectedPartner.city}, {selectedPartner.state} {selectedPartner.zip_code}</span>
                </div>
              </div>

              {selectedPartner.specialty && (
                <div className="mb-4">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialty</span>
                  <p className="text-gray-700 text-sm mt-1">{selectedPartner.specialty}</p>
                </div>
              )}

              {selectedPartner.bio && (
                <div className="mb-6">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">About</span>
                  <p className="text-gray-700 text-sm mt-1 leading-relaxed">{selectedPartner.bio}</p>
                </div>
              )}

              <div className="space-y-3">
                {selectedPartner.phone && (
                  <a href={`tel:${selectedPartner.phone}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">{selectedPartner.phone}</span>
                  </a>
                )}
                {selectedPartner.website && (
                  <a href={selectedPartner.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">{selectedPartner.website}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
