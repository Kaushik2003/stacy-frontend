"use client"

import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
    walletConnected: boolean
    address: string | null
    onConnect: () => void
    onDisconnect?: () => void
}

export default function Header({ walletConnected, address, onConnect, onDisconnect }: HeaderProps) {
    const displayAddress = address
        ? `${address.slice(0, 4)}...${address.slice(-4)}`
        : "";

    return (
        <header className="glass-elevated h-16 px-6 flex items-center justify-between border-b border-primary/20">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full"></div>
                    <div className="relative bg-gradient-to-br from-primary to-secondary p-2 rounded-full">
                        <Star size={20} className="text-background" />
                    </div>
                </div>
                <span className="text-xl font-bold neon-glow">Vide</span>
            </div>

            {/* Center: File Tabs */}
            <div className="flex items-center gap-2">
                <div className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">src/contracts/hello_world/</span>
                    <span className="text-primary font-semibold">lib.rs</span>
                    <span className="text-muted-foreground">●</span>
                </div>
            </div>

            {/* Right: Connect Wallet */}
            {walletConnected ? (
                <Button
                    onClick={onDisconnect}
                    variant="outline"
                    className="rounded-full px-6 font-medium transition-all duration-300 bg-primary/10 border-primary/50 text-primary hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                >
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                    {displayAddress} (Disconnect)
                </Button>
            ) : (
                <Button
                    onClick={onConnect}
                    variant="outline"
                    className="rounded-full px-6 font-medium transition-all duration-300 border-white/20 text-foreground hover:border-primary/50 hover:text-primary"
                >
                    Connect Wallet
                </Button>
            )}
        </header>
    )
}
