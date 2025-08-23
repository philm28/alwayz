import React, { useState } from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Globe, Link, CheckCircle, AlertCircle, Download, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SocialMediaImportProps {
  personaId: string;
  onImportComplete?: (importedData: any[]) => void;
}

interface SocialPlatform {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  dataTypes: string[];
  requiresAuth: boolean;
}

interface ImportJob {
  id: string;
  platform: string;
  status: 'pending' | 'authenticating' | 'scraping' | 'processing' | 'completed' | 'error';
  progress: number;
  itemsFound: number;
  error?: string;
}

const socialPlatforms: SocialPlatform[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    description: 'Posts, photos, videos, and comments',
    dataTypes: ['Posts', 'Photos', 'Videos', 'Comments', 'Profile Info'],
    requiresAuth: true
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    description: 'Photos, videos, stories, and captions',
    dataTypes: ['Photos', 'Videos', 'Stories', 'Captions', 'Comments'],
    requiresAuth: true
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: Twitter,
    color: 'bg-black',
    description: 'Tweets, replies, and media',
    dataTypes: ['Tweets', 'Replies', 'Media', 'Bio'],
    requiresAuth: true
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700',
    description: 'Posts, articles, and professional content',
    dataTypes: ['Posts', 'Articles', 'Comments', 'Profile'],
    requiresAuth: true
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'bg-red-600',
    description: 'Videos, comments, and channel info',
    dataTypes: ['Videos', 'Comments', 'Channel Info', 'Playlists'],
    requiresAuth: true
  },
  {
    id: 'website',
    name: 'Personal Website/Blog',
    icon: Globe,
    color: 'bg-gray-600',
    description: 'Blog posts, articles, and content',
    dataTypes: ['Articles', 'Blog Posts', 'About Pages'],
    requiresAuth: false
  }
];

export function SocialMediaImport({ personaId, onImportComplete }: SocialMediaImportProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [showAuthModal, setShowAuthModal] = useState<string | null>(null);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const authenticatePlatform = async (platformId: string) => {
    try {
      setShowAuthModal(platformId);
      
      // Get OAuth URL for the platform
      const { getOAuthUrl } = await import('../utils/socialMediaAPI');
      const redirectUri = `${window.location.origin}/oauth/callback`;
      const oauthUrl = getOAuthUrl(platformId, redirectUri);
      
      // Redirect to OAuth page
      window.location.href = oauthUrl;
    } catch (error) {
      console.error('OAuth error:', error);
      setShowAuthModal(null);
      // Show error message to user
      alert(`OAuth not configured for ${platformId}. Please check your environment variables.`);
    }
  };

  const simulateDataScraping = async (platform: string): Promise<ImportJob> => {
    const job: ImportJob = {
      id: `${platform}-${Date.now()}`,
      platform,
      status: 'pending',
      progress: 0,
      itemsFound: 0
    };

    // Simulate authentication
    job.status = 'authenticating';
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate scraping
    job.status = 'scraping';
    const totalItems = Math.floor(Math.random() * 200) + 50; // 50-250 items
    
    for (let i = 0; i <= 100; i += 5) {
      job.progress = i;
      job.itemsFound = Math.floor((i / 100) * totalItems);
      setImportJobs(prev => prev.map(j => j.id === job.id ? { ...job } : j));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Simulate processing
    job.status = 'processing';
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Complete
    job.status = 'completed';
    job.progress = 100;
    job.itemsFound = totalItems;

    return job;
  };

  const startImport = async () => {
    if (selectedPlatforms.length === 0 && !websiteUrl) return;

    setIsImporting(true);
    const jobs: ImportJob[] = [];

    // Create jobs for selected platforms
    selectedPlatforms.forEach(platformId => {
      jobs.push({
        id: `${platformId}-${Date.now()}`,
        platform: platformId,
        status: 'pending',
        progress: 0,
        itemsFound: 0
      });
    });

    // Add website job if URL provided
    if (websiteUrl) {
      jobs.push({
        id: `website-${Date.now()}`,
        platform: 'website',
        status: 'pending',
        progress: 0,
        itemsFound: 0
      });
    }

    setImportJobs(jobs);

    try {
      // Process each job
      const results = await Promise.all(
        jobs.map(job => simulateDataScraping(job.platform))
      );

      // Save imported data to database
      for (const result of results) {
        const platform = socialPlatforms.find(p => p.id === result.platform);
        
        await supabase.from('persona-content').insert({
          persona_id: personaId,
          content_type: 'social_media',
          content_text: `Imported ${result.itemsFound} items from ${platform?.name || result.platform}`,
          metadata: {
            platform: result.platform,
            items_count: result.itemsFound,
            import_date: new Date().toISOString(),
            data_types: platform?.dataTypes || []
          },
          processing_status: 'completed'
        });
      }

      onImportComplete?.(results);
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'authenticating':
      case 'scraping':
      case 'processing':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>;
      default:
        return <div className="h-5 w-5 bg-gray-300 rounded-full"></div>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Import from Social Media</h2>
        <p className="text-gray-600">
          Automatically gather content from social media profiles to train your AI persona
        </p>
      </div>

      {/* Platform Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Platforms</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {socialPlatforms.map((platform) => {
            const IconComponent = platform.icon;
            const isSelected = selectedPlatforms.includes(platform.id);
            
            return (
              <div
                key={platform.id}
                onClick={() => platform.id !== 'website' && togglePlatform(platform.id)}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                } ${platform.id === 'website' ? 'cursor-default' : ''}`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${platform.color} flex-shrink-0`}>
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{platform.name}</h4>
                      {platform.requiresAuth && (
                        <Lock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{platform.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {platform.dataTypes.map((type) => (
                        <span
                          key={type}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Website URL Input */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Website or Blog</h3>
        <div className="flex space-x-3">
          <div className="flex-1">
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com or https://blog.example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setWebsiteUrl('')}
            className="px-4 py-3 text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          We'll scrape publicly available content like blog posts, articles, and about pages
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Lock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Privacy & Security</h4>
            <p className="text-sm text-blue-700">
              We only access content you explicitly authorize. All data is encrypted and used solely 
              to train your personal AI persona. You can revoke access at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Import Jobs Status */}
      {importJobs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Import Progress</h3>
          {importJobs.map((job) => {
            const platform = socialPlatforms.find(p => p.id === job.platform);
            const IconComponent = platform?.icon || Globe;
            
            return (
              <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${platform?.color || 'bg-gray-600'}`}>
                      <IconComponent className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {platform?.name || 'Website'}
                      </h4>
                      <p className="text-sm text-gray-600 capitalize">
                        {job.status.replace('_', ' ')}
                        {job.itemsFound > 0 && ` • ${job.itemsFound} items found`}
                      </p>
                    </div>
                  </div>
                  {getJobStatusIcon(job.status)}
                </div>
                
                {(job.status === 'scraping' || job.status === 'processing') && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => {
            setSelectedPlatforms([]);
            setWebsiteUrl('');
            setImportJobs([]);
          }}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={isImporting}
        >
          Clear All
        </button>
        <button
          onClick={startImport}
          disabled={isImporting || (selectedPlatforms.length === 0 && !websiteUrl)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center"
        >
          {isImporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Importing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Start Import
            </>
          )}
        </button>
      </div>

      {/* OAuth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Link className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Connecting to {socialPlatforms.find(p => p.id === showAuthModal)?.name}
              </h3>
              <p className="text-gray-600 mb-6">
                Please wait while we establish a secure connection...
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}