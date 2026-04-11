import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Copy, Check, Plus, Trash2, RefreshCw, Users, CheckCircle, Clock, XCircle, Shield, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface BetaToken {
  id: string;
  token: string;
  assigned_to_name: string;
  assigned_to_email: string | null;
  notes: string | null;
  status: 'pending' | 'activated' | 'revoked';
  created_at: string;
  activated_at: string | null;
  activated_by_email: string | null;
  shared_count: number;
}

const ADMIN_EMAIL = 'phil@gomangoai.com';

export function BetaAdmin() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<BetaToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'activated' | 'revoked'>('all');

  useEffect(() => {
    if (user) loadTokens();
  }, [user]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('beta_tokens')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error loading tokens:', error);
      toast.error('Could not load tokens');
    } finally {
      setLoading(false);
    }
  };

  const generateToken = () => {
    const prefix = 'BETA';
    const name = newName.trim().toUpperCase().replace(/\s+/g, '-').substring(0, 10);
    const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${name}-${suffix}`;
  };

  const createToken = async () => {
    if (!newName.trim()) { toast.error('Please enter a name'); return; }
    setIsCreating(true);
    try {
      const token = generateToken();
      const { data, error } = await supabase
        .from('beta_tokens')
        .insert({
          token,
          assigned_to_name: newName.trim(),
          assigned_to_email: newEmail.trim() || null,
          notes: newNotes.trim() || null,
          status: 'pending'
        })
        .select()
        .single();
      if (error) throw error;
      setTokens(prev => [data, ...prev]);
      setNewName(''); setNewEmail(''); setNewNotes('');
      setShowCreateForm(false);
      toast.success(`Beta link created for ${newName} ✓`);
    } catch (error) {
      toast.error('Could not create token');
    } finally {
      setIsCreating(false);
    }
  };

  const revokeToken = async (id: string, name: string) => {
    if (!confirm(`Revoke beta access for ${name}? They will no longer be able to sign up.`)) return;
    try {
      const { error } = await supabase
        .from('beta_tokens')
        .update({ status: 'revoked' })
        .eq('id', id);
      if (error) throw error;
      setTokens(prev => prev.map(t => t.id === id ? { ...t, status: 'revoked' } : t));
      toast.success(`Access revoked for ${name}`);
    } catch (error) {
      toast.error('Could not revoke token');
    }
  };

  const reinstateToken = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('beta_tokens')
        .update({ status: 'pending' })
        .eq('id', id);
      if (error) throw error;
      setTokens(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' } : t));
      toast.success(`Access reinstated for ${name}`);
    } catch (error) {
      toast.error('Could not reinstate token');
    }
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}?beta=${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success('Link copied!');
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const copyInviteMessage = async (token: BetaToken) => {
    const link = `${window.location.origin}?beta=${token.token}`;
    const message = `Hi ${token.assigned_to_name.split(' ')[0]},\n\nI'd love for you to be one of the first people to try AlwayZ — a platform I built to help families stay connected to loved ones they've lost.\n\nYour personal beta link:\n${link}\n\nThis link is just for you. Would love your honest feedback.\n\n— Phil`;
    await navigator.clipboard.writeText(message);
    toast.success('Invite message copied!');
  };

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Access restricted</p>
        </div>
      </div>
    );
  }

  const filtered = tokens.filter(t => filter === 'all' || t.status === filter);
  const stats = {
    total: tokens.length,
    pending: tokens.filter(t => t.status === 'pending').length,
    activated: tokens.filter(t => t.status === 'activated').length,
    revoked: tokens.filter(t => t.status === 'revoked').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Beta Access</h1>
            <p className="text-gray-500 mt-1">Manage and track all beta tester invitations</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadTokens}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-all">
              <RefreshCw className="h-5 w-5" />
            </button>
            <button onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:shadow-lg transition-all">
              <Plus className="h-4 w-4" />
              New Invite
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Activated', value: stats.activated, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Revoked', value: stats.revoked, color: 'text-red-500', bg: 'bg-red-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 shadow-sm border border-gray-100`}>
              <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Create New Beta Invite</h3>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g., Sarah Johnson"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email (optional)</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="sarah@email.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
                <input type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  placeholder="e.g., lost spouse last year"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={createToken} disabled={isCreating || !newName.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 hover:shadow-lg transition-all">
                {isCreating ? 'Creating...' : 'Create Invite Link'}
              </button>
              <button onClick={() => { setShowCreateForm(false); setNewName(''); setNewEmail(''); setNewNotes(''); }}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {(['all', 'pending', 'activated', 'revoked'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}>
              {f} {f !== 'all' && `(${stats[f as keyof typeof stats]})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No {filter === 'all' ? '' : filter} tokens yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(token => (
              <div key={token.id}
                className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                  token.status === 'revoked' ? 'opacity-60 border-gray-100' :
                  token.status === 'activated' ? 'border-green-100' :
                  'border-gray-100 hover:shadow-md'
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-gray-900">{token.assigned_to_name}</h3>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        token.status === 'activated' ? 'bg-green-100 text-green-700' :
                        token.status === 'revoked' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {token.status === 'activated' && <CheckCircle className="h-3 w-3" />}
                        {token.status === 'pending' && <Clock className="h-3 w-3" />}
                        {token.status === 'revoked' && <XCircle className="h-3 w-3" />}
                        {token.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                      {token.assigned_to_email && <span>{token.assigned_to_email}</span>}
                      {token.notes && <span className="italic">"{token.notes}"</span>}
                      <span>Created {new Date(token.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-lg border border-gray-100 font-mono">
                        {token.token}
                      </code>
                      <span className="text-gray-300">→</span>
                      <code className="text-xs text-blue-500 truncate max-w-xs">
                        {window.location.origin}?beta={token.token}
                      </code>
                    </div>
                    {token.status === 'activated' && token.activated_by_email && (
                      <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Activated by {token.activated_by_email} on {new Date(token.activated_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {token.status !== 'revoked' && (
                      <>
                        <button onClick={() => copyLink(token.token)} title="Copy invite link"
                          className="p-2 hover:bg-blue-50 rounded-lg transition-all text-blue-600">
                          {copiedToken === token.token
                            ? <Check className="h-4 w-4 text-green-600" />
                            : <Copy className="h-4 w-4" />}
                        </button>
                        <button onClick={() => copyInviteMessage(token)} title="Copy full invite message"
                          className="p-2 hover:bg-purple-50 rounded-lg transition-all text-purple-600">
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {token.status === 'pending' && (
                      <button onClick={() => revokeToken(token.id, token.assigned_to_name)} title="Revoke access"
                        className="p-2 hover:bg-red-50 rounded-lg transition-all text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {token.status === 'revoked' && (
                      <button onClick={() => reinstateToken(token.id, token.assigned_to_name)}
                        className="p-2 hover:bg-green-50 rounded-lg transition-all text-green-600 text-xs font-medium">
                        Reinstate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
