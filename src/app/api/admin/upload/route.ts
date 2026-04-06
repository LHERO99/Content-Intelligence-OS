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

    // In serverless environments, we need a public URL for Airtable to fetch the file.
    // If we can't write to the local filesystem, we would need S3/Cloudinary/etc.
    // However, for this implementation, we assume we can write to /tmp or similar,
    // OR we use a temporary file sharing service if we want to be fully serverless.
    
    // For now, let's try to save it to a temporary location that Airtable can access if possible,
    // or return the base64 if it's small enough, but for Attachments Airtable needs a URL.
    
    // IMPORTANT: Airtable requires a publicly accessible URL to fetch the attachment.
    // Since we don't have a public file storage integrated yet, we will continue
    // with the Base64 approach for Config values but optimize the Airtable field type
    // if the user wants to use native attachments.
    
    // If the user REALLY wants native attachments, we need to upload the file to a 
    // public URL first (like an S3 bucket or Vercel Blob).
    
    const base64Data = `data:${file.type};base64,${buffer.toString('base64')}`;
    return NextResponse.json({ url: base64Data });
  } catch (error: any) {
    console.error('[API] Error uploading file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
