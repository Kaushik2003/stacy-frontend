"use client"

import { ChevronUp, GripHorizontal } from "lucide-react"
import { useState, useRef, useEffect } from "react"
// import { Terminal, AnimatedSpan } from "@/components/ui/terminal"

interface BottomPanelProps {
    logs: string[]
    contractId?: string | null
}

export default function BottomPanel({ logs, contractId }: BottomPanelProps) {
    const [expanded, setExpanded] = useState(true)
    const [height, setHeight] = useState(256) // Default height in pixels
    const [isResizing, setIsResizing] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when logs change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, contractId, expanded]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return

            const newHeight = window.innerHeight - e.clientY
            if (newHeight >= 100 && newHeight <= window.innerHeight * 0.7) {
                setHeight(newHeight)
            }
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    return (
        <div
            ref={panelRef}
            className="glass-elevated border-t border-primary/20 transition-all duration-300 flex flex-col relative"
            style={{ height: expanded ? `${height}px` : '48px' }}
        >
            {/* Resize Handle */}
            {expanded && (
                <div
                    className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/30 transition-colors group"
                    onMouseDown={() => setIsResizing(true)}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripHorizontal size={16} className="text-primary" />
                    </div>
                </div>
            )}

            {/* Header */}
            <div
                className="glass-light px-6 py-3 border-b border-primary/10 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span>Terminal Output</span>
                    <span className="text-xs text-muted-foreground ml-2">{logs.length} messages</span>
                </div>
                <ChevronUp size={18} className={`text-primary transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>

            {/* Content */}
            {expanded && (
                <div className="flex-1 overflow-hidden bg-black p-2 relative">
                    <div className="absolute inset-0 overflow-y-auto p-4 space-y-1 font-mono text-sm scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                        {logs.map((log, i) => {
                            const isError = log.includes("[ERROR]") || log.toLowerCase().includes("error")
                            const isSuccess = log.includes("[SUCCESS]") || log.toLowerCase().includes("success")
                            const isCompile = log.includes("[COMPILE]") || log.includes("[DEPLOY]")
                            const isWarning = log.includes("[WARNING]")

                            return (
                                <div
                                    key={i}
                                    className={`
                                        break-all
                                        ${isError ? "text-red-400" : ""}
                                        ${isSuccess ? "text-green-400" : ""}
                                        ${isCompile ? "text-blue-400" : ""}
                                        ${isWarning ? "text-yellow-400" : ""}
                                        ${!isError && !isSuccess && !isCompile && !isWarning ? "text-foreground/70" : ""}
                                    `}
                                >
                                    <span className="opacity-50 mr-2">$</span>
                                    {log}
                                </div>
                            )
                        })}
                        {contractId && (
                            <div className="text-green-400 mt-4 font-bold border border-green-500/30 bg-green-500/10 p-2 rounded">
                                Contract ID: {contractId} (Deployed)
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </div>
            )}
        </div>
    )
}
