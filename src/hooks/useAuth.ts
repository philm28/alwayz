import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false)
  const [checkingAgreement, setCheckingAgreement] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        checkAgreement(session.user.id)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        checkAgreement(session.user.id)
      } else {
        // ✅ Reset agreement when logged out
        setHasAgreedToTerms(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ✅ Check if user has already agreed to terms
  const checkAgreement = async (userId: string) => {
    setCheckingAgreement(true)
    try {
      const { data, error } = await supabase
        .from('user_agreements')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      setHasAgreedToTerms(!!data && !error)
    } catch {
      setHasAgreedToTerms(false)
    } finally {
      setCheckingAgreement(false)
    }
  }

  // ✅ Call this after user agrees to terms
  const markAgreedToTerms = () => {
    setHasAgreedToTerms(true)
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          is_temporary: false
        },
      },
    })

    if (data.user && !error) {
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        email: data.user.email!,
        full_name: fullName,
      })
    }

    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    })
  }

  const signOut = async () => {
    setHasAgreedToTerms(false)
    return await supabase.auth.signOut()
  }

  return {
    user,
    session,
    loading,
    hasAgreedToTerms,
    checkingAgreement,
    markAgreedToTerms,
    signUp,
    signIn,
    signOut,
    createTemporaryUser: signUp
  }
}
