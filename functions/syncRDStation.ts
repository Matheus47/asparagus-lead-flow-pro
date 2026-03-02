import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function detectChannel(contact) {
  const source = (contact.traffic_source || '').toLowerCase();
  const medium = (contact.traffic_medium || '').toLowerCase();
  if (contact.cf_google_click_id || source.includes('google') || medium === 'cpc') return 'paid_search';
  if (contact.cf_facebook_click_id || source.includes('facebook') || source.includes('instagram')) return 'paid_social';
  if (medium === 'organic' || medium === 'seo') return 'organic_search';
  if (source.includes('social')) return 'organic_social';
  if (medium === 'email') return 'email';
  if (medium === 'referral') return 'referral';
  if (source === 'direct' || (!source && !medium)) return 'direct';
  return 'unknown';
}

async function getValidToken(integration, base44) {
  const now = new Date();
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : now;
  if (expiresAt <= now && integration.refresh_token && integration.client_id && integration.client_secret) {
    const tokenRes = await fetch('https://api.rd.services/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: integration.client_id,
        client_secret: integration.client_secret,
        refresh_token: integration.refresh_token
      })
    });
    if (tokenRes.ok) {
      const tokens = await tokenRes.json();
      await base44.entities.Integration.update(integration.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || integration.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString()
      });
      return tokens.access_token;
    }
  }
  return integration.access_token;
}

