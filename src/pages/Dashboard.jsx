import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import KPICard from '../components/shared/KPICard';
import { KPICardSkeleton, ChartSkeleton } from '../components/shared/LoadingSkeleton';
import ChannelBadge from '../components/shared/ChannelBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Users, Target, GitBranch, UserCheck, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CHANNEL_COLORS = {
  paid_search: '#2563EB',
  paid_social: '#F59E0B',
  organic_search: '#10B981',
  organic_social: '#8B5CF6',
  email: '#EC4899',
  referral: '#14B8A6',
  direct: '#6B7280',
  unknown: '#94A3B8'
};

export default function Dashboard() {
  const [period, setPeriod] = useState('30');
  const [channelFilter, setChannelFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 1000)
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => base44.entities.CampaignMetric.list('-date', 500)
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['insights'],
    queryFn: () => base44.entities.AIInsight.filter({ is_read: false }, '-generated_at', 10)
  });

  // Filter leads by period using rd_created_at
  const periodDays = parseInt(period);
  const startDate = subDays(new Date(), periodDays);
  const prevStartDate = subDays(new Date(), periodDays * 2);

  const filteredLeads = leads.filter(lead => {
    const createdDate = new Date(lead.rd_created_at || lead.created_date);
    const inPeriod = createdDate >= startDate;
    const matchChannel = channelFilter === 'all' || lead.origin_channel === channelFilter;
    const matchStage = stageFilter === 'all' || lead.lifecycle_stage === stageFilter;
    return inPeriod && matchChannel && matchStage;
  });

  const prevPeriodLeads = leads.filter(lead => {
    const createdDate = new Date(lead.rd_created_at || lead.created_date);
    return createdDate >= prevStartDate && createdDate < startDate;
  });

  // Calculate KPIs
  const totalLeads = filteredLeads.length;
  const mqls = filteredLeads.filter(l => l.is_mql).length;
  const opportunities = filteredLeads.filter(l => l.is_opportunity).length;
  const clients = filteredLeads.filter(l => l.is_client).length;
  
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0) / 100;
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  // Calculate real trends comparing current vs previous period
  const prevTotal = prevPeriodLeads.length;
  const prevMqls = prevPeriodLeads.filter(l => l.is_mql).length;
  const prevOpps = prevPeriodLeads.filter(l => l.is_opportunity).length;
  const prevClients = prevPeriodLeads.filter(l => l.is_client).length;

  const calcTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return parseFloat(((current - previous) / previous * 100).toFixed(1));
  };

  const leadTrend = calcTrend(totalLeads, prevTotal);
  const mqlTrend = calcTrend(mqls, prevMqls);
  const oppTrend = calcTrend(opportunities, prevOpps);
  const clientTrend = calcTrend(clients, prevClients);

  // Group leads by date for timeline chart
  const leadsTimeline = filteredLeads.reduce((acc, lead) => {
    const date = format(new Date(lead.rd_created_at || lead.created_date), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = { date, leads: 0, mqls: 0, opportunities: 0, clients: 0 };
    }
    acc[date].leads += 1;
    if (lead.is_mql) acc[date].mqls += 1;
    if (lead.is_opportunity) acc[date].opportunities += 1;
    if (lead.is_client) acc[date].clients += 1;
    return acc;
  }, {});

  const timelineData = Object.values(leadsTimeline).sort((a, b) => a.date.localeCompare(b.date));

  // Channel distribution
  const channelDistribution = filteredLeads.reduce((acc, lead) => {
    const channel = lead.origin_channel || 'unknown';
    if (!acc[channel]) {
      acc[channel] = { channel, count: 0, mqls: 0 };
    }
    acc[channel].count += 1;
    if (lead.is_mql) acc[channel].mqls += 1;
    return acc;
  }, {});

  const channelData = Object.values(channelDistribution).sort((a, b) => b.count - a.count);
  const pieData = channelData.map(c => ({ name: c.channel, value: c.count }));

  // Funnel metrics
  const funnelData = [
    { stage: 'Leads', count: totalLeads, rate: 100 },
    { stage: 'MQLs', count: mqls, rate: totalLeads > 0 ? (mqls / totalLeads * 100).toFixed(1) : 0 },
    { stage: 'Oportunidades', count: opportunities, rate: mqls > 0 ? (opportunities / mqls * 100).toFixed(1) : 0 },
    { stage: 'Clientes', count: clients, rate: opportunities > 0 ? (clients / opportunities * 100).toFixed(1) : 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da performance de marketing</p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card className="card-shadow">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os canais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="paid_search">Paid Search</SelectItem>
                <SelectItem value="paid_social">Paid Social</SelectItem>
                <SelectItem value="organic_search">Organic Search</SelectItem>
                <SelectItem value="organic_social">Organic Social</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
              </SelectContent>
            </Select>

            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os estágios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estágios</SelectItem>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="Qualified Lead">Qualified Lead</SelectItem>
                <SelectItem value="Client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {leadsLoading ? (
          Array(6).fill(0).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard
              title="Leads Totais"
              value={totalLeads.toLocaleString('pt-BR')}
              icon={Users}
              trend={leadTrend > 0 ? 'up' : 'down'}
              trendValue={leadTrend}
            />
            <KPICard
              title="MQLs"
              value={mqls.toLocaleString('pt-BR')}
              subtitle={`${totalLeads > 0 ? ((mqls / totalLeads) * 100).toFixed(1) : 0}%`}
              icon={Target}
              trend={mqlTrend > 0 ? 'up' : 'down'}
              trendValue={mqlTrend}
            />
            <KPICard
              title="Oportunidades"
              value={opportunities.toLocaleString('pt-BR')}
              subtitle={`R$ ${(opportunities * 5000).toLocaleString('pt-BR')}`}
              icon={GitBranch}
              trend={oppTrend > 0 ? 'up' : 'down'}
              trendValue={oppTrend}
            />
            <KPICard
              title="Clientes"
              value={clients.toLocaleString('pt-BR')}
              icon={UserCheck}
              trend={clientTrend > 0 ? 'up' : 'down'}
              trendValue={clientTrend}
            />
            <KPICard
              title="Investimento Ads"
              value={`R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
            />
            <KPICard
              title="CPL Médio"
              value={`R$ ${cpl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      {/* Main Chart */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Performance ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {leadsLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={timelineData}>
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
                <Line type="monotone" dataKey="leads" stroke="#2563EB" strokeWidth={2} name="Leads" />
                <Line type="monotone" dataKey="mqls" stroke="#10B981" strokeWidth={2} name="MQLs" />
                <Line type="monotone" dataKey="opportunities" stroke="#F59E0B" strokeWidth={2} name="Oportunidades" />
                <Line type="monotone" dataKey="clients" stroke="#8B5CF6" strokeWidth={2} name="Clientes" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((item, index) => (
                <div key={item.stage}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{item.stage}</span>
                    <div className="text-right">
                      <span className="font-bold">{item.count}</span>
                      <span className="text-sm text-muted-foreground ml-2">({item.rate}%)</span>
                    </div>
                  </div>
                  <div className="h-12 bg-muted rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#2E86AB] to-[#2563EB] transition-all duration-500"
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>Distribuição por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[entry.name] || CHANNEL_COLORS.unknown} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Channels Table */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Top 10 Origens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Canal</th>
                  <th className="pb-3 font-medium">Plataforma</th>
                  <th className="pb-3 font-medium text-right">Leads</th>
                  <th className="pb-3 font-medium text-right">MQLs</th>
                  <th className="pb-3 font-medium text-right">Taxa Conv%</th>
                  <th className="pb-3 font-medium text-right">CPL</th>
                </tr>
              </thead>
              <tbody>
                {channelData.slice(0, 10).map((item, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-3">
                      <ChannelBadge channel={item.channel} />
                    </td>
                    <td className="py-3 text-sm">{item.channel.replace(/_/g, ' ')}</td>
                    <td className="py-3 text-right font-medium">{item.count}</td>
                    <td className="py-3 text-right font-medium">{item.mqls}</td>
                    <td className="py-3 text-right">
                      {item.count > 0 ? ((item.mqls / item.count) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-3 text-right">
                      R$ {(totalSpend / totalLeads || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Preview */}
      {insights.length > 0 && (
        <Card className="card-shadow bg-gradient-to-r from-[#2E86AB]/5 to-[#2563EB]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Insights de IA
              <span className="text-sm font-normal text-muted-foreground">({insights.length} novos)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.slice(0, 3).map((insight) => (
                <div key={insight.id} className="p-4 bg-white rounded-lg border">
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      insight.severity === 'critical' ? 'bg-red-500' :
                      insight.severity === 'warning' ? 'bg-yellow-500' :
                      insight.severity === 'success' ? 'bg-green-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">{insight.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}