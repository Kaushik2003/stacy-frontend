"use client"

import { Zap, Rocket, Copy, ExternalLink, Loader, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface RightPanelProps {
    onCompile: () => void
    compiling: boolean
    compiled: boolean
    deployed: boolean
    onDeploy: () => void
    contractId: string
    activeContractName: string
    onClose?: () => void
}

export default function RightPanel({
    onCompile,
    compiling,
    compiled,
    deployed,
    onDeploy,
    contractId,
    activeContractName,
    onClose,
}: RightPanelProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(contractId)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <aside className="glass-elevated w-80 border-l border-primary/20 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="glass-light px-6 py-4 border-b border-primary/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Project Control</h2>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-primary/20 rounded transition-colors"
                        title="Close panel"
                    >
                        <X size={18} className="text-muted-foreground hover:text-foreground" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Compile Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                <Zap size={16} /> Compile Contract
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">Target: <span className="text-foreground font-mono">{activeContractName}</span></p>
                        </div>
                        <span
                            className={`
              text-xs px-2 py-1 rounded-full font-medium transition-all
              ${compiled ? "bg-green-500/20 text-green-400" : "bg-muted/50 text-muted-foreground"}
            `}
                        >
                            {compiled ? "Success" : "Ready"}
                        </span>
                    </div>

                    <Button
                        onClick={onCompile}
                        disabled={compiling}
                        className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-background font-semibold py-6 rounded-xl transition-all duration-300 disabled:opacity-50"
                    >
                        {compiling ? (
                            <>
                                <Loader size={16} className="animate-spin mr-2" />
                                Compiling...
                            </>
                        ) : (
                            <>
                                <Zap size={16} className="mr-2" />
                                Compile Contract
                            </>
                        )}
                    </Button>
                </div>

                {/* Deployment Section */}
                {compiled && (
                    <div className="space-y-3 pt-4 border-t border-primary/20">
                        <h3 className="text-sm font-semibold text-secondary flex items-center gap-2">
                            <Rocket size={16} /> Deployment
                        </h3>

                        <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${deployed ? "bg-green-500" : "bg-muted"}`}></div>
                                <span>1. Upload WASM</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${deployed ? "bg-green-500" : "bg-muted"}`}></div>
                                <span>2. Instantiate Contract</span>
                            </div>
                        </div>

                        <Button
                            onClick={onDeploy}
                            disabled={!compiled || deployed}
                            className="w-full bg-gradient-to-r from-secondary to-cyan-400 hover:from-secondary/90 hover:to-cyan-400/90 text-background font-semibold py-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Rocket size={16} className="mr-2" />
                            Deploy to Testnet
                        </Button>
                    </div>
                )}

                {/* Contract Details */}
                {deployed && (
                    <div className="space-y-3 pt-4 border-t border-primary/20">
                        <h3 className="text-sm font-semibold text-foreground">Contract Details</h3>

                        <div className="glass p-4 rounded-lg space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground block mb-2">Contract ID</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono text-primary/80 truncate flex-1">{contractId}</span>
                                    <button onClick={handleCopy} className="p-1 hover:bg-primary/20 rounded transition-colors">
                                        <Copy size={14} className={copied ? "text-green-500" : "text-muted-foreground"} />
                                    </button>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => window.open(`https://stellar.expert/explorer/testnet/contract/${contractId}`, '_blank', 'noopener,noreferrer')}
                                className="w-full text-sm text-secondary border-secondary/50 hover:bg-secondary/10 py-4 bg-transparent"
                            >
                                <ExternalLink size={14} className="mr-2" />
                                View on Explorer
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer gradient */}
            <div className="absolute bottom-0 right-0 w-full h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none"></div>
        </aside>
    )
}
