import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'];

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  webp: 'image/webp',
};

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 nicht konfiguriert. Bitte S3_ENDPOINT, S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY setzen.');
  }

  return new S3Client({
    endpoint,
    region: 'eu-central-1', // Hetzner ignoriert diesen Wert, wird aber vom SDK benötigt
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false, // Hetzner nutzt virtual-hosted style: {bucket}.{endpoint}
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId: string = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context in session' }, { status: 400 });
    }

    const bucket = process.env.S3_BUCKET;
    const publicUrl = process.env.S3_PUBLIC_URL;
    if (!bucket || !publicUrl) {
      return NextResponse.json({ error: 'S3_BUCKET oder S3_PUBLIC_URL nicht konfiguriert.' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'logo' or 'favicon'

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    // Size limit: 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei ist zu groß (maximal 2MB erlaubt)' }, { status: 400 });
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const safeExt = String(ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!ALLOWED_EXTENSIONS.includes(safeExt)) {
      return NextResponse.json(
        { error: 'Dateityp nicht erlaubt. Erlaubt: ' + ALLOWED_EXTENSIONS.join(', ') },
        { status: 400 }
      );
    }

    const prefix = type === 'favicon' ? 'favicon' : 'logo';
    const filename = `${prefix}-${Date.now()}.${safeExt}`;
    // Include tenantId in the key to physically isolate files per tenant
    const objectKey = `branding/${tenantId}/${filename}`;

    const s3 = getS3Client();
    const bytes = await file.arrayBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: Buffer.from(bytes),
        ContentType: MIME_TYPES[safeExt] ?? 'application/octet-stream',
        ACL: 'public-read',
      })
    );

    // Public URL served directly by Hetzner Object Storage CDN
    const url = `${publicUrl.replace(/\/$/, '')}/${objectKey}`;

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('[API] Error uploading file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
