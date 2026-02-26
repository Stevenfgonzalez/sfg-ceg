import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// GET /api/dashboard/[incidentId]
// Returns incident details, all checkins, and live AAR summary
export async function GET(
  _request: NextRequest,
  { params }: { params: { incidentId: string } }
) {
  const { incidentId } = params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(incidentId)) {
    return NextResponse.json({ error: 'Invalid incident ID' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    // Parallel fetch: incident, checkins, summary, assembly breakdown
    const [incidentRes, checkinsRes, summaryRes, assemblyRes] = await Promise.all([
      // Incident details
      supabase
        .from('incidents')
        .select('*')
        .eq('id', incidentId)
        .single(),

      // All checkins for this incident, newest first
      supabase
        .from('checkins')
        .select('*')
        .eq('incident_id', incidentId)
        .order('checked_in_at', { ascending: false }),

      // AAR summary from the view
      supabase
        .from('v_aar_summary')
        .select('*')
        .eq('incident_id', incidentId)
        .single(),

      // Assembly point breakdown from the view
      supabase
        .from('v_aar_by_assembly_point')
        .select('*')
        .eq('incident_id', incidentId),
    ]);

    if (incidentRes.error) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // EMS flags: pull out anyone who needs immediate attention
    const emsFlags = (checkinsRes.data ?? []).filter(
      (c) => c.status === 'NEED_EMS' || c.needs_transport
    );

    // Reunification: anyone with dependents
    const reunification = (checkinsRes.data ?? []).filter(
      (c) => c.has_dependents
    );

    return NextResponse.json({
      incident: incidentRes.data,
      checkins: checkinsRes.data ?? [],
      summary: summaryRes.data ?? null,
      assembly_points: assemblyRes.data ?? [],
      ems_flags: emsFlags,
      reunification,
      meta: {
        total_checkins: (checkinsRes.data ?? []).length,
        fetched_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
