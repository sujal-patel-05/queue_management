import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { formatPaise } from '@qflow/shared';
import { Loader2, Users, Clock, DollarSign, UserX, TrendingUp, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export default function Analytics() {
  const user = useAuthStore(s => s.user);
  const restaurantId = user?.restaurant_id;

  const [stats, setStats] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [restaurantId, days]);

  async function fetchAnalytics() {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [statsData, hourlyData] = await Promise.all([
        api.get(`/api/analytics/stats/${restaurantId}?days=${days}`),
        api.get(`/api/analytics/hourly/${restaurantId}?days=${days}`)
      ]);
      setStats(statsData.stats);
      setHourly(hourlyData.distribution || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const pieData = [
    { name: 'Seated', value: stats?.total_seated || 0 },
    { name: 'No-shows', value: stats?.total_no_shows || 0 },
    { name: 'Other', value: Math.max(0, (stats?.total_customers || 0) - (stats?.total_seated || 0) - (stats?.total_no_shows || 0)) },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-500" />
            Analytics
          </h2>
          <p className="text-text-muted text-sm">Performance overview for the last {days} days</p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 7, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                days === d
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'bg-surface-3 text-text-secondary hover:text-text-primary border border-surface-border'
              }`}
            >
              {d === 1 ? 'Today' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-500" />
            </div>
          </div>
          <p className="stat-card-label">Total Customers</p>
          <p className="stat-card-value">{stats?.total_customers || 0}</p>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <p className="stat-card-label">Avg Wait Time</p>
          <p className="stat-card-value">{stats?.avg_wait_minutes || 0}<span className="text-sm font-normal text-text-muted ml-1">min</span></p>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="stat-card-label">Revenue</p>
          <p className="stat-card-value text-xl">{formatPaise(stats?.total_revenue_paise || 0)}</p>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <UserX className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <p className="stat-card-label">No-Show Rate</p>
          <p className="stat-card-value">{stats?.no_show_rate || 0}<span className="text-sm font-normal text-text-muted ml-0.5">%</span></p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Customers by Hour</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e32" />
              <XAxis dataKey="hour" stroke="#52525b" tick={{ fontSize: 11 }} tickFormatter={h => `${h}:00`} />
              <YAxis stroke="#52525b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2e2e32', borderRadius: '12px', fontSize: '13px' }}
                labelStyle={{ color: '#a3a3a3' }}
                labelFormatter={h => `${h}:00 - ${h}:59`}
              />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Customers" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Breakdown Pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Customer Outcomes</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  stroke="none"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2e2e32', borderRadius: '12px', fontSize: '13px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px]">
              <p className="text-text-muted text-sm">No data yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
