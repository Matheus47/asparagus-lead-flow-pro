import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { workspaceId, userMessage, chatHistory = [] } = await req.json();

    // Fetch real workspace data for context
    const [leads, campaigns, webMetrics, opportunities, insights] = await Promise.all([
      base44.entities.Lead.list('-created_date', 200),
      base44.entities.CampaignMetric.list('-date', 100),
      base44.entities.WebMetric.list('-date', 60),
      base44.entities.PipelineOpportunity.filter({ status: 'open' }, '-created_date', 50),
      base44.entities.AIInsight.list('-generated_at', 20)
    ]);

    // Build a compact data summary for the LLM context
    const totalLeads = leads.length;
    const mqls = leads.filter(l => l.is_mql).length;
    const clients = leads.filter(l => l.is_client).length;
    const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0) / 100;
    const cpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 0;
    const totalSessions = webMetrics.reduce((s, m) => s + (m.sessions || 0), 0);
    const pipelineValue = opportunities.reduce((s, o) => s + (o.value || 0), 0);

    const channelBreakdown = leads.reduce((acc, l) => {
      const ch = l.origin_channel || 'unknown';
      acc[ch] = (acc[ch] || 0) + 1;
      return acc;
    }, {});

    const campaignBreakdown = campaigns.reduce((acc, c) => {
      if (!acc[c.campaign_name]) acc[c.campaign_name] = { spend: 0, conversions: 0, platform: c.platform };
      acc[c.campaign_name].spend += (c.spend || 0) / 100;
      acc[c.campaign_name].conversions += (c.conversions || 0);
      return acc;
    }, {});

    const dataContext = `
Dados reais do workspace LeadFlow Analytics:
- Total de Leads: ${totalLeads}
- MQLs: ${mqls} (taxa: ${totalLeads > 0 ? ((mqls/totalLeads)*100).toFixed(1) : 0}%)
- Clientes: ${clients}
- Investimento total em Ads: R$ ${totalSpend.toFixed(2)}
- CPL médio: R$ ${cpl}
- Sessões web (GA4): ${totalSessions}
- Pipeline aberto: R$ ${pipelineValue.toLocaleString('pt-BR')}
- Leads por canal: ${JSON.stringify(channelBreakdown)}
- Campanhas (nome → investimento/conversões): ${JSON.stringify(campaignBreakdown)}
- Últimos insights: ${insights.slice(0, 5).map(i => i.title).join('; ')}
`;

    // Build conversation history for the LLM
    const conversationHistory = chatHistory.slice(-6).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n');

    const prompt = `Você é um analista de marketing e dados especialista em performance digital. 
Você tem acesso aos dados reais do workspace do usuário abaixo. 
Responda de forma direta, precisa e acionável em português do Brasil.
Após sua resposta principal, sugira exatamente 3 perguntas de follow-up relevantes no formato JSON ao final, assim:
FOLLOW_UPS: ["pergunta 1", "pergunta 2", "pergunta 3"]

${dataContext}

Histórico da conversa:
${conversationHistory}

Usuário: ${userMessage}

Responda agora:`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });

    // Parse follow-up questions from response
    let answer = result;
    let followUps = [];
    const followUpMatch = result.match(/FOLLOW_UPS:\s*(\[.*?\])/s);
    if (followUpMatch) {
      try {
        followUps = JSON.parse(followUpMatch[1]);
        answer = result.replace(/FOLLOW_UPS:\s*\[.*?\]/s, '').trim();
      } catch (_) {
        // ignore parse error, keep full answer
      }
    }

    return Response.json({ answer, followUps });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});