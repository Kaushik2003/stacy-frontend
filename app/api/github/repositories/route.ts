import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('github-token');
  return tokenCookie?.value || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getGitHubToken();
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch user repositories
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    const repositories = await response.json();

    // Filter and format repositories
    const formattedRepos = repositories.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
      },
    }));

    return NextResponse.json(formattedRepos);
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  console.log('API: POST /api/github/repositories called');
  try {
    const token = await getGitHubToken();
    console.log('API: Token retrieved:', token ? 'Found' : 'Missing');
    
    if (!token) {
      console.log('API: Error - Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
      console.log('API: Request body parsed:', body);
    } catch (e) {
      console.error('API: Failed to parse request body:', e);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, description, private: isPrivate } = body;

    if (!name) {
      console.log('API: Error - Name missing');
      return NextResponse.json({ error: 'Repository name is required' }, { status: 400 });
    }

    console.log('API: Sending request to GitHub:', 'https://api.github.com/user/repos');
    
    // Create new repository
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true, // Initialize with README
      }),
    });

    console.log('API: GitHub Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('API: GitHub Error Body:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      console.error('GitHub API Create Repo Error:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      });
      
      throw new Error(errorData.message || `GitHub API Failed: ${response.status} ${response.statusText}`);
    }

    const repository = await response.json();
    console.log('API: Repository created successfully:', repository.full_name);

    return NextResponse.json({
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name,
      private: repository.private,
      html_url: repository.html_url,
      default_branch: repository.default_branch,
      owner: {
        login: repository.owner.login,
        avatar_url: repository.owner.avatar_url,
      },
    });
  } catch (error) {
    console.error('API: Critical Error in POST /api/github/repositories:', error);
    // Log the full error object structure
    if (typeof error === 'object') {
       try {
         console.error('API: Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
       } catch (e) {
         console.error('API: Could not stringify error details');
       }
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    }, { status: 500 });
  }
}