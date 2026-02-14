"use client";
import { useState, useReducer, useEffect, useCallback, useRef } from "react";
import { SandboxProvider } from "@/contexts/SandboxContext";
import { GlobalTopBar } from "@/components/ide/GlobalTopBar";
import { ChatPanel } from "@/components/ide/ChatPanel";
import { IdeWorkspace } from "@/components/ide/IdeWorkspace";
import {
  IdeMode,
  WorkspaceState,
  DeployedContract,
  ChatContext,
  ChatTargetMode,
  FileNode,
} from "@/types/ide";
import { useStellarIDE } from "@/hooks/useStellarIDE";
import {
  transformFilesForBackend,
  getActiveContractName,
} from "@/lib/fileTransform";
import {
  addFileToTree,
  addFolderToTree,
  renameNodeInTree,
  deleteNodeFromTree,
  getAllFilePaths,
} from "@/lib/fileTreeUtils";
import { FileTreeSyncData, FileContentSyncData } from "@/hooks/useSandbox";

// --- Initial State Mock Data ---

// Soroban contract structure:
// hello_world/
// ├── contracts/
// │   └── hello_world/
// │       ├── src/
// │       │   └── lib.rs
// │       └── Cargo.toml
// └── Cargo.toml (root workspace)

const CONTRACT_TREE: FileNode[] = [
  {
    id: "contracts",
    name: "contracts",
    type: "folder",
    children: [
      {
        id: "contracts/hello_world",
        name: "hello_world",
        type: "folder",
        children: [
          {
            id: "contracts/hello_world/src",
            name: "src",
            type: "folder",
            children: [
              {
                id: "contracts/hello_world/src/lib.rs",
                name: "lib.rs",
                type: "file",
              },
            ],
          },
          {
            id: "contracts/hello_world/Cargo.toml",
            name: "Cargo.toml",
            type: "file",
          },
        ],
      },
    ],
  },
  {
    id: "Cargo.toml",
    name: "Cargo.toml",
    type: "file",
  },
];

// Frontend tree mirrors the nextjs-template structure
// This provides an initial view before sandbox connects, then syncs with container
const FRONTEND_TREE: FileNode[] = [
  {
    id: "app",
    name: "app",
    type: "folder",
    children: [
      {
        id: "app/api",
        name: "api",
        type: "folder",
        children: [
          {
            id: "app/api/contract",
            name: "contract",
            type: "folder",
            children: [
              {
                id: "app/api/contract/hello",
                name: "hello",
                type: "folder",
                children: [
                  {
                    id: "app/api/contract/hello/route.ts",
                    name: "route.ts",
                    type: "file",
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "app/globals.css", name: "globals.css", type: "file" },
      { id: "app/layout.tsx", name: "layout.tsx", type: "file" },
      { id: "app/page.tsx", name: "page.tsx", type: "file" },
    ],
  },
  {
    id: "components",
    name: "components",
    type: "folder",
    children: [
      {
        id: "components/ContractDemo.tsx",
        name: "ContractDemo.tsx",
        type: "file",
      },
    ],
  },
  { id: "next.config.mjs", name: "next.config.mjs", type: "file" },
  { id: "package.json", name: "package.json", type: "file" },
  { id: "postcss.config.mjs", name: "postcss.config.mjs", type: "file" },
  { id: "tailwind.config.ts", name: "tailwind.config.ts", type: "file" },
  { id: "tsconfig.json", name: "tsconfig.json", type: "file" },
];

const INITIAL_CONTRACT_STATE: WorkspaceState = {
  mode: "contract",
  fileTree: CONTRACT_TREE,
  openFiles: ["contracts/hello_world/src/lib.rs"],
  activeFile: "contracts/hello_world/src/lib.rs",
  fileContents: {
    "contracts/hello_world/src/lib.rs": `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloWorldContract;

#[contractimpl]
impl HelloWorldContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
`,
    "contracts/hello_world/Cargo.toml": `[package]
name = "hello_world"
version = "0.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }
`,
    "Cargo.toml": `[workspace]
resolver = "2"
members = [
  "contracts/hello_world", 
]

[workspace.dependencies]
soroban-sdk = "*"
stellar-tokens = "=0.5.0"
stellar-access = "=0.5.0"
stellar-contract-utils = "=0.5.0"
stellar-macros = "=0.5.0"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
`,
  },
  terminalLogs: [
    "Stacy IDE initialized",
    "Connected to Soroban SDK v21.0.0",
  ],
  terminalStatus: "idle",
  ui: {
    isFileExplorerOpen: true,
    isActionPanelOpen: true,
    isTerminalOpen: true,
    isPreviewMode: false,
  },
};

// Initial file contents matching nextjs-template
const INITIAL_FRONTEND_CONTENTS: Record<string, string> = {
  "app/page.tsx": `import ContractDemo from "@/components/ContractDemo";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Stellar App
          </h1>
          <p className="text-gray-400">
            Built with Stacy IDE - Your AI-powered Stellar development environment
          </p>
        </div>

        {/* Contract Interaction Demo */}
        <ContractDemo />

        {/* Instructions */}
        <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Deploy your smart contract from the Contract Mode</li>
            <li>Click &quot;Generate Bindings&quot; in the Frontend Mode action panel</li>
            <li>The AI will generate TypeScript bindings and integration code</li>
            <li>Use the ContractDemo component above to test your contract</li>
          </ol>
        </div>

        {/* Status */}
        <div className="text-center text-sm text-gray-500">
          <p>Live Preview • Hot Reload Enabled</p>
        </div>
      </div>
    </main>
  );
}`,
  "app/layout.tsx": `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stellar App",
  description: "Built with Stacy IDE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}`,
  "app/globals.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #030712;
  --foreground: #f9fafb;
}

body {
  color: var(--foreground);
  background: var(--background);
}`,
  "components/ContractDemo.tsx": `'use client';

import { useState } from 'react';

export default function ContractDemo() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callContract = async () => {
    if (!input.trim()) {
      setError('Please enter a value');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(\`/api/contract/hello?name=\${encodeURIComponent(input)}\`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || \`HTTP \${response.status}\`);
      }

      const data = await response.json();
      
      if (Array.isArray(data.result)) {
        setResult(data.result.join(' '));
      } else if (typeof data.result === 'object') {
        setResult(JSON.stringify(data.result, null, 2));
      } else {
        setResult(String(data.result ?? data.greeting ?? 'Success'));
      }
    } catch (err) {
      console.error('Contract call failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to call contract');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <h2 className="text-xl font-semibold">Contract Interaction</h2>
      </div>
      
      <p className="text-gray-400 text-sm">
        Test your deployed smart contract. Enter a parameter and click "Call Contract".
      </p>

      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter parameter value..."
          disabled={loading}
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                     text-white placeholder-gray-500 focus:outline-none focus:ring-2 
                     focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={callContract}
          disabled={loading}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 
                     disabled:cursor-not-allowed text-white font-medium rounded-lg 
                     transition-colors"
        >
          {loading ? 'Calling...' : 'Call Contract'}
        </button>
      </div>

      {result && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <span className="text-green-400 font-medium text-sm">Success: </span>
          <pre className="text-green-300 font-mono text-sm">{result}</pre>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="text-red-400 font-medium text-sm">Error: </span>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}`,
  "app/api/contract/hello/route.ts": `import { NextResponse } from 'next/server';

// NOTE: Imports will be available after running "Generate Bindings"
// import { Client, networks } from '@/bindings/src';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'World';

    // Placeholder response until bindings are generated
    return NextResponse.json({
      result: ['Hello', name],
      success: true,
      note: 'This is a placeholder. Generate bindings to enable real contract calls.'
    });

  } catch (error) {
    console.error('Contract call error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', success: false },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { params } = body;

    return NextResponse.json({
      success: true,
      note: 'POST handler placeholder. Implement after generating bindings.',
      receivedParams: params
    });

  } catch (error) {
    console.error('Contract call error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', success: false },
      { status: 500 }
    );
  }
}`,
  "package.json": `{
  "name": "sandbox-nextjs",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.21",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@stellar/stellar-sdk": "^13.1.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "tailwindcss": "^3.4.1",
    "postcss": "^8",
    "autoprefixer": "^10.0.1"
  }
}`,
  "tailwind.config.ts": `import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;`,
  "tsconfig.json": `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
  "next.config.mjs": `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

export default nextConfig;`,
  "postcss.config.mjs": `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;`,
};

// Initial frontend state with full file tree and contents
const INITIAL_FRONTEND_STATE: WorkspaceState = {
  mode: "frontend",
  fileTree: FRONTEND_TREE,
  openFiles: ["app/page.tsx"],
  activeFile: "app/page.tsx",
  fileContents: INITIAL_FRONTEND_CONTENTS,
  terminalLogs: [
    "Frontend workspace ready",
    "Files will sync with sandbox when started",
  ],
  terminalStatus: "idle",
  ui: {
    isFileExplorerOpen: true,
    isActionPanelOpen: true,
    isTerminalOpen: true,
    isPreviewMode: false,
  },
};

// --- Reducer ---

type Action =
  | { type: "OPEN_FILE"; payload: string }
  | { type: "CLOSE_FILE"; payload: string }
  | {
    type: "UPDATE_FILE";
    payload: {
      path: string;
      content: string;
      source?: "editor" | "ai" | "system";
    };
  }
  | { type: "TOGGLE_EXPLORER" }
  | { type: "TOGGLE_ACTION_PANEL" }
  | { type: "TOGGLE_TERMINAL" }
  | { type: "TOGGLE_PREVIEW" }
  | { type: "SET_TERMINAL_STATUS"; payload: WorkspaceState["terminalStatus"] }
  | { type: "ADD_LOG"; payload: string }
  | { type: "CLEAR_LOGS" }
  | { type: "ADD_BINDINGS_FILE"; payload: { name: string; content: string } }
  | {
    type: "ADD_FILE";
    payload: { parentPath: string; fileName: string; content?: string };
  }
  | { type: "ADD_FOLDER"; payload: { parentPath: string; folderName: string } }
  | { type: "RENAME_FILE"; payload: { oldPath: string; newName: string } }
  | { type: "DELETE_FILE"; payload: { path: string } }
  | { type: "SYNC_FILE_TREE"; payload: FileNode[] }
  | { type: "SYNC_FILE_CONTENT"; payload: { path: string; content: string } }
  | { type: "MARK_FILE_LOADING"; payload: string };

function workspaceReducer(
  state: WorkspaceState,
  action: Action,
): WorkspaceState {
  switch (action.type) {
    case "OPEN_FILE":
      if (!state.openFiles.includes(action.payload)) {
        return {
          ...state,
          openFiles: [...state.openFiles, action.payload],
          activeFile: action.payload,
        };
      }
      return { ...state, activeFile: action.payload };
    case "CLOSE_FILE":
      const newOpen = state.openFiles.filter((f) => f !== action.payload);
      return {
        ...state,
        openFiles: newOpen,
        activeFile:
          state.activeFile === action.payload
            ? newOpen[newOpen.length - 1] || null
            : state.activeFile,
      };
    case "UPDATE_FILE":
      return {
        ...state,
        fileContents: {
          ...state.fileContents,
          [action.payload.path]: action.payload.content,
        },
      };
    case "TOGGLE_EXPLORER":
      return {
        ...state,
        ui: { ...state.ui, isFileExplorerOpen: !state.ui.isFileExplorerOpen },
      };
    case "TOGGLE_ACTION_PANEL":
      return {
        ...state,
        ui: { ...state.ui, isActionPanelOpen: !state.ui.isActionPanelOpen },
      };
    case "TOGGLE_TERMINAL":
      return {
        ...state,
        ui: { ...state.ui, isTerminalOpen: !state.ui.isTerminalOpen },
      };
    case "TOGGLE_PREVIEW":
      return {
        ...state,
        ui: { ...state.ui, isPreviewMode: !state.ui.isPreviewMode },
      };
    case "SET_TERMINAL_STATUS":
      return { ...state, terminalStatus: action.payload };
    case "ADD_LOG":
      return {
        ...state,
        terminalLogs: [...state.terminalLogs, action.payload],
      };
    case "CLEAR_LOGS":
      return { ...state, terminalLogs: ["Console cleared."] };
    case "ADD_BINDINGS_FILE":
      // deep clone file tree to add bindings (simplified for root/lib insertion)
      // In a real app we'd traverse the tree. Here assuming flat-ish structure or known path.
      const isAlreadyOpen = state.openFiles.includes(action.payload.name);
      return {
        ...state,
        fileContents: {
          ...state.fileContents,
          [action.payload.name]: action.payload.content,
        },
        // Only add to openFiles if not already present (prevents duplicate keys)
        openFiles: isAlreadyOpen
          ? state.openFiles
          : [...state.openFiles, action.payload.name],
        activeFile: action.payload.name,
      };
    case "ADD_FILE": {
      const newTree = addFileToTree(
        state.fileTree,
        action.payload.parentPath,
        action.payload.fileName,
      );
      const newFilePath = action.payload.parentPath
        ? `${action.payload.parentPath}/${action.payload.fileName}`
        : action.payload.fileName;

      return {
        ...state,
        fileTree: newTree,
        fileContents: {
          ...state.fileContents,
          [newFilePath]: action.payload.content || "",
        },
        openFiles: state.openFiles.includes(newFilePath)
          ? state.openFiles
          : [...state.openFiles, newFilePath],
        activeFile: newFilePath,
      };
    }
    case "ADD_FOLDER": {
      const newTree = addFolderToTree(
        state.fileTree,
        action.payload.parentPath,
        action.payload.folderName,
      );
      return {
        ...state,
        fileTree: newTree,
      };
    }
    case "RENAME_FILE": {
      const pathParts = action.payload.oldPath.split("/").filter(Boolean);
      pathParts[pathParts.length - 1] = action.payload.newName;
      const newPath = pathParts.join("/");

      const newTree = renameNodeInTree(
        state.fileTree,
        action.payload.oldPath,
        action.payload.newName,
      );

      // Update fileContents keys
      const newFileContents = { ...state.fileContents };
      if (newFileContents[action.payload.oldPath]) {
        newFileContents[newPath] = newFileContents[action.payload.oldPath];
        delete newFileContents[action.payload.oldPath];
      }

      // Update openFiles
      const newOpenFiles = state.openFiles.map((f) =>
        f === action.payload.oldPath ? newPath : f,
      );

      return {
        ...state,
        fileTree: newTree,
        fileContents: newFileContents,
        openFiles: newOpenFiles,
        activeFile:
          state.activeFile === action.payload.oldPath
            ? newPath
            : state.activeFile,
      };
    }
    case "DELETE_FILE": {
      const newTree = deleteNodeFromTree(state.fileTree, action.payload.path);

      // Remove from fileContents - also remove all files in deleted folder
      const newFileContents = { ...state.fileContents };
      delete newFileContents[action.payload.path];

      // If it's a folder, remove all files that start with the folder path
      Object.keys(newFileContents).forEach((filePath) => {
        if (filePath.startsWith(action.payload.path + "/")) {
          delete newFileContents[filePath];
        }
      });

      // Remove from openFiles - also remove all files in deleted folder
      const newOpenFiles = state.openFiles.filter((f) => {
        return (
          f !== action.payload.path && !f.startsWith(action.payload.path + "/")
        );
      });

      // If deleted file/folder was active, switch to another file
      const newActiveFile =
        state.activeFile === action.payload.path ||
          (state.activeFile &&
            state.activeFile.startsWith(action.payload.path + "/"))
          ? newOpenFiles[newOpenFiles.length - 1] || null
          : state.activeFile;

      return {
        ...state,
        fileTree: newTree,
        fileContents: newFileContents,
        openFiles: newOpenFiles,
        activeFile: newActiveFile,
      };
    }
    // Sync entire file tree from sandbox container
    case "SYNC_FILE_TREE": {
      return {
        ...state,
        fileTree: action.payload,
      };
    }
    // Sync file content from sandbox container (lazy loading)
    case "SYNC_FILE_CONTENT": {
      return {
        ...state,
        fileContents: {
          ...state.fileContents,
          [action.payload.path]: action.payload.content,
        },
      };
    }
    // Mark a file as loading (placeholder while fetching content)
    case "MARK_FILE_LOADING": {
      // Only set loading placeholder if content not already cached
      if (state.fileContents[action.payload] !== undefined) {
        return state;
      }
      return {
        ...state,
        fileContents: {
          ...state.fileContents,
          [action.payload]: "// Loading file content...",
        },
      };
    }
    default:
      return state;
  }
}

// --- Main Page Component ---

export default function GeneratePage() {
  // Stellar IDE Hook - provides wallet, compiler, deployer
  const stellarIDE = useStellarIDE();

  const [ideMode, setIdeMode] = useState<IdeMode>("contract");
  const [deployedContracts, setDeployedContracts] = useState<
    DeployedContract[]
  >([]);

  // Independent Workspace States
  const [contractState, dispatchContract] = useReducer(
    workspaceReducer,
    INITIAL_CONTRACT_STATE,
  );
  const [frontendState, dispatchFrontend] = useReducer(
    workspaceReducer,
    INITIAL_FRONTEND_STATE,
  );

  // Ref to track file contents without causing re-renders (fixes infinite loop)
  const fileContentsRef = useRef(frontendState.fileContents);

  // Keep ref in sync with state
  useEffect(() => {
    fileContentsRef.current = frontendState.fileContents;
  }, [frontendState.fileContents]);

  // Ref to track contract file contents for fresh state in handleCompile
  const contractFileContentsRef = useRef(contractState.fileContents);

  // Keep contract ref in sync with state
  useEffect(() => {
    contractFileContentsRef.current = contractState.fileContents;
    console.log(
      "[State] contractFileContentsRef updated, keys:",
      Object.keys(contractState.fileContents),
    );
  }, [contractState.fileContents]);

  // Chat Context State
  const [targetMode, setTargetMode] = useState<ChatTargetMode>("auto");

  // Selection state for AI actions (Explain/Debug)
  const [codeSelection, setCodeSelection] = useState<{
    file: string;
    startLine: number;
    endLine: number;
    text: string;
    intent?: "explain" | "debug";
  } | null>(null);

  // Track pending AI-generated file changes (synced on preview)
  const [pendingAIChanges, setPendingAIChanges] = useState<
    Array<{
      path: string;
      action: "create" | "update" | "delete";
      content?: string;
    }>
  >([]);
  const hasPendingChanges = pendingAIChanges.length > 0;

  // Track last synced log index to avoid duplicates
  const lastSyncedLogIndex = useRef(0);

  // Ref to store Monaco sync function (syncs Monaco content back to workspace state)
  const monacoSyncRef = useRef<(() => void) | null>(null);

  // Callback to receive Monaco sync function from IdeWorkspace
  const handleMonacoSyncReady = useCallback((syncFn: () => void) => {
    monacoSyncRef.current = syncFn;
    console.log("[Generate] Monaco sync function registered");
  }, []);

  // Sync stellarIDE logs to terminal
  useEffect(() => {
    const newLogs = stellarIDE.allLogs.slice(lastSyncedLogIndex.current);
    if (newLogs.length > 0) {
      newLogs.forEach((log) => {
        dispatchContract({ type: "ADD_LOG", payload: log });
      });
      lastSyncedLogIndex.current = stellarIDE.allLogs.length;
    }
  }, [stellarIDE.allLogs]);

  // Update terminal status based on compiler/deployer
  useEffect(() => {
    if (stellarIDE.isCompiling) {
      dispatchContract({ type: "SET_TERMINAL_STATUS", payload: "compiling" });
    } else if (stellarIDE.isDeploying) {
      dispatchContract({ type: "SET_TERMINAL_STATUS", payload: "deploying" });
    } else if (
      stellarIDE.compiler.status === "SUCCESS" ||
      stellarIDE.deployer.status === "SUCCESS"
    ) {
      dispatchContract({ type: "SET_TERMINAL_STATUS", payload: "success" });
    } else if (
      stellarIDE.compiler.status === "ERROR" ||
      stellarIDE.deployer.status === "ERROR"
    ) {
      dispatchContract({ type: "SET_TERMINAL_STATUS", payload: "error" });
    } else {
      dispatchContract({ type: "SET_TERMINAL_STATUS", payload: "idle" });
    }
  }, [
    stellarIDE.isCompiling,
    stellarIDE.isDeploying,
    stellarIDE.compiler.status,
    stellarIDE.deployer.status,
  ]);

  // Add deployed contract to list when deployment succeeds
  useEffect(() => {
    if (
      stellarIDE.deployer.status === "SUCCESS" &&
      stellarIDE.deployer.contractId
    ) {
      const activeContractName = getActiveContractName(
        contractState.activeFile,
      );
      const newContract: DeployedContract = {
        id: stellarIDE.deployer.contractId,
        name:
          activeContractName.charAt(0).toUpperCase() +
          activeContractName.slice(1) +
          "Contract",
        address: stellarIDE.deployer.contractId,
        deployedAt: new Date().toISOString(),
        network: "testnet",
        wasmHash: stellarIDE.deployer.wasmHash || undefined,
      };
      setDeployedContracts((prev) => {
        // Avoid duplicates
        if (prev.some((c) => c.id === newContract.id)) return prev;
        return [newContract, ...prev];
      });
    }
  }, [stellarIDE.deployer.status, stellarIDE.deployer.contractId]);

  // --- Sandbox File Sync ---

  // Track pending file reads to avoid duplicate requests
  const pendingFileReads = useRef<Set<string>>(new Set());

  // Set up file tree sync handler
  useEffect(() => {
    stellarIDE.sandbox.setOnFileTreeSync((data: FileTreeSyncData) => {
      dispatchFrontend({ type: "SYNC_FILE_TREE", payload: data.tree });
      dispatchFrontend({
        type: "ADD_LOG",
        payload: `[sync] File tree synced: ${data.files.length} items`,
      });
    });

    stellarIDE.sandbox.setOnFileContentSync((data: FileContentSyncData) => {
      // Remove from pending reads
      pendingFileReads.current.delete(data.path);
      // Update file content
      dispatchFrontend({ type: "SYNC_FILE_CONTENT", payload: data });
    });
  }, [stellarIDE.sandbox]);

  // NOTE: Auto-sync on connect removed - sync happens when user clicks Preview

  // Fetch file content when opening a file that doesn't have cached content
  const fetchFileContent = useCallback(
    (filePath: string) => {
      if (!stellarIDE.isSandboxConnected) return;
      if (pendingFileReads.current.has(filePath)) return;

      // Use ref to avoid dependency loop
      const currentContents = fileContentsRef.current;
      if (
        currentContents[filePath] !== undefined &&
        currentContents[filePath] !== "// Loading file content..."
      ) {
        return; // Already have content
      }

      pendingFileReads.current.add(filePath);
      dispatchFrontend({ type: "MARK_FILE_LOADING", payload: filePath });
      stellarIDE.sandbox.readFile(filePath);
    },
    [stellarIDE.isSandboxConnected, stellarIDE.sandbox],
  );

  // Sync file content to sandbox when user edits a file
  const syncFileToSandbox = useCallback(
    (filePath: string, content: string) => {
      if (!stellarIDE.isSandboxConnected) return;
      stellarIDE.sandbox.writeFile(filePath, content);
    },
    [stellarIDE.isSandboxConnected, stellarIDE.sandbox],
  );

  // Computed Chat Context
  const resolvedMode = targetMode === "auto" ? ideMode : targetMode;
  const activeWorkspace =
    resolvedMode === "contract" ? contractState : frontendState;

  const chatContext: ChatContext = {
    targetMode,
    resolvedMode,
    activeFilePath: activeWorkspace.activeFile || undefined,
    selection: codeSelection
      ? {
        startLine: codeSelection.startLine,
        endLine: codeSelection.endLine,
        selectedText: codeSelection.text,
      }
      : undefined,
    intent: codeSelection?.intent || "general",
  };

  // --- Handlers ---

  const handleModeChange = (newMode: IdeMode) => {
    setIdeMode(newMode);
  };

  // Handle code action (Explain/Debug) from inline toolbar
  const handleCodeAction = useCallback(
    (
      action: "debug" | "explain",
      selection: {
        file: string;
        startLine: number;
        endLine: number;
        text: string;
      },
    ) => {
      console.log("[CodeAction] Action triggered:", action, selection);
      // Set selection state with intent - this will trigger auto-send in ChatPanel
      setCodeSelection({
        ...selection,
        intent: action,
      });

      // Clear intent after a delay (keeps selection for context, but clears intent badge)
      // This prevents the intent badge from persisting after the message is sent
      setTimeout(() => {
        setCodeSelection((prev) =>
          prev ? { ...prev, intent: undefined } : null,
        );
      }, 2000);
    },
    [],
  );

  const handleCompile = useCallback(() => {
    // Diagnostic logging to debug stale state issues
    console.log("[Compile] ============================================");
    console.log("[Compile] handleCompile CALLED");
    console.log("[Compile] ============================================");

    // CRITICAL: Sync Monaco content to workspace state before compiling
    // This ensures we compile the latest content from Monaco (source of truth)
    if (monacoSyncRef.current) {
      console.log(
        "[Compile] Syncing Monaco to workspace state before compile...",
      );
      monacoSyncRef.current();
    }

    // Use ref to get fresh state (fixes stale closure issue)
    const freshFileContents = contractFileContentsRef.current;

    console.log("[Compile] Using contractFileContentsRef for fresh state");
    console.log(
      "[Compile] freshFileContents keys:",
      Object.keys(freshFileContents),
    );
    console.log(
      "[Compile] lib.rs content preview:",
      freshFileContents["contracts/hello_world/src/lib.rs"]?.substring(0, 300),
    );
    console.log("[Compile] activeFile:", contractState.activeFile);

    // Get active contract name from file path
    const activeContractName = getActiveContractName(contractState.activeFile);
    console.log("[Compile] activeContractName:", activeContractName);

    // Transform files for backend using fresh state from ref
    const files = transformFilesForBackend(
      freshFileContents,
      activeContractName,
    );
    console.log(
      "[Compile] Files being sent to compiler:",
      files.map((f) => ({
        path: f.path,
        contentPreview: f.content.substring(0, 100),
      })),
    );

    // Clear ALL logs - terminal and hook logs
    dispatchContract({ type: "CLEAR_LOGS" });
    stellarIDE.clearAllLogs();
    lastSyncedLogIndex.current = 0; // Reset sync index

    dispatchContract({
      type: "ADD_LOG",
      payload: `[COMPILE] Starting build for: ${activeContractName}`,
    });

    // Use the real compiler
    stellarIDE.compiler.compile(files);
    console.log("[Compile] ============================================");
  }, [contractState.activeFile, stellarIDE.compiler, stellarIDE.clearAllLogs]);

  const handleDeploy = useCallback(async () => {
    if (!stellarIDE.isWalletConnected) {
      dispatchContract({
        type: "ADD_LOG",
        payload: "[ERROR] Please connect your wallet first",
      });
      return;
    }

    if (!stellarIDE.hasCompiledWasm) {
      dispatchContract({
        type: "ADD_LOG",
        payload: "[ERROR] Please compile the contract first",
      });
      return;
    }

    dispatchContract({
      type: "ADD_LOG",
      payload: "[DEPLOY] Starting deployment...",
    });

    // Use the real deployer
    await stellarIDE.deployer.deploy();
  }, [
    stellarIDE.isWalletConnected,
    stellarIDE.hasCompiledWasm,
    stellarIDE.deployer,
  ]);

  const handleGenerateBindings = async (contractId: string) => {
    console.log("[Generate] ============================================");
    console.log("[Generate] GENERATE_BINDINGS CALLED");
    console.log("[Generate] ============================================");
    console.log("[Generate] Contract ID:", contractId);
    console.log("[Generate] Sandbox connected:", stellarIDE.isSandboxConnected);
    console.log("[Generate] Timestamp:", new Date().toISOString());

    // Find contract by ID or use the passed contractId directly (for latest deployed)
    const contract = deployedContracts.find(
      (c) => c.id === contractId || c.address === contractId,
    );
    const finalContractId = contract?.address || contractId;

    console.log(
      "[Generate] Resolved contract:",
      contract
        ? { id: contract.id, address: contract.address, name: contract.name }
        : "not found",
    );
    console.log("[Generate] Final contract ID:", finalContractId);

    if (!finalContractId) {
      const errorMsg = "[bindings] Error: No contract ID provided";
      console.error("[Generate]", errorMsg);
      dispatchFrontend({ type: "ADD_LOG", payload: errorMsg });
      return;
    }

    // Check if sandbox is connected for real bindings generation
    if (stellarIDE.isSandboxConnected) {
      const logMsg = `[bindings] Generating TS bindings for ${finalContractId} on ${stellarIDE.deployer.network}...`;
      console.log("[Generate]", logMsg);
      dispatchFrontend({ type: "ADD_LOG", payload: logMsg });

      // Use sandbox to generate bindings - track changes instead of applying immediately
      console.log("[Generate] Setting up bindings response handler...");
      stellarIDE.sandbox.generateBindings(finalContractId, (changes) => {
        console.log("[Generate] ============================================");
        console.log("[Generate] BINDINGS GENERATION RESPONSE RECEIVED");
        console.log("[Generate] ============================================");
        console.log("[Generate] Changes received:", changes.length);
        console.log(
          "[Generate] Change details:",
          changes.map((c) => ({
            path: c.path,
            action: c.action,
            size: c.content?.length || 0,
          })),
        );

        // Add changes to tracker (will be applied when user clicks Preview)
        setPendingAIChanges((prev) => {
          const updated = [...prev, ...changes];
          console.log("[Generate] Total pending changes:", updated.length);
          return updated;
        });

        const bindingsFileCount = changes.filter((c) =>
          c.path.startsWith("bindings/"),
        ).length;
        const successMsg = `[bindings] ✓ ${changes.length} files generated (${bindingsFileCount} bindings files) - click Preview to sync`;
        console.log("[Generate]", successMsg);
        dispatchFrontend({
          type: "ADD_LOG",
          payload: successMsg,
        });

        // Auto-refresh file tree to show the new bindings folder
        // The bindings folder already exists in the container, we just need to refresh the view
        console.log(
          "[Generate] Auto-refreshing file tree to show bindings folder...",
        );
        if (stellarIDE.isSandboxConnected) {
          // Try multiple times with increasing delays to ensure the refresh works
          const refreshAttempts = [500, 1500, 3000];
          refreshAttempts.forEach((delay, index) => {
            setTimeout(() => {
              console.log(
                `[Generate] File tree refresh attempt ${index + 1}/${refreshAttempts.length} (delay: ${delay}ms)`,
              );
              handleRefreshFileTree();
              if (index === 0) {
                dispatchFrontend({
                  type: "ADD_LOG",
                  payload: `[bindings] Refreshing file tree to show bindings folder...`,
                });
              }
            }, delay);
          });
        } else {
          console.warn(
            "[Generate] Cannot refresh file tree - sandbox not connected",
          );
        }

        console.log("[Generate] ============================================");
        console.log("[Generate] BINDINGS HANDLER COMPLETE");
        console.log("[Generate] ============================================");
      });
    } else {
      // Fallback: Generate mock bindings locally
      dispatchFrontend({
        type: "ADD_LOG",
        payload: `[bindings] Generating mock bindings for ${finalContractId}...`,
      });
      dispatchFrontend({
        type: "ADD_LOG",
        payload: "[bindings] Note: Start sandbox for real Stellar CLI bindings",
      });

      setTimeout(() => {
        const contractName = contract?.name || "Contract";
        const bindingsContent = `// TypeScript Bindings for ${contractName}
// Contract ID: ${finalContractId}
// Network: ${stellarIDE.deployer.network}
//
// NOTE: These are mock bindings. Start a sandbox for real Stellar CLI generated bindings.

import * as StellarSdk from '@stellar/stellar-sdk';

export const CONTRACT_ID = '${finalContractId}';
export const NETWORK = '${stellarIDE.deployer.network}';
export const NETWORK_PASSPHRASE = '${stellarIDE.deployer.network === "mainnet" ? "Public Global Stellar Network ; September 2015" : "Test SDF Network ; September 2015"}';

export interface ${contractName}Client {
  contractId: string;
  // Add your contract methods here
  hello(to: string): Promise<string[]>;
}

export function create${contractName}Client(publicKey: string): ${contractName}Client {
  return {
    contractId: CONTRACT_ID,
    async hello(to: string) {
      // Implement contract call logic
      console.log('Calling hello with:', to);
      return ['Hello', to];
    }
  };
}
`;
        dispatchFrontend({
          type: "ADD_BINDINGS_FILE",
          payload: { name: "lib/bindings.ts", content: bindingsContent },
        });
        dispatchFrontend({
          type: "ADD_LOG",
          payload: "✓ Mock bindings generated at lib/bindings.ts",
        });
      }, 1000);
    }
  };

  // Sandbox handlers
  const handleSpawnSandbox = useCallback(() => {
    dispatchFrontend({
      type: "ADD_LOG",
      payload: "[sandbox] Spawning development sandbox...",
    });
    stellarIDE.sandbox.spawn({
      GROQ_API_KEY: process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
      AI_PROVIDER: "groq",
    });
  }, [stellarIDE.sandbox]);

  const handleStopSandbox = useCallback(() => {
    dispatchFrontend({
      type: "ADD_LOG",
      payload: "[sandbox] Stopping sandbox...",
    });
    stellarIDE.sandbox.stop();
  }, [stellarIDE.sandbox]);

  // Refresh file tree from sandbox
  const handleRefreshFileTree = useCallback(() => {
    if (stellarIDE.isSandboxConnected) {
      dispatchFrontend({
        type: "ADD_LOG",
        payload: "[sync] Refreshing file tree from container...",
      });
      stellarIDE.sandbox.syncFileTree();
    }
  }, [stellarIDE.isSandboxConnected, stellarIDE.sandbox]);

  // Handler for applying editor changes from AI responses
  const handleApplyEditorChanges = useCallback(
    (
      changes: Array<{
        path: string;
        action: "create" | "update" | "delete";
        content: string;
      }>,
    ) => {
      console.log("[AI] ============================================");
      console.log("[AI] handleApplyEditorChanges CALLED");
      console.log("[AI] ============================================");
      console.log(`[AI] Received ${changes.length} change(s)`);
      console.log(`[AI] Mode: ${resolvedMode}`);
      console.log(
        "[AI] Changes:",
        changes.map((c) => ({
          path: c.path,
          action: c.action,
          contentLength: c.content?.length || 0,
        })),
      );

      const activeWorkspace =
        resolvedMode === "contract" ? contractState : frontendState;
      const activeDispatch =
        resolvedMode === "contract" ? dispatchContract : dispatchFrontend;
      const isFrontendMode = resolvedMode === "frontend";

      changes.forEach((change) => {
        // Validate content is provided for create/update
        if (
          (change.action === "create" || change.action === "update") &&
          !change.content
        ) {
          activeDispatch({
            type: "ADD_LOG",
            payload: `[AI] Error: ${change.action} action requires content for ${change.path}`,
          });
          return;
        }

        if (change.action === "create") {
          // Extract parent path and file name
          const pathParts = change.path.split("/");
          const fileName = pathParts.pop() || change.path;
          const parentPath = pathParts.join("/");

          // Validate content is not empty
          if (!change.content || change.content.trim().length === 0) {
            activeDispatch({
              type: "ADD_LOG",
              payload: `[AI] Error: Cannot create empty file: ${change.path}`,
            });
            return;
          }

          activeDispatch({
            type: "ADD_FILE",
            payload: {
              parentPath,
              fileName,
              content: change.content,
            },
          });

          // ADD_FILE already opens the file, but ensure it's active
          // The reducer sets it as activeFile automatically, but let's be explicit
          console.log(`[AI] Created and opened file: ${change.path}`);

          // Track for sandbox sync on preview (frontend mode only)
          if (isFrontendMode && stellarIDE.isSandboxConnected) {
            setPendingAIChanges((prev) => [...prev, change]);
          }

          activeDispatch({
            type: "ADD_LOG",
            payload: `[AI] ✓ Created file: ${change.path} (${change.content.length} chars)`,
          });
        } else if (change.action === "update") {
          // Validate content is not empty
          if (!change.content || change.content.trim().length === 0) {
            activeDispatch({
              type: "ADD_LOG",
              payload: `[AI] Error: Cannot update file with empty content: ${change.path}`,
            });
            return;
          }

          // Check if file exists in fileContents
          if (activeWorkspace.fileContents[change.path] !== undefined) {
            // Diagnostic logging for AI changes
            console.log("[AI] ============================================");
            console.log("[AI] UPDATE_FILE action");
            console.log("[AI] ============================================");
            console.log(
              `[AI] Applying to ${resolvedMode} mode: ${change.path}`,
            );
            console.log(
              `[AI] Content preview (first 300 chars): ${change.content?.substring(0, 300)}`,
            );
            console.log(`[AI] Content length: ${change.content?.length} chars`);
            console.log(
              "[AI] activeWorkspace keys before update:",
              Object.keys(activeWorkspace.fileContents),
            );

            // Update existing file with FULL content
            activeDispatch({
              type: "UPDATE_FILE",
              payload: {
                path: change.path,
                content: change.content,
                source: "ai",
              },
            });

            // Ensure the file is opened and active in the editor so changes are visible
            // OPEN_FILE will both open it and set it as active
            if (activeWorkspace.activeFile !== change.path) {
              activeDispatch({
                type: "OPEN_FILE",
                payload: change.path,
              });
              console.log(
                `[AI] Opened and activated file in editor: ${change.path}`,
              );
            }

            console.log("[AI] UPDATE_FILE dispatched successfully");
            console.log("[AI] ============================================");

            // Track for sandbox sync on preview (frontend mode only)
            if (isFrontendMode && stellarIDE.isSandboxConnected) {
              setPendingAIChanges((prev) => [...prev, change]);
            }

            activeDispatch({
              type: "ADD_LOG",
              payload: `[AI] ✓ Updated file: ${change.path} (${change.content.length} chars)`,
            });
          } else {
            // File doesn't exist, create it instead
            console.log("[AI] ============================================");
            console.log("[AI] FILE NOT FOUND - Creating new file instead");
            console.log("[AI] ============================================");
            console.log(`[AI] Requested path: ${change.path}`);
            console.log(`[AI] Mode: ${resolvedMode}`);
            console.log(
              `[AI] Available files in activeWorkspace:`,
              Object.keys(activeWorkspace.fileContents),
            );
            console.log("[AI] ============================================");

            const pathParts = change.path.split("/");
            const fileName = pathParts.pop() || change.path;
            const parentPath = pathParts.join("/");

            activeDispatch({
              type: "ADD_FILE",
              payload: {
                parentPath,
                fileName,
                content: change.content,
              },
            });

            // Track for sandbox sync on preview (frontend mode only)
            if (isFrontendMode && stellarIDE.isSandboxConnected) {
              setPendingAIChanges((prev) => [
                ...prev,
                { ...change, action: "create" as const },
              ]);
            }

            activeDispatch({
              type: "ADD_LOG",
              payload: `[AI] ✓ Created file (via update): ${change.path} (${change.content.length} chars)`,
            });
          }
        } else if (change.action === "delete") {
          activeDispatch({
            type: "DELETE_FILE",
            payload: { path: change.path },
          });

          // Track for sandbox sync on preview (frontend mode only)
          if (isFrontendMode && stellarIDE.isSandboxConnected) {
            setPendingAIChanges((prev) => [...prev, change]);
          }

          activeDispatch({
            type: "ADD_LOG",
            payload: `[AI] ✓ Deleted file: ${change.path}`,
          });
        }
      });

      // Notify user about pending changes
      if (
        isFrontendMode &&
        stellarIDE.isSandboxConnected &&
        changes.length > 0
      ) {
        dispatchFrontend({
          type: "ADD_LOG",
          payload: `[sync] ${changes.length} changes pending - click Preview to sync with sandbox`,
        });
      }

      // CRITICAL: Sync Monaco editor content back to workspace state
      // This ensures Monaco (view layer) is the source of truth after AI edits
      // Monaco might have unsaved changes or might not have synced yet
      if (monacoSyncRef.current) {
        console.log("[AI] Syncing Monaco content to workspace state...");
        // Small delay to ensure Monaco has updated from workspace state changes
        setTimeout(() => {
          if (monacoSyncRef.current) {
            monacoSyncRef.current();
            console.log("[AI] Monaco sync completed");
          }
        }, 150);
      } else {
        console.warn(
          "[AI] Monaco sync function not available - workspace state may be out of sync",
        );
      }

      console.log("[AI] ============================================");
      console.log("[AI] handleApplyEditorChanges COMPLETE");
      console.log(
        `[AI] Processed ${changes.length} change(s) for ${resolvedMode} mode`,
      );
      console.log("[AI] ============================================");
    },
    [
      resolvedMode,
      contractState,
      frontendState,
      dispatchContract,
      dispatchFrontend,
      stellarIDE.isSandboxConnected,
    ],
  );

  // Determine which workspace is currently VISIBLE in the IDE pane
  const currentVisibleWorkspace =
    ideMode === "contract" ? contractState : frontendState;

  // Delete file in sandbox
  const deleteFileInSandbox = useCallback(
    (filePath: string) => {
      if (!stellarIDE.isSandboxConnected) return;
      stellarIDE.sandbox.deleteFile(filePath);
    },
    [stellarIDE.isSandboxConnected, stellarIDE.sandbox],
  );

  // Create a wrapped dispatch for frontend mode that handles file sync
  const wrappedFrontendDispatch = useCallback(
    (action: Action) => {
      // GUARD: Never sync to sandbox when in preview mode
      const isPreviewMode = frontendState.ui.isPreviewMode;

      // Intercept OPEN_FILE to fetch content from sandbox
      if (
        action.type === "OPEN_FILE" &&
        stellarIDE.isSandboxConnected &&
        !isPreviewMode
      ) {
        const filePath = action.payload;
        // Use ref to avoid dependency loop
        const currentContents = fileContentsRef.current;
        // Check if we need to fetch content
        if (
          currentContents[filePath] === undefined ||
          currentContents[filePath] === "// Loading file content..."
        ) {
          fetchFileContent(filePath);
        }
      }

      // Intercept UPDATE_FILE to sync to sandbox
      // GUARD: Only sync if NOT in preview mode AND source is "editor" or "ai" (not "system")
      if (
        action.type === "UPDATE_FILE" &&
        stellarIDE.isSandboxConnected &&
        !isPreviewMode
      ) {
        const source = action.payload.source || "editor";
        if (source === "editor" || source === "ai") {
          syncFileToSandbox(action.payload.path, action.payload.content);
        }
      }

      // Intercept DELETE_FILE to sync to sandbox
      if (
        action.type === "DELETE_FILE" &&
        stellarIDE.isSandboxConnected &&
        !isPreviewMode
      ) {
        deleteFileInSandbox(action.payload.path);
      }

      // Intercept ADD_FILE to sync new files to sandbox
      if (
        action.type === "ADD_FILE" &&
        stellarIDE.isSandboxConnected &&
        !isPreviewMode
      ) {
        const filePath = action.payload.parentPath
          ? `${action.payload.parentPath}/${action.payload.fileName}`
          : action.payload.fileName;
        syncFileToSandbox(filePath, action.payload.content || "");
      }

      // Always dispatch the action
      dispatchFrontend(action);
    },
    [
      stellarIDE.isSandboxConnected,
      fetchFileContent,
      syncFileToSandbox,
      deleteFileInSandbox,
      frontendState.ui.isPreviewMode,
    ],
  );

  const currentDispatch =
    ideMode === "contract" ? dispatchContract : wrappedFrontendDispatch;

  // Handle preview toggle - syncs pending changes when switching to preview mode
  const handlePreviewToggle = useCallback(() => {
    // If switching TO preview mode and sandbox is connected
    if (!frontendState.ui.isPreviewMode && stellarIDE.isSandboxConnected) {
      // Apply any pending AI changes to sandbox
      if (pendingAIChanges.length > 0) {
        dispatchFrontend({
          type: "ADD_LOG",
          payload: `[sync] Syncing ${pendingAIChanges.length} pending changes to sandbox...`,
        });

        pendingAIChanges.forEach((change) => {
          if (change.action === "create" || change.action === "update") {
            stellarIDE.sandbox.writeFile(change.path, change.content || "");
          } else if (change.action === "delete") {
            stellarIDE.sandbox.deleteFile(change.path);
          }
        });

        setPendingAIChanges([]); // Clear tracker
        dispatchFrontend({
          type: "ADD_LOG",
          payload: "[sync] ✓ Changes synced to sandbox",
        });
      }

      // Sync file tree from sandbox
      stellarIDE.sandbox.syncFileTree();
    }

    // Toggle preview mode
    dispatchFrontend({ type: "TOGGLE_PREVIEW" });
  }, [
    frontendState.ui.isPreviewMode,
    stellarIDE.isSandboxConnected,
    pendingAIChanges,
    stellarIDE.sandbox,
  ]);

  return (
    <SandboxProvider sandbox={stellarIDE.sandbox}>
      <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 overflow-hidden font-sans transition-colors duration-300">
        <GlobalTopBar
          ideMode={ideMode}
          onIdeModeChange={handleModeChange}
          walletAddress={stellarIDE.wallet.address}
          walletStatus={stellarIDE.wallet.status}
          onConnectWallet={stellarIDE.wallet.connect}
          onDisconnectWallet={stellarIDE.wallet.disconnect}
        />

        <div className="flex-1 flex min-h-0">
          {/* Left: Chat Panel with Icon Rail */}
          <ChatPanel
            chatContext={chatContext}
            onTargetModeChange={setTargetMode}
            onSendMessage={(msg, model) => {
              // Mock backend interaction - log which model is being used
              const activeLogDispatch =
                resolvedMode === "contract"
                  ? dispatchContract
                  : dispatchFrontend;
              activeLogDispatch({
                type: "ADD_LOG",
                payload: `> AI (${model}): Processing request for ${resolvedMode}...`,
              });
            }}
            fileTree={activeWorkspace.fileTree}
            fileContents={activeWorkspace.fileContents}
            onApplyEditorChanges={handleApplyEditorChanges}
          />

          {/* Right: IDE Workspace (Swappable) - Takes remaining space */}
          <IdeWorkspace
            key={ideMode}
            mode={ideMode}
            workspace={currentVisibleWorkspace}
            deployedContracts={deployedContracts}
            dispatch={currentDispatch}
            onCompile={handleCompile}
            onDeploy={handleDeploy}
            onGenerateBindings={handleGenerateBindings}
            // Toggles
            onToggleFileExplorer={() =>
              currentDispatch({ type: "TOGGLE_EXPLORER" })
            }
            onToggleActionPanel={() =>
              currentDispatch({ type: "TOGGLE_ACTION_PANEL" })
            }
            onToggleTerminal={() =>
              currentDispatch({ type: "TOGGLE_TERMINAL" })
            }
            // Compile/Deploy Status
            compilerStatus={stellarIDE.compiler.status}
            deployerStatus={stellarIDE.deployer.status}
            wasmHex={stellarIDE.compiler.wasmHex}
            latestContractId={stellarIDE.deployer.contractId}
            isWalletConnected={stellarIDE.isWalletConnected}
            // Network Selection
            network={stellarIDE.deployer.network}
            onNetworkChange={stellarIDE.deployer.setNetwork}
            explorerUrl={stellarIDE.deployer.explorerUrl}
            // Sandbox
            sandboxPreviewUrl={stellarIDE.sandbox.previewUrl}
            isSandboxRunning={stellarIDE.isSandboxRunning}
            // Code Actions (Explain/Debug)
            onCodeAction={handleCodeAction}
            sandboxStatus={stellarIDE.sandbox.status}
            onSpawnSandbox={handleSpawnSandbox}
            onStopSandbox={handleStopSandbox}
            bindingsStatus={stellarIDE.sandbox.bindingsStatus}
            // File sync
            onRefreshFileTree={handleRefreshFileTree}
            isSandboxConnected={stellarIDE.isSandboxConnected}
            // Preview sync
            onTogglePreview={handlePreviewToggle}
            hasPendingChanges={hasPendingChanges}
            // Monaco sync
            onMonacoSyncReady={handleMonacoSyncReady}
          />
        </div>
      </div>
    </SandboxProvider>
  );
}
