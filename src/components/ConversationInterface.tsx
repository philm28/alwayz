import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { FaceTimeInterface } from './FaceTimeInterface';

interface ConversationInterfaceProps {
  persona: any;
  conversationType?: 'chat' | 'video_call' | 'voice_call';
  onEndCall?: () => void;
}

export function ConversationInterface({
  persona,
  conversationType = 'chat',
  onEndCall
}: ConversationInterfaceProps) {
  const personaId = persona?.id;
  const personaName = persona?.name || 'Persona';
  const { user } = useAuth();

  if (!persona || !personaId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No persona selected</p>
        </div>
      </div>
    );
  }

  // All conversation types route through FaceTime interface
  return (
    <FaceTimeInterface
      personaId={personaId}
      personaName={personaName}
      personaAvatar={persona?.avatar_url}
      onEndCall={() => onEndCall?.()}
    />
  );
}
