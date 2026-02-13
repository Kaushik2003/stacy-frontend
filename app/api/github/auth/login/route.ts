import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function GET(request: NextRequest) {
  // Diagnostic logging
  console.log('=== GitHub OAuth Login Debug ===');
  console.log('GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID);
  console.log('NEXT_PUBLIC_APP_URL:', NEXT_PUBLIC_APP_URL);
  console.log('process.env.NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  console.log('process.env.VERCEL_URL:', process.env.VERCEL_URL);
  
  if (!GITHUB_CLIENT_ID) {
    console.error('ERROR: GitHub Client ID not configured');
    return NextResponse.json({ error: 'GitHub Client ID not configured' }, { status: 500 });
  }

  const redirectUri = `${NEXT_PUBLIC_APP_URL}/api/github/auth/callback`;
  
  // Need 'repo' scope to create repositories
  const scope = 'repo user:email';
  const state = Math.random().toString(36).substring(2, 15);
  
  console.log('GitHub OAuth - Redirect URI:', redirectUri);
  console.log('GitHub OAuth - Scope:', scope);
  
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  return NextResponse.redirect(authUrl);
}
