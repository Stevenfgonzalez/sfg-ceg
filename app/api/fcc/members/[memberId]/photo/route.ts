import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';
import { getFccAuth } from '@/lib/fcc-auth';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

// Magic bytes: JPEG starts with FF D8 FF, PNG starts with 89 50 4E 47
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function detectImageType(buffer: Buffer): 'image/jpeg' | 'image/png' | null {
  if (buffer.length < 4) return null;
  if (JPEG_MAGIC.every((b, i) => buffer[i] === b)) return 'image/jpeg';
  if (PNG_MAGIC.every((b, i) => buffer[i] === b)) return 'image/png';
  return null;
}

// POST /api/fcc/members/[memberId]/photo — upload photo (owner or editor)
export async function POST(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const auth = await getFccAuth(svc, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify member belongs to user's household
  const { data: member } = await svc
    .from('fcc_members')
    .select('id, household_id')
    .eq('id', params.memberId)
    .eq('household_id', auth.household_id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const photo = formData.get('photo') as File | null;
  if (!photo) {
    return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
  }

  if (photo.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Photo must be under 2MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await photo.arrayBuffer());

  // Verify actual file content via magic bytes — don't trust client MIME type
  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    return NextResponse.json({ error: 'Photo must be JPEG or PNG' }, { status: 400 });
  }

  const ext = detectedType === 'image/png' ? 'png' : 'jpg';
  const path = `${member.household_id}/${params.memberId}.${ext}`;

  const { error: uploadErr } = await svc.storage
    .from('fcc-photos')
    .upload(path, buffer, {
      upsert: true,
      contentType: detectedType,
    });

  if (uploadErr) {
    log({ level: 'error', event: 'fcc_photo_upload_error', route: `/api/fcc/members/${params.memberId}/photo`, error: uploadErr.message });
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: urlData } = svc.storage.from('fcc-photos').getPublicUrl(path);
  const photo_url = urlData.publicUrl;

  const { error: updateErr } = await svc
    .from('fcc_members')
    .update({ photo_url })
    .eq('id', params.memberId);

  if (updateErr) {
    log({ level: 'error', event: 'fcc_photo_url_update_error', route: `/api/fcc/members/${params.memberId}/photo`, error: updateErr.message });
    return NextResponse.json({ error: 'Photo uploaded but failed to update record' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_photo_uploaded', route: `/api/fcc/members/${params.memberId}/photo` });
  return NextResponse.json({ photo_url });
}

// DELETE /api/fcc/members/[memberId]/photo — remove photo (owner or editor)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const auth = await getFccAuth(svc, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: member } = await svc
    .from('fcc_members')
    .select('id, household_id, photo_url')
    .eq('id', params.memberId)
    .eq('household_id', auth.household_id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const basePath = `${member.household_id}/${params.memberId}`;
  await svc.storage.from('fcc-photos').remove([`${basePath}.jpg`, `${basePath}.png`]);

  const { error: updateErr } = await svc
    .from('fcc_members')
    .update({ photo_url: null })
    .eq('id', params.memberId);

  if (updateErr) {
    log({ level: 'error', event: 'fcc_photo_delete_error', route: `/api/fcc/members/${params.memberId}/photo`, error: updateErr.message });
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_photo_deleted', route: `/api/fcc/members/${params.memberId}/photo` });
  return NextResponse.json({ success: true });
}
