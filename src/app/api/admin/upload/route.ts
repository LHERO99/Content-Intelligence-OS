import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine filename and path
    const extension = file.name.split('.').pop();
    const filename = `${type}_${Date.now()}.${extension}`;
    
    // In many serverless environments, /tmp is the only writable directory.
    // However, for local development and standard servers, we use public/uploads.
    // We try to find the project root correctly.
    const rootDir = process.cwd();
    const uploadDir = join(rootDir, 'public', 'uploads');
    
    try {
      // Ensure upload directory exists
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }
    } catch (e) {
      console.error('Directory creation failed, likely read-only filesystem:', e);
      return NextResponse.json({ 
        error: 'Dateisystem ist schreibgeschützt oder Pfad nicht verfügbar. Upload nicht möglich.' 
      }, { status: 500 });
    }

    const path = join(uploadDir, filename);
    await writeFile(path, buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('[API] Error uploading file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
