"use client";
import { cn } from "@/lib/utils";
import { IdeMode, TerminalStatus, DeployedContract } from "@/types/ide";
import { 
  Play, 
  Rocket, 
  CheckCircle2, 
  Loader2, 
  FileJson, 
  Code2, 
  Github,
  AlertCircle,
  Copy,
  ExternalLink,
  Upload,
  Sparkles,
  Globe
} from "lucide-react";
import { useState } from "react";
import { DeployDialog } from "./DeployDialog";
import { useGitHub } from "@/contexts/GitHubContext";
import { GitHubAuthDialog } from "@/components/github/GitHubAuthDialog";
import { GitHubRepoDialog } from "@/components/github/GitHubRepoDialog";

type CompilerStatus = "IDLE" | "QUEUED" | "COMPILING" | "SUCCESS" | "ERROR";
type DeployerStatus = "IDLE" | "UPLOADING" | "INSTANTIATING" | "SUCCESS" | "ERROR";
type NetworkType = "testnet" | "mainnet";
type SandboxStatus = "idle" | "spawning" | "running" | "stopping" | "error";
type BindingsStatus = "idle" | "generating" | "success" | "error";

interface ActionPanelProps {
  mode: IdeMode;
  isOpen: boolean;
  terminalStatus: TerminalStatus;
  deployedContracts: DeployedContract[];
  onCompile: () => void;
  onDeploy: () => void;
  onGenerateBindings: (contractId: string) => void;
  // New props for detailed status
  compilerStatus?: CompilerStatus;
  deployerStatus?: DeployerStatus;
  wasmHex?: string | null;
  latestContractId?: string | null;
  isWalletConnected?: boolean;
  // Network selection
  network?: NetworkType;
  onNetworkChange?: (network: NetworkType) => void;
  explorerUrl?: string | null;
  // Sandbox props
  sandboxStatus?: SandboxStatus;
  isSandboxConnected?: boolean;
  onSpawnSandbox?: () => void;
  onStopSandbox?: () => void;
  bindingsStatus?: BindingsStatus;
  /** File contents for Push to GitHub (Project Actions). */
  fileContents?: Record<string, string>;
}

