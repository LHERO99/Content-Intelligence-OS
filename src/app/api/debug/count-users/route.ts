import { countUsers } from '@/lib/airtable';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const count = await countUsers();
    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
