import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';
import { getFccAuth } from '@/lib/fcc-auth';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

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

  const auth = await getFccAuth(supabase, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify member belongs to user's household
  const { data: member } = await supabase
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

  if (!ALLOWED_TYPES.includes(photo.type)) {
    return NextResponse.json({ error: 'Photo must be JPEG or PNG' }, { status: 400 });
  }

  const ext = photo.type === 'image/png' ? 'png' : 'jpg';
  const path = `${member.household_id}/${params.memberId}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from('fcc-photos')
    .upload(path, buffer, {
      upsert: true,
      contentType: photo.type,
    });

  if (uploadErr) {
    log({ level: 'error', event: 'fcc_photo_upload_error', route: `/api/fcc/members/${params.memberId}/photo`, error: uploadErr.message });
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('fcc-photos').getPublicUrl(path);
  const photo_url = urlData.publicUrl;

  const { error: updateErr } = await supabase
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

  const auth = await getFccAuth(supabase, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: member } = await supabase
    .from('fcc_members')
    .select('id, household_id, photo_url')
    .eq('id', params.memberId)
    .eq('household_id', auth.household_id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const basePath = `${member.household_id}/${params.memberId}`;
  await supabase.storage.from('fcc-photos').remove([`${basePath}.jpg`, `${basePath}.png`]);

  const { error: updateErr } = await supabase
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
