import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import KPICard from '../components/shared/KPICard';
import { KPICardSkeleton, ChartSkeleton } from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import { Users, MousePointer, Clock, Target, TrendingUp } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CHANNEL_COLORS = {
  'Organic Search': '#10B981',
  'Paid Search': '#2563EB',
  'Paid Social': '#F59E0B',
  'Direct': '#6B7280',
  'Email': '#EC4899',
  'Referral': '#14B8A6',
  'Organic Social': '#8B5CF6'
};

export default function Analytics() {
  const { data: webMetrics = [], isLoading } = useQuery({
    queryKey: ['webMetrics'],
    queryFn: () => base44.entities.WebMetric.list('-date', 1000)
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500)
  });

  // Calculate totals
  const totals = webMetrics.reduce((acc, m) => ({
    sessions: acc.sessions + (m.sessions || 0),
    users: acc.users + (m.users || 0),
    pageviews: acc.pageviews + (m.pageviews || 0),
    goalCompletions: acc.goalCompletions + (m.goal_completions || 0)
  }), { sessions: 0, users: 0, pageviews: 0, goalCompletions: 0 });

  const avgBounceRate = webMetrics.length > 0 
    ? (webMetrics.reduce((sum, m) => sum + (m.bounce_rate || 0), 0) / webMetrics.length * 100).toFixed(1)
    : 0;

  const avgSessionDuration = webMetrics.length > 0
    ? Math.round(webMetrics.reduce((sum, m) => sum + (m.avg_session_duration || 0), 0) / webMetrics.length)
    : 0;

  const conversionRate = totals.sessions > 0
    ? (totals.goalCompletions / totals.sessions * 100).toFixed(2)
    : 0;

  // Group by date and channel
  const sessionsByChannel = webMetrics.reduce((acc, m) => {
    const date = m.date;
    if (!acc[date]) {
      acc[date] = { date };
    }
    const channel = m.channel_grouping || 'Direct';
    acc[date][channel] = (acc[date][channel] || 0) + (m.sessions || 0);
    return acc;
  }, {});

  const timelineData = Object.values(sessionsByChannel).sort((a, b) => a.date.localeCompare(b.date));

  // Channel distribution
  const channelData = webMetrics.reduce((acc, m) => {
    const channel = m.channel_grouping || 'Direct';
    if (!acc[channel]) {
      acc[channel] = { channel, sessions: 0, users: 0, conversions: 0 };
    }
    acc[channel].sessions += m.sessions || 0;
    acc[channel].users += m.users || 0;
    acc[channel].conversions += m.goal_completions || 0;
    return acc;
  }, {});

  const channelList = Object.values(channelData).sort((a, b) => b.sessions - a.sessions);

  // Correlation with leads
  const correlation = leads.reduce((acc, lead) => {
    const channelMap = {
      'paid_search': 'Paid Search',
      'paid_social': 'Paid Social',
      'organic_search': 'Organic Search',
      'organic_social': 'Organic Social',
      'email': 'Email',
      'referral': 'Referral',
      'direct': 'Direct'
    };
    const gaChannel = channelMap[lead.origin_channel] || 'Direct';
    if (!acc[gaChannel]) {
      acc[gaChannel] = 0;
    }
    acc[gaChannel] += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analytics Web</h1>
        <p className="text-muted-foreground mt-1">Dados de tráfego e comportamento do Google Analytics 4</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard
              title="Sessões"
              value={totals.sessions.toLocaleString('pt-BR')}
              icon={MousePointer}
            />
            <KPICard
              title="Usuários"
              value={totals.users.toLocaleString('pt-BR')}
              icon={Users}
            />
            <KPICard
              title="Taxa de Rejeição"
              value={`${avgBounceRate}%`}
              icon={TrendingUp}
            />
            <KPICard
              title="Duração Média"
              value={`${Math.floor(avgSessionDuration / 60)}:${(avgSessionDuration % 60).toString().padStart(2, '0')}`}
              subtitle="minutos"
              icon={Clock}
            />
            <KPICard
              title="Taxa de Conversão"
              value={`${conversionRate}%`}
              subtitle={`${totals.goalCompletions} conversões`}
              icon={Target}
            />
          </>
        )}
      </div>

      {/* Sessions by Channel Chart */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Sessões por Canal ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton />
          ) : timelineData.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Nenhum dado disponível"
              description="Conecte sua conta Google Analytics 4 para visualizar as métricas"
            />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: ptBR })}
                  stroke="#64748B"
                />
                <YAxis stroke="#64748B" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
                  labelFormatter={(date) => format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })}
                />
                <Legend />
                {Object.keys(CHANNEL_COLORS).map(channel => (
                  <Area
                    key={channel}
                    type="monotone"
                    dataKey={channel}
                    stackId="1"
                    stroke={CHANNEL_COLORS[channel]}
                    fill={CHANNEL_COLORS[channel]}
                    name={channel}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Performance Table */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>Performance por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            {channelList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b text-xs">
                    <tr className="text-left">
                      <th className="pb-2 font-medium">Canal</th>
                      <th className="pb-2 font-medium text-right">Sessões</th>
                      <th className="pb-2 font-medium text-right">Usuários</th>
                      <th className="pb-2 font-medium text-right">Conversões</th>
                      <th className="pb-2 font-medium text-right">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelList.map((item) => (
                      <tr key={item.channel} className="border-b last:border-0 text-sm">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHANNEL_COLORS[item.channel] || '#6B7280' }}
                            />
                            <span className="font-medium">{item.channel}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right">{item.sessions.toLocaleString('pt-BR')}</td>
                        <td className="py-2 text-right">{item.users.toLocaleString('pt-BR')}</td>
                        <td className="py-2 text-right">{item.conversions.toLocaleString('pt-BR')}</td>
                        <td className="py-2 text-right">
                          {item.sessions > 0 ? ((item.conversions / item.sessions) * 100).toFixed(2) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Correlation with Leads */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>Correlação: Sessões GA4 vs Leads RD</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={channelList.map(c => ({
                channel: c.channel,
                sessions: c.sessions,
                leads: correlation[c.channel] || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="channel" stroke="#64748B" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#64748B" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
                />
                <Legend />
                <Bar dataKey="sessions" fill="#2E86AB" name="Sessões GA4" />
                <Bar dataKey="leads" fill="#10B981" name="Leads RD" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}