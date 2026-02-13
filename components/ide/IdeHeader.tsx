"use client";
import { cn } from "@/lib/utils";
import {
  PanelLeft,
  PanelRight,
  TerminalSquare,
  Eye,
  Code2,
  X,
  FileCode2,
  Search,
  Folder,
} from "lucide-react";
import { WorkspaceState, FileNode } from "@/types/ide";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitHubStatus } from "@/components/github/GitHubStatus";
import { GitHubButton } from "@/components/github/GitHubButton";

interface IdeHeaderProps {
  workspace: WorkspaceState;
  onToggleFileExplorer: () => void;
  onToggleActionPanel: () => void;
  onToggleTerminal: () => void;
  onTogglePreview?: () => void;
  previewMode?: boolean;
  onCloseFile: (fileId: string) => void;
  onSelectFile: (fileId: string) => void;
  sandboxPreviewUrl?: string | null;
  isSandboxRunning?: boolean;
  hasPendingChanges?: boolean;
}

// Flatten file tree to get all file paths
function flattenFileTree(nodes: FileNode[], parentPath: string = ""): string[] {
  const results: string[] = [];
  for (const node of nodes) {
    const currentPath = parentPath
      ? `${parentPath}/${node.name}`
      : `/${node.name}`;
    if (node.type === "file") {
      results.push(currentPath);
    }
    if (node.children) {
      results.push(...flattenFileTree(node.children, currentPath));
    }
  }
  return results;
}

export function IdeHeader({
  workspace,
  onToggleFileExplorer,
  onToggleActionPanel,
  onToggleTerminal,
  onTogglePreview,
  previewMode = false,
  onCloseFile,
  onSelectFile,
  sandboxPreviewUrl,
  isSandboxRunning,
  hasPendingChanges = false,
}: IdeHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get all files from the file tree
  const allFiles = useMemo(
    () => flattenFileTree(workspace.fileTree),
    [workspace.fileTree],
  );

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return allFiles.slice(0, 8);
    const query = searchQuery.toLowerCase();
    return allFiles
      .filter((file) => file.toLowerCase().includes(query))
      .slice(0, 8);
  }, [allFiles, searchQuery]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFiles]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isSearchOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredFiles.length - 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            onSelectFile(filteredFiles[selectedIndex]);
            setSearchQuery("");
            setIsSearchOpen(false);
          }
          break;
        case "Escape":
          setSearchQuery("");
          setIsSearchOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isSearchOpen, filteredFiles, selectedIndex, onSelectFile],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcut (Cmd+P)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <div className="h-12 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-2 shrink-0">
      {/* Left Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFileExplorer}
          className={cn(
            "p-2 rounded-md transition-colors",
            workspace.ui.isFileExplorerOpen
              ? "text-purple-400 bg-purple-500/10"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
          )}
          title="Toggle File Explorer"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* File Search Bar */}
        <div ref={containerRef} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 z-10" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search files..."
            className="w-48 h-8 pl-8 pr-8 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-500 font-mono">
            ⌘P
          </kbd>

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50"
              >
                <div className="p-2 border-b border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {searchQuery
                      ? `Results for "${searchQuery}"`
                      : "Recent Files"}
                  </span>
                </div>
                <div className="max-h-[240px] overflow-y-auto">
                  {filteredFiles.length === 0 ? (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      No files found
                    </div>
                  ) : (
                    filteredFiles.map((file, index) => (
                      <button
                        key={file}
                        onClick={() => {
                          onSelectFile(file);
                          setSearchQuery("");
                          setIsSearchOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                          index === selectedIndex
                            ? "bg-purple-600/20 text-purple-300"
                            : "text-zinc-400 hover:bg-zinc-800",
                        )}
                      >
                        <FileCode2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="flex-1 truncate">{file}</span>
                        {index === selectedIndex && (
                          <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-500 font-mono">
                            ↵
                          </kbd>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center - Tabs (Simplified) */}
      <div className="flex-1 px-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {workspace.openFiles.map((file) => (
          <div
            key={file}
            className={cn(
              "group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border cursor-pointer select-none min-w-[120px] max-w-[200px]",
              workspace.activeFile === file
                ? "bg-zinc-800 border-zinc-700 text-zinc-100"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50",
            )}
            onClick={() => onSelectFile(file)}
          >
            <FileCode2 className="w-3.5 h-3.5 opacity-70" />
            <span className="truncate flex-1">{file.split("/").pop()}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(file);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* GitHub Status - Show when files are open */}
        {workspace.openFiles.length > 0 && (
          <div className="ml-auto">
            <GitHubButton files={{}} className="" />
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        {workspace.mode === "frontend" && onTogglePreview && (
          <div className="flex items-center bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-800/50 mr-2">
            <button
              onClick={() => onTogglePreview()}
              className={cn(
                "p-1.5 rounded-md transition-all",
                !previewMode
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              title="Code View"
            >
              <Code2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTogglePreview()}
              className={cn(
                "p-1.5 rounded-md transition-all relative",
                previewMode
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              title={
                hasPendingChanges
                  ? "Preview (Click to sync pending changes)"
                  : isSandboxRunning
                    ? `Preview (${sandboxPreviewUrl})`
                    : "Preview (Sandbox not running)"
              }
            >
              <Eye className="w-4 h-4" />
              {hasPendingChanges ? (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              ) : (
                isSandboxRunning && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )
              )}
            </button>
          </div>
        )}

        <button
          onClick={onToggleTerminal}
          className={cn(
            "p-2 rounded-md transition-colors",
            workspace.ui.isTerminalOpen
              ? "text-purple-400 bg-purple-500/10"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
          )}
          title="Toggle Terminal"
        >
          <TerminalSquare className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleActionPanel}
          className={cn(
            "p-2 rounded-md transition-colors",
            workspace.ui.isActionPanelOpen
              ? "text-purple-400 bg-purple-500/10"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
          )}
          title="Toggle Action Panel"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
