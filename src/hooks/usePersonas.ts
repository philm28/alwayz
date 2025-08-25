import { useState, useEffect } from 'react'
import { supabase, Persona } from '../lib/supabase'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function usePersonas() {
  const { user } = useAuth()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchPersonas()
    }
  }, [user])

  const fetchPersonas = async () => {
    try {
      // Check if Supabase is configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables not configured');
        toast.error('Database not configured. Please check your environment variables.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPersonas(data || [])
    } catch (error) {
      console.error('Error fetching personas:', error)
      
      // Handle specific error types
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        toast.error('Unable to connect to database. Please check your internet connection and Supabase configuration.');
      } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        toast.error('Database tables not found. Please run the database migration first.');
      } else {
        toast.error('Failed to load personas. Please try again.');
      }
    } finally {
      setLoading(false)
    }
  }

  const createPersona = async (personaData: Partial<Persona>) => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('personas')
        .insert({
          ...personaData,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      
      setPersonas(prev => [data, ...prev])
      return data
    } catch (error) {
      console.error('Error creating persona:', error)
      return null
    }
  }

  const updatePersona = async (id: string, updates: Partial<Persona>) => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      
      setPersonas(prev => 
        prev.map(persona => persona.id === id ? data : persona)
      )
      return data
    } catch (error) {
      console.error('Error updating persona:', error)
      return null
    }
  }

  const deletePersona = async (id: string) => {
    try {
      const { error } = await supabase
        .from('personas')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setPersonas(prev => prev.filter(persona => persona.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting persona:', error)
      return false
    }
  }

  return {
    personas,
    loading,
    createPersona,
    updatePersona,
    deletePersona,
    refetch: fetchPersonas,
  }
}