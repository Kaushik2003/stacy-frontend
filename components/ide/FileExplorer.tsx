"use client";
import { cn } from "@/lib/utils";
import { FileNode } from "@/types/ide";
import { 
  ChevronRight, 
  ChevronDown, 
  FileCode2, 
  Folder, 
  FolderOpen,
  Plus,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  MoreVertical,
  RefreshCw
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FileExplorerProps {
  files: FileNode[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  isOpen: boolean;
  onAddFile?: (parentPath: string, fileName: string) => void;
  onAddFolder?: (parentPath: string, folderName: string) => void;
  onRename?: (oldPath: string, newName: string) => void;
  onDelete?: (path: string) => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
}

const FileItem = ({ 
  node, 
  level, 
  activeFile, 
  onSelectFile, 
  path,
  onAddFile,
  onAddFolder,
  onRename,
  onDelete
}: { 
  node: FileNode; 
  level: number; 
  activeFile: string | null; 
  onSelectFile: (path: string) => void;
  path: string;
  onAddFile?: (parentPath: string, fileName: string) => void;
  onAddFolder?: (parentPath: string, folderName: string) => void;
  onRename?: (oldPath: string, newName: string) => void;
  onDelete?: (path: string) => void;
}) => {
  const [isExpanded, setExpanded] = useState(true);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState<"file" | "folder">("file");
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [folderContextMenuPosition, setFolderContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const folderItemRef = useRef<HTMLDivElement>(null);
  const fileItemRef = useRef<HTMLDivElement>(null);
  
  // Build current path - avoid leading slash
  const currentPath = path ? `${path}/${node.name}` : node.name;
  
  // For files, use the node.id since it contains the full path we need
  // This matches the keys in fileContents
  const filePath = node.type === "file" ? node.id : currentPath;
  const isActive = activeFile === filePath;
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
        setShowAddMenu(false);
        setContextMenuPosition(null);
        setFolderContextMenuPosition(null);
      }
    };
    if (showContextMenu || showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showContextMenu, showAddMenu]);
  
  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);
  
  // Focus new item input when showing add menu
  useEffect(() => {
    if (showAddMenu && newItemInputRef.current) {
      newItemInputRef.current.focus();
    }
  }, [showAddMenu]);
  
  const handleRename = () => {
    if (renameValue.trim() && renameValue !== node.name && onRename) {
      onRename(filePath, renameValue.trim());
    }
    setIsRenaming(false);
    setRenameValue(node.name);
  };
  
  const handleDelete = () => {
    if (onDelete && confirm(`Are you sure you want to delete ${node.name}?`)) {
      onDelete(filePath);
    }
    setShowContextMenu(false);
  };
  
  const handleAddItem = () => {
    if (newItemName.trim()) {
      if (newItemType === "file" && onAddFile) {
        onAddFile(filePath, newItemName.trim());
      } else if (newItemType === "folder" && onAddFolder) {
        onAddFolder(filePath, newItemName.trim());
      }
    }
    setShowAddMenu(false);
    setNewItemName("");
    setNewItemType("file");
  };

  const handleFolderContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (folderItemRef.current) {
      const rect = folderItemRef.current.getBoundingClientRect();
      setFolderContextMenuPosition({ x: rect.left, y: rect.bottom + 4 });
      setShowContextMenu(true);
    }
  };

  const handleFolderMoreButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (folderItemRef.current) {
      const rect = folderItemRef.current.getBoundingClientRect();
      setFolderContextMenuPosition({ x: rect.left, y: rect.bottom + 4 });
      setShowContextMenu(true);
    }
  };

  if (node.type === "folder") {
    return (
      <div className="select-none relative group" ref={folderItemRef}>
        <div 
          className={cn(
            "flex items-center gap-1.5 py-1 px-2 hover:bg-zinc-800/50 cursor-pointer text-zinc-400 transition-colors",
            "text-sm"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => setExpanded(!isExpanded)}
          onContextMenu={handleFolderContextMenu}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-purple-400/70" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-purple-400/50" />
          )}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setIsRenaming(false);
                  setRenameValue(node.name);
                }
              }}
              className="flex-1 bg-zinc-800 text-zinc-200 px-1 py-0.5 rounded text-sm outline-none border border-purple-500/50 min-w-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1 min-w-0">{node.name}</span>
          )}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0 ml-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddMenu(true);
              }}
              className="p-1 hover:bg-zinc-700 rounded transition-colors"
              title="Add file or folder"
              type="button"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500 hover:text-purple-400" />
            </button>
            <button
              onClick={handleFolderMoreButtonClick}
              className="p-1 hover:bg-zinc-700 rounded transition-colors"
              title="More options"
              type="button"
            >
              <MoreVertical className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
            </button>
          </div>
        </div>
        
        {/* Add Item Menu */}
        {showAddMenu && (
          <div
            ref={contextMenuRef}
            className="absolute left-0 top-8 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 min-w-[200px]"
            style={{ left: `${level * 12 + 8}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setNewItemType("file")}
                className={cn(
                  "px-2 py-1 text-xs rounded",
                  newItemType === "file"
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                )}
              >
                <FilePlus className="w-3 h-3 inline mr-1" />
                File
              </button>
              <button
                onClick={() => setNewItemType("folder")}
                className={cn(
                  "px-2 py-1 text-xs rounded",
                  newItemType === "folder"
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                )}
              >
                <FolderPlus className="w-3 h-3 inline mr-1" />
                Folder
              </button>
            </div>
            <input
              ref={newItemInputRef}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddItem();
                if (e.key === "Escape") {
                  setShowAddMenu(false);
                  setNewItemName("");
                }
              }}
              placeholder={`New ${newItemType} name...`}
              className="w-full bg-zinc-900 text-zinc-200 px-2 py-1 rounded text-sm outline-none border border-zinc-600 focus:border-purple-500"
            />
          </div>
        )}
        
        {/* Context Menu */}
        {showContextMenu && !showAddMenu && folderContextMenuPosition && (
          <div
            ref={contextMenuRef}
            className="fixed z-[100] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ 
              left: `${folderContextMenuPosition.x}px`,
              top: `${folderContextMenuPosition.y}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowContextMenu(false);
                setFolderContextMenuPosition(null);
                setShowAddMenu(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              type="button"
            >
              <FilePlus className="w-4 h-4" />
              New File
            </button>
            <button
              onClick={() => {
                setShowContextMenu(false);
                setFolderContextMenuPosition(null);
                setNewItemType("folder");
                setShowAddMenu(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              type="button"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
            <div className="h-px bg-zinc-700 my-1" />
            <button
              onClick={() => {
                setIsRenaming(true);
                setShowContextMenu(false);
                setFolderContextMenuPosition(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              type="button"
            >
              <Pencil className="w-4 h-4" />
              Rename
            </button>
            <button
              onClick={() => {
                handleDelete();
                setShowContextMenu(false);
                setFolderContextMenuPosition(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
              type="button"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
        <AnimatePresence>
          {isExpanded && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {node.children.map((child) => (
                <FileItem 
                  key={child.id} 
                  node={child} 
                  level={level + 1} 
                  activeFile={activeFile} 
                  onSelectFile={onSelectFile}
                  path={currentPath}
                  onAddFile={onAddFile}
                  onAddFolder={onAddFolder}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileItemRef.current) {
      const rect = fileItemRef.current.getBoundingClientRect();
      setContextMenuPosition({ x: rect.left, y: rect.bottom + 4 });
      setShowContextMenu(true);
    }
  };

  const handleMoreButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileItemRef.current) {
      const rect = fileItemRef.current.getBoundingClientRect();
      setContextMenuPosition({ x: rect.left, y: rect.bottom + 4 });
      setShowContextMenu(true);
    }
  };

  return (
    <div className="relative group" ref={fileItemRef}>
      <div
        className={cn(
          "flex items-center gap-2 py-1 px-2 cursor-pointer transition-colors text-sm border-l-2 relative",
          isActive 
            ? "bg-purple-900/20 text-purple-300 border-purple-500" 
            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border-transparent"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelectFile(filePath)}
        onContextMenu={handleContextMenu}
      >
        <FileCode2 className={cn(
          "w-3.5 h-3.5 flex-shrink-0",
          isActive ? "text-purple-400" : "text-zinc-600"
        )} />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setIsRenaming(false);
                setRenameValue(node.name);
              }
            }}
            className="flex-1 bg-zinc-800 text-zinc-200 px-1 py-0.5 rounded text-sm outline-none border border-purple-500/50 min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1 min-w-0">{node.name}</span>
        )}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto">
          <button
            onClick={handleMoreButtonClick}
            className="p-1 hover:bg-zinc-700 rounded transition-colors"
            title="More options"
            type="button"
          >
            <MoreVertical className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
          </button>
        </div>
      </div>
      
      {/* Context Menu */}
      {showContextMenu && contextMenuPosition && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ 
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setIsRenaming(true);
              setShowContextMenu(false);
              setContextMenuPosition(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            type="button"
          >
            <Pencil className="w-4 h-4" />
            Rename
          </button>
          <button
            onClick={() => {
              handleDelete();
              setShowContextMenu(false);
              setContextMenuPosition(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export function FileExplorer({ 
  files, 
  activeFile, 
  onSelectFile, 
  isOpen,
  onAddFile,
  onAddFolder,
  onRename,
  onDelete,
  onRefresh,
  showRefresh
}: FileExplorerProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      setIsRefreshing(true);
      onRefresh();
      // Reset animation after a short delay
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [onRefresh]);
  const [width, setWidth] = useState(240);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [showRootAddMenu, setShowRootAddMenu] = useState(false);
  const [newRootItemName, setNewRootItemName] = useState("");
  const [newRootItemType, setNewRootItemType] = useState<"file" | "folder">("file");
  const rootAddInputRef = useRef<HTMLInputElement>(null);
  const rootAddMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (showRootAddMenu && rootAddInputRef.current) {
      rootAddInputRef.current.focus();
    }
  }, [showRootAddMenu]);
  
  // Close root add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootAddMenuRef.current && !rootAddMenuRef.current.contains(event.target as Node)) {
        setShowRootAddMenu(false);
        setNewRootItemName("");
      }
    };
    if (showRootAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showRootAddMenu]);
  
  const handleRootAddItem = () => {
    if (newRootItemName.trim()) {
      if (newRootItemType === "file" && onAddFile) {
        onAddFile("", newRootItemName.trim());
      } else if (newRootItemType === "folder" && onAddFolder) {
        onAddFolder("", newRootItemName.trim());
      }
    }
    setShowRootAddMenu(false);
    setNewRootItemName("");
    setNewRootItemType("file");
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !panelRef.current) return;
      const panelRect = panelRef.current.getBoundingClientRect();
      const newWidth = e.clientX - panelRect.left;
      setWidth(Math.max(180, Math.min(400, newWidth)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      ref={panelRef}
      className="relative border-r border-zinc-800 bg-zinc-900/30 flex flex-col shrink-0"
      style={{ width }}
    >
      <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800/50">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-1 relative">
          {showRefresh && (
            <button
              onClick={handleRefresh}
              className="p-1 hover:bg-zinc-700/50 rounded transition-colors"
              title="Refresh file tree from container"
            >
              <RefreshCw 
                size={14} 
                className={cn(
                  "text-zinc-400",
                  isRefreshing && "animate-spin"
                )} 
              />
            </button>
          )}
          <button
            onClick={() => setShowRootAddMenu(true)}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title="Add file or folder"
          >
            <Plus className="w-4 h-4 text-zinc-500 hover:text-purple-400" />
          </button>
          {showRootAddMenu && (
            <div 
              ref={rootAddMenuRef}
              className="absolute top-8 right-0 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 min-w-[200px]"
            >
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setNewRootItemType("file")}
                  className={cn(
                    "px-2 py-1 text-xs rounded",
                    newRootItemType === "file"
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  )}
                >
                  <FilePlus className="w-3 h-3 inline mr-1" />
                  File
                </button>
                <button
                  onClick={() => setNewRootItemType("folder")}
                  className={cn(
                    "px-2 py-1 text-xs rounded",
                    newRootItemType === "folder"
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  )}
                >
                  <FolderPlus className="w-3 h-3 inline mr-1" />
                  Folder
                </button>
              </div>
              <input
                ref={rootAddInputRef}
                value={newRootItemName}
                onChange={(e) => setNewRootItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRootAddItem();
                  if (e.key === "Escape") {
                    setShowRootAddMenu(false);
                    setNewRootItemName("");
                  }
                }}
                placeholder={`New ${newRootItemType} name...`}
                className="w-full bg-zinc-900 text-zinc-200 px-2 py-1 rounded text-sm outline-none border border-zinc-600 focus:border-purple-500"
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {files.map((node) => (
          <FileItem 
            key={node.id} 
            node={node} 
            level={0} 
            activeFile={activeFile} 
            onSelectFile={onSelectFile}
            path=""
            onAddFile={onAddFile}
            onAddFolder={onAddFolder}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 bottom-0 right-0 w-1 cursor-col-resize z-50 group hover:bg-purple-500/30 active:bg-purple-500/50 transition-colors"
      >
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-0.5 h-8 bg-zinc-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

