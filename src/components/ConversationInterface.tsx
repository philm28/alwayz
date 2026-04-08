import React from 'react';
import { FaceTimeInterface } from './FaceTimeInterface';

interface ConversationInterfaceProps {
  persona: any;
  conversationType?: 'chat' | 'video_call' | 'voice_call';
  onEndCall?: () => void;
  onBackToDashboard?: () => void;
}

export function ConversationInterface({
  persona,
  conversationType = 'chat',
  onEndCall,
  onBackToDashboard
}: ConversationInterfaceProps) {
  const personaId = persona?.id;
  const personaName = persona?.name || 'Persona';

  if (!persona || !personaId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No persona selected</p>
        </div>
      </div>
    );
  }

  return (
    <FaceTimeInterface
      personaId={personaId}
      personaName={personaName}
      personaAvatar={persona?.avatar_url}
      onEndCall={() => onEndCall?.()}
      onBackToDashboard={onBackToDashboard}
    />
  );
}
