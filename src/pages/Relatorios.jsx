import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import EmptyState from '../components/shared/EmptyState';
import { FileText, Download, Plus, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  ready: { label: 'Pronto', color: 'bg-green-100 text-green-800 border-green-200' },
  generating: { label: 'Gerando...', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  failed: { label: 'Erro', color: 'bg-red-100 text-red-800 border-red-200' }
};

const typeLabels = {
  executivo: 'Executivo',
  campanhas: 'Campanhas',
  leads: 'Leads',
  pipeline: 'Pipeline',
  completo: 'Completo'
};

export default function Relatorios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [generatingIds, setGeneratingIds] = useState({});
  const [form, setForm] = useState({
    name: '',
    report_type: '',
    period_start: '',
    period_end: '',
    formats: ['PDF']
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.Report.list('-created_date', 50)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Report.create({ ...data, workspace_id: 'demo', status: 'pending' }),
    onSuccess: async (report) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowModal(false);
      setForm({ name: '', report_type: '', period_start: '', period_end: '', formats: ['PDF'] });
      // Immediately trigger generation
      await handleGenerate(report.id);
    }
  });

  const handleGenerate = async (reportId) => {
    setGeneratingIds(prev => ({ ...prev, [reportId]: true }));
    await base44.entities.Report.update(reportId, { status: 'generating' });
    queryClient.invalidateQueries({ queryKey: ['reports'] });

    const res = await base44.functions.invoke('generateReport', { reportId });
    setGeneratingIds(prev => ({ ...prev, [reportId]: false }));

    if (res.data?.success) {
      toast({ title: 'Relatório gerado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    } else {
      await base44.entities.Report.update(reportId, { status: 'failed', error_message: res.data?.error });
      toast({ title: 'Erro ao gerar relatório', description: res.data?.error, variant: 'destructive' });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  };

  const toggleFormat = (fmt) => {
    setForm(prev => ({
      ...prev,
      formats: prev.formats.includes(fmt) ? prev.formats.filter(f => f !== fmt) : [...prev.formats, fmt]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Gere relatórios personalizados em PDF ou Excel</p>
        </div>
        <Button className="bg-[#2E86AB] hover:bg-[#1E3A5F]" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Relatório
        </Button>
      </div>

      {/* Reports List */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)
        ) : reports.length === 0 ? (
          <Card className="card-shadow">
            <CardContent className="p-8">
              <EmptyState
                icon={FileText}
                title="Nenhum relatório gerado"
                description="Crie seu primeiro relatório para começar"
                actionLabel="Novo Relatório"
                onAction={() => setShowModal(true)}
              />
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => {
            const sc = statusConfig[report.status] || statusConfig.pending;
            const isGenerating = generatingIds[report.id] || report.status === 'generating';
            return (
              <Card key={report.id} className="card-shadow hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#2E86AB]/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[#2E86AB]" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{report.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[report.report_type] || report.report_type}
                          </Badge>
                          <Badge variant="secondary" className={`text-xs border ${sc.color}`}>
                            {isGenerating ? 'Gerando...' : sc.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(report.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      {report.status === 'ready' && (
                        <>
                          {report.file_url_pdf && (report.formats?.includes('PDF') ?? true) && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={report.file_url_pdf} target="_blank" rel="noreferrer">
                                <Download className="w-4 h-4 mr-2" /> PDF
                              </a>
                            </Button>
                          )}
                          {report.file_url_excel && report.formats?.includes('Excel') && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={report.file_url_excel} target="_blank" rel="noreferrer">
                                <Download className="w-4 h-4 mr-2" /> Excel
                              </a>
                            </Button>
                          )}
                        </>
                      )}
                      {(report.status === 'failed' || report.status === 'pending') && !isGenerating && (
                        <Button variant="outline" size="sm" onClick={() => handleGenerate(report.id)}>
                          <RefreshCw className="w-4 h-4 mr-2" /> Gerar
                        </Button>
                      )}
                      {isGenerating && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-4 h-4 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin" />
                          Processando...
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* New Report Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do relatório</Label>
              <Input
                className="mt-1"
                placeholder="Ex: Relatório Executivo - Março 2026"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.report_type} onValueChange={v => setForm(prev => ({ ...prev, report_type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executivo">Executivo</SelectItem>
                  <SelectItem value="campanhas">Campanhas</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="pipeline">Pipeline</SelectItem>
                  <SelectItem value="completo">Completo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data início</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.period_start}
                  onChange={e => setForm(prev => ({ ...prev, period_start: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.period_end}
                  onChange={e => setForm(prev => ({ ...prev, period_end: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Formatos</Label>
              <div className="flex gap-4 mt-2">
                {['PDF', 'Excel'].map(fmt => (
                  <div key={fmt} className="flex items-center gap-2">
                    <Checkbox
                      id={fmt}
                      checked={form.formats.includes(fmt)}
                      onCheckedChange={() => toggleFormat(fmt)}
                    />
                    <label htmlFor={fmt} className="text-sm cursor-pointer">{fmt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button
              className="bg-[#2E86AB] hover:bg-[#1E3A5F]"
              disabled={!form.name || !form.report_type || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
            >
              {createMutation.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
              ) : 'Criar e Gerar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}