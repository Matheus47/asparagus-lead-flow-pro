import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { 
  Link as LinkIcon, 
  Users, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingButtons, setLoadingButtons] = useState({});

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list('-created_date', 100)
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['syncLogs'],
    queryFn: () => base44.entities.SyncLog.list('-started_at', 20)
  });

  const setLoading = (key, val) => setLoadingButtons(prev => ({ ...prev, [key]: val }));

  const handleSync = async (integration) => {
    const key = `sync_${integration.id}`;
    setLoading(key, true);
    const res = await base44.functions.invoke('syncIntegration', {
      integrationId: integration.id,
      integrationType: integration.type,
      workspaceId: integration.workspace_id,
      syncType: 'incremental'
    });
    setLoading(key, false);
    if (res.data?.success) {
      toast({ title: 'Sincronização concluída', description: `${res.data.records_processed} registros processados.` });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
    } else {
      toast({ title: 'Erro na sincronização', description: res.data?.error || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleDisconnect = async (integration) => {
    const key = `disconnect_${integration.id}`;
    setLoading(key, true);
    await base44.entities.Integration.update(integration.id, { status: 'disconnected', access_token: '', refresh_token: '' });
    setLoading(key, false);
    toast({ title: 'Integração desconectada' });
    queryClient.invalidateQueries({ queryKey: ['integrations'] });
  };

  const handleConnect = async (type) => {
    const key = `connect_${type}`;
    setLoading(key, true);
    // In production this would trigger the OAuth flow; here we simulate it
    await new Promise(r => setTimeout(r, 1000));
    setLoading(key, false);
    toast({ title: 'Conecte sua conta', description: `Configure as credenciais de ${type} nas configurações da integração.` });
  };

  const getStatusBadge = (status) => {
    const config = {
      connected: { icon: CheckCircle2, label: 'Conectado', color: 'bg-green-100 text-green-800 border-green-200' },
      disconnected: { icon: XCircle, label: 'Desconectado', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      error: { icon: AlertCircle, label: 'Erro', color: 'bg-red-100 text-red-800 border-red-200' },
      syncing: { icon: RefreshCw, label: 'Sincronizando...', color: 'bg-blue-100 text-blue-800 border-blue-200' }
    };

    const statusConfig = config[status] || config.disconnected;
    const Icon = statusConfig.icon;

    return (
      <Badge variant="secondary" className={`${statusConfig.color} border flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  const integrationLabels = {
    rdstation: { name: 'RD Station Marketing', icon: '📊' },
    google_analytics: { name: 'Google Analytics 4', icon: '📈' },
    google_ads: { name: 'Google Ads', icon: '🎯' },
    meta_ads: { name: 'Meta Ads', icon: '📱' },
    pipedrive: { name: 'Pipedrive', icon: '💼' }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie integrações, usuários e preferências</p>
      </div>

      <Tabs defaultValue="integracoes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integracoes" className="space-y-6">
          {/* Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(integrationLabels).map(([type, config]) => {
              const integration = integrations.find(i => i.type === type);
              const isConnected = integration?.status === 'connected';

              return (
                <Card key={type} className="card-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-2xl">{config.icon}</span>
                        {config.name}
                      </CardTitle>
                      {integration && getStatusBadge(integration.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {integration && isConnected ? (
                      <>
                        <div className="text-sm space-y-1">
                          <div className="text-muted-foreground">Conta: {integration.account_name || '-'}</div>
                          {integration.last_sync_at && (
                            <div className="text-muted-foreground">
                              Última sincronização: {format(new Date(integration.last_sync_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </div>
                          )}
                          {integration.total_records_synced > 0 && (
                            <div className="text-muted-foreground">
                              {integration.total_records_synced.toLocaleString('pt-BR')} registros sincronizados
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline" size="sm" className="flex-1"
                            disabled={loadingButtons[`sync_${integration.id}`]}
                            onClick={() => handleSync(integration)}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingButtons[`sync_${integration.id}`] ? 'animate-spin' : ''}`} />
                            {loadingButtons[`sync_${integration.id}`] ? 'Sincronizando...' : 'Sincronizar agora'}
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            disabled={loadingButtons[`disconnect_${integration.id}`]}
                            onClick={() => handleDisconnect(integration)}
                          >
                            {loadingButtons[`disconnect_${integration.id}`] ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : 'Desconectar'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Conecte sua conta {config.name} para importar dados automaticamente
                        </p>
                        <Button
                          className="w-full bg-[#2E86AB] hover:bg-[#1E3A5F]"
                          disabled={loadingButtons[`connect_${type}`]}
                          onClick={() => handleConnect(type)}
                        >
                          {loadingButtons[`connect_${type}`] ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <LinkIcon className="w-4 h-4 mr-2" />
                          )}
                          {loadingButtons[`connect_${type}`] ? 'Conectando...' : 'Conectar'}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Sync History */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Histórico de Sincronizações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b text-sm">
                    <tr className="text-left">
                      <th className="pb-3 font-medium">Integração</th>
                      <th className="pb-3 font-medium">Tipo</th>
                      <th className="pb-3 font-medium">Início</th>
                      <th className="pb-3 font-medium">Duração</th>
                      <th className="pb-3 font-medium text-right">Registros</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhuma sincronização realizada ainda
                        </td>
                      </tr>
                    ) : (
                      syncLogs.map((log) => {
                        const integration = integrations.find(i => i.id === log.integration_id);
                        const duration = log.finished_at 
                          ? Math.round((new Date(log.finished_at) - new Date(log.started_at)) / 1000)
                          : '-';

                        return (
                          <tr key={log.id} className="border-b last:border-0 text-sm">
                            <td className="py-3">
                              {integration ? integrationLabels[integration.type]?.name : 'Unknown'}
                            </td>
                            <td className="py-3">
                              <Badge variant="outline" className="text-xs">
                                {log.sync_type}
                              </Badge>
                            </td>
                            <td className="py-3">
                              {format(new Date(log.started_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </td>
                            <td className="py-3">{duration}s</td>
                            <td className="py-3 text-right">{log.records_processed.toLocaleString('pt-BR')}</td>
                            <td className="py-3">
                              {getStatusBadge(log.status)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-6">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Informações do Workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="workspace-name">Nome do Workspace</Label>
                <Input id="workspace-name" defaultValue="Agência Demo" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="company-segment">Segmento</Label>
                <Input id="company-segment" defaultValue="Marketing Digital" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currency">Moeda Padrão</Label>
                  <Input id="currency" defaultValue="BRL" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <Input id="timezone" defaultValue="America/Sao_Paulo" className="mt-1" />
                </div>
              </div>
              <Button className="bg-[#2E86AB] hover:bg-[#1E3A5F]">
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="usuarios" className="space-y-6">
          <Card className="card-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários do Workspace</CardTitle>
                <Button className="bg-[#2E86AB] hover:bg-[#1E3A5F]">
                  <Users className="w-4 h-4 mr-2" />
                  Convidar Usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gerencie os usuários que têm acesso a este workspace
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notificacoes" className="space-y-6">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Preferências de Notificações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure quais alertas você deseja receber e por qual canal
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Toaster />
    </div>
  );
}