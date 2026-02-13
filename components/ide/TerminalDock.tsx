"use client";
import { cn } from "@/lib/utils";
import { TerminalStatus } from "@/types/ide";
import { 
  TerminalSquare, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

interface TerminalDockProps {
  isOpen: boolean;
  logs: string[];
  status: TerminalStatus;
  onClear: () => void;
  onToggle: () => void;
}

export function TerminalDock({ isOpen, logs, status, onClear, onToggle }: TerminalDockProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(220);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !panelRef.current) return;
      const panelRect = panelRef.current.getBoundingClientRect();
      const newHeight = panelRect.bottom - e.clientY;
      setHeight(Math.max(100, Math.min(500, newHeight)));
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
    return (
      <div 
        className="h-[36px] bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-4 cursor-pointer hover:bg-zinc-800/50 transition-colors z-50 relative"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-zinc-400">
          <TerminalSquare className="w-4 h-4" />
          <span className="text-xs font-mono">Terminal</span>
        </div>
        <ChevronUp className="w-4 h-4 text-zinc-600" />
      </div>
    );
  }

  return (
    <div 
      ref={panelRef}
      className="border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0 flex-grow-0 z-50 relative"
      style={{ height }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 right-0 top-0 h-1 cursor-row-resize z-50 group hover:bg-purple-500/30 active:bg-purple-500/50 transition-colors"
      >
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-0.5 w-8 bg-zinc-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Terminal Header */}
      <div className="h-9 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-zinc-400">
            <TerminalSquare className="w-4 h-4" />
            <span className="text-xs font-medium">Terminal</span>
          </div>
          {status !== "idle" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                status === "compiling" && "bg-yellow-500",
                status === "deploying" && "bg-purple-500",
                status === "success" && "bg-green-500",
                status === "error" && "bg-red-500"
              )} />
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                {status}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onClear}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onToggle}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
      >
        {logs.length === 0 && (
          <div className="text-zinc-600 italic text-xs">Console ready. workspace initialized.</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 group">
            <span className="text-zinc-600 select-none opacity-50 text-[10px] w-4 text-right pt-[3px]">
              {i + 1}
            </span>
            <div className={cn(
              "flex-1 break-all whitespace-pre-wrap",
              log.includes("✓") || log.includes("Success") ? "text-green-400" :
              log.includes("⚠") || log.includes("Warning") ? "text-yellow-400" :
              log.includes("Error") || log.includes("Failed") ? "text-red-400" :
              log.includes(">") ? "text-zinc-300 font-bold" :
              "text-zinc-400"
            )}>
              {log}
            </div>
          </div>
        ))}
        {status === "compiling" && (
           <div className="flex gap-2 animate-pulse">
             <span className="text-zinc-600 w-4"/>
             <span className="text-yellow-500/50">Compiling...</span>
           </div>
        )}
      </div>
    </div>
  );
}
