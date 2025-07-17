import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Users, Clock, Heart, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AnalyticsData {
  conversationStats: {
    total: number;
    thisMonth: number;
    avgDuration: number;
    totalMinutes: number;
  };
  emotionalInsights: {
    emotion: string;
    count: number;
    color: string;
  }[];
  weeklyActivity: {
    day: string;
    conversations: number;
    duration: number;
  }[];
  personaUsage: {
    name: string;
    conversations: number;
    totalTime: number;
  }[];
  monthlyTrends: {
    month: string;
    conversations: number;
    avgDuration: number;
  }[];
}

export function Analytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get date range
      const now = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Fetch conversation data
      const { data: conversations } = await supabase
        .from('conversations')
        .select(`
          *,
          personas(name),
          messages(content, sender_type, timestamp)
        `)
        .eq('user_id', user!.id)
        .gte('started_at', startDate.toISOString());

      if (!conversations) {
        setAnalytics(null);
        return;
      }

      // Process analytics data
      const processedAnalytics = await processAnalyticsData(conversations);
      setAnalytics(processedAnalytics);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = async (conversations: any[]): Promise<AnalyticsData> => {
    // Conversation stats
    const totalConversations = conversations.length;
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    
    const thisMonthConversations = conversations.filter(
      conv => new Date(conv.started_at) >= thisMonthStart
    ).length;

    const totalMinutes = conversations.reduce((sum, conv) => sum + (conv.duration_seconds || 0), 0) / 60;
    const avgDuration = totalConversations > 0 ? totalMinutes / totalConversations : 0;

    // Emotional insights (simulated - in production, analyze message content)
    const emotionalInsights = [
      { emotion: 'Joy', count: 45, color: '#10B981' },
      { emotion: 'Nostalgia', count: 32, color: '#8B5CF6' },
      { emotion: 'Comfort', count: 28, color: '#06B6D4' },
      { emotion: 'Sadness', count: 15, color: '#EF4444' },
      { emotion: 'Peace', count: 22, color: '#F59E0B' }
    ];

    // Weekly activity
    const weeklyActivity = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayConversations = conversations.filter(conv => {
        const convDate = new Date(conv.started_at);
        return convDate.toDateString() === date.toDateString();
      });
      
      weeklyActivity.push({
        day: days[i],
        conversations: dayConversations.length,
        duration: dayConversations.reduce((sum, conv) => sum + (conv.duration_seconds || 0), 0) / 60
      });
    }

    // Persona usage
    const personaUsage = conversations.reduce((acc: any[], conv) => {
      const personaName = conv.personas?.name || 'Unknown';
      const existing = acc.find(p => p.name === personaName);
      
      if (existing) {
        existing.conversations++;
        existing.totalTime += (conv.duration_seconds || 0) / 60;
      } else {
        acc.push({
          name: personaName,
          conversations: 1,
          totalTime: (conv.duration_seconds || 0) / 60
        });
      }
      
      return acc;
    }, []);

    // Monthly trends
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthConversations = conversations.filter(conv => {
        const convDate = new Date(conv.started_at);
        return convDate >= monthStart && convDate <= monthEnd;
      });
      
      monthlyTrends.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        conversations: monthConversations.length,
        avgDuration: monthConversations.length > 0 
          ? monthConversations.reduce((sum, conv) => sum + (conv.duration_seconds || 0), 0) / monthConversations.length / 60
          : 0
      });
    }

    return {
      conversationStats: {
        total: totalConversations,
        thisMonth: thisMonthConversations,
        avgDuration: Math.round(avgDuration),
        totalMinutes: Math.round(totalMinutes)
      },
      emotionalInsights,
      weeklyActivity,
      personaUsage,
      monthlyTrends
    };
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="h-80 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-center">
        <div className="bg-white rounded-2xl shadow-sm p-12">
          <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Data Yet</h2>
          <p className="text-gray-600">Start having conversations with your personas to see analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Insights</h1>
          <p className="text-gray-600">Track your conversations and emotional journey</p>
        </div>
        
        <div className="flex space-x-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === range
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Conversations</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.conversationStats.total}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.conversationStats.thisMonth}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Duration</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.conversationStats.avgDuration}m</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Time</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.conversationStats.totalMinutes}m</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Weekly Activity */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Weekly Activity</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="conversations" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Emotional Insights */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Emotional Insights</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.emotionalInsights}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="count"
                label={({ emotion, count }) => `${emotion}: ${count}`}
              >
                {analytics.emotionalInsights.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trends */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Monthly Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="conversations" stroke="#8B5CF6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Persona Usage */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Persona Usage</h2>
          <div className="space-y-4">
            {analytics.personaUsage.map((persona, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">{persona.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{persona.name}</h3>
                    <p className="text-sm text-gray-600">{persona.conversations} conversations</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{Math.round(persona.totalTime)}m</p>
                  <p className="text-sm text-gray-600">total time</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}