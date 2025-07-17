import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface TemporaryLoginProps {
  onClose: () => void;
}

export function TemporaryLogin({ onClose }: TemporaryLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginCreated, setLoginCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate a random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  // Create a temporary user
  const createTemporaryUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please provide both email and password');
      return;
    }
    
    setLoading(true);
    
    try {
      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: 'Temporary User',
            is_temporary: true
          }
        }
      });
      
      if (error) throw error;
      
      // Create profile
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: data.user.id,
          email: email,
          full_name: 'Temporary User',
          subscription_tier: 'free'
        });
        
        if (profileError) throw profileError;
      }
      
      setLoginCreated(true);
      toast.success('Temporary login created successfully!');
    } catch (error) {
      console.error('Error creating temporary user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create temporary user');
    } finally {
      setLoading(false);
    }
  };

  // Copy login details to clipboard
  const copyLoginDetails = () => {
    const text = `Temporary Login for AlwayZ\n\nEmail: ${email}\nPassword: ${password}\n\nThis is a temporary account for demonstration purposes.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Login details copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {loginCreated ? 'Temporary Login Created' : 'Create Temporary Login'}
        </h2>
        
        {!loginCreated ? (
          <form onSubmit={createTemporaryUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter email for temporary user"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter or generate password"
                  required
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-purple-600 hover:text-purple-700"
                >
                  Generate
                </button>
              </div>
            </div>
            
            <div className="pt-4 flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-800">Login Created Successfully</h4>
                  <p className="text-sm text-green-700 mt-1">
                    A temporary account has been created. Share these details with your guest.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700">Email:</p>
                <p className="text-gray-900">{email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Password:</p>
                <p className="text-gray-900">{password}</p>
              </div>
            </div>
            
            <button
              onClick={copyLoginDetails}
              className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5 mr-2" />
                  Copy Login Details
                </>
              )}
            </button>
            
            <div className="pt-4">
              <button
                onClick={onClose}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}