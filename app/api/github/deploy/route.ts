import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const GITHUB_API_URL = "https://api.github.com";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("github-token")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, error: "GitHub token not found in cookies" },
      { status: 401 },
    );
  }

  try {
    // 1. Fetch user info to get username and email
    const userResponse = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user info: ${userResponse.statusText}`);
    }
    const userData = await userResponse.json();
    const username = userData.login;
    const userEmail = userData.email || `${username}@users.noreply.github.com`;

    // 2. Generate a unique repo name
    const repoName = `stellar-project-${Date.now()}`;

    // 3. Call GitHub API to create the repo
    const createRepoResponse = await fetch(`${GITHUB_API_URL}/user/repos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        private: false, // Default to public for now
        description: "Stellar Smart Contract Project created with Stacy IDE",
      }),
    });

    if (!createRepoResponse.ok) {
      const errorData = await createRepoResponse.json();
      console.error("GitHub API Error Response:", {
        status: createRepoResponse.status,
        statusText: createRepoResponse.statusText,
        errorData: errorData,
      });
      throw new Error(
        `Failed to create repository: ${errorData.message || createRepoResponse.statusText}`,
      );
    }

    const repoData = await createRepoResponse.json();

    // 4. Return necessary details, including the token temporarily
    return NextResponse.json({
      success: true,
      repoName: repoData.name,
      cloneUrl: repoData.clone_url,
      owner: username,
      userName: userData.name || username,
      userEmail: userEmail,
      accessToken: token, // Temporarily return token for sandbox push
    });
  } catch (error) {
    console.error("GitHub deploy error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 },
    );
  }
}
