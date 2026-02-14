"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { GitBranch, Plus, Loader2, ExternalLink } from "lucide-react";
import { useGitHub } from "@/contexts/GitHubContext";
import { GitHubRepository } from "@/types/github";

interface GitHubRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitHubRepoDialog({
  open,
  onOpenChange,
}: GitHubRepoDialogProps) {
  const {
    repositories,
    isLoading,
    fetchRepositories,
    connectRepository,
    authState,
  } = useGitHub();
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(
    null,
  );
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDescription, setNewRepoDescription] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");

  useEffect(() => {
    if (open && authState.isAuthenticated && repositories.length === 0) {
      fetchRepositories();
    }
  }, [open, authState.isAuthenticated, repositories.length, fetchRepositories]);

  const handleConnectExisting = () => {
    if (selectedRepo) {
      connectRepository(selectedRepo, selectedBranch);
      onOpenChange(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newRepoName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/github/repositories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: newRepoName.trim(),
          description: newRepoDescription.trim() || undefined,
          private: newRepoPrivate,
        }),
      });

      if (response.ok) {
        const newRepo = await response.json();
        connectRepository(newRepo, "main");
        onOpenChange(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to create repository:", {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        });
      }
    } catch (error) {
      console.error("Failed to create repository:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Select Repository
          </DialogTitle>
          <DialogDescription>
            Choose an existing repository or create a new one to push your code.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Repository</TabsTrigger>
            <TabsTrigger value="new">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                <span className="ml-2 text-sm text-zinc-400">
                  Loading repositories...
                </span>
              </div>
            ) : repositories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-zinc-400 mb-4">
                  No repositories found.
                </p>
                <Button onClick={fetchRepositories} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="repository">Repository</Label>
                  <Select
                    onValueChange={(value) => {
                      const repo = repositories.find(
                        (r) => r.id.toString() === value,
                      );
                      setSelectedRepo(repo || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {repositories.map((repo) => (
                        <SelectItem key={repo.id} value={repo.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{repo.name}</span>
                            {repo.private && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                Private
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRepo && (
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Input
                      id="branch"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      placeholder="main"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ExternalLink className="w-3 h-3" />
                      <a
                        href={selectedRepo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground underline"
                      >
                        {selectedRepo.full_name}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleConnectExisting}
                    disabled={!selectedRepo}
                    className="flex-1"
                  >
                    Connect Repository
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-name">Repository Name</Label>
              <Input
                id="repo-name"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="my-stellar-project"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo-description">Description (optional)</Label>
              <Input
                id="repo-description"
                value={newRepoDescription}
                onChange={(e) => setNewRepoDescription(e.target.value)}
                placeholder="A Stellar smart contract project"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="private-repo"
                checked={newRepoPrivate}
                onCheckedChange={setNewRepoPrivate}
              />
              <Label htmlFor="private-repo">Private repository</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateNew}
                disabled={!newRepoName.trim() || isCreating}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create & Connect
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
