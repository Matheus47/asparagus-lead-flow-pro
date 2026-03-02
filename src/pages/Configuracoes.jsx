import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Link as LinkIcon, Users, RefreshCw, CheckCircle2, XCircle, AlertCircle, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CALLBACK_URL = 'https://apecuariadeprecisao.com.br/callback';

const integrationLabels = {
  rdstation: { name: 'RD Station Marketing', icon: '📊' },
  google_analytics: { name: 'Google Analytics 4', icon: '📈' },
  google_ads: { name: 'Google Ads', icon: '🎯' },
  meta_ads: { name: 'Meta Ads', icon: '📱' },
  pipedrive: { name: 'Pipedrive', icon: '💼' }
};

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingButtons, setLoadingButtons] = useState({});
  const [oauthModal, setOauthModal] = useState(null);
  const [credentials, setCredentials] = useState({ client_id: '', client_secret: '' });
  const [oauthCode, setOauthCode] = useState('');
  const [oauthStep, setOauthStep] = useState(1);

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list('-created_date', 100)
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['syncLogs'],
    queryFn: () => base44.entities.SyncLog.list('-started_at', 20)
  });

  const setLoading = (key, val) => setLoadingButtons(prev => ({ ...prev, [key]: val }));

  const handleOpenConnect = (type) => {
    setOauthModal({ type, integrationId: null });
    setOauthStep(1);
    setCredentials({ client_id: '', client_secret: '' });
    setOauthCode('');
  };

  const handleGoToOAuth = async () => {
    if (!credentials.client_id || !credentials.client_secret) {
      toast({ title: 'Preencha o Client ID e Client Secret', variant: 'destructive' });
      return;
    }
    let integration = integrations.find(i => i.type === oauthModal.type);
    if (!integration) {
      integration = await base44.entities.Integration.create({
        type: oauthModal.type,
        status: 'disconnected',
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        workspace_id: 'demo'
      });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    } else {
      await base44.entities.Integration.update(integration.id, {
        client_id: credentials.client_id,
        client_secret: credentials.client_secret
      });
    }
    setOauthModal(prev => ({ ...prev, integrationId: integration.id }));
    const authUrl = `https://api.rd.services/auth/dialog?client_id=${credentials.client_id}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`;
    window.open(authUrl, '_blank');
    setOauthStep(2);
  };

  const handleExchangeCode = async () => {
    if (!oauthCode.trim()) {
      toast({ title: 'Cole o código de autorização recebido', variant: 'destructive' });
      return;
    }
    const key = `exchange_${oauthModal.type}`;
    setLoading(key, true);
    const res = await base44.functions.invoke('rdstationAuth', {
      action: 'exchange_code',
      code: oauthCode.trim(),
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: CALLBACK_URL,
      integration_id: oauthModal.integrationId
    });
    setLoading(key, false);
    if (res.data?.success) {
      toast({ title: '✅ RD Station conectado!', description: 'Iniciando sincronização dos leads...' });
      setOauthModal(null);
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      const allIntegrations = await base44.entities.Integration.list('-created_date', 100);
      const updated = allIntegrations.find(i => i.id === oauthModal.integrationId);
      if (updated) handleSync(updated);
    } else {
      toast({ title: 'Erro ao conectar', description: res.data?.error || 'Verifique o código e tente novamente.', variant: 'destructive' });
    }
  };

  const handleSync = async (integration) => {
    const key = `sync_${integration.id}`;
    setLoading(key, true);

    // Mark as syncing immediately in the DB so the UI updates right away
    await base44.entities.Integration.update(integration.id, { status: 'syncing' });
    queryClient.invalidateQueries({ queryKey: ['integrations'] });

    // Fire-and-forget: don't await — avoids 504 timeout on large bases
    const isRD = integration.type === 'rdstation';
    base44.functions.invoke(
      isRD ? 'syncRDStation' : 'syncIntegration',
      isRD
        ? { integration_id: integration.id, sync_type: 'incremental' }
        : { integrationId: integration.id, integrationType: integration.type, syncType: 'incremental' }
    ).then((res) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }).catch(() => {
      // Timeout/network error is expected for large syncs running in background
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    });

    setLoading(key, false);
    toast({
      title: '⏳ Sincronização iniciada!',
      description: 'Os leads estão sendo importados em background. O status será atualizado automaticamente.'
    });

    // Poll every 30s to update status while syncing
    const pollInterval = setInterval(async () => {
      const fresh = await base44.entities.Integration.filter({ id: integration.id }, '-created_date', 1);
      if (fresh?.[0]?.status !== 'syncing') {
        clearInterval(pollInterval);
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
        queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
      }
    }, 30000);

    // Stop polling after 10 min max
    setTimeout(() => clearInterval(pollInterval), 600000);
  };

  const handleDisconnect = async (integration) => {
    const key = `disconnect_${integration.id}`;
    setLoading(key, true);
    await base44.entities.Integration.update(integration.id, {
      status: 'disconnected',
      access_token: '',
      refresh_token: ''
    });
    setLoading(key, false);
    toast({ title: 'Integração desconectada' });
    queryClient.invalidateQueries({ queryKey: ['integrations'] });
  };

  const getStatusBadge = (status) => {
    const config = {
      connected: { icon: CheckCircle2, label: 'Conectado', color: 'bg-green-100 text-green-800 border-green-200' },
      disconnected: { icon: XCircle, label: 'Desconectado', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      error: { icon: AlertCircle, label: 'Erro', color: 'bg-red-100 text-red-800 border-red-200' },
      syncing: { icon: RefreshCw, label: 'Sincronizando...', color: 'bg-blue-100 text-blue-800 border-blue-200' }
    };
    const sc = config[status] || config.disconnected;
    const Icon = sc.icon;
    return (
      <Badge variant="secondary" className={`${sc.color} border flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {sc.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie integrações, usuários e preferências</p>
      </div>

      <Tabs defaultValue="integracoes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="integracoes" className="space-y-6">
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
                          {integration.account_name && (
                            <div className="text-muted-foreground">Conta: {integration.account_name}</div>
                          )}
                          {integration.last_sync_at && (
                            <div className="text-muted-foreground">
                              Última sync: {format(new Date(integration.last_sync_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
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
                            disabled={!!loadingButtons[`sync_${integration.id}`]}
                            onClick={() => handleSync(integration)}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingButtons[`sync_${integration.id}`] ? 'animate-spin' : ''}`} />
                            {loadingButtons[`sync_${integration.id}`] ? 'Iniciando...' : 'Sincronizar'}
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            disabled={!!loadingButtons[`disconnect_${integration.id}`]}
                            onClick={() => handleDisconnect(integration)}
                          >
                            {loadingButtons[`disconnect_${integration.id}`]
                              ? <RefreshCw className="w-4 h-4 animate-spin" />
                              : 'Desconectar'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {type === 'rdstation'
                            ? 'Conecte via OAuth 2.0 para importar seus leads automaticamente'
                            : `Conecte sua conta ${config.name} para importar dados`}
                        </p>
                        <Button className="w-full bg-[#2E86AB] hover:bg-[#1E3A5F]" onClick={() => handleOpenConnect(type)}>
                          <LinkIcon className="w-4 h-4 mr-2" />
                          Conectar
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
            <CardHeader><CardTitle>Histórico de Sincronizações</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b text-sm">
                    <tr className="text-left">
                      <th className="pb-3 font-medium">Integração</th>
                      <th className="pb-3 font-medium">Tipo</th>
                      <th className="pb-3 font-medium">Início</th>
                      <th className="pb-3 font-medium text-right">Registros</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhuma sincronização realizada ainda
                        </td>
                      </tr>
                    ) : syncLogs.map((log) => {
                      const integration = integrations.find(i => i.id === log.integration_id);
                      return (
                        <tr key={log.id} className="border-b last:border-0 text-sm">
                          <td className="py-3">
                            {integration ? integrationLabels[integration.type]?.name || integration.type : 'Unknown'}
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-xs">{log.sync_type}</Badge>
                          </td>
                          <td className="py-3">
                            {log.started_at ? format(new Date(log.started_at), 'dd/MM HH:mm', { locale: ptBR }) : '-'}
                          </td>
                          <td className="py-3 text-right">
                            {(log.records_processed || 0).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3">{getStatusBadge(log.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace">
          <Card className="card-shadow">
            <CardHeader><CardTitle>Informações do Workspace</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="workspace-name">Nome do Workspace</Label>
                <Input id="workspace-name" defaultValue="Agência Demo" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="timezone">Fuso Horário</Label>
                <Input id="timezone" defaultValue="America/Sao_Paulo" className="mt-1" />
              </div>
              <Button className="bg-[#2E86AB] hover:bg-[#1E3A5F]">Salvar Alterações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
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
              <p className="text-sm text-muted-foreground">Gerencie os usuários com acesso ao workspace</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* OAuth Modal */}
      <Dialog open={!!oauthModal} onOpenChange={(open) => !open && setOauthModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Conectar {oauthModal && integrationLabels[oauthModal.type]?.name}
            </DialogTitle>
          </DialogHeader>

          {oauthStep === 1 && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800 space-y-1">
                <p className="font-semibold">Como obter as credenciais:</p>
                <p>1. Acesse o <strong>App Publisher</strong> da RD Station App Store</p>
                <p>2. Crie um aplicativo com a redirect URI abaixo</p>
                <p>3. Cole aqui o Client ID e Client Secret gerados</p>
                <div className="mt-2 p-2 bg-blue-100 rounded font-mono text-xs break-all">{CALLBACK_URL}</div>
              </div>
              <div>
                <Label>Client ID</Label>
                <Input className="mt-1" placeholder="Cole seu client_id aqui"
                  value={credentials.client_id}
                  onChange={e => setCredentials(prev => ({ ...prev, client_id: e.target.value }))} />
              </div>
              <div>
                <Label>Client Secret</Label>
                <Input className="mt-1" type="password" placeholder="Cole seu client_secret aqui"
                  value={credentials.client_secret}
                  onChange={e => setCredentials(prev => ({ ...prev, client_secret: e.target.value }))} />
              </div>
            </div>
          )}

          {oauthStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800 space-y-2">
                <p className="font-semibold">✅ Nova aba aberta para autorização</p>
                <p>Após autorizar no RD Station, você será redirecionado para:</p>
                <div className="p-2 bg-green-100 rounded font-mono text-xs break-all">{CALLBACK_URL}</div>
                <p>A URL terá um parâmetro <strong>?code=XXXXXX</strong> — copie apenas o valor do code e cole abaixo.</p>
              </div>
              <div>
                <Label>Código de autorização (code)</Label>
                <Input className="mt-1" placeholder="Ex: a1b2c3d4e5f6..."
                  value={oauthCode}
                  onChange={e => setOauthCode(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOauthModal(null)}>Cancelar</Button>
            {oauthStep === 1 ? (
              <Button className="bg-[#2E86AB] hover:bg-[#1E3A5F]"
                onClick={handleGoToOAuth}
                disabled={!credentials.client_id || !credentials.client_secret}>
                Ir para autorização →
              </Button>
            ) : (
              <Button className="bg-[#2E86AB] hover:bg-[#1E3A5F]"
                onClick={handleExchangeCode}
                disabled={!oauthCode.trim() || !!loadingButtons[`exchange_${oauthModal?.type}`]}>
                {loadingButtons[`exchange_${oauthModal?.type}`]
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Conectando...</>
                  : 'Conectar e Sincronizar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}