"use client";
import { cn } from "@/lib/utils";
import { Cuboid, LayoutTemplate, Wallet, LogOut, HelpCircle } from "lucide-react";
import { IdeMode } from "@/types/ide";
import { useState } from "react";
import { WalletGuidePopup } from "./WalletGuidePopup";

type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

interface GlobalTopBarProps {
  ideMode: IdeMode;
  onIdeModeChange: (mode: IdeMode) => void;
  walletAddress?: string | null;
  walletStatus?: WalletStatus;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
}

export function GlobalTopBar({
  ideMode,
  onIdeModeChange,
  walletAddress,
  walletStatus = "disconnected",
  onConnectWallet,
  onDisconnectWallet
}: GlobalTopBarProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  const isConnected = walletStatus === "connected" && walletAddress;
  const isConnecting = walletStatus === "connecting";

  return (
    <div className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 shrink-0 select-none">
      {/* Left - Logo */}
      <div className="flex items-center gap-2 text-zinc-100 font-bold tracking-tight w-40">
        <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center">
          <Cuboid className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm">Stacy</span>
      </div>

      {/* Center - Mode Toggle */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button
            onClick={() => onIdeModeChange("contract")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2",
              ideMode === "contract"
                ? "bg-zinc-800 text-purple-400 shadow-sm ring-1 ring-zinc-700/50"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            <Cuboid className="w-3.5 h-3.5" />
            Smart Contract
          </button>
          <button
            onClick={() => onIdeModeChange("frontend")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2",
              ideMode === "frontend"
                ? "bg-zinc-800 text-purple-400 shadow-sm ring-1 ring-zinc-700/50"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Frontend
          </button>
        </div>
      </div>

      {/* Right - Wallet Controls */}
      <div className="flex items-center gap-3 w-50 justify-end">
        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="h-8 px-3 rounded-md bg-green-900/30 border border-green-800/50 text-green-400 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {displayAddress}
            </span>
            <button
              onClick={onDisconnectWallet}
              className="h-8 px-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-800/50 transition-colors flex items-center"
              title="Disconnect wallet"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-purple-400 hover:border-purple-800/50 transition-colors flex items-center gap-1.5 whitespace-nowrap text-xs font-medium"
              title="Need help installing a wallet?"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>No wallet?</span>
            </button>
            <button
              onClick={onConnectWallet}
              disabled={isConnecting}
              className={cn(
                "h-8 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap",
                isConnecting
                  ? "text-zinc-500 cursor-wait"
                  : "text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
              )}
            >
              <Wallet className="w-3.5 h-3.5" />
              {isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          </div>
        )}
      </div>

      {/* Wallet Guide Popup */}
      <WalletGuidePopup isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}