async function findSegmentationId(accessToken) {
  const res = await fetch('https://api.rd.services/platform/segmentations', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const segmentations = data.segmentations || [];
  const todaBase = segmentations.find(s =>
    s.name?.toLowerCase().includes('toda') ||
    s.name?.toLowerCase().includes('base') ||
    (s.standard === true && s.name?.toLowerCase().includes('lead'))
  );
  return todaBase?.id || segmentations.find(s => s.standard === true)?.id || null;
}

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const wait = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * (i + 1);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      integration_id,
      sync_type = 'incremental',
      sync_log_id = null,
      start_page = 1,
      total_processed_so_far = 0,
      total_created_so_far = 0,
      total_updated_so_far = 0,
      segmentation_id = null
    } = body;

    const PAGE_SIZE = 125;
    const PAGES_PER_BATCH = 16;

    const integrations = await base44.entities.Integration.filter({ id: integration_id }, '-created_date', 1);
    const integration = integrations?.[0];
    if (!integration || !integration.access_token) {
      return Response.json({ error: 'Integration not found or not authenticated' }, { status: 400 });
    }

    const accessToken = await getValidToken(integration, base44);

    let logId = sync_log_id;
    let segId = segmentation_id;

    if (!logId) {
      const syncLog = await base44.entities.SyncLog.create({
        workspace_id: integration.workspace_id || 'demo',
        integration_id,
        sync_type,
        started_at: new Date().toISOString(),
        status: 'running',
        triggered_by: 'manual'
      });
      logId = syncLog.id;
      await base44.entities.Integration.update(integration_id, { status: 'syncing' });
    }

    if (!segId) {
      segId = await findSegmentationId(accessToken);
    }

    const baseUrl = segId
      ? `https://api.rd.services/platform/segmentations/${segId}/contacts`
      : `https://api.rd.services/platform/contacts`;

    let page = start_page;
    let totalRows = null;
    let totalProcessed = total_processed_so_far;
    let totalCreated = total_created_so_far;
    let totalUpdated = total_updated_so_far;
    let batchProcessed = 0;
    let lastContacts = [];

    while (batchProcessed < PAGES_PER_BATCH) {
      const rdRes = await fetchWithRetry(`${baseUrl}?page=${page}&page_size=${PAGE_SIZE}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!rdRes.ok) {
        const err = await rdRes.text();
        await base44.entities.SyncLog.update(logId, {
          status: 'error',
          finished_at: new Date().toISOString(),
          records_processed: totalProcessed,
          error_message: `API error page ${page}: ${err}`
        });
        await base44.entities.Integration.update(integration_id, { status: 'error', last_sync_status: 'error' });
        return Response.json({ error: `RD Station API error: ${err}` }, { status: 400 });
      }

      if (totalRows === null) {
        const totalHeader = rdRes.headers.get('pagination-total-rows');
        totalRows = totalHeader ? parseInt(totalHeader) : null;
      }

      const data = await rdRes.json();
      const contacts = data.contacts || [];
      lastContacts = contacts;
      if (contacts.length === 0) break;

      for (const contact of contacts) {
        try {
          const channel = detectChannel(contact);
          const leadData = {
            rd_identifier: contact.uuid,
            name: contact.name || '',
            email: contact.email || '',
            phone: contact.personal_phone || contact.mobile_phone || '',
            company: contact.company_name || '',
            job_title: contact.job_title || '',
            city: contact.city || '',
            state: contact.state || '',
            country: contact.country || 'Brasil',
            origin_channel: channel,
            origin_source: contact.traffic_source || '',
            origin_medium: contact.traffic_medium || '',
            origin_campaign: contact.traffic_campaign || '',
            lifecycle_stage: contact.lead_stage || 'Lead',
            lead_score: contact.fit_score || 0,
            gclid: contact.cf_google_click_id || '',
            fbclid: contact.cf_facebook_click_id || '',
            tags: contact.tags || [],
            workspace_id: integration.workspace_id || 'demo',
            enrichment_status: 'pending'
          };

          const existing = await base44.entities.Lead.filter({ rd_identifier: contact.uuid }, '-created_date', 1);
          let leadId;

          if (existing && existing.length > 0) {
            await base44.entities.Lead.update(existing[0].id, leadData);
            leadId = existing[0].id;
            totalUpdated++;
          } else {
            const created = await base44.entities.Lead.create(leadData);
            leadId = created.id;
            totalCreated++;
          }

          const existingQueue = await base44.entities.EnrichmentQueue.filter(
            { lead_id: leadId, status: 'pending' }, '-created_date', 1
          );
          if (!existingQueue || existingQueue.length === 0) {
            await base44.entities.EnrichmentQueue.create({
              lead_id: leadId,
              rd_uuid: contact.uuid,
              integration_id,
              workspace_id: integration.workspace_id || 'demo',
              status: 'pending',
              attempts: 0
            });
          }

          totalProcessed++;
        } catch (err) {
          console.error(`Error processing contact ${contact.uuid}: ${err.message}`);
        }
      }

      batchProcessed++;
      page++;
      if (contacts.length < PAGE_SIZE) break;
      if (totalRows !== null && totalProcessed >= totalRows) break;
    }

    await base44.entities.SyncLog.update(logId, {
      records_processed: totalProcessed,
      records_created: totalCreated,
      records_updated: totalUpdated
    });

    const continueNeeded = lastContacts.length === PAGE_SIZE &&
      (totalRows === null || totalProcessed < totalRows);

    if (continueNeeded) {
      fetch(req.url, {
        method: 'POST',
        headers: { ...Object.fromEntries(req.headers.entries()) },
        body: JSON.stringify({
          integration_id, sync_type, sync_log_id: logId,
          start_page: page,
          total_processed_so_far: totalProcessed,
          total_created_so_far: totalCreated,
          total_updated_so_far: totalUpdated,
          segmentation_id: segId
        })
      }).catch(() => {});

      return Response.json({
        success: true,
        status: 'continuing',
        next_page: page,
        records_processed_so_far: totalProcessed,
        total_rows: totalRows
      });
    }

    await base44.entities.SyncLog.update(logId, {
      status: 'success',
      finished_at: new Date().toISOString(),
      records_processed: totalProcessed,
      records_created: totalCreated,
      records_updated: totalUpdated
    });

    await base44.entities.Integration.update(integration_id, {
      status: 'connected',
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      total_records_synced: (integration.total_records_synced || 0) + totalProcessed
    });

    fetch(req.url.replace('syncRDStation', 'enrichLeads'), {
      method: 'POST',
      headers: { ...Object.fromEntries(req.headers.entries()) },
      body: JSON.stringify({ integration_id })
    }).catch(() => {});

    return Response.json({
      success: true,
      status: 'completed',
      records_processed: totalProcessed,
      records_created: totalCreated,
      records_updated: totalUpdated,
      total_rows: totalRows,
      message: 'Sincronização concluída. Enriquecimento iniciado em background.'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});