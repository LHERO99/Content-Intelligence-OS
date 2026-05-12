import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAllUsers } from '@/lib/postgres';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await getAllUsers();
    const assignableUsers = users
      .filter((user) => user.Role === 'Editor' || user.Role === 'Admin')
      .map((user) => ({
        id: user.id,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      }));

    return NextResponse.json(assignableUsers);
  } catch (error) {
    console.error('[API] Error fetching assignable editors:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
