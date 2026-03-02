import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const wait = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * (i + 1);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    return res;
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
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

function analyzeChannel(source, medium) {
  const s = (source || '').toLowerCase();
  const m = (medium || '').toLowerCase();
  if (m === 'cpc' || m === 'ppc' || m === 'paid') {
    if (s.includes('google')) return 'Paid Search | Google';
    if (s.includes('facebook') || s.includes('instagram') || s.includes('meta')) return 'Paid Social | Meta';
    if (s.includes('linkedin')) return 'Paid Social | LinkedIn';
    return `Paid | ${source || 'Unknown'}`;
  }
  if (m === 'organic') return `Organic Search | ${source || 'Unknown'}`;
  if (m === 'email') return `Email | ${source || 'Unknown'}`;
  if (m === 'referral') return `Referral | ${source || 'Unknown'}`;
  if (m === 'social') {
    if (s.includes('facebook')) return 'Organic Social | Facebook';
    if (s.includes('instagram')) return 'Organic Social | Instagram';
    if (s.includes('linkedin')) return 'Organic Social | LinkedIn';
    return `Organic Social | ${source || 'Unknown'}`;
  }
  if (!source && !medium) return 'Direct | Direct';
  return `Unknown | ${source || medium || 'Unknown'}`;
}

function decodeTrafficSource(encoded) {
  if (!encoded) return { source: '', medium: '', campaign: '' };
  try {
    const decoded = atob(encoded);
    const params = new URLSearchParams(decoded);
    return {
      source: params.get('utm_source') || params.get('source') || '',
      medium: params.get('utm_medium') || params.get('medium') || '',
      campaign: params.get('utm_campaign') || params.get('campaign') || ''
    };
  } catch {
    return { source: encoded, medium: '', campaign: '' };
  }
}

