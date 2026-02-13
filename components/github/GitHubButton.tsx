"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitBranch, Github, Loader2, Upload } from "lucide-react";
import { useGitHub } from "@/contexts/GitHubContext";
import { useSandboxContext } from "@/contexts/SandboxContext";
import { GitHubAuthDialog } from "./GitHubAuthDialog";
import { GitHubRepoDialog } from "./GitHubRepoDialog";
import { cn } from "@/lib/utils";

interface GitHubButtonProps {
  files: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

export function GitHubButton({
  files,
  disabled,
  className,
}: GitHubButtonProps) {
  const { authState, connectedRepo, pushToGitHub, signOut } = useGitHub();
  const sandbox = useSandboxContext();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showRepoDialog, setShowRepoDialog] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    error?: string;
    commitHash?: string;
  } | null>(null);

  const handleClick = async () => {
    if (!authState.isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }

    if (connectedRepo) {
      // Push to GitHub
      setIsPushing(true);
      setPushResult(null);

      try {
        const result = await pushToGitHub(files);
        setPushResult(result);

        if (result.success) {
          // Show success for 3 seconds
          setTimeout(() => setPushResult(null), 3000);
        }
      } catch (error) {
        setPushResult({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsPushing(false);
      }
      return;
    }

    // NEW DEPLOY LOGIC
    if (!sandbox.isConnected) {
      setPushResult({
        success: false,
        error: "Sandbox not running. Please start the sandbox first.",
      });
      return;
    }

    setIsPushing(true);
    setPushResult(null);

    try {
      // 1. Create Repo
      const response = await fetch("/api/github/deploy", { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create repository");
      }

      const { repoName, cloneUrl, owner, accessToken, userEmail, userName } =
        data;

      // 2. Execute Git Script in Sandbox
      const gitScript = `
            # Configure git user (locally for this repo)
            git config user.email "${userEmail}"
            git config user.name "${userName}"

            # Rename ,gitignore to .gitignore if it exists (common template pattern to avoid npm publish issues)
            if [ -f ,gitignore ]; then
                mv ,gitignore .gitignore
            fi

            # Ensure .gitignore exists and ignores node_modules
            touch .gitignore
            if ! grep -q "node_modules" .gitignore; then
                echo "node_modules/" >> .gitignore
            fi
            if ! grep -q ".env" .gitignore; then
                echo ".env" >> .gitignore
            fi

            # Initialize (safe to run re-init)
            git init

            # Add all files
            git add .

            # Commit
            git commit -m "Initial deploy from Stacy" || true

            # Ensure main branch
            git branch -M main

            # Add remote (remove first to be safe)
            git remote remove origin || true
            git remote add origin https://${accessToken}@github.com/${owner}/${repoName}.git

            # Push
            git push -u origin main --force
        `;

      sandbox.executeCommand(gitScript);

      setPushResult({ success: true });

      // Show success for 3 seconds
      setTimeout(() => setPushResult(null), 3000);
    } catch (error) {
      console.error("Deploy error:", error);
      setPushResult({
        success: false,
        error: error instanceof Error ? error.message : "Deploy failed",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const getButtonContent = () => {
    if (isPushing) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Pushing...
        </>
      );
    }

    if (pushResult?.success) {
      return (
        <>
          <Github className="w-4 h-4" />
          Pushed!
        </>
      );
    }

    if (!authState.isAuthenticated) {
      return (
        <>
          <Github className="w-4 h-4" />
          Connect GitHub
        </>
      );
    }

    if (!connectedRepo) {
      return (
        <>
          <Upload className="w-4 h-4" />
          Deploy to GitHub
        </>
      );
    }

    return (
      <>
        <Upload className="w-4 h-4" />
        Push Changes
      </>
    );
  };

  const getButtonVariant = () => {
    if (pushResult?.success) return "default";
    if (pushResult?.error) return "destructive";
    return "outline";
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          onClick={handleClick}
          disabled={disabled || isPushing}
          variant={getButtonVariant()}
          size="sm"
          className={cn(
            "transition-all duration-200",
            pushResult?.success &&
            "bg-green-600 hover:bg-green-700 border-green-600",
            className,
          )}
        >
          {getButtonContent()}
        </Button>

        {/* Disconnect button when authenticated */}
        {authState.isAuthenticated && (
          <Button
            onClick={signOut}
            variant="ghost"
            size="sm"
            className="text-xs text-zinc-500 hover:text-red-400"
            title="Disconnect from GitHub"
          >
            Disconnect
          </Button>
        )}
      </div>

      {/* Show error message */}
      {pushResult?.error && (
        <div
          className="text-xs text-red-400 mt-1 max-w-[200px] truncate"
          title={pushResult.error}
        >
          {pushResult.error}
        </div>
      )}

      {/* Show connected repo info */}
      {connectedRepo && !pushResult && (
        <div
          className="text-xs text-zinc-500 mt-1 max-w-[200px] truncate"
          title={connectedRepo.full_name}
        >
          → {connectedRepo.name}:{connectedRepo.branch}
        </div>
      )}

      <GitHubAuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
      />

      <GitHubRepoDialog
        open={showRepoDialog}
        onOpenChange={setShowRepoDialog}
      />
    </>
  );
}
