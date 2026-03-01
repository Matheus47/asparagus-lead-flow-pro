import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KPICard from '../components/shared/KPICard';
import { KPICardSkeleton, ChartSkeleton } from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import { Target, TrendingUp, MousePointer, Eye, DollarSign } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Campanhas() {
  const [expandedCampaigns, setExpandedCampaigns] = useState({});

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => base44.entities.CampaignMetric.list('-date', 1000)
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500)
  });

  // Aggregate Google Ads data
  const googleAds = campaigns.filter(c => c.platform === 'google_ads');
  const googleAdsStats = googleAds.reduce((acc, c) => ({
    spend: acc.spend + (c.spend || 0),
    impressions: acc.impressions + (c.impressions || 0),
    clicks: acc.clicks + (c.clicks || 0),
    conversions: acc.conversions + (c.conversions || 0)
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

  const googleAdsCTR = googleAdsStats.impressions > 0 ? (googleAdsStats.clicks / googleAdsStats.impressions * 100).toFixed(2) : 0;
  const googleAdsCPC = googleAdsStats.clicks > 0 ? (googleAdsStats.spend / googleAdsStats.clicks / 100).toFixed(2) : 0;
  const googleAdsLeads = leads.filter(l => l.gclid || l.origin_channel === 'paid_search').length;
  const googleAdsCPL = googleAdsLeads > 0 ? (googleAdsStats.spend / googleAdsLeads / 100).toFixed(2) : 0;

  // Aggregate Meta Ads data
  const metaAds = campaigns.filter(c => c.platform === 'meta_ads');
  const metaAdsStats = metaAds.reduce((acc, c) => ({
    spend: acc.spend + (c.spend || 0),
    impressions: acc.impressions + (c.impressions || 0),
    clicks: acc.clicks + (c.clicks || 0),
    reach: acc.reach + (c.reach || 0)
  }), { spend: 0, impressions: 0, clicks: 0, reach: 0 });

  const metaAdsCTR = metaAdsStats.impressions > 0 ? (metaAdsStats.clicks / metaAdsStats.impressions * 100).toFixed(2) : 0;
  const metaAdsCPM = metaAdsStats.impressions > 0 ? (metaAdsStats.spend / metaAdsStats.impressions * 1000 / 100).toFixed(2) : 0;
  const metaAdsLeads = leads.filter(l => l.fbclid || l.origin_channel === 'paid_social').length;
  const metaAdsCPL = metaAdsLeads > 0 ? (metaAdsStats.spend / metaAdsLeads / 100).toFixed(2) : 0;
  const metaFrequency = metaAdsStats.reach > 0 ? (metaAdsStats.impressions / metaAdsStats.reach).toFixed(2) : 0;

  // Group campaigns by campaign_id
  const groupedGoogleCampaigns = googleAds.reduce((acc, c) => {
    if (!acc[c.campaign_id]) {
      acc[c.campaign_id] = {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        campaign_status: c.campaign_status,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0
      };
    }
    acc[c.campaign_id].spend += c.spend || 0;
    acc[c.campaign_id].impressions += c.impressions || 0;
    acc[c.campaign_id].clicks += c.clicks || 0;
    acc[c.campaign_id].conversions += c.conversions || 0;
    return acc;
  }, {});

  const googleCampaignsList = Object.values(groupedGoogleCampaigns).sort((a, b) => b.spend - a.spend);

  const groupedMetaCampaigns = metaAds.reduce((acc, c) => {
    if (!acc[c.campaign_id]) {
      acc[c.campaign_id] = {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        campaign_status: c.campaign_status,
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0
      };
    }
    acc[c.campaign_id].spend += c.spend || 0;
    acc[c.campaign_id].impressions += c.impressions || 0;
    acc[c.campaign_id].clicks += c.clicks || 0;
    acc[c.campaign_id].reach += c.reach || 0;
    return acc;
  }, {});

  const metaCampaignsList = Object.values(groupedMetaCampaigns).sort((a, b) => b.spend - a.spend);

  // Spend over time
  const spendTimeline = campaigns.reduce((acc, c) => {
    const date = c.date;
    if (!acc[date]) {
      acc[date] = { date, google_ads: 0, meta_ads: 0 };
    }
    if (c.platform === 'google_ads') {
      acc[date].google_ads += (c.spend || 0) / 100;
    } else {
      acc[date].meta_ads += (c.spend || 0) / 100;
    }
    return acc;
  }, {});

  const timelineData = Object.values(spendTimeline).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Performance de Campanhas</h1>
        <p className="text-muted-foreground mt-1">Análise detalhada de campanhas pagas</p>
      </div>

      <Tabs defaultValue="google" className="space-y-6">
        <TabsList>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
        </TabsList>

        {/* Google Ads Tab */}
        <TabsContent value="google" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <KPICardSkeleton key={i} />)
            ) : (
              <>
                <KPICard
                  title="Investimento"
                  value={`R$ ${(googleAdsStats.spend / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={DollarSign}
                />
                <KPICard
                  title="Impressões"
                  value={googleAdsStats.impressions.toLocaleString('pt-BR')}
                  icon={Eye}
                />
                <KPICard
                  title="Cliques"
                  value={googleAdsStats.clicks.toLocaleString('pt-BR')}
                  subtitle={`CTR ${googleAdsCTR}%`}
                  icon={MousePointer}
                />
                <KPICard
                  title="CPC Médio"
                  value={`R$ ${googleAdsCPC}`}
                  icon={TrendingUp}
                />
                <KPICard
                  title="CPL"
                  value={`R$ ${googleAdsCPL}`}
                  subtitle={`${googleAdsLeads} leads`}
                  icon={Target}
                />
              </>
            )}
          </div>

          {/* Chart */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Investimento vs Leads (Google Ads)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ChartSkeleton />
              ) : timelineData.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Nenhum dado disponível"
                  description="Conecte sua conta Google Ads para visualizar as métricas"
                />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: ptBR })}
                      stroke="#64748B"
                    />
                    <YAxis stroke="#64748B" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
                      formatter={(value) => [`R$ ${value.toFixed(2)}`, '']}
                    />
                    <Legend />
                    <Bar dataKey="google_ads" fill="#2563EB" name="Investimento" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Campaigns Table */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Campanhas Google Ads</CardTitle>
            </CardHeader>
            <CardContent>
              {googleCampaignsList.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Nenhuma campanha encontrada"
                  description="Suas campanhas do Google Ads aparecerão aqui após a sincronização"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr className="text-left text-sm">
                        <th className="p-4 font-medium">Campanha</th>
                        <th className="p-4 font-medium text-right">Investimento</th>
                        <th className="p-4 font-medium text-right">Impressões</th>
                        <th className="p-4 font-medium text-right">Cliques</th>
                        <th className="p-4 font-medium text-right">CTR</th>
                        <th className="p-4 font-medium text-right">CPC</th>
                        <th className="p-4 font-medium text-right">CPL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {googleCampaignsList.map((campaign) => {
                        const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions * 100).toFixed(2) : 0;
                        const cpc = campaign.clicks > 0 ? (campaign.spend / campaign.clicks / 100).toFixed(2) : 0;
                        const campaignLeads = leads.filter(l => l.origin_campaign === campaign.campaign_name || l.gad_campaign_id === campaign.campaign_id).length;
                        const cpl = campaignLeads > 0 ? (campaign.spend / campaignLeads / 100).toFixed(2) : 0;

                        return (
                          <tr key={campaign.campaign_id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-4">
                              <div className="font-medium">{campaign.campaign_name}</div>
                              <div className="text-xs text-muted-foreground">{campaign.campaign_status}</div>
                            </td>
                            <td className="p-4 text-right font-medium">R$ {(campaign.spend / 100).toFixed(2)}</td>
                            <td className="p-4 text-right">{campaign.impressions.toLocaleString('pt-BR')}</td>
                            <td className="p-4 text-right">{campaign.clicks.toLocaleString('pt-BR')}</td>
                            <td className="p-4 text-right">{ctr}%</td>
                            <td className="p-4 text-right">R$ {cpc}</td>
                            <td className="p-4 text-right">
                              <div>R$ {cpl}</div>
                              <div className="text-xs text-muted-foreground">{campaignLeads} leads</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meta Ads Tab */}
        <TabsContent value="meta" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <KPICardSkeleton key={i} />)
            ) : (
              <>
                <KPICard
                  title="Investimento"
                  value={`R$ ${(metaAdsStats.spend / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={DollarSign}
                />
                <KPICard
                  title="Alcance"
                  value={metaAdsStats.reach.toLocaleString('pt-BR')}
                  icon={Eye}
                />
                <KPICard
                  title="Impressões"
                  value={metaAdsStats.impressions.toLocaleString('pt-BR')}
                  subtitle={`Freq ${metaFrequency}`}
                  icon={TrendingUp}
                />
                <KPICard
                  title="CPM"
                  value={`R$ ${metaAdsCPM}`}
                  icon={MousePointer}
                />
                <KPICard
                  title="CPL"
                  value={`R$ ${metaAdsCPL}`}
                  subtitle={`${metaAdsLeads} leads`}
                  icon={Target}
                />
              </>
            )}
          </div>

          {/* Chart */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Investimento vs Leads (Meta Ads)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ChartSkeleton />
              ) : timelineData.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Nenhum dado disponível"
                  description="Conecte sua conta Meta Ads para visualizar as métricas"
                />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: ptBR })}
                      stroke="#64748B"
                    />
                    <YAxis stroke="#64748B" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
                      formatter={(value) => [`R$ ${value.toFixed(2)}`, '']}
                    />
                    <Legend />
                    <Bar dataKey="meta_ads" fill="#F59E0B" name="Investimento" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Campaigns Table */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Campanhas Meta Ads</CardTitle>
            </CardHeader>
            <CardContent>
              {metaCampaignsList.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Nenhuma campanha encontrada"
                  description="Suas campanhas do Meta Ads aparecerão aqui após a sincronização"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr className="text-left text-sm">
                        <th className="p-4 font-medium">Campanha</th>
                        <th className="p-4 font-medium text-right">Investimento</th>
                        <th className="p-4 font-medium text-right">Alcance</th>
                        <th className="p-4 font-medium text-right">Impressões</th>
                        <th className="p-4 font-medium text-right">Cliques</th>
                        <th className="p-4 font-medium text-right">CPM</th>
                        <th className="p-4 font-medium text-right">CPL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metaCampaignsList.map((campaign) => {
                        const cpm = campaign.impressions > 0 ? (campaign.spend / campaign.impressions * 1000 / 100).toFixed(2) : 0;
                        const campaignLeads = leads.filter(l => l.origin_campaign === campaign.campaign_name).length;
                        const cpl = campaignLeads > 0 ? (campaign.spend / campaignLeads / 100).toFixed(2) : 0;

                        return (
                          <tr key={campaign.campaign_id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-4">
                              <div className="font-medium">{campaign.campaign_name}</div>
                              <div className="text-xs text-muted-foreground">{campaign.campaign_status}</div>
                            </td>
                            <td className="p-4 text-right font-medium">R$ {(campaign.spend / 100).toFixed(2)}</td>
                            <td className="p-4 text-right">{campaign.reach.toLocaleString('pt-BR')}</td>
                            <td className="p-4 text-right">{campaign.impressions.toLocaleString('pt-BR')}</td>
                            <td className="p-4 text-right">{campaign.clicks.toLocaleString('pt-BR')}</td>
                            <td className="p-4 text-right">R$ {cpm}</td>
                            <td className="p-4 text-right">
                              <div>R$ {cpl}</div>
                              <div className="text-xs text-muted-foreground">{campaignLeads} leads</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consolidated Tab */}
        <TabsContent value="consolidado" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Comparison Cards */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Google Ads vs Meta Ads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <span className="font-medium">Investimento Total</span>
                    <div className="text-right">
                      <div className="text-sm text-[#2563EB]">Google: R$ {(googleAdsStats.spend / 100).toFixed(2)}</div>
                      <div className="text-sm text-[#F59E0B]">Meta: R$ {(metaAdsStats.spend / 100).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <span className="font-medium">Leads Atribuídos</span>
                    <div className="text-right">
                      <div className="text-sm text-[#2563EB]">Google: {googleAdsLeads}</div>
                      <div className="text-sm text-[#F59E0B]">Meta: {metaAdsLeads}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <span className="font-medium">CPL Médio</span>
                    <div className="text-right">
                      <div className="text-sm text-[#2563EB]">Google: R$ {googleAdsCPL}</div>
                      <div className="text-sm text-[#F59E0B]">Meta: R$ {metaAdsCPL}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Spend Distribution Chart */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Distribuição de Investimento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: ptBR })}
                      stroke="#64748B"
                    />
                    <YAxis stroke="#64748B" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
                      formatter={(value) => [`R$ ${value.toFixed(2)}`, '']}
                    />
                    <Legend />
                    <Bar dataKey="google_ads" stackId="a" fill="#2563EB" name="Google Ads" />
                    <Bar dataKey="meta_ads" stackId="a" fill="#F59E0B" name="Meta Ads" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}