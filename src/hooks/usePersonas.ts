import { useState, useEffect } from 'react'
import { supabase, Persona } from '../lib/supabase'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function usePersonas() {
  const { user } = useAuth()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [sharedPersonas, setSharedPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchPersonas()
      handleInviteToken()
    }
  }, [user])

  // ✅ Check for invite token in URL and auto-accept
  const handleInviteToken = async () => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    if (!inviteToken || !user) return;

    try {
      // Find the invite
      const { data: invite, error } = await supabase
        .from('persona_collaborators')
        .select('*, personas(*)')
        .eq('invite_token', inviteToken)
        .eq('status', 'pending')
        .single();

      if (error || !invite) {
        toast.error('This invite link is invalid or has already been used.');
        return;
      }

      // Accept the invite
      const { error: updateError } = await supabase
        .from('persona_collaborators')
        .update({
          collaborator_id: user.id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('invite_token', inviteToken);

      if (updateError) throw updateError;

      toast.success(`You now have access to ${invite.personas?.name}'s memories! 💙`);

      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);

      // Refresh personas
      await fetchPersonas();

    } catch (error) {
      console.error('Error accepting invite:', error);
      toast.error('Could not accept invite. Please try again.');
    }
  };

  const fetchPersonas = async () => {
    try {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables not configured');
        toast.error('Database not configured. Please check your environment variables.');
        setLoading(false);
        return;
      }

      // ✅ Fetch owned personas
      const { data: ownedData, error: ownedError } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (ownedError) throw ownedError;

      // ✅ Fetch shared personas (accepted collaborations)
      const { data: collabData, error: collabError } = await supabase
        .from('persona_collaborators')
        .select('persona_id, personas(*)')
        .eq('collaborator_id', user?.id)
        .eq('status', 'accepted');

      if (collabError) {
        console.error('Error fetching shared personas:', collabError);
      }

      const sharedData = (collabData || [])
        .map((c: any) => c.personas)
        .filter(Boolean)
        .map((p: any) => ({ ...p, isShared: true }));

      setPersonas(ownedData || []);
      setSharedPersonas(sharedData);

    } catch (error) {
      console.error('Error fetching personas:', error);

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        toast.error('Unable to connect to database. Please check your internet connection.');
      } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        toast.error('Database tables not found. Please run the database migration first.');
      } else {
        toast.error('Failed to load personas. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const createPersona = async (personaData: Partial<Persona>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('personas')
        .insert({ ...personaData, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setPersonas(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error creating persona:', error);
      return null;
    }
  };

  const updatePersona = async (id: string, updates: Partial<Persona>) => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setPersonas(prev => prev.map(persona => persona.id === id ? data : persona));
      await fetchPersonas();
      return data;
    } catch (error) {
      console.error('Error updating persona:', error);
      return null;
    }
  };

  const deletePersona = async (id: string) => {
    try {
      const { error } = await supabase
        .from('personas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPersonas(prev => prev.filter(persona => persona.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting persona:', error);
      return false;
    }
  };

  return {
    personas,
    sharedPersonas,
    loading,
    createPersona,
    updatePersona,
    deletePersona,
    refetch: fetchPersonas,
  };
}
