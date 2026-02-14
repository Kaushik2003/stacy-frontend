"use client";

import { useGitHub } from '@/contexts/GitHubContext';
import { Github, GitBranch, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GitHubStatus() {
  const { authState, connectedRepo, disconnectRepository } = useGitHub();

  if (!authState.isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400 transition-colors">
      <Github className="w-3.5 h-3.5" />
      <span>{authState.user?.login}</span>
      
      {connectedRepo && (
        <>
          <span className="text-gray-400 dark:text-zinc-600">→</span>
          <div className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            <span className="text-black dark:text-zinc-300">{connectedRepo.name}:{connectedRepo.branch}</span>
            <a
              href={connectedRepo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300 transition-colors"
              title="Open in GitHub"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={disconnectRepository}
              className="text-gray-600 dark:text-zinc-500 hover:text-red-400 transition-colors ml-1"
              title="Disconnect repository"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}