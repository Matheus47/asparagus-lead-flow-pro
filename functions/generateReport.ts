import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'reportId is required' }, { status: 400 });

    // Mark as generating
    await base44.entities.Report.update(reportId, { status: 'generating' });

    // Simulate report generation (in production, generate actual PDF/Excel)
    await new Promise(resolve => setTimeout(resolve, 2000));

    await base44.entities.Report.update(reportId, {
      status: 'ready',
      generated_at: new Date().toISOString(),
      file_url_pdf: 'https://example.com/report.pdf',
      file_url_excel: 'https://example.com/report.xlsx'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});