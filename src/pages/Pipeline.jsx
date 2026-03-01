import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import KPICard from '../components/shared/KPICard';
import { KPICardSkeleton } from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { GitBranch, DollarSign, TrendingUp, Award, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Pipeline() {
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.PipelineOpportunity.list('-created_date', 500)
  });

  // Calculate KPIs
  const openOpportunities = opportunities.filter(o => o.status === 'open');
  const wonOpportunities = opportunities.filter(o => o.status === 'won');
  const lostOpportunities = opportunities.filter(o => o.status === 'lost');

  const totalValue = openOpportunities.reduce((sum, o) => sum + (o.value || 0), 0);
  const wonValue = wonOpportunities.reduce((sum, o) => sum + (o.value || 0), 0);
  const totalClosed = wonOpportunities.length + lostOpportunities.length;
  const winRate = totalClosed > 0 ? (wonOpportunities.length / totalClosed * 100).toFixed(1) : 0;
  const avgTicket = wonOpportunities.length > 0 ? wonValue / wonOpportunities.length : 0;
  const avgCycle = wonOpportunities.length > 0
    ? Math.round(wonOpportunities.reduce((sum, o) => sum + (o.days_in_pipeline || 0), 0) / wonOpportunities.length)
    : 0;

  // Group by stage
  const stageGroups = openOpportunities.reduce((acc, opp) => {
    const stage = opp.stage_name || 'Sem etapa';
    if (!acc[stage]) {
      acc[stage] = [];
    }
    acc[stage].push(opp);
    return acc;
  }, {});

  const stages = Object.keys(stageGroups);

  // Value by stage for funnel chart
  const funnelData = stages.map(stage => ({
    stage,
    value: stageGroups[stage].reduce((sum, o) => sum + (o.value || 0), 0),
    count: stageGroups[stage].length
  }));

  // Check for stuck opportunities (more than 30 days)
  const stuckOpps = openOpportunities.filter(o => {
    if (!o.created_at_pipedrive) return false;
    return differenceInDays(new Date(), new Date(o.created_at_pipedrive)) > 30;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Funil de Vendas</h1>
        <p className="text-muted-foreground mt-1">Pipeline de oportunidades do Pipedrive</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard
              title="Oportunidades Abertas"
              value={openOpportunities.length}
              icon={GitBranch}
            />
            <KPICard
              title="Valor em Pipeline"
              value={`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
            />
            <KPICard
              title="Win Rate"
              value={`${winRate}%`}
              subtitle={`${wonOpportunities.length}/${totalClosed}`}
              icon={Award}
            />
            <KPICard
              title="Ticket Médio"
              value={`R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
            />
            <KPICard
              title="Ciclo Médio"
              value={`${avgCycle} dias`}
              icon={Clock}
            />
          </>
        )}
      </div>

      {opportunities.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="p-8">
            <EmptyState
              icon={GitBranch}
              title="Nenhuma oportunidade encontrada"
              description="Conecte sua conta Pipedrive para visualizar seu pipeline de vendas"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Kanban View */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {stages.map((stage) => (
                <Card key={stage} className="card-shadow w-80 flex-shrink-0">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{stage}</CardTitle>
                      <Badge variant="secondary">{stageGroups[stage].length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      R$ {stageGroups[stage].reduce((sum, o) => sum + (o.value || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                    {stageGroups[stage].map((opp) => {
                      const daysInStage = opp.created_at_pipedrive 
                        ? differenceInDays(new Date(), new Date(opp.created_at_pipedrive))
                        : 0;
                      const isStuck = daysInStage > 30;

                      return (
                        <div 
                          key={opp.id} 
                          className={`p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer ${
                            isStuck ? 'border-red-200 bg-red-50' : 'bg-white'
                          }`}
                        >
                          <h4 className="font-medium text-sm mb-2">{opp.title}</h4>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Valor:</span>
                              <span className="font-medium">
                                R$ {(opp.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            {opp.owner_name && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Dono:</span>
                                <span>{opp.owner_name}</span>
                              </div>
                            )}
                            {opp.probability !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Probabilidade:</span>
                                <span>{opp.probability}%</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Dias na etapa:</span>
                              <span className={isStuck ? 'text-red-600 font-medium' : ''}>
                                {daysInStage}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel Chart */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Funil de Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" stroke="#64748B" />
                    <YAxis dataKey="stage" type="category" stroke="#64748B" width={150} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
                      formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                    />
                    <Bar dataKey="value" fill="#2E86AB" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Opportunities Table */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Oportunidades Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {openOpportunities.slice(0, 10).map((opp) => (
                    <div key={opp.id} className="flex justify-between items-start p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{opp.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {opp.stage_name} • {opp.owner_name}
                        </div>
                        {opp.expected_close_date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Fechamento previsto: {format(new Date(opp.expected_close_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">
                          R$ {(opp.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </div>
                        {opp.created_at_pipedrive && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {differenceInDays(new Date(), new Date(opp.created_at_pipedrive))} dias
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stuck Opportunities Alert */}
          {stuckOpps.length > 0 && (
            <Card className="card-shadow border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {stuckOpps.length} Oportunidades Paradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-700 mb-3">
                  Estas oportunidades estão há mais de 30 dias na mesma etapa e precisam de atenção:
                </p>
                <div className="space-y-2">
                  {stuckOpps.slice(0, 5).map((opp) => (
                    <div key={opp.id} className="flex justify-between items-center p-2 bg-white rounded border border-red-200">
                      <span className="font-medium text-sm">{opp.title}</span>
                      <Badge variant="destructive">
                        {differenceInDays(new Date(), new Date(opp.created_at_pipedrive))} dias
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}