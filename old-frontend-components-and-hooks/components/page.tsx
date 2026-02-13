"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import LeftSidebar from "@/components/left-sidebar"
import Editor from "@/components/editor"
import RightPanel from "@/components/right-panel"
import BottomPanel from "@/components/bottom-panel"
import { useNebula } from "@/hooks/useNebula"

const DEFAULT_CODE = `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
`;

export default function Home() {
  const { wallet, compiler, deploy, deployStatus, allLogs, contractId, fileSystem } = useNebula();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Sync editor content with selected file
  useEffect(() => {
    if (fileSystem.selectedFile?.content) {
      setCode(fileSystem.selectedFile.content);
    }
  }, [fileSystem.selectedFile]);

  const handleEditorChange = (newContent: string | undefined) => {
    setCode(newContent || "");
    if (fileSystem.selectedFile) {
      fileSystem.updateFileContent(fileSystem.selectedFile.id, newContent || "");
    }
  };

  // Status Mappings
  const isCompiling = compiler.status === "COMPILING" || compiler.status === "QUEUED";
  const isCompiled = compiler.status === "SUCCESS";
  const isDeployed = deployStatus === "SUCCESS";

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden font-sans text-foreground">
      <Header
        walletConnected={!!wallet.address}
        address={wallet.address}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar fileSystem={fileSystem} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor lifts state up */}
          <Editor
            code={code}
            onChange={handleEditorChange}
          />
          <BottomPanel logs={allLogs} contractId={contractId} />
        </div>

        {showRightPanel && (
          <RightPanel
            onCompile={() => compiler.compile(fileSystem.activeContractName, fileSystem.fileTree)}
            activeContractName={fileSystem.activeContractName}
            compiling={isCompiling}
            compiled={isCompiled}
            deployed={isDeployed}
            onDeploy={deploy}
            contractId={contractId || "Not Deployed"}
            onClose={() => setShowRightPanel(false)}
          />
        )}
      </div>
    </div>
  )
}
