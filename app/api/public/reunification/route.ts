import { NextResponse } from 'next/server';

// POST /api/public/reunification
// DEPRECATED — replaced by /api/public/reunify
export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint removed. Use /api/public/reunify.' },
    { status: 410 }
  );
}
