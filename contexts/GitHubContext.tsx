"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  GitHubUser,
  GitHubRepository,
  GitHubAuthState,
  GitHubConnectedRepo,
} from "@/types/github";

interface GitHubContextType {
  authState: GitHubAuthState;
  connectedRepo: GitHubConnectedRepo | null;
  repositories: GitHubRepository[];
  isLoading: boolean;

  // Auth methods
  signIn: () => void;
  signOut: () => void;

  // Repository methods
  fetchRepositories: () => Promise<void>;
  connectRepository: (repo: GitHubRepository, branch?: string) => void;
  disconnectRepository: () => void;

  // Push method
  pushToGitHub: (
    files: Record<string, string>,
    commitMessage?: string,
  ) => Promise<{ success: boolean; error?: string; commitHash?: string }>;
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined);

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<GitHubAuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
  });

  const [connectedRepo, setConnectedRepo] =
    useState<GitHubConnectedRepo | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing auth on mount and handle popup messages
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/github/auth/status", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isAuthenticated) {
            setAuthState({
              isAuthenticated: true,
              user: data.user,
              accessToken: null, // Never expose token to frontend
            });
          }
        }
      } catch (error) {
        console.error("Failed to check GitHub auth status:", error);
      }
    };

    checkAuth();

    // Listen for auth success message from popup
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "GITHUB_AUTH_SUCCESS") {
        checkAuth();
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);

  // Load connected repo from localStorage
  useEffect(() => {
    const savedRepo = localStorage.getItem("github-connected-repo");
    if (savedRepo) {
      try {
        setConnectedRepo(JSON.parse(savedRepo));
      } catch (error) {
        console.error("Failed to parse saved repository:", error);
        localStorage.removeItem("github-connected-repo");
      }
    }
  }, []);

  const signIn = useCallback(() => {
    // Open popup for GitHub OAuth
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      "/api/github/auth/login",
      "GitHubAuth",
      `width=${width},height=${height},left=${left},top=${top}`,
    );
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/github/auth/signout", {
        method: "POST",
        credentials: "include",
      });

      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      setConnectedRepo(null);
      setRepositories([]);
      localStorage.removeItem("github-connected-repo");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }, []);

  const fetchRepositories = useCallback(async () => {
    if (!authState.isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/github/repositories", {
        credentials: "include",
      });

      if (response.ok) {
        const repos = await response.json();
        setRepositories(repos);
      } else {
        console.error("Failed to fetch repositories");
      }
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
    } finally {
      setIsLoading(false);
    }
  }, [authState.isAuthenticated]);

  const connectRepository = useCallback(
    (repo: GitHubRepository, branch = "main") => {
      const connectedRepo: GitHubConnectedRepo = {
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        branch: branch,
        html_url: repo.html_url,
      };

      setConnectedRepo(connectedRepo);
      localStorage.setItem(
        "github-connected-repo",
        JSON.stringify(connectedRepo),
      );
    },
    [],
  );

  const disconnectRepository = useCallback(() => {
    setConnectedRepo(null);
    localStorage.removeItem("github-connected-repo");
  }, []);

  const pushToGitHub = useCallback(
    async (files: Record<string, string>, commitMessage?: string) => {
      if (!authState.isAuthenticated) {
        return { success: false, error: "Not authenticated with GitHub" };
      }

      if (!connectedRepo) {
        return { success: false, error: "No repository connected" };
      }

      try {
        const response = await fetch("/api/github/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            repositoryId: connectedRepo.id,
            repositoryName: connectedRepo.full_name,
            branch: connectedRepo.branch,
            commitMessage:
              commitMessage ||
              `Update from Stacy IDE - ${new Date().toISOString()}`,
            files,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          return {
            success: true,
            commitHash: result.commitHash,
          };
        } else {
          return {
            success: false,
            error: result.error || "Failed to push to GitHub",
          };
        }
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },
    [authState.isAuthenticated, connectedRepo],
  );

  return (
    <GitHubContext.Provider
      value={{
        authState,
        connectedRepo,
        repositories,
        isLoading,
        signIn,
        signOut,
        fetchRepositories,
        connectRepository,
        disconnectRepository,
        pushToGitHub,
      }}
    >
      {children}
    </GitHubContext.Provider>
  );
}

export function useGitHub() {
  const context = useContext(GitHubContext);
  if (context === undefined) {
    throw new Error("useGitHub must be used within a GitHubProvider");
  }
  return context;
}
