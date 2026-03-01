import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '../components/shared/EmptyState';
import { FileText, Download, Plus, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Mock data for reports
const mockReports = [
  {
    id: '1',
    name: 'Relatório Executivo - Janeiro 2026',
    type: 'executivo',
    status: 'ready',
    created_at: '2026-02-01T10:00:00',
    formats: ['PDF', 'Excel']
  },
  {
    id: '2',
    name: 'Performance de Campanhas - Q4 2025',
    type: 'campanhas',
    status: 'ready',
    created_at: '2026-01-15T14:30:00',
    formats: ['PDF']
  },
  {
    id: '3',
    name: 'Análise de Leads - Último Trimestre',
    type: 'leads',
    status: 'generating',
    created_at: '2026-02-24T08:00:00',
    formats: ['PDF', 'Excel']
  }
];

export default function Relatorios() {
  const statusConfig = {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Gere relatórios personalizados em PDF ou Excel</p>
        </div>
        <Button className="bg-[#2E86AB] hover:bg-[#1E3A5F]">
          <Plus className="w-4 h-4 mr-2" />
          Novo Relatório
        </Button>
      </div>

      {/* Reports List */}
      <div className="grid grid-cols-1 gap-4">
        {mockReports.length === 0 ? (
          <Card className="card-shadow">
            <CardContent className="p-8">
              <EmptyState
                icon={FileText}
                title="Nenhum relatório gerado"
                description="Crie seu primeiro relatório para começar"
                actionLabel="Novo Relatório"
                onAction={() => {}}
              />
            </CardContent>
          </Card>
        ) : (
          mockReports.map((report) => (
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
                          {typeLabels[report.type]}
                        </Badge>
                        <Badge variant="secondary" className={`text-xs border ${statusConfig[report.status].color}`}>
                          {statusConfig[report.status].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(report.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {report.status === 'ready' && (
                    <div className="flex gap-2">
                      {report.formats.map((format) => (
                        <Button key={format} variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          {format}
                        </Button>
                      ))}
                    </div>
                  )}

                  {report.status === 'generating' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Card */}
      <Card className="card-shadow bg-gradient-to-r from-[#2E86AB]/5 to-[#2563EB]/5">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2">Como funciona?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Escolha o tipo de relatório e o período desejado</li>
            <li>• Selecione as seções que deseja incluir</li>
            <li>• Opcionalmente, inclua insights gerados por IA</li>
            <li>• Configure agendamento automático (semanal ou mensal)</li>
            <li>• Baixe em PDF ou Excel conforme sua necessidade</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}