import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('github-token');
  return tokenCookie?.value || null;
}

// Generate .gitignore content
function generateGitignore(): string {
  return `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.tsbuildinfo
next-env.d.ts

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Rust
target/
Cargo.lock

# Stellar
.soroban/
`;
}

// Check if file should be ignored based on .gitignore rules
function shouldIgnoreFile(filePath: string): boolean {
  const ignoredPatterns = [
    /^\.env$/,
    /^\.env\./,
    /node_modules/,
    /\.DS_Store$/,
    /\.log$/,
    /target\//,
    /\.soroban\//,
  ];

  return ignoredPatterns.some(pattern => pattern.test(filePath));
}

// Generate commit message based on file changes
function generateCommitMessage(files: Record<string, string>): string {
  const fileCount = Object.keys(files).length;
  const hasRustFiles = Object.keys(files).some(path => path.endsWith('.rs'));
  const hasJSFiles = Object.keys(files).some(path => path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.tsx'));
  
  if (fileCount === 1) {
    const fileName = Object.keys(files)[0];
    return `Update ${fileName.split('/').pop()}`;
  }
  
  if (hasRustFiles && hasJSFiles) {
    return `Update smart contract and frontend code (${fileCount} files)`;
  } else if (hasRustFiles) {
    return `Update smart contract code (${fileCount} files)`;
  } else if (hasJSFiles) {
    return `Update frontend code (${fileCount} files)`;
  }
  
  return `Update project files (${fileCount} files)`;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getGitHubToken();
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { repositoryName, branch, commitMessage, files } = await request.json();

    if (!repositoryName || !branch || !files) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Filter out ignored files
    const filteredFiles: Record<string, string> = {};
    for (const [path, content] of Object.entries(files)) {
      if (!shouldIgnoreFile(path) && typeof content === 'string' && content.trim()) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        filteredFiles[cleanPath] = content;
      }
    }

    // Add .gitignore if not present
    if (!filteredFiles['.gitignore']) {
      filteredFiles['.gitignore'] = generateGitignore();
    }

    if (Object.keys(filteredFiles).length === 0) {
      return NextResponse.json({ error: 'No valid files to push' }, { status: 400 });
    }

    const finalCommitMessage = commitMessage || generateCommitMessage(filteredFiles);

    // Get repository information
    const repoResponse = await fetch(`https://api.github.com/repos/${repositoryName}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!repoResponse.ok) {
      throw new Error('Repository not found or access denied');
    }

    const repoData = await repoResponse.json();

    // Get the latest commit SHA for the branch
    let latestCommitSha: string;
    try {
      const branchResponse = await fetch(`https://api.github.com/repos/${repositoryName}/branches/${branch}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (branchResponse.ok) {
        const branchData = await branchResponse.json();
        latestCommitSha = branchData.commit.sha;
      } else {
        // Branch doesn't exist, use default branch
        latestCommitSha = repoData.default_branch_commit?.sha || repoData.master_branch?.sha;
        if (!latestCommitSha) {
          throw new Error('Could not determine base commit');
        }
      }
    } catch (error) {
      throw new Error('Failed to get branch information');
    }

    // Create blobs for all files
    const blobs: Record<string, string> = {};
    for (const [path, content] of Object.entries(filteredFiles)) {
      const blobResponse = await fetch(`https://api.github.com/repos/${repositoryName}/git/blobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          encoding: 'base64',
        }),
      });

      if (!blobResponse.ok) {
        throw new Error(`Failed to create blob for ${path}`);
      }

      const blobData = await blobResponse.json();
      blobs[path] = blobData.sha;
    }

    // Create tree
    const tree = Object.entries(blobs).map(([path, sha]) => ({
      path,
      mode: '100644',
      type: 'blob',
      sha,
    }));

    const treeResponse = await fetch(`https://api.github.com/repos/${repositoryName}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tree,
        base_tree: latestCommitSha,
      }),
    });

    if (!treeResponse.ok) {
      throw new Error('Failed to create tree');
    }

    const treeData = await treeResponse.json();

    // Create commit
    const commitResponse = await fetch(`https://api.github.com/repos/${repositoryName}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: finalCommitMessage,
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    });

    if (!commitResponse.ok) {
      throw new Error('Failed to create commit');
    }

    const commitData = await commitResponse.json();

    // Update branch reference
    const refResponse = await fetch(`https://api.github.com/repos/${repositoryName}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: commitData.sha,
      }),
    });

    if (!refResponse.ok) {
      // If branch doesn't exist, create it
      const createRefResponse = await fetch(`https://api.github.com/repos/${repositoryName}/git/refs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: commitData.sha,
        }),
      });

      if (!createRefResponse.ok) {
        throw new Error('Failed to create/update branch');
      }
    }

    return NextResponse.json({
      success: true,
      commitHash: commitData.sha,
      repositoryUrl: repoData.html_url,
      commitMessage: finalCommitMessage,
      filesCount: Object.keys(filteredFiles).length,
    });

  } catch (error) {
    console.error('GitHub push error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to push to GitHub',
    }, { status: 500 });
  }
}