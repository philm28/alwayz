import React, { useState, useRef, useEffect } from 'react';
import { Shield, Heart, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface TermsAndConditionsProps {
  onAccept: () => void;
}

export function TermsAndConditions({ onAccept }: TermsAndConditionsProps) {
  const { user } = useAuth();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
    if (atBottom) setHasScrolledToBottom(true);
  };

  const handleAccept = async () => {
    if (!isChecked || !hasScrolledToBottom || !user) return;
    setIsAccepting(true);

    try {
      const { error } = await supabase
        .from('user_agreements')
        .upsert({
          user_id: user.id,
          agreed_at: new Date().toISOString(),
          agreement_version: '1.0'
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Thank you for agreeing to our terms.');
      onAccept();
    } catch (error) {
      console.error('Error saving agreement:', error);
      toast.error('Could not save agreement. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Terms of Service & Privacy Policy</h2>
              <p className="text-white/70 text-sm">Please read and agree before continuing</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto flex-1 px-8 py-6 text-sm text-gray-700 leading-relaxed space-y-6"
        >
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-start gap-3">
              <Heart className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" />
              <p className="text-blue-800 text-sm">
                <strong>AlwayZ is designed to support grief healing.</strong> Our AI personas are intended as a compassionate tool to help process loss — not as a replacement for professional mental health care or real human connection.
              </p>
            </div>
          </div>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">1. Acceptance of Terms</h3>
            <p>By creating an account and using AlwayZ ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms apply to all users, including those who contribute content, information, or other materials to the Service.</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">2. Description of Service</h3>
            <p>AlwayZ is an AI-powered memory preservation platform that allows users to create interactive AI personas of deceased loved ones using voice cloning, conversational AI, and uploaded personal content. The Service is intended to provide comfort and support during the grieving process.</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">3. Emotional Wellbeing & Mental Health</h3>
            <p className="mb-2">You acknowledge and agree that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>AlwayZ is not a substitute for professional mental health care, grief counseling, or medical advice.</li>
              <li>If you are experiencing a mental health crisis, please contact a qualified mental health professional or crisis line immediately.</li>
              <li>The AI personas on AlwayZ are artificial constructs and are not actual deceased individuals.</li>
              <li>AlwayZ is designed with an Ethical Sunset Arc to support healthy grief processing and discourage unhealthy dependency.</li>
              <li>We encourage users to maintain strong connections with living loved ones and professional support systems.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">4. Content & Privacy</h3>
            <p className="mb-2">By uploading content to AlwayZ, you represent and warrant that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You have the right to upload, share, and use all content you provide, including voice recordings, photos, and personal information.</li>
              <li>You have obtained appropriate consent from any living individuals whose voice, likeness, or personal information you upload.</li>
              <li>You will not upload content that is unlawful, harmful, defamatory, or that violates the rights of any third party.</li>
              <li>All content is stored securely and is accessible only to you and those you explicitly invite.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">5. Voice Cloning & AI Personas</h3>
            <p className="mb-2">You acknowledge that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Voice cloning technology creates an artificial approximation of a person's voice and is not identical to the actual person.</li>
              <li>AI-generated responses do not represent the actual thoughts, beliefs, or statements of the deceased individual.</li>
              <li>You are solely responsible for ensuring you have the right to clone the voice of any individual represented in the Service.</li>
              <li>AlwayZ personas are not to be used for deceptive, fraudulent, or harmful purposes.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">6. SMS Communications</h3>
            <p className="mb-2">If you use features that send SMS messages (Surprise Messages, Legacy Letters):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You confirm that all SMS recipients have consented to receive messages.</li>
              <li>You are responsible for ensuring recipients can opt out by replying STOP.</li>
              <li>You will not use SMS features for spam, harassment, or unsolicited communications.</li>
              <li>Standard message and data rates may apply to recipients.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">7. Privacy Policy</h3>
            <p className="mb-2">AlwayZ collects and processes personal data as follows:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Data collected:</strong> Account information, uploaded content (audio, images, text), conversation history, and usage data.</li>
              <li><strong>How we use it:</strong> To provide and improve the Service, generate AI personas, and support your grief healing journey.</li>
              <li><strong>Data sharing:</strong> We do not sell your personal data. We use trusted third-party services (ElevenLabs for voice, OpenAI for AI, Supabase for storage) under strict data processing agreements.</li>
              <li><strong>Data retention:</strong> Your data is retained as long as your account is active. You may request deletion at any time by contacting support@alwayz.app.</li>
              <li><strong>Security:</strong> We use industry-standard encryption and security practices to protect your data.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">8. Pre-Loss Recording</h3>
            <p>If you use the "Record Your Legacy" feature to create a persona of yourself for your family's future use, you acknowledge that your recordings, voice clone, and personal memories will be stored securely and made available to family members you explicitly authorize. You may revoke access or request deletion at any time.</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">9. Clinical Partnerships</h3>
            <p>AlwayZ may partner with grief counselors, hospice organizations, and mental health professionals. These partners are independently licensed professionals and AlwayZ does not provide clinical oversight of their services. Always consult qualified professionals for mental health support.</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">10. Limitation of Liability</h3>
            <p>AlwayZ is provided "as is" without warranties of any kind. To the maximum extent permitted by law, AlwayZ shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including emotional distress, reliance on AI-generated content, or technical failures.</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">11. Termination</h3>
            <p>We reserve the right to suspend or terminate your account for violations of these Terms. You may delete your account at any time. Upon termination, your data will be deleted within 30 days, except where retention is required by law.</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">12. Changes to Terms</h3>
            <p>We may update these Terms from time to time. We will notify you of material changes by email or in-app notification. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-gray-900 mb-2">13. Contact</h3>
            <p>For questions about these Terms or our Privacy Policy, contact us at: <strong>support@alwayz.app</strong></p>
          </section>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs text-gray-500">
            <p>Last updated: April 2026 — Version 1.0</p>
            <p className="mt-1">These terms are governed by the laws of the State of Texas, United States.</p>
          </div>
        </div>

        {/* Footer — acceptance */}
        <div className="flex-shrink-0 px-8 py-6 border-t border-gray-100 bg-gray-50">
          {!hasScrolledToBottom && (
            <p className="text-xs text-amber-600 text-center mb-3 font-medium">
              ↓ Please scroll to the bottom to continue
            </p>
          )}

          <div
            className={`flex items-start gap-3 mb-5 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              hasScrolledToBottom
                ? isChecked
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-white hover:border-blue-300'
                : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
            }`}
            onClick={() => hasScrolledToBottom && setIsChecked(!isChecked)}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-all ${
              isChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white'
            }`}>
              {isChecked && <CheckCircle className="h-4 w-4 text-white" fill="currentColor" />}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              I have read and agree to AlwayZ's <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>. I understand that AlwayZ uses AI technology to create personas of deceased individuals and that these are not actual representations of real people.
            </p>
          </div>

          <button
            onClick={handleAccept}
            disabled={!isChecked || !hasScrolledToBottom || isAccepting}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAccepting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Saving...
              </>
            ) : (
              <>
                <Heart className="h-5 w-5" fill="currentColor" />
                I Agree — Take Me to AlwayZ
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            You must scroll through and agree to continue using AlwayZ
          </p>
        </div>
      </div>
    </div>
  );
}
