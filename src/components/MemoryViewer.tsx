import React, { useState, useEffect } from 'react';
import { Brain, Search, Filter, TrendingUp, Calendar, Tag, ExternalLink } from 'lucide-react';
import { memoryConversationEngine } from '../lib/memoryConversation';
import { Memory } from '../lib/memoryExtraction';
import toast from 'react-hot-toast';

interface MemoryViewerProps {
  personaId: string;
  personaName: string;
}

export function MemoryViewer({ personaId, personaName }: MemoryViewerProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadMemorySummary();
  }, [personaId]);

  const loadMemorySummary = async () => {
    setIsLoading(true);
    try {
      const data = await memoryConversationEngine.getMemorySummary(personaId);
      setSummary(data);
      setMemories(data.recentMemories);
    } catch (error) {
      console.error('Error loading memories:', error);
      toast.error('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  };

  const processAllContent = async () => {
    setIsProcessing(true);
    try {
      toast.loading('Processing all content and extracting memories...', { id: 'process-memories' });

      const result = await memoryConversationEngine.processAllPendingContent(personaId);

      toast.success(
        `Processed ${result.processed} items and extracted ${result.memoriesExtracted} memories!`,
        { id: 'process-memories' }
      );

      await loadMemorySummary();
    } catch (error) {
      console.error('Error processing content:', error);
      toast.error('Failed to process content', { id: 'process-memories' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getMemoryIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      fact: <Tag className="h-4 w-4" />,
      experience: <Calendar className="h-4 w-4" />,
      preference: <TrendingUp className="h-4 w-4" />,
      relationship: <ExternalLink className="h-4 w-4" />,
      skill: <Brain className="h-4 w-4" />,
      emotion: <TrendingUp className="h-4 w-4" />
    };
    return icons[type] || <Tag className="h-4 w-4" />;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      fact: 'bg-blue-100 text-blue-700',
      experience: 'bg-purple-100 text-purple-700',
      preference: 'bg-green-100 text-green-700',
      relationship: 'bg-pink-100 text-pink-700',
      skill: 'bg-orange-100 text-orange-700',
      emotion: 'bg-yellow-100 text-yellow-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, string> = {
      video: 'Video',
      audio: 'Audio',
      image: 'Image',
      text: 'Text',
      social_media: 'Social Media'
    };
    return badges[source] || source;
  };

  const filteredMemories = memories.filter(memory => {
    const matchesSearch = !searchQuery || memory.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || memory.type === selectedType;
    const matchesSource = selectedSource === 'all' || memory.source === selectedSource;
    return matchesSearch && matchesType && matchesSource;
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading memories...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Memory Bank</h2>
            <p className="text-gray-600">{personaName}'s extracted memories</p>
          </div>
        </div>

        <button
          onClick={processAllContent}
          disabled={isProcessing}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            isProcessing
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Process All Content'}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Memories</p>
            <p className="text-3xl font-bold text-blue-600">{summary.totalMemories}</p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Memory Types</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(summary.byType).map(([type, count]) => (
                <span
                  key={type}
                  className={`text-xs px-2 py-1 rounded-full ${getTypeColor(type)}`}
                >
                  {type}: {count as number}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Sources</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(summary.bySource).map(([source, count]) => (
                <span
                  key={source}
                  className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700"
                >
                  {getSourceBadge(source)}: {count as number}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="fact">Facts</option>
          <option value="experience">Experiences</option>
          <option value="preference">Preferences</option>
          <option value="relationship">Relationships</option>
          <option value="skill">Skills</option>
          <option value="emotion">Emotions</option>
        </select>

        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Sources</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="image">Image</option>
          <option value="text">Text</option>
          <option value="social_media">Social Media</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No memories found</p>
            <p className="text-gray-400 text-sm">
              Upload content or connect social media to start building the memory bank
            </p>
          </div>
        ) : (
          filteredMemories.map((memory) => (
            <div
              key={memory.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getTypeColor(memory.type)}`}>
                    {getMemoryIcon(memory.type)}
                    {memory.type}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    {getSourceBadge(memory.source)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Importance: {Math.round(memory.importance * 100)}%
                  </span>
                </div>
              </div>

              <p className="text-gray-800 mb-2">{memory.content}</p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(memory.timestamp).toLocaleDateString()}</span>
                {memory.metadata?.topics && memory.metadata.topics.length > 0 && (
                  <div className="flex gap-1">
                    {memory.metadata.topics.slice(0, 3).map((topic: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 rounded">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
