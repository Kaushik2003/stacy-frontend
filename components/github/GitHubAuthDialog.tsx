"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';
import { useGitHub } from '@/contexts/GitHubContext';

interface GitHubAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitHubAuthDialog({ open, onOpenChange }: GitHubAuthDialogProps) {
  const { signIn } = useGitHub();

  const handleSignIn = () => {
    signIn();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Connect to GitHub
          </DialogTitle>
          <DialogDescription>
            Sign in with your GitHub account to push your code directly from the IDE.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-200 mb-2">What you'll get:</h4>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Push code directly to your repositories</li>
              <li>• Create new repositories from the IDE</li>
              <li>• Automatic commit messages</li>
              <li>• Secure OAuth authentication</li>
            </ul>
          </div>

          <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-amber-200 mb-1">Permissions Required:</h4>
            <p className="text-xs text-amber-300/80">
              We'll request access to your repositories to enable push functionality. 
              Your credentials are never stored in the browser.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSignIn} className="flex-1">
              <Github className="w-4 h-4 mr-2" />
              Sign in with GitHub
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}