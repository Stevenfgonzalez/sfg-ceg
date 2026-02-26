import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// GET /api/dashboard/[incidentId]/export?format=csv
// AAR export: full checkin data as CSV or JSON
export async function GET(
  request: NextRequest,
  { params }: { params: { incidentId: string } }
) {
  const { incidentId } = params;
  const format = request.nextUrl.searchParams.get('format') ?? 'csv';

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(incidentId)) {
    return NextResponse.json({ error: 'Invalid incident ID' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    // Get incident for the filename
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('name, declared_at')
      .eq('id', incidentId)
      .single();

    if (incidentError) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Get all checkins with computed response time
    const { data: checkins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .eq('incident_id', incidentId)
      .order('checked_in_at', { ascending: true });

    if (checkinsError) {
      return NextResponse.json({ error: checkinsError.message }, { status: 500 });
    }

    // Get summary
    const { data: summary } = await supabase
      .from('v_aar_summary')
      .select('*')
      .eq('incident_id', incidentId)
      .single();

    if (format === 'json') {
      return NextResponse.json({
        incident,
        summary,
        checkins,
        exported_at: new Date().toISOString(),
      });
    }

    // CSV export
    const declaredAt = new Date(incident.declared_at);
    const csvRows: string[] = [];

    // Header
    csvRows.push([
      'Name',
      'Status',
      'Assembly Point',
      'Zone',
      'Department',
      'Role',
      'Party Size',
      'Has Dependents',
      'Dependent Names',
      'Needs Transport',
      'EMS Notes',
      'Phone',
      'Checked In At',
      'Response Time (sec)',
      'Notes',
    ].join(','));

    // Data rows
    for (const c of checkins ?? []) {
      const checkedInAt = new Date(c.checked_in_at);
      const responseTimeSec = Math.round(
        (checkedInAt.getTime() - declaredAt.getTime()) / 1000
      );

      csvRows.push([
        csvEscape(c.full_name),
        c.status,
        csvEscape(c.assembly_point ?? ''),
        csvEscape(c.zone ?? ''),
        csvEscape(c.department ?? ''),
        c.role ?? '',
        c.party_size,
        c.has_dependents,
        csvEscape((c.dependent_names ?? []).join('; ')),
        c.needs_transport,
        csvEscape(c.ems_notes ?? ''),
        csvEscape(c.phone ?? ''),
        c.checked_in_at,
        responseTimeSec,
        csvEscape(c.notes ?? ''),
      ].join(','));
    }

    // Summary footer
    csvRows.push('');
    csvRows.push('--- AAR SUMMARY ---');
    if (summary) {
      csvRows.push(`Total Check-ins,${summary.total_checkins}`);
      csvRows.push(`Total Headcount,${summary.total_headcount}`);
      csvRows.push(`SAFE,${summary.safe_count}`);
      csvRows.push(`SIP,${summary.sip_count}`);
      csvRows.push(`NEED_EMS,${summary.ems_count}`);
      csvRows.push(`Transport Needed,${summary.transport_needed}`);
      csvRows.push(`Time to First Check-in,${summary.time_to_first_checkin}`);
      csvRows.push(`Time to Last Check-in,${summary.time_to_last_checkin}`);
      csvRows.push(`Avg Response Time,${summary.avg_response_time}`);
    }

    const safeName = (incident.name ?? 'export').replace(/[^a-zA-Z0-9-_]/g, '_');
    const dateStr = declaredAt.toISOString().split('T')[0];
    const filename = `AAR_${safeName}_${dateStr}.csv`;

    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
