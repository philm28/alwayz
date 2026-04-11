import React, { useState, useEffect } from 'react'
import { X, Mail, Lock, User, Shield, CheckCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // ✅ Beta token state
  const [betaToken, setBetaToken] = useState<string | null>(null)
  const [betaTokenValid, setBetaTokenValid] = useState<boolean | null>(null)
  const [betaTokenName, setBetaTokenName] = useState<string | null>(null)
  const [checkingToken, setCheckingToken] = useState(false)

  const { signIn, signUp } = useAuth()

  // ✅ Check for beta token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('beta')
    if (token) {
      setBetaToken(token)
      validateBetaToken(token)
      setIsSignUp(true)
    }
  }, [])

  const validateBetaToken = async (token: string) => {
    setCheckingToken(true)
    try {
      const { data, error } = await supabase
        .from('beta_tokens')
        .select('token, assigned_to_name, status')
        .eq('token', token)
        .eq('status', 'pending')
        .single()
      if (error || !data) {
        setBetaTokenValid(false)
        setBetaTokenName(null)
      } else {
        setBetaTokenValid(true)
        setBetaTokenName(data.assigned_to_name)
      }
    } catch {
      setBetaTokenValid(false)
    } finally {
      setCheckingToken(false)
    }
  }

  const activateBetaToken = async (token: string, userId: string, userEmail: string) => {
    try {
      await supabase
        .from('beta_tokens')
        .update({
          status: 'activated',
          activated_at: new Date().toISOString(),
          activated_by_user_id: userId,
          activated_by_email: userEmail
        })
        .eq('token', token)
    } catch (error) {
      console.error('Could not activate beta token:', error)
    }
  }

  const captureLocation = async (userId: string) => {
    try {
      const response = await fetch('https://ipapi.co/json/')
      if (!response.ok) return
      const data = await response.json()
      if (!data || data.error) return
      await supabase.from('user_locations').insert({
        user_id: userId,
        city: data.city || null,
        region: data.region || null,
        country: data.country_name || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      })
      await supabase.from('profiles').update({
        city: data.city || null,
        region: data.region || null,
        country: data.country_name || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      }).eq('user_id', userId)
    } catch (error) {
      console.warn('Could not capture location:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        if (betaToken && betaTokenValid === false) {
          setError('This beta invite link is invalid or has already been used.')
          setLoading(false)
          return
        }
        const { data, error } = await signUp(email, password, fullName)
        if (error) throw error
        if (data?.user?.id) {
          captureLocation(data.user.id)
          if (betaToken && betaTokenValid) {
            activateBetaToken(betaToken, data.user.id, email)
            window.history.replaceState({}, '', window.location.pathname)
          }
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
      }
      onSuccess?.()
      onClose()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address first'); return; }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setResetSent(true)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  if (showForgotPassword) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          {resetSent ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Check your email</h3>
              <p className="text-gray-600 mb-6">We sent a password reset link to <strong>{email}</strong></p>
              <button onClick={() => { setShowForgotPassword(false); setResetSent(false); }}
                className="text-purple-600 hover:text-purple-700 font-medium">
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="p-6 space-y-4">
              <p className="text-gray-600 text-sm">Enter your email and we'll send you a reset link.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email" required />
                </div>
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setShowForgotPassword(false); setError(''); }}
                  className="text-purple-600 hover:text-purple-700 font-medium text-sm">
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ✅ Beta token banner */}
        {betaToken && (
          <div className={`mx-6 mt-4 rounded-xl p-3 flex items-center gap-3 ${
            checkingToken ? 'bg-gray-50 border border-gray-200' :
            betaTokenValid ? 'bg-green-50 border border-green-200' :
            'bg-red-50 border border-red-200'
          }`}>
            {checkingToken ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">Validating your beta invite...</p>
              </>
            ) : betaTokenValid ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Beta invite for {betaTokenName}</p>
                  <p className="text-xs text-green-600">Create your account below to activate it</p>
                </div>
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Invalid or expired invite</p>
                  <p className="text-xs text-red-500">This link has already been used or doesn't exist</p>
                </div>
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your full name" required />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your email" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your password" required minLength={6} />
            </div>
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          {!isSignUp && (
            <div className="text-right">
              <button type="button" onClick={() => { setShowForgotPassword(true); setError(''); }}
                className="text-sm text-purple-600 hover:text-purple-700">
                Forgot your password?
              </button>
            </div>
          )}
          <button type="submit"
            disabled={loading || (isSignUp && betaToken !== null && betaTokenValid === false)}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50">
            {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
          <div className="text-center">
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-purple-600 hover:text-purple-700 font-medium">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
