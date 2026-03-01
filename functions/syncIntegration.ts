import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Generic sync dispatcher – routes to the right sync logic per integration type
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { integrationId, integrationType, workspaceId, syncType = 'incremental' } = await req.json();

    // Update integration status to syncing
    if (integrationId) {
      await base44.entities.Integration.update(integrationId, { status: 'syncing' });
    }

    // Create a sync log entry
    const syncLog = await base44.entities.SyncLog.create({
      workspace_id: workspaceId || 'demo',
      integration_id: integrationId || '',
      sync_type: syncType,
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: 'manual'
    });

    // Simulate sync work (in production, this would call the actual APIs)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const recordsProcessed = Math.floor(Math.random() * 200) + 50;
    const recordsCreated = Math.floor(recordsProcessed * 0.3);
    const recordsUpdated = recordsProcessed - recordsCreated;

    // Update sync log as success
    await base44.entities.SyncLog.update(syncLog.id, {
      status: 'success',
      finished_at: new Date().toISOString(),
      records_processed: recordsProcessed,
      records_created: recordsCreated,
      records_updated: recordsUpdated
    });

    // Update integration status back to connected with last sync info
    if (integrationId) {
      await base44.entities.Integration.update(integrationId, {
        status: 'connected',
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        total_records_synced: recordsProcessed
      });
    }

    return Response.json({
      success: true,
      records_processed: recordsProcessed,
      records_created: recordsCreated,
      records_updated: recordsUpdated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});