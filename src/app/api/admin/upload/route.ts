import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { put } from '@vercel/blob';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'logo' or 'favicon'

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    // Size limit check: 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei ist zu groß (maximal 2MB erlaubt)' }, { status: 400 });
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const safeExt = String(ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = type === 'favicon' ? 'favicon' : 'logo';
    const blobPath = `branding/${prefix}-${Date.now()}.${safeExt || 'bin'}`;

    const uploaded = await put(blobPath, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: uploaded.url });
  } catch (error: any) {
    console.error('[API] Error uploading file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