export function ActionPanel({ 
  mode, 
  isOpen, 
  terminalStatus, 
  deployedContracts,
  onCompile,
  onDeploy,
  onGenerateBindings,
  compilerStatus = "IDLE",
  deployerStatus = "IDLE",
  wasmHex,
  latestContractId,
  isWalletConnected = false,
  network = "testnet",
  onNetworkChange,
  explorerUrl,
  sandboxStatus = "idle",
  isSandboxConnected = false,
  onSpawnSandbox,
  onStopSandbox,
  bindingsStatus = "idle",
  fileContents = {}
}: ActionPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showGitHubAuthDialog, setShowGitHubAuthDialog] = useState(false);
  const [showGitHubRepoDialog, setShowGitHubRepoDialog] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const { authState, connectedRepo, pushToGitHub } = useGitHub();
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (!isOpen) {
    return null;
  }

  const hasCompiledWasm = !!wasmHex;
  const isCompiling = compilerStatus === "COMPILING" || terminalStatus === "compiling";
  const isDeploying = deployerStatus === "UPLOADING" || deployerStatus === "INSTANTIATING" || terminalStatus === "deploying";

  const handleDeployClick = () => {
    setShowDeployDialog(true);
  };

  return (
    <div className="w-72 border-l border-zinc-800 bg-zinc-900/30 flex flex-col shrink-0 overflow-y-auto">
      <div className="h-12 flex items-center px-4 border-b border-zinc-800/50 shrink-0">
        <span className="text-sm font-medium text-zinc-300">
          {mode === "contract" ? "Contract Actions" : "Frontend Actions"}
        </span>
      </div>

      <div className="p-4 space-y-5">
        {mode === "contract" ? (
          <>
            {/* Compile Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Development</h3>
              <button
                onClick={onCompile}
                disabled={isCompiling}
                className={cn(
                  "w-full h-10 flex items-center justify-between px-3 rounded-md transition-all border text-sm",
                  compilerStatus === "SUCCESS" && !isCompiling
                    ? "bg-green-500/10 border-green-900 text-green-400"
                    : compilerStatus === "ERROR" && !isCompiling
                    ? "bg-red-500/10 border-red-900 text-red-400"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700"
                )}
              >
                <div className="flex items-center gap-2">
                  {compilerStatus === "SUCCESS" && !isCompiling ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : compilerStatus === "ERROR" && !isCompiling ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isCompiling ? "Compiling..." : 
                   compilerStatus === "SUCCESS" ? "Compiled ✓" :
                   compilerStatus === "ERROR" ? "Build Failed" : "Build Contract"}
                </div>
                {isCompiling && <Loader2 className="w-4 h-4 animate-spin" />}
              </button>
              
              {/* Compile Status */}
              {hasCompiledWasm && (
                <div className="p-2 rounded-md bg-green-500/5 border border-green-900/50 text-xs text-green-400/80">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    WASM ready ({(wasmHex.length / 2).toLocaleString()} bytes)
                  </div>
                </div>
              )}
            </div>

            {/* Deploy Section */}
            <div className="space-y-3 pt-3 border-t border-zinc-800/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Deployment</h3>
                {/* Network Toggle */}
                <div className="flex items-center gap-1 bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
                  <button
                    onClick={() => onNetworkChange?.("testnet")}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded transition-colors flex items-center gap-1",
                      network === "testnet"
                        ? "bg-purple-600 text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Testnet
                  </button>
                  <button
                    onClick={() => onNetworkChange?.("mainnet")}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded transition-colors flex items-center gap-1",
                      network === "mainnet"
                        ? "bg-red-600 text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Mainnet
                  </button>
                </div>
              </div>
              
              {/* Deployment Steps */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    deployerStatus === "UPLOADING" ? "bg-yellow-500 animate-pulse" :
                    (deployerStatus === "INSTANTIATING" || deployerStatus === "SUCCESS") ? "bg-green-500" : "bg-zinc-700"
                  )} />
                  <span className={cn(
                    deployerStatus === "UPLOADING" ? "text-yellow-400" :
                    (deployerStatus === "INSTANTIATING" || deployerStatus === "SUCCESS") ? "text-green-400" : "text-zinc-500"
                  )}>1. Upload WASM</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    deployerStatus === "INSTANTIATING" ? "bg-yellow-500 animate-pulse" :
                    deployerStatus === "SUCCESS" ? "bg-green-500" : "bg-zinc-700"
                  )} />
                  <span className={cn(
                    deployerStatus === "INSTANTIATING" ? "text-yellow-400" :
                    deployerStatus === "SUCCESS" ? "text-green-400" : "text-zinc-500"
                  )}>2. Instantiate Contract</span>
                </div>
              </div>

              <button
                onClick={handleDeployClick}
                disabled={isDeploying || !hasCompiledWasm || !isWalletConnected}
                className={cn(
                  "w-full h-10 flex items-center justify-between px-3 rounded-md transition-all border text-sm shadow-sm",
                  deployerStatus === "SUCCESS" 
                    ? "bg-green-500/10 border-green-900 text-green-400" 
                    : !hasCompiledWasm
                    ? "bg-zinc-800/50 border-zinc-800 text-zinc-600 cursor-not-allowed"
                    : !isWalletConnected
                    ? "bg-yellow-500/10 border-yellow-900/50 text-yellow-500/80"
                    : "bg-purple-600 hover:bg-purple-500 text-white border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  {deployerStatus === "SUCCESS" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : deployerStatus === "UPLOADING" ? (
                    <Upload className="w-4 h-4" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  {isDeploying ? (deployerStatus === "UPLOADING" ? "Uploading..." : "Instantiating...") :
                   deployerStatus === "SUCCESS" ? "Deployed ✓" : 
                   !hasCompiledWasm ? "Compile First" :
                   !isWalletConnected ? "Connect Wallet" :
                   "Deploy to Testnet"}
                </div>
                {isDeploying && <Loader2 className="w-4 h-4 animate-spin" />}
              </button>
              
              {/* Wallet Warning */}
              {!isWalletConnected && hasCompiledWasm && (
                <div className="p-2 rounded-md bg-yellow-500/5 border border-yellow-900/30 text-xs text-yellow-500/70">
                  Connect your Freighter wallet to deploy
                </div>
              )}
            </div>

            {/* Deployed Contract Details */}
            {latestContractId && (
              <div className="space-y-3 pt-3 border-t border-zinc-800/50">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contract Details</h3>
                <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800 space-y-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Contract ID</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-purple-400/90 truncate flex-1">
                        {latestContractId.slice(0, 12)}...{latestContractId.slice(-8)}
                      </code>
                      <button 
                        onClick={() => handleCopy(latestContractId)}
                        className="p-1 hover:bg-zinc-800 rounded transition-colors"
                        title="Copy full contract ID"
                      >
                        <Copy className={cn("w-3.5 h-3.5", copied ? "text-green-400" : "text-zinc-500")} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`https://stellar.expert/explorer/testnet/contract/${latestContractId}`, '_blank')}
                    className="w-full h-8 flex items-center justify-center gap-2 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on Explorer
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Sandbox Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Development Sandbox</h3>
              
              {/* Sandbox Status */}
              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      sandboxStatus === "running" && isSandboxConnected ? "bg-green-500 animate-pulse" :
                      sandboxStatus === "spawning" ? "bg-yellow-500 animate-pulse" :
                      sandboxStatus === "error" ? "bg-red-500" : "bg-zinc-600"
                    )} />
                    <span className="text-xs text-zinc-400">
                      {sandboxStatus === "running" && isSandboxConnected ? "Connected" :
                       sandboxStatus === "running" ? "Starting Agent..." :
                       sandboxStatus === "spawning" ? "Spawning..." :
                       sandboxStatus === "stopping" ? "Stopping..." :
                       sandboxStatus === "error" ? "Error" : "Not Running"}
                    </span>
                  </div>
                </div>
              </div>

              {sandboxStatus === "running" ? (
                <button
                  onClick={onStopSandbox}
                  disabled={sandboxStatus === "stopping"}
                  className="w-full h-9 flex items-center justify-center gap-2 px-3 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-900/50 text-sm"
                >
                  {sandboxStatus === "stopping" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {sandboxStatus === "stopping" ? "Stopping..." : "Stop Sandbox"}
                </button>
              ) : (
                <button
                  onClick={onSpawnSandbox}
                  disabled={sandboxStatus === "spawning"}
                  className={cn(
                    "w-full h-9 flex items-center justify-center gap-2 px-3 rounded-md transition-colors border text-sm",
                    sandboxStatus === "spawning"
                      ? "bg-yellow-500/10 border-yellow-900/50 text-yellow-400"
                      : "bg-purple-600 hover:bg-purple-500 text-white border-transparent"
                  )}
                >
                  {sandboxStatus === "spawning" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  {sandboxStatus === "spawning" ? "Spawning..." : "Start Sandbox"}
                </button>
              )}
            </div>

            {/* Contract Bindings Section */}
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contract Bindings</h3>
              
              {!isSandboxConnected ? (
                <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-yellow-500/80">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">Sandbox Required</span>
                  </div>
                  <p className="text-xs text-zinc-500">Start the sandbox to generate TypeScript bindings for your contracts.</p>
                </div>
              ) : deployedContracts.length === 0 && !latestContractId ? (
                <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-yellow-500/80">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">No Contracts Found</span>
                  </div>
                  <p className="text-xs text-zinc-500">Deploy a contract in Contract Mode first to generate bindings.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Contract ID</label>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-md h-9 px-2 focus:ring-1 focus:ring-purple-500 outline-none"
                    defaultValue={latestContractId || (deployedContracts[0]?.address)}
                  >
                    {latestContractId && (
                      <option value={latestContractId}>
                        Latest ({latestContractId.slice(0,8)}...{latestContractId.slice(-6)})
                      </option>
                    )}
                    {deployedContracts.map(c => (
                      <option key={c.id} value={c.address}>{c.name} ({c.address.slice(0,8)}...)</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => {
                      const contractId = latestContractId || deployedContracts[0]?.address;
                      if (contractId) onGenerateBindings(contractId);
                    }}
                    disabled={bindingsStatus === "generating"}
                    className={cn(
                      "w-full h-9 flex items-center justify-center gap-2 px-3 rounded-md transition-colors border text-sm mt-2",
                      bindingsStatus === "success" 
                        ? "bg-green-500/10 border-green-900 text-green-400"
                        : bindingsStatus === "generating"
                        ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700"
                    )}
                  >
                    {bindingsStatus === "generating" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : bindingsStatus === "success" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <FileJson className="w-3.5 h-3.5" />
                    )}
                    {bindingsStatus === "generating" ? "Generating..." :
                     bindingsStatus === "success" ? "Bindings Generated ✓" :
                     "Generate Bindings"}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Project Actions</h3>
              <button className="w-full h-9 flex items-center justify-start gap-2 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors text-sm">
                <Code2 className="w-4 h-4" />
                Deploy to Vercel
              </button>
              <button
                onClick={async () => {
                  if (!authState.isAuthenticated) {
                    setShowGitHubAuthDialog(true);
                    return;
                  }
                  if (!connectedRepo) {
                    setShowGitHubRepoDialog(true);
                    return;
                  }
                  setIsPushing(true);
                  try {
                    await pushToGitHub(fileContents);
                  } finally {
                    setIsPushing(false);
                  }
                }}
                disabled={isPushing || (authState.isAuthenticated && !!connectedRepo && Object.keys(fileContents).length === 0)}
                className={cn(
                  "w-full h-9 flex items-center justify-start gap-2 px-3 rounded-md border transition-colors text-sm",
                  "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700",
                  isPushing && "opacity-60 cursor-not-allowed"
                )}
              >
                {isPushing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  authState.isAuthenticated ? (
                    <Upload className="w-4 h-4" />
                  ) : (
                    <Github className="w-4 h-4" />
                  )
                )}
                {isPushing ? "Pushing..." : authState.isAuthenticated ? "Push to GitHub" : "Connect GitHub"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Deploy Dialog */}
      <DeployDialog
        isOpen={showDeployDialog}
        onClose={() => setShowDeployDialog(false)}
        status={deployerStatus}
        contractId={latestContractId || null}
        explorerUrl={explorerUrl || null}
        network={network}
        onDeploy={onDeploy}
      />

      <GitHubAuthDialog open={showGitHubAuthDialog} onOpenChange={setShowGitHubAuthDialog} />
      <GitHubRepoDialog open={showGitHubRepoDialog} onOpenChange={setShowGitHubRepoDialog} />
    </div>
  );
}
