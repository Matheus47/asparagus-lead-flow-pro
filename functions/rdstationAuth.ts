import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'exchange_code') {
      const { code, client_id, client_secret, redirect_uri, integration_id } = body;
      const tokenRes = await fetch('https://api.rd.services/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id, client_secret, code })
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return Response.json({ error: `RD Station token error: ${err}` }, { status: 400 });
      }
      const tokens = await tokenRes.json();
      await base44.entities.Integration.update(integration_id, {
        status: 'connected',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString(),
        connected_at: new Date().toISOString()
      });
      return Response.json({ success: true, access_token: tokens.access_token });
    }

    if (action === 'refresh_token') {
      const { client_id, client_secret, refresh_token, integration_id } = body;
      const tokenRes = await fetch('https://api.rd.services/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id, client_secret, refresh_token })
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return Response.json({ error: `Token refresh failed: ${err}` }, { status: 400 });
      }
      const tokens = await tokenRes.json();
      await base44.entities.Integration.update(integration_id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString()
      });
      return Response.json({ success: true, access_token: tokens.access_token });
    }

    return Response.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});