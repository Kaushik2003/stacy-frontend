import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Delete GitHub auth cookies
    cookieStore.delete('github-token');
    cookieStore.delete('github-user');
    
    return NextResponse.json({ success: true, message: 'Successfully signed out' });
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json({ success: false, error: 'Failed to sign out' }, { status: 500 });
  }
}