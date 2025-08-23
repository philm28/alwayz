import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle, AlertCircle, ExternalLink, Key } from 'lucide-react';

export function OpenAIStatus() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isWorking, setIsWorking] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkOpenAIConfiguration();
  }, []);

  const checkOpenAIConfiguration = () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    setIsConfigured(!!apiKey && apiKey !== 'your_openai_api_key' && apiKey.startsWith('sk-'));
  };

  const testOpenAIConnection = async () => {
    setTesting(true);
    
    try {
      // Import AI engine and test it
      const { AIPersonaEngine } = await import('../lib/ai');
      
      const testPersona = {
        id: 'test',
        name: 'Test Persona',
        personality_traits: 'Friendly and helpful',
        common_phrases: ['Hello there!'],
        relationship: 'Friend',
        memories: [],
        conversationHistory: []
      };

      const aiEngine = new AIPersonaEngine(testPersona);
      const response = await aiEngine.generateResponse('Hello, how are you?');
      
      if (response && response.length > 10) {
        setIsWorking(true);
      } else {
        setIsWorking(false);
      }
    } catch (error) {
      console.error('OpenAI test failed:', error);
      setIsWorking(false);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 max-w-md mx-auto">
      <div className="flex items-center mb-4">
        <Brain className="h-6 w-6 text-purple-600 mr-3" />
        <h2 className="text-xl font-bold text-gray-900">OpenAI Integration</h2>
      </div>
      
      <div className="space-y-4">
        {/* Configuration Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {isConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">API Key</h3>
              <p className="text-sm text-gray-600">
                {isConfigured ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </div>
        </div>

        {/* Connection Test */}
        {isConfigured && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {testing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                ) : isWorking === true ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : isWorking === false ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Brain className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Connection</h3>
                <p className="text-sm text-gray-600">
                  {testing ? 'Testing...' : 
                   isWorking === true ? 'Working correctly' :
                   isWorking === false ? 'Connection failed' : 'Not tested'}
                </p>
              </div>
            </div>
            <button
              onClick={testOpenAIConnection}
              disabled={testing}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              Test
            </button>
          </div>
        )}

        {/* Setup Instructions */}
        {!isConfigured && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Setup Required</h4>
            <p className="text-sm text-blue-700 mb-3">
              To enable real-time AI responses, you need to add your OpenAI API key.
            </p>
            <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
              <li>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">OpenAI Platform</a></li>
              <li>Add it to your environment variables as VITE_OPENAI_API_KEY</li>
              <li>Restart your development server or redeploy</li>
            </ol>
          </div>
        )}

        {/* Current Status */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
          <p className="text-sm text-gray-600">
            {isConfigured && isWorking ? (
              <>
                <span className="text-green-600 font-medium">✅ Real AI responses enabled</span>
                <br />
                Your personas will generate authentic, contextual responses using OpenAI's GPT-4.
              </>
            ) : isConfigured && isWorking === false ? (
              <>
                <span className="text-red-600 font-medium">❌ OpenAI connection failed</span>
                <br />
                Check your API key and account status. Using simulated responses as fallback.
              </>
            ) : isConfigured ? (
              <>
                <span className="text-yellow-600 font-medium">⚠️ Not tested yet</span>
                <br />
                Click "Test" to verify your OpenAI connection.
              </>
            ) : (
              <>
                <span className="text-gray-600 font-medium">🤖 Using simulated responses</span>
                <br />
                Add your OpenAI API key to enable real AI-powered conversations.
              </>
            )}
          </p>
        </div>

        {/* Help Link */}
        <div className="text-center">
          <a
            href="/OPENAI_SETUP_GUIDE.md"
            target="_blank"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium text-sm"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Setup Guide
          </a>
        </div>
      </div>
    </div>
  );
}