import { useState, useEffect } from 'react'
import { supabase, Persona } from '../lib/supabase'
import { useAuth } from './useAuth'

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
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPersonas(data || [])
    } catch (error) {
      console.error('Error fetching personas:', error)
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