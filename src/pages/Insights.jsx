import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import EmptyState from '../components/shared/EmptyState';
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  Bell,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-300' },
  success: { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
  info: { icon: Lightbulb, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' }
};

const typeLabels = {
  daily_summary: 'Resumo Diário',
  anomaly: 'Anomalia',
  recommendation: 'Recomendação',
  trend: 'Tendência',
  opportunity_alert: 'Alerta de Oportunidade',
  forecast: 'Previsão'
};

export default function Insights() {
  const [selectedType, setSelectedType] = useState('all');
  const [expandedInsight, setExpandedInsight] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const queryClient = useQueryClient();

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: () => base44.entities.AIInsight.list('-generated_at', 100)
  });

  const markAsReadMutation = useMutation({
    mutationFn: (insightId) => base44.entities.AIInsight.update(insightId, { is_read: true, read_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    }
  });

  const filteredInsights = selectedType === 'all' 
    ? insights 
    : insights.filter(i => i.insight_type === selectedType);

  const unreadCount = insights.filter(i => !i.is_read).length;

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;

    const userMessage = { role: 'user', content: chatMessage };
    setChatHistory(prev => [...prev, userMessage]);
    setChatMessage('');

    // Mock AI response - in production this would call a backend function
    setTimeout(() => {
      const aiMessage = {
        role: 'assistant',
        content: 'Analisando seus dados... Esta é uma resposta de exemplo. Em produção, isso seria gerado por IA com base nos dados reais do seu workspace.'
      };
      setChatHistory(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const suggestedQuestions = [
    "Qual canal trouxe mais MQLs este mês?",
    "Por que meu CPL aumentou na última semana?",
    "Qual campanha tem melhor ROAS?",
    "Compare performance desta semana com a anterior"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Insights de IA</h1>
          <p className="text-muted-foreground mt-1">
            Análises inteligentes e alertas automáticos
            {unreadCount > 0 && <Badge className="ml-2 bg-[#EC4899]">{unreadCount} novos</Badge>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed de Insights - Left Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Tabs */}
          <Tabs value={selectedType} onValueChange={setSelectedType}>
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="anomaly">Anomalias</TabsTrigger>
              <TabsTrigger value="recommendation">Dicas</TabsTrigger>
              <TabsTrigger value="trend">Tendências</TabsTrigger>
              <TabsTrigger value="daily_summary">Resumos</TabsTrigger>
              <TabsTrigger value="opportunity_alert">Alertas</TabsTrigger>
              <TabsTrigger value="forecast">Previsões</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Insights List */}
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredInsights.length === 0 ? (
            <Card className="card-shadow">
              <CardContent className="p-8">
                <EmptyState
                  icon={Lightbulb}
                  title="Nenhum insight disponível"
                  description="Os insights serão gerados automaticamente conforme seus dados são sincronizados"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredInsights.map((insight) => {
                const config = severityConfig[insight.severity] || severityConfig.info;
                const Icon = config.icon;
                const isExpanded = expandedInsight === insight.id;

                return (
                  <Card 
                    key={insight.id} 
                    className={`card-shadow border-l-4 ${config.borderColor} ${!insight.is_read ? 'bg-gradient-to-r from-blue-50/50' : ''}`}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${config.bgColor}`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base mb-1">{insight.title}</CardTitle>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {typeLabels[insight.insight_type]}
                                </Badge>
                                <span>{format(new Date(insight.generated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                                {!insight.is_read && <Badge className="bg-blue-500">Novo</Badge>}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-sm ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {insight.content}
                      </p>

                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          {insight.metric_affected && (
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="text-xs font-medium text-muted-foreground mb-1">Métrica Afetada</div>
                              <div className="font-medium">{insight.metric_affected}</div>
                              {insight.delta_value && (
                                <div className={`text-sm mt-1 ${insight.delta_value > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {insight.delta_value > 0 ? '+' : ''}{insight.delta_value}%
                                </div>
                              )}
                            </div>
                          )}

                          {!insight.is_read && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => markAsReadMutation.mutate(insight.id)}
                              className="w-full"
                            >
                              Marcar como lido
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Chat with Data */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Chat com seus dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Suggested Questions */}
              {chatHistory.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Perguntas sugeridas:</p>
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto py-2 px-3 text-xs"
                      onClick={() => setChatMessage(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              )}

              {/* Chat History */}
              {chatHistory.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {chatHistory.map((message, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg text-sm ${
                        message.role === 'user' 
                          ? 'bg-[#2E86AB] text-white ml-8' 
                          : 'bg-muted mr-8'
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Faça uma pergunta sobre seus dados..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="text-sm"
                />
                <Button size="icon" onClick={handleSendMessage}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Alert Configuration */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Configuração de Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="daily-summary" className="text-sm">Resumo diário por email</Label>
                <Switch id="daily-summary" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="weekly-report" className="text-sm">Relatório semanal</Label>
                <Switch id="weekly-report" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="anomaly-alerts" className="text-sm">Alertas de anomalia</Label>
                <Switch id="anomaly-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="milestone-alerts" className="text-sm">Alertas de milestone</Label>
                <Switch id="milestone-alerts" />
              </div>

              <div className="pt-4 border-t">
                <Label className="text-sm mb-2 block">Threshold de CPL (%)</Label>
                <Input type="number" defaultValue="20" className="text-sm" />
                <p className="text-xs text-muted-foreground mt-1">
                  Alertar quando CPL aumentar mais que este percentual
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}