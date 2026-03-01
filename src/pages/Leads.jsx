import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import ChannelBadge from '../components/shared/ChannelBadge';
import LifecycleBadge from '../components/shared/LifecycleBadge';
import EmptyState from '../components/shared/EmptyState';
import { TableSkeleton } from '../components/shared/LoadingSkeleton';
import { 
  Search, 
  Filter, 
  Users, 
  Mail, 
  Phone, 
  Building, 
  Calendar,
  Target,
  TrendingUp,
  ExternalLink,
  Tag as TagIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [filters, setFilters] = useState({
    lifecycle: [],
    channel: [],
    isMQL: null,
    isOpportunity: null
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500)
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', selectedLead?.id],
    queryFn: () => base44.entities.LeadConversionEvent.filter({ lead_id: selectedLead.id }, '-occurred_at', 100),
    enabled: !!selectedLead
  });

  // Filter and search leads
  const filteredLeads = leads.filter(lead => {
    const matchSearch = !searchTerm || 
      lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchLifecycle = filters.lifecycle.length === 0 || filters.lifecycle.includes(lead.lifecycle_stage);
    const matchChannel = filters.channel.length === 0 || filters.channel.includes(lead.origin_channel);
    const matchMQL = filters.isMQL === null || lead.is_mql === filters.isMQL;
    const matchOpp = filters.isOpportunity === null || lead.is_opportunity === filters.isOpportunity;

    return matchSearch && matchLifecycle && matchChannel && matchMQL && matchOpp;
  });

  const toggleFilter = (type, value) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value) 
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }));
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-orange-100 text-orange-800 border-orange-200',
      unknown: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return (
      <Badge variant="secondary" className={`${colors[confidence] || colors.unknown} border`}>
        {confidence}
      </Badge>
    );
  };

  const getEventIcon = (eventType) => {
    const icons = {
      conversion: '🎯',
      stage_changed: '📊',
      opportunity_created: '💼',
      tag_added: '🏷️',
      tag_removed: '❌',
      email_opened: '📧',
      email_clicked: '🔗',
      form_submitted: '📝',
      page_visited: '👁️'
    };
    return icons[eventType] || '•';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Leads</h1>
          <p className="text-muted-foreground mt-1">{filteredLeads.length} leads encontrados</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Filters */}
        <Card className="w-64 flex-shrink-0 card-shadow h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lifecycle Stage */}
            <div>
              <h4 className="font-medium mb-2 text-sm">Lifecycle Stage</h4>
              <div className="space-y-2">
                {['Lead', 'Qualified Lead', 'Client', 'Former Client'].map(stage => (
                  <div key={stage} className="flex items-center gap-2">
                    <Checkbox
                      checked={filters.lifecycle.includes(stage)}
                      onCheckedChange={() => toggleFilter('lifecycle', stage)}
                    />
                    <label className="text-sm cursor-pointer">{stage}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel */}
            <div>
              <h4 className="font-medium mb-2 text-sm">Canal de Origem</h4>
              <div className="space-y-2">
                {['paid_search', 'paid_social', 'organic_search', 'organic_social', 'email', 'referral', 'direct'].map(channel => (
                  <div key={channel} className="flex items-center gap-2">
                    <Checkbox
                      checked={filters.channel.includes(channel)}
                      onCheckedChange={() => toggleFilter('channel', channel)}
                    />
                    <label className="text-sm cursor-pointer">{channel.replace(/_/g, ' ')}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* MQL/Opportunity */}
            <div>
              <h4 className="font-medium mb-2 text-sm">Qualificação</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.isMQL === true}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, isMQL: checked ? true : null }))}
                  />
                  <label className="text-sm cursor-pointer">É MQL</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.isOpportunity === true}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, isOpportunity: checked ? true : null }))}
                  />
                  <label className="text-sm cursor-pointer">É Oportunidade</label>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setFilters({ lifecycle: [], channel: [], isMQL: null, isOpportunity: null })}
            >
              Limpar Filtros
            </Button>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <Card className="card-shadow">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6">
                  <TableSkeleton rows={10} cols={6} />
                </div>
              ) : filteredLeads.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nenhum lead encontrado"
                  description="Ajuste os filtros ou sincronize seus dados do RD Station"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr className="text-left text-sm">
                        <th className="p-4 font-medium">Nome</th>
                        <th className="p-4 font-medium">Stage</th>
                        <th className="p-4 font-medium">Canal</th>
                        <th className="p-4 font-medium">Score</th>
                        <th className="p-4 font-medium">Data Entrada</th>
                        <th className="p-4 font-medium">Última Atividade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr 
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <td className="p-4">
                            <div>
                              <div className="font-medium">{lead.name || 'Sem nome'}</div>
                              <div className="text-sm text-muted-foreground">{lead.email}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            <LifecycleBadge stage={lead.lifecycle_stage || 'Lead'} />
                          </td>
                          <td className="p-4">
                            <ChannelBadge channel={lead.origin_channel || 'unknown'} />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-[#2E86AB]"
                                  style={{ width: `${lead.lead_score || 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{lead.lead_score || 0}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm">
                            {lead.rd_created_at ? format(new Date(lead.rd_created_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {lead.last_activity_at ? format(new Date(lead.last_activity_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Nenhuma'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lead Details Drawer */}
      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl">Detalhes do Lead</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Header Info */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#2E86AB] text-white flex items-center justify-center text-2xl font-bold">
                    {selectedLead.name?.charAt(0) || selectedLead.email?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{selectedLead.name || 'Sem nome'}</h3>
                    <p className="text-muted-foreground">{selectedLead.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <LifecycleBadge stage={selectedLead.lifecycle_stage || 'Lead'} />
                      {selectedLead.is_mql && <Badge className="bg-green-500">MQL</Badge>}
                      {selectedLead.is_opportunity && <Badge className="bg-purple-500">Oportunidade</Badge>}
                      {selectedLead.tags?.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Dados de Contato</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedLead.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedLead.phone}</span>
                      </div>
                    )}
                    {selectedLead.company && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedLead.company}</span>
                        {selectedLead.job_title && <span className="text-muted-foreground">• {selectedLead.job_title}</span>}
                      </div>
                    )}
                    {selectedLead.city && (
                      <div className="text-sm text-muted-foreground">
                        {selectedLead.city}{selectedLead.state ? `, ${selectedLead.state}` : ''}{selectedLead.country ? ` - ${selectedLead.country}` : ''}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Attribution */}
                <Card className="bg-gradient-to-r from-[#2E86AB]/5 to-[#2563EB]/5">
                  <CardHeader>
                    <CardTitle className="text-base">Atribuição de Origem</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Canal de Origem</div>
                      <div className="flex items-center gap-2">
                        <ChannelBadge channel={selectedLead.origin_channel || 'unknown'} />
                        <span className="text-sm">{selectedLead.origin_source || 'Unknown'}</span>
                        {getConfidenceBadge(selectedLead.attribution_confidence)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2">Primeira Conversão</div>
                      <div className="text-sm space-y-1">
                        <div><span className="text-muted-foreground">Data:</span> {selectedLead.first_conversion_at ? format(new Date(selectedLead.first_conversion_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}</div>
                        <div><span className="text-muted-foreground">Conversão:</span> {selectedLead.first_conversion_identifier || '-'}</div>
                        <div><span className="text-muted-foreground">Canal:</span> {selectedLead.first_conversion_source || '-'}</div>
                        {selectedLead.origin_campaign && <div><span className="text-muted-foreground">Campanha:</span> {selectedLead.origin_campaign}</div>}
                      </div>
                    </div>

                    {selectedLead.last_conversion_at && (
                      <div>
                        <div className="text-sm font-medium mb-2">Última Conversão</div>
                        <div className="text-sm space-y-1">
                          <div><span className="text-muted-foreground">Data:</span> {format(new Date(selectedLead.last_conversion_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
                          <div><span className="text-muted-foreground">Conversão:</span> {selectedLead.last_conversion_identifier || '-'}</div>
                        </div>
                      </div>
                    )}

                    {(selectedLead.gclid || selectedLead.fbclid) && (
                      <div className="pt-3 border-t">
                        {selectedLead.gclid && <div className="text-xs"><span className="text-muted-foreground">Google Click ID:</span> {selectedLead.gclid}</div>}
                        {selectedLead.fbclid && <div className="text-xs"><span className="text-muted-foreground">Facebook Click ID:</span> {selectedLead.fbclid}</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Scores */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Lead Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{selectedLead.lead_score || 0}</div>
                      <div className="w-full h-2 bg-muted rounded-full mt-2">
                        <div 
                          className="h-full bg-[#2E86AB] rounded-full"
                          style={{ width: `${selectedLead.lead_score || 0}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Qualidade dos Dados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{selectedLead.data_quality_score || 0}</div>
                      <div className="w-full h-2 bg-muted rounded-full mt-2">
                        <div 
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${selectedLead.data_quality_score || 0}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Timeline de Eventos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento registrado</p>
                    ) : (
                      <div className="space-y-4">
                        {events.map((event) => (
                          <div key={event.id} className="flex gap-3 pb-4 border-b last:border-0">
                            <div className="text-2xl">{getEventIcon(event.event_type)}</div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{event.event_name}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(event.occurred_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </div>
                              {event.source_channel && (
                                <div className="mt-2">
                                  <ChannelBadge channel={event.source_channel} />
                                </div>
                              )}
                              {(event.utm_campaign || event.utm_source) && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {event.utm_campaign && <div>Campanha: {event.utm_campaign}</div>}
                                  {event.utm_source && <div>Origem: {event.utm_source}</div>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Opportunity Info */}
                {selectedLead.is_opportunity && (
                  <Card className="bg-purple-50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Oportunidade
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Nome:</span> {selectedLead.opportunity_name || '-'}</div>
                      <div><span className="text-muted-foreground">Etapa:</span> {selectedLead.opportunity_stage || '-'}</div>
                      {selectedLead.opportunity_value && (
                        <div><span className="text-muted-foreground">Valor:</span> R$ {selectedLead.opportunity_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}