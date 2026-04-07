import React, { useState, useEffect } from 'react';
import { Users, X, Copy, Check, Link, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface InviteFamilyProps {
  persona: any;
  onClose: () => void;
}

interface Collaborator {
  id: string;
  invite_token: string;
  status: string;
  role: string;
  created_at: string;
  collaborator_id: string | null;
}

export function InviteFamily({ persona, onClose }: InviteFamilyProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    loadCollaborators();
  }, []);

  const loadCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('persona_collaborators')
        .select('*')
        .eq('persona_id', persona.id)
        .eq('owner_id', user?.id);

      if (error) throw error;
      setCollaborators(data || []);
    } catch (error) {
      console.error('Error loading collaborators:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createInviteLink = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('persona_collaborators')
        .insert({
          persona_id: persona.id,
          owner_id: user?.id,
          status: 'pending',
          role: 'collaborator'
        })
        .select()
        .single();

      if (error) throw error;

      setCollaborators(prev => [...prev, data]);
      toast.success('Invite link created!');

      // Auto copy to clipboard
      const link = `${window.location.origin}?invite=${data.invite_token}`;
      await navigator.clipboard.writeText(link);
      setCopiedToken(data.invite_token);
      setTimeout(() => setCopiedToken(null), 3000);

    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error('Could not create invite link');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}?invite=${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success('Link copied!');
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const deleteInvite = async (id: string) => {
    try {
      const { error } = await supabase
        .from('persona_collaborators')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCollaborators(prev => prev.filter(c => c.id !== id));
      toast.success('Invite removed');
    } catch (error) {
      console.error('Error deleting invite:', error);
      toast.error('Could not remove invite');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Invite Family</h2>
                <p className="text-white/70 text-sm">Share {persona.name} with loved ones</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-8">
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            Generate a shareable link and send it to family members. When they click it and sign up,
            they'll have access to {persona.name}'s persona and can add their own memories.
          </p>

          {/* Create new invite */}
          <button
            onClick={createInviteLink}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2 mb-8"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Creating link...
              </>
            ) : (
              <>
                <Link className="h-5 w-5" />
                Generate Invite Link
              </>
            )}
          </button>

          {/* Existing invites */}
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : collaborators.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Active Invite Links ({collaborators.length})
              </h3>
              <div className="space-y-3">
                {collaborators.map(collab => (
                  <div key={collab.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-gray-500 truncate">
                        {window.location.origin}?invite={collab.invite_token}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          collab.status === 'accepted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {collab.status === 'accepted' ? '✓ Accepted' : 'Pending'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(collab.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyLink(collab.invite_token)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-all"
                        title="Copy link"
                      >
                        {copiedToken === collab.invite_token
                          ? <Check className="h-4 w-4 text-green-600" />
                          : <Copy className="h-4 w-4 text-gray-500" />
                        }
                      </button>
                      <button
                        onClick={() => deleteInvite(collab.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-all"
                        title="Remove invite"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No invites yet. Generate a link to share with family.</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>How it works:</strong> Share the link via text or email. When your family member clicks it and creates an account, they'll automatically get access to {persona.name}. Each person has their own private conversations while sharing the same memories.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
