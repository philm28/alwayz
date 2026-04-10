import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Users, Clock, MessageCircle, Globe, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AnalyticsData {
  conversationStats: {
    total: number;
    thisMonth: number;
    avgDuration: number;
    totalMinutes: number;
  };
  emotionalInsights: { emotion: string; count: number; color: string; }[];
  weeklyActivity: { day: string; conversations: number; duration: number; }[];
  personaUsage: { name: string; conversations: number; totalTime: number; }[];
  monthlyTrends: { month: string; conversations: number; avgDuration: number; }[];
}

interface UserLocation {
  id: string;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

interface LocationGroup {
  city: string;
  region: string;
  country: string;
  count: number;
  latitude: number;
  longitude: number;
}

// ✅ Convert lat/lng to SVG x/y on a simple equirectangular projection
function latLngToXY(lat: number, lng: number, width: number, height: number) {
  const x = (lng + 180) * (width / 360);
  const y = (90 - lat) * (height / 180);
  return { x, y };
}

const MAP_W = 800;
const MAP_H = 400;

export function Analytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [activeTab, setActiveTab] = useState<'insights' | 'users'>('insights');
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingMap, setLoadingMap] = useState(false);
  const [hoveredLocation, setHoveredLocation] = useState<LocationGroup | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (user) loadAnalytics();
  }, [user, timeRange]);

  useEffect(() => {
    if (activeTab === 'users') loadLocationData();
  }, [activeTab]);

  const loadLocationData = async () => {
    setLoadingMap(true);
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLocations(data || []);
      setTotalUsers(data?.length || 0);

      const groups: Record<string, LocationGroup> = {};
      (data || []).forEach((loc: UserLocation) => {
        if (!loc.latitude || !loc.longitude) return;
        const key = `${loc.city}-${loc.country}`;
        if (groups[key]) {
          groups[key].count++;
        } else {
          groups[key] = {
            city: loc.city || 'Unknown',
            region: loc.region || '',
            country: loc.country || 'Unknown',
            count: 1,
            latitude: loc.latitude,
            longitude: loc.longitude,
          };
        }
      });

      setLocationGroups(Object.values(groups));
    } catch (error) {
      console.error('Error loading location data:', error);
    } finally {
      setLoadingMap(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case 'week': startDate.setDate(now.getDate() - 7); break;
        case 'month': startDate.setMonth(now.getMonth() - 1); break;
        case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
      }

      const { data: conversations } = await supabase
        .from('conversations')
        .select(`*, personas(name), messages(content, sender_type, timestamp)`)
        .eq('user_id', user!.id)
        .gte('started_at', startDate.toISOString());

      if (!conversations) { setAnalytics(null); return; }
      setAnalytics(await processAnalyticsData(conversations));
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = async (conversations: any[]): Promise<AnalyticsData> => {
    const totalConversations = conversations.length;
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const thisMonthConversations = conversations.filter(
      conv => new Date(conv.started_at) >= thisMonthStart
    ).length;
    const totalMinutes = conversations.reduce((sum, conv) => sum + (conv.duration_seconds || 0), 0) / 60;
    const avgDuration = totalConversations > 0 ? totalMinutes / totalConversations : 0;

    const emotionalInsights = [
      { emotion: 'Joy', count: 45, color: '#10B981' },
      { emotion: 'Nostalgia', count: 32, color: '#8B5CF6' },
      { emotion: 'Comfort', count: 28, color: '#06B6D4' },
      { emotion: 'Sadness', count: 15, color: '#EF4444' },
      { emotion: 'Peace', count: 22, color: '#F59E0B' }
    ];

    const weeklyActivity = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayConversations = conversations.filter(conv =>
        new Date(conv.started_at).toDateString() === date.toDateString()
      );
      weeklyActivity.push({
        day: days[i],
        conversations: dayConversations.length,
        duration: dayConversations.reduce((sum, conv) => sum + (conv.duration_seconds || 0), 0) / 60
      });
    }

    const personaUsage = conversations.reduce((acc: any[], conv) => {
      const personaName = conv.personas?.name || 'Unknown';
      const existing = acc.find(p => p.name === personaName);
      if (existing) { existing.conversations++; existing.totalTime += (conv.duration_seconds || 0) / 60; }
      else acc.push({ name: personaName, conversations: 1, totalTime: (conv.duration_seconds || 0) / 60 });
      return acc;
    }, []);

    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const monthConversations = conversations.filter(conv => {
        const d = new Date(conv.started_at);
        return d >= monthStart && d <= monthEnd;
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
      emotionalInsights, weeklyActivity, personaUsage, monthlyTrends
    };
  };

  const countryBreakdown = locationGroups.reduce((acc: Record<string, number>, loc) => {
    acc[loc.country] = (acc[loc.country] || 0) + loc.count;
    return acc;
  }, {});

  const countryList = Object.entries(countryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (loading && activeTab === 'insights') {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl" />)}
          </div>
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
          <p className="text-gray-600">Track your conversations, users, and emotional journey</p>
        </div>
        {activeTab === 'insights' && (
          <div className="flex space-x-2">
            {(['week', 'month', 'year'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeRange === range ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-6 py-3 font-medium text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'insights' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Conversation Insights
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium text-sm transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'users' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="h-4 w-4" />
          User Map
        </button>
      </div>

      {/* ✅ USER MAP TAB */}
      {activeTab === 'users' && (
        <div className="space-y-6">

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Countries</p>
                <p className="text-3xl font-bold text-gray-900">{Object.keys(countryBreakdown).length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cities</p>
                <p className="text-3xl font-bold text-gray-900">{locationGroups.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {loadingMap ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
              <p className="text-gray-500">Loading user map...</p>
            </div>
          ) : totalUsers === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No users yet</h3>
              <p className="text-gray-500">When beta users sign up their locations will appear here.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">

              {/* ✅ SVG World Map */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">User Locations</h3>
                  <p className="text-xs text-gray-400">Hover a dot to see details — approximate location by IP</p>
                </div>
                <div className="relative bg-slate-900 p-2">
                  <svg
                    viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                    className="w-full"
                    style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
                  >
                    {/* ✅ Simple world map outline using a natural earth projection approximation */}
                    {/* Ocean background */}
                    <rect width={MAP_W} height={MAP_H} fill="#0f172a" />

                    {/* Grid lines */}
                    {[-60, -30, 0, 30, 60].map(lat => {
                      const { y } = latLngToXY(lat, 0, MAP_W, MAP_H);
                      return (
                        <line key={lat} x1={0} y1={y} x2={MAP_W} y2={y}
                          stroke="#1e293b" strokeWidth={0.5} />
                      );
                    })}
                    {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(lng => {
                      const { x } = latLngToXY(0, lng, MAP_W, MAP_H);
                      return (
                        <line key={lng} x1={x} y1={0} x2={x} y2={MAP_H}
                          stroke="#1e293b" strokeWidth={0.5} />
                      );
                    })}

                    {/* ✅ Continent outlines as simplified polygons */}
                    {/* North America */}
                    <polygon
                      points={[
                        [latLngToXY(70, -140, MAP_W, MAP_H), latLngToXY(70, -60, MAP_W, MAP_H)],
                        [latLngToXY(70, -60, MAP_W, MAP_H), latLngToXY(50, -55, MAP_W, MAP_H)],
                        [latLngToXY(50, -55, MAP_W, MAP_H), latLngToXY(45, -60, MAP_W, MAP_H)],
                        [latLngToXY(45, -60, MAP_W, MAP_H), latLngToXY(25, -80, MAP_W, MAP_H)],
                        [latLngToXY(25, -80, MAP_W, MAP_H), latLngToXY(15, -85, MAP_W, MAP_H)],
                        [latLngToXY(15, -85, MAP_W, MAP_H), latLngToXY(10, -75, MAP_W, MAP_H)],
                        [latLngToXY(10, -75, MAP_W, MAP_H), latLngToXY(20, -105, MAP_W, MAP_H)],
                        [latLngToXY(20, -105, MAP_W, MAP_H), latLngToXY(30, -110, MAP_W, MAP_H)],
                        [latLngToXY(30, -110, MAP_W, MAP_H), latLngToXY(50, -125, MAP_W, MAP_H)],
                        [latLngToXY(50, -125, MAP_W, MAP_H), latLngToXY(60, -140, MAP_W, MAP_H)],
                        [latLngToXY(60, -140, MAP_W, MAP_H), latLngToXY(70, -140, MAP_W, MAP_H)],
                      ].map(([p]) => `${p.x},${p.y}`).join(' ')}
                      fill="#1e3a5f" stroke="#2563eb" strokeWidth={0.5} opacity={0.7}
                    />

                    {/* South America */}
                    <polygon
                      points={[
                        latLngToXY(12, -72, MAP_W, MAP_H),
                        latLngToXY(10, -60, MAP_W, MAP_H),
                        latLngToXY(5, -52, MAP_W, MAP_H),
                        latLngToXY(-10, -37, MAP_W, MAP_H),
                        latLngToXY(-25, -43, MAP_W, MAP_H),
                        latLngToXY(-35, -57, MAP_W, MAP_H),
                        latLngToXY(-55, -67, MAP_W, MAP_H),
                        latLngToXY(-55, -75, MAP_W, MAP_H),
                        latLngToXY(-40, -72, MAP_W, MAP_H),
                        latLngToXY(-20, -70, MAP_W, MAP_H),
                        latLngToXY(0, -78, MAP_W, MAP_H),
                        latLngToXY(12, -72, MAP_W, MAP_H),
                      ].map(p => `${p.x},${p.y}`).join(' ')}
                      fill="#1e3a5f" stroke="#2563eb" strokeWidth={0.5} opacity={0.7}
                    />

                    {/* Europe */}
                    <polygon
                      points={[
                        latLngToXY(71, 28, MAP_W, MAP_H),
                        latLngToXY(70, 32, MAP_W, MAP_H),
                        latLngToXY(60, 30, MAP_W, MAP_H),
                        latLngToXY(55, 24, MAP_W, MAP_H),
                        latLngToXY(50, 20, MAP_W, MAP_H),
                        latLngToXY(45, 28, MAP_W, MAP_H),
                        latLngToXY(37, 27, MAP_W, MAP_H),
                        latLngToXY(36, 10, MAP_W, MAP_H),
                        latLngToXY(43, -9, MAP_W, MAP_H),
                        latLngToXY(48, -5, MAP_W, MAP_H),
                        latLngToXY(51, 2, MAP_W, MAP_H),
                        latLngToXY(58, 5, MAP_W, MAP_H),
                        latLngToXY(62, 5, MAP_W, MAP_H),
                        latLngToXY(71, 28, MAP_W, MAP_H),
                      ].map(p => `${p.x},${p.y}`).join(' ')}
                      fill="#1e3a5f" stroke="#2563eb" strokeWidth={0.5} opacity={0.7}
                    />

                    {/* Africa */}
                    <polygon
                      points={[
                        latLngToXY(37, -5, MAP_W, MAP_H),
                        latLngToXY(37, 11, MAP_W, MAP_H),
                        latLngToXY(30, 32, MAP_W, MAP_H),
                        latLngToXY(20, 38, MAP_W, MAP_H),
                        latLngToXY(10, 42, MAP_W, MAP_H),
                        latLngToXY(0, 42, MAP_W, MAP_H),
                        latLngToXY(-10, 40, MAP_W, MAP_H),
                        latLngToXY(-25, 32, MAP_W, MAP_H),
                        latLngToXY(-35, 27, MAP_W, MAP_H),
                        latLngToXY(-34, 18, MAP_W, MAP_H),
                        latLngToXY(-20, 13, MAP_W, MAP_H),
                        latLngToXY(-5, 8, MAP_W, MAP_H),
                        latLngToXY(5, -5, MAP_W, MAP_H),
                        latLngToXY(15, -17, MAP_W, MAP_H),
                        latLngToXY(28, -13, MAP_W, MAP_H),
                        latLngToXY(37, -5, MAP_W, MAP_H),
                      ].map(p => `${p.x},${p.y}`).join(' ')}
                      fill="#1e3a5f" stroke="#2563eb" strokeWidth={0.5} opacity={0.7}
                    />

                    {/* Asia */}
                    <polygon
                      points={[
                        latLngToXY(71, 32, MAP_W, MAP_H),
                        latLngToXY(71, 180, MAP_W, MAP_H),
                        latLngToXY(60, 165, MAP_W, MAP_H),
                        latLngToXY(50, 142, MAP_W, MAP_H),
                        latLngToXY(35, 139, MAP_W, MAP_H),
                        latLngToXY(22, 114, MAP_W, MAP_H),
                        latLngToXY(10, 104, MAP_W, MAP_H),
                        latLngToXY(5, 100, MAP_W, MAP_H),
                        latLngToXY(20, 93, MAP_W, MAP_H),
                        latLngToXY(22, 72, MAP_W, MAP_H),
                        latLngToXY(12, 44, MAP_W, MAP_H),
                        latLngToXY(20, 38, MAP_W, MAP_H),
                        latLngToXY(30, 32, MAP_W, MAP_H),
                        latLngToXY(37, 36, MAP_W, MAP_H),
                        latLngToXY(42, 45, MAP_W, MAP_H),
                        latLngToXY(55, 60, MAP_W, MAP_H),
                        latLngToXY(60, 60, MAP_W, MAP_H),
                        latLngToXY(71, 32, MAP_W, MAP_H),
                      ].map(p => `${p.x},${p.y}`).join(' ')}
                      fill="#1e3a5f" stroke="#2563eb" strokeWidth={0.5} opacity={0.7}
                    />

                    {/* Australia */}
                    <polygon
                      points={[
                        latLngToXY(-15, 130, MAP_W, MAP_H),
                        latLngToXY(-15, 137, MAP_W, MAP_H),
                        latLngToXY(-12, 142, MAP_W, MAP_H),
                        latLngToXY(-20, 149, MAP_W, MAP_H),
                        latLngToXY(-30, 153, MAP_W, MAP_H),
                        latLngToXY(-38, 147, MAP_W, MAP_H),
                        latLngToXY(-39, 140, MAP_W, MAP_H),
                        latLngToXY(-35, 137, MAP_W, MAP_H),
                        latLngToXY(-32, 116, MAP_W, MAP_H),
                        latLngToXY(-22, 114, MAP_W, MAP_H),
                        latLngToXY(-18, 122, MAP_W, MAP_H),
                        latLngToXY(-15, 130, MAP_W, MAP_H),
                      ].map(p => `${p.x},${p.y}`).join(' ')}
                      fill="#1e3a5f" stroke="#2563eb" strokeWidth={0.5} opacity={0.7}
                    />

                    {/* ✅ User location dots */}
                    {locationGroups.map((group, i) => {
                      const { x, y } = latLngToXY(group.latitude, group.longitude, MAP_W, MAP_H);
                      const r = Math.min(18, 6 + group.count * 3);
                      return (
                        <g key={i}>
                          {/* Pulse ring */}
                          <circle cx={x} cy={y} r={r + 4} fill="none"
                            stroke="#7C3AED" strokeWidth={1} opacity={0.3}>
                            <animate attributeName="r" values={`${r+2};${r+8};${r+2}`}
                              dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;0;0.4"
                              dur="3s" repeatCount="indefinite" />
                          </circle>
                          {/* Main dot */}
                          <circle
                            cx={x} cy={y} r={r}
                            fill="url(#dotGradient)"
                            stroke="white"
                            strokeWidth={1.5}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => {
                              const rect = (e.target as SVGElement)
                                .closest('svg')!
                                .getBoundingClientRect();
                              const svgX = (x / MAP_W) * rect.width;
                              const svgY = (y / MAP_H) * rect.height;
                              setHoveredLocation(group);
                              setTooltipPos({ x: svgX, y: svgY });
                            }}
                            onMouseLeave={() => setHoveredLocation(null)}
                          />
                          {/* Count label for bigger dots */}
                          {group.count > 1 && (
                            <text x={x} y={y + 4} textAnchor="middle"
                              fill="white" fontSize={r > 10 ? 9 : 7} fontWeight="700"
                              style={{ pointerEvents: 'none' }}>
                              {group.count}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Gradient def */}
                    <defs>
                      <radialGradient id="dotGradient" cx="40%" cy="35%">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </radialGradient>
                    </defs>
                  </svg>

                  {/* ✅ Hover tooltip */}
                  {hoveredLocation && (
                    <div
                      className="absolute pointer-events-none bg-gray-900/95 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-purple-500/30 z-10"
                      style={{
                        left: Math.min(tooltipPos.x + 12, 320),
                        top: Math.max(tooltipPos.y - 40, 8),
                        minWidth: '140px'
                      }}
                    >
                      <div className="font-bold text-sm mb-0.5">{hoveredLocation.city}</div>
                      <div className="text-gray-300">{hoveredLocation.country}</div>
                      <div className="text-purple-400 font-semibold mt-1">
                        {hoveredLocation.count} user{hoveredLocation.count > 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right panel — country list + recent signups */}
              <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">By Country</h3>
                  {countryList.length === 0 ? (
                    <p className="text-gray-400 text-sm">No data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {countryList.map(([country, count]) => (
                        <div key={country}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-gray-700">{country}</span>
                            <span className="text-sm font-bold text-purple-600">{count}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${(count / totalUsers) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Signups</h4>
                  <div className="space-y-2">
                    {locations.slice(0, 8).map(loc => (
                      <div key={loc.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
                        <span className="text-xs text-gray-600 truncate">
                          {loc.city || 'Unknown'}, {loc.country || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                          {new Date(loc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INSIGHTS TAB */}
      {activeTab === 'insights' && (
        <>
          {!analytics ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Data Yet</h2>
              <p className="text-gray-600">Start having conversations with your personas to see analytics here.</p>
            </div>
          ) : (
            <>
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

              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Weekly Activity</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.weeklyActivity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" /><YAxis />
                      <Tooltip />
                      <Bar dataKey="conversations" fill="#8B5CF6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Emotional Insights</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={analytics.emotionalInsights} cx="50%" cy="50%"
                        outerRadius={100} dataKey="count"
                        label={({ emotion, count }) => `${emotion}: ${count}`}>
                        {analytics.emotionalInsights.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Monthly Trends</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" /><YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="conversations" stroke="#8B5CF6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

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
            </>
          )}
        </>
      )}
    </div>
  );
}