function processEventOrigin(event) {
  const encodedSource = event.payload?.traffic_source || event.traffic_source || '';
  const decoded = decodeTrafficSource(encodedSource);
  const source = decoded.source || event.conversion_origin?.source || event.conversion_origin?.social_network || '';
  const medium = decoded.medium || '';
  return analyzeChannel(source, medium);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { integration_id } = await req.json();
    const BATCH_SIZE = 30;
    const BASE = 'https://api.rd.services/platform';

    const integrations = await base44.entities.Integration.filter({ id: integration_id }, '-created_date', 1);
    const integration = integrations?.[0];
    if (!integration || !integration.access_token) {
      return Response.json({ error: 'Integration not found or not authenticated' }, { status: 400 });
    }

    const accessToken = await getValidToken(integration, base44);

    const queue = await base44.entities.EnrichmentQueue.filter(
      { integration_id, status: 'pending' }, 'created_date', BATCH_SIZE
    );

    if (!queue || queue.length === 0) {
      return Response.json({ success: true, status: 'queue_empty', message: 'Todos os leads foram enriquecidos.' });
    }

    let enriched = 0;
    let errors = 0;

    for (const item of queue) {
      try {
        await base44.entities.EnrichmentQueue.update(item.id, { status: 'processing' });

        const headers = { 'Authorization': `Bearer ${accessToken}` };

        const contactRes = await fetchWithRetry(`${BASE}/contacts/${item.rd_uuid}`, { headers });
        if (!contactRes.ok) throw new Error(`Contact fetch failed: ${contactRes.status}`);
        const contactData = await contactRes.json();

        let funnelData = null;
        try {
          const funnelRes = await fetchWithRetry(`${BASE}/contacts/${item.rd_uuid}/funnels/default`, { headers });
          if (funnelRes.ok) funnelData = await funnelRes.json();
        } catch (_e) { /* funil opcional */ }

        const convRes = await fetchWithRetry(
          `${BASE}/contacts/${item.rd_uuid}/events?event_type=CONVERSION`, { headers }
        );
        const convData = convRes.ok ? await convRes.json() : { events: [] };
        const convEvents = Array.isArray(convData) ? convData : (convData.events || []);

        await new Promise(r => setTimeout(r, 300));

        const oppRes = await fetchWithRetry(
          `${BASE}/contacts/${item.rd_uuid}/events?event_type=OPPORTUNITY`, { headers }
        );
        const oppData = oppRes.ok ? await oppRes.json() : { events: [] };
        const oppEvents = Array.isArray(oppData) ? oppData : (oppData.events || []);

        const lifecycleStage = funnelData?.lifecycle_stage || contactData.lead_stage || 'Lead';
        const isOpportunity = funnelData?.opportunity || false;

        const sortedConversions = [...convEvents].sort((a, b) =>
          new Date(a.event_timestamp || a.timestamp).getTime() -
          new Date(b.event_timestamp || b.timestamp).getTime()
        );

        const sortedOpportunities = [...oppEvents].sort((a, b) =>
          new Date(a.event_timestamp || a.timestamp).getTime() -
          new Date(b.event_timestamp || b.timestamp).getTime()
        );

        let lastOpportunityDate = null;
        if (isOpportunity && sortedOpportunities.length > 0) {
          const lastOpp = sortedOpportunities[sortedOpportunities.length - 1];
          lastOpportunityDate = new Date(lastOpp.event_timestamp || lastOpp.timestamp).toISOString();
        }

        let firstConversionDate = null;
        let firstConversionOrigin = null;
        let lastConversionDate = null;
        let lastConversionOrigin = null;

        if (sortedConversions.length > 0) {
          const firstEvent = sortedConversions[0];
          firstConversionDate = new Date(firstEvent.event_timestamp || firstEvent.timestamp).toISOString();
          firstConversionOrigin = processEventOrigin(firstEvent);

          if (sortedConversions.length > 1) {
            const lastEvent = sortedConversions[sortedConversions.length - 1];
            lastConversionDate = new Date(lastEvent.event_timestamp || lastEvent.timestamp).toISOString();
            lastConversionOrigin = processEventOrigin(lastEvent);
          }
        }

        const globalSource = contactData.traffic_source || sortedConversions[0]?.traffic_source || '';
        const decoded = decodeTrafficSource(globalSource);
        const trafficAnalysis = JSON.stringify({
          source: decoded.source,
          medium: decoded.medium,
          campaign: decoded.campaign,
          channel: analyzeChannel(decoded.source, decoded.medium),
          gclid: contactData.cf_google_click_id || '',
          fbclid: contactData.cf_facebook_click_id || '',
          confidence_score: decoded.source ? 80 : 30
        });

        const eventsHistory = sortedConversions
          .map(e => e.conversion_identifier || e.event_identifier)
          .filter(Boolean)
          .join(', ');

        await base44.entities.Lead.update(item.lead_id, {
          lifecycle_stage: lifecycleStage,
          funnel_status: lifecycleStage,
          is_mql: isOpportunity || lifecycleStage === 'Qualified Lead',
          is_opportunity: isOpportunity,
          is_client: lifecycleStage === 'Client',
          lead_score: contactData.fit_score || 0,
          first_conversion_at: firstConversionDate,
          first_conversion_origin: firstConversionOrigin,
          last_conversion_at: lastConversionDate,
          last_conversion_origin: lastConversionOrigin,
          last_opportunity_date: lastOpportunityDate,
          traffic_analysis: trafficAnalysis,
          events_history: eventsHistory,
          enrichment_status: 'done'
        });

        const existingConversions = await base44.entities.Conversion.filter(
          { lead_id: item.lead_id }, '-created_date', 200
        );
        for (const c of existingConversions) {
          await base44.entities.Conversion.delete(c.id);
        }

        const allEventsToSave = [
          ...sortedConversions.map(e => ({ ...e, _type: 'CONVERSION' })),
          ...sortedOpportunities.map(e => ({ ...e, _type: 'OPPORTUNITY' }))
        ].sort((a, b) =>
          new Date(a.event_timestamp || a.timestamp).getTime() -
          new Date(b.event_timestamp || b.timestamp).getTime()
        );

        for (const event of allEventsToSave) {
          await base44.entities.Conversion.create({
            lead_id: item.lead_id,
            rd_uuid: item.rd_uuid,
            workspace_id: item.workspace_id,
            conversion_time: new Date(event.event_timestamp || event.timestamp).toISOString(),
            event_type: event._type,
            event_identifier: event.conversion_identifier || event.event_identifier || 'unknown',
            conversion_origin: processEventOrigin(event),
            metadata: JSON.stringify(event)
          });
        }

        await base44.entities.EnrichmentQueue.update(item.id, { status: 'done' });
        enriched++;

        await new Promise(r => setTimeout(r, 200));

      } catch (err) {
        errors++;
        const attempts = (item.attempts || 0) + 1;
        await base44.entities.EnrichmentQueue.update(item.id, {
          status: attempts >= 3 ? 'error' : 'pending',
          attempts,
          error_message: err.message
        });
        await base44.entities.Lead.update(item.lead_id, { enrichment_status: 'error' });
      }
    }

    const remaining = await base44.entities.EnrichmentQueue.filter(
      { integration_id, status: 'pending' }, 'created_date', 1
    );

    if (remaining && remaining.length > 0) {
      fetch(req.url, {
        method: 'POST',
        headers: { ...Object.fromEntries(req.headers.entries()) },
        body: JSON.stringify({ integration_id })
      }).catch(() => {});

      return Response.json({
        success: true,
        status: 'continuing',
        enriched_this_batch: enriched,
        errors_this_batch: errors
      });
    }

    return Response.json({
      success: true,
      status: 'completed',
      enriched,
      errors,
      message: 'Enriquecimento concluído para todos os leads.'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});