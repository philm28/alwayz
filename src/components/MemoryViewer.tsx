import React, { useState, useEffect } from 'react';
import { Brain, Search, TrendingUp, Calendar, Tag, ExternalLink, RefreshCw } from 'lucide-react';
import { memoryConversationEngine } from '../lib/memoryConversation';
import { supabase } from '../lib/supabase';
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
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMemories = async () => {
    setIsRefreshing(true);
    try {
      // ✅ Pull fresh memories directly from Supabase
      const { data, error } = await supabase
        .from('persona_memories')
        .select('*')
        .eq('persona_id', personaId)
        .order('importance', { ascending: false })
        .limit(50);

      if (error) throw error;

      const byType: Record<string, number> = {};
      const bySource: Record<string, number> = {};

      (data || []).forEach((m: any) => {
        byType[m.memory_type || 'other'] = (byType[m.memory_type || 'other'] || 0) + 1;
        bySource[m.source_type || 'manual'] = (bySource[m.source_type || 'manual'] || 0) + 1;
      });

      setSummary({
        totalMemories: data?.length || 0,
        byType,
        bySource,
        recentMemories: data || []
      });

      setMemories(data || []);
      toast.success(`${data?.length || 0} memories loaded ✓`, { duration: 1500 });

    } catch (error) {
      console.error('Error refreshing memories:', error);
      toast.error('Could not refresh memories');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      fact: 'bg-blue-100 text-blue-700',
      experience: 'bg-purple-100 text-purple-700',
      preference: 'bg-green-100 text-green-700',
      relationship: 'bg-pink-100 text-pink-700',
      skill: 'bg-orange-100 text-orange-700',
      emotion: 'bg-yellow-100 text-yellow-700',
      story: 'bg-indigo-100 text-indigo-700',
      career: 'bg-cyan-100 text-cyan-700',
      interest: 'bg-teal-100 text-teal-700',
      phrase: 'bg-rose-100 text-rose-700',
      legacy: 'bg-amber-100 text-amber-700',
      biography: 'bg-violet-100 text-violet-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, string> = {
      manual: 'Manual',
      conversation: 'Conversation',
      web: 'Web',
      self_recorded: 'Self Recorded',
      video: 'Video',
      audio: 'Audio',
      image: 'Image',
      text: 'Text',
      social_media: 'Social Media'
    };
    return badges[source] || source;
  };

  const filteredMemories = memories.filter((memory: any) => {
    const type = memory.memory_type || memory.type || '';
    const source = memory.source_type || memory.source || '';
    const matchesSearch = !searchQuery ||
      memory.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || type === selectedType;
    const matchesSource = selectedSource === 'all' || source === selectedSource;
    return matchesSearch && matchesType && matchesSource;
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading memories...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Memory Bank</h2>
            <p className="text-xs text-gray-500">{summary?.totalMemories || 0} memories</p>
          </div>
        </div>
        <button
          onClick={refreshMemories}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      {summary && summary.totalMemories > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="text-2xl font-bold text-blue-600">{summary.totalMemories}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-2">By Type</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(summary.byType).slice(0, 4).map(([type, count]) => (
                <span key={type} className={`text-xs px-1.5 py-0.5 rounded-full ${getTypeColor(type)}`}>
                  {type}: {count as number}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          <option value="all">All Types</option>
          <option value="story">Story</option>
          <option value="fact">Fact</option>
          <option value="phrase">Phrase</option>
          <option value="career">Career</option>
          <option value="interest">Interest</option>
          <option value="relationship">Relationship</option>
          <option value="legacy">Legacy</option>
          <option value="biography">Biography</option>
        </select>

        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          <option value="all">All Sources</option>
          <option value="manual">Manual</option>
          <option value="conversation">Conversation</option>
          <option value="web">Web</option>
          <option value="self_recorded">Self Recorded</option>
          <option value="social_media">Social Media</option>
        </select>
      </div>

      {/* Memory list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No memories found</p>
            <p className="text-gray-300 text-xs mt-1">
              Add memories using the Enrich button
            </p>
          </div>
        ) : (
          filteredMemories.map((memory: any) => {
            const type = memory.memory_type || memory.type || 'other';
            const source = memory.source_type || memory.source || 'manual';
            const importance = memory.importance || 0;
            const timestamp = memory.created_at || memory.timestamp;

            return (
              <div
                key={memory.id}
                className="border border-gray-100 rounded-xl p-3 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeColor(type)}`}>
                    {type}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                    {getSourceBadge(source)}
                  </span>
                  {importance > 0.9 && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      ⭐ High importance
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                  {memory.content}
                </p>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">
                    {timestamp ? new Date(timestamp).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    }) : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    {Math.round(importance * 100)}% importance
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
