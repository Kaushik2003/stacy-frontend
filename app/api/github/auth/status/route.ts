import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('github-user');
    const tokenCookie = cookieStore.get('github-token');

    if (!userCookie || !tokenCookie) {
      return NextResponse.json({ isAuthenticated: false });
    }

    const user = JSON.parse(userCookie.value);

    return NextResponse.json({
      isAuthenticated: true,
      user,
    });
  } catch (error) {
    return NextResponse.json({ isAuthenticated: false });
  }
}