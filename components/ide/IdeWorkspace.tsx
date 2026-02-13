"use client";
import { WorkspaceState, DeployedContract, IdeMode } from "@/types/ide";
import { IdeHeader } from "./IdeHeader";
import { FileExplorer } from "./FileExplorer";
import { ActionPanel } from "./ActionPanel";
import { TerminalDock } from "./TerminalDock";
import { CodeSelectionPopup, AIAction } from "@/components/ui/CodeSelectionPopup";
import Editor, { OnMount } from "@monaco-editor/react";
import { useRef, useState, useCallback, useEffect } from "react";

interface IdeWorkspaceProps {
  mode: IdeMode;
  workspace: WorkspaceState;
  deployedContracts: DeployedContract[];
  dispatch: (action: any) => void;
  onCompile: () => void;
  onDeploy: () => void;
  onGenerateBindings: (id: string) => void;
  onToggleFileExplorer: () => void;
  onToggleActionPanel: () => void;
  onToggleTerminal: () => void;
  onCodeAction?: (action: AIAction, selection: { file: string; startLine: number; endLine: number; text: string }) => void;
  // Compile/Deploy status props
  compilerStatus?: "IDLE" | "QUEUED" | "COMPILING" | "SUCCESS" | "ERROR";
  deployerStatus?: "IDLE" | "UPLOADING" | "INSTANTIATING" | "SUCCESS" | "ERROR";
  wasmHex?: string | null;
  latestContractId?: string | null;
  isWalletConnected?: boolean;
  // Network selection
  network?: "testnet" | "mainnet";
  onNetworkChange?: (network: "testnet" | "mainnet") => void;
  explorerUrl?: string | null;
  // Sandbox props
  sandboxPreviewUrl?: string | null;
  isSandboxRunning?: boolean;
  sandboxStatus?: "idle" | "spawning" | "running" | "stopping" | "error";
  onSpawnSandbox?: () => void;
  onStopSandbox?: () => void;
  bindingsStatus?: "idle" | "generating" | "success" | "error";
  // File sync
  onRefreshFileTree?: () => void;
  isSandboxConnected?: boolean;
  // Preview sync
  onTogglePreview?: () => void;
  hasPendingChanges?: boolean;
  // Monaco sync callback - called to sync Monaco content to workspace state
  onMonacoSyncReady?: (syncFn: () => void) => void;
}

interface SelectionState {
  isVisible: boolean;
  position: { x: number; y: number };
  text: string;
  startLine: number;
  endLine: number;
}

export function IdeWorkspace({
  mode,
  workspace,
  deployedContracts,
  dispatch,
  onCompile,
  onDeploy,
  onGenerateBindings,
  onToggleFileExplorer,
  onToggleActionPanel,
  onToggleTerminal,
  onCodeAction,
  compilerStatus,
  deployerStatus,
  wasmHex,
  latestContractId,
  isWalletConnected,
  network,
  onNetworkChange,
  explorerUrl,
  sandboxPreviewUrl,
  isSandboxRunning,
  sandboxStatus,
  onSpawnSandbox,
  onStopSandbox,
  bindingsStatus,
  onRefreshFileTree,
  isSandboxConnected,
  onTogglePreview,
  hasPendingChanges,
  onMonacoSyncReady
}: IdeWorkspaceProps) {

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const [selection, setSelection] = useState<SelectionState>({
    isVisible: false,
    position: { x: 0, y: 0 },
    text: "",
    startLine: 0,
    endLine: 0
  });

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure Monaco with v0-like theme
    monaco.editor.defineTheme("v0-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#09090b",
        "editor.lineHighlightBackground": "#18181b",
        "editorLineNumber.foreground": "#52525b",
        "editor.selectionBackground": "#3b0764",
      }
    });
    monaco.editor.setTheme("v0-dark");

    // Configure TypeScript and JavaScript defaults for JSX support
    const compilerOptions = {
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowJs: true,
      checkJs: false,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    };

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    // Register react/jsx-runtime declaration (only once, cleanup-safe)
    const jsxRuntimeLib = `
      declare module "react/jsx-runtime" {
        export function jsx(type: any, props: any, key?: any): any;
        export function jsxs(type: any, props: any, key?: any): any;
        export function Fragment(props: { children?: any }): any;
      }
    `;

    // Check if already registered to avoid duplicates
    const existingLibs = monaco.languages.typescript.typescriptDefaults.getExtraLibs();
    if (!existingLibs || !existingLibs['react/jsx-runtime.d.ts']) {
      const disposable = monaco.languages.typescript.typescriptDefaults.addExtraLib(
        jsxRuntimeLib,
        'react/jsx-runtime.d.ts'
      );
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        jsxRuntimeLib,
        'react/jsx-runtime.d.ts'
      );
      // Store disposable in monacoRef for potential cleanup
      if (!monacoRef.current._jsxRuntimeDisposable) {
        monacoRef.current._jsxRuntimeDisposable = disposable;
      }
    }

    // Listen for selection changes
    editor.onDidChangeCursorSelection((e: any) => {
      const sel = editor.getSelection();
      if (!sel || sel.isEmpty()) {
        setSelection(prev => ({ ...prev, isVisible: false }));
        return;
      }

      const model = editor.getModel();
      if (!model) {
        setSelection(prev => ({ ...prev, isVisible: false }));
        return;
      }

      // Expand partial line selections to full lines
      let startLine = sel.startLineNumber;
      let endLine = sel.endLineNumber;
      let expandedStartColumn = sel.startColumn;
      let expandedEndColumn = sel.endColumn;

      // Check if selection is on a single line and doesn't span the full line
      if (startLine === endLine) {
        const lineContent = model.getLineContent(startLine);
        const lineLength = lineContent.length;

        // If selection doesn't start at column 1 or doesn't end at the line's end, expand to full line
        if (sel.startColumn !== 1 || sel.endColumn !== lineLength + 1) {
          // Expand to full line
          expandedStartColumn = 1;
          expandedEndColumn = lineLength + 1;
        }
      } else {
        // Multi-line selection: expand each line to full lines
        const firstLineLength = model.getLineContent(startLine).length;
        const lastLineLength = model.getLineContent(endLine).length;

        // Expand start line to beginning if not already
        if (sel.startColumn !== 1) {
          expandedStartColumn = 1;
        }
        // Expand end line to end if not already
        if (sel.endColumn !== lastLineLength + 1) {
          expandedEndColumn = lastLineLength + 1;
        }
      }

      // Create expanded range using Monaco's Range API
      // Monaco Range is available on the monaco global object
      const Range = monaco.Range;
      const expandedSel = new Range(
        startLine,
        expandedStartColumn,
        endLine,
        expandedEndColumn
      );

      // Get text from expanded selection
      const selectedText = model.getValueInRange(expandedSel) || "";
      if (selectedText.trim().length < 3) {
        setSelection(prev => ({ ...prev, isVisible: false }));
        return;
      }

      // Get position for popup (near end of selection)
      const endPos = expandedSel.getEndPosition();
      const coords = editor.getScrolledVisiblePosition(endPos);
      const editorDom = editor.getDomNode();

      if (coords && editorDom) {
        const rect = editorDom.getBoundingClientRect();
        setSelection({
          isVisible: true,
          position: {
            x: rect.left + coords.left,
            y: rect.top + coords.top + 24
          },
          text: selectedText,
          startLine: startLine,
          endLine: endLine
        });
      }
    });
  };

  const handleAIAction = useCallback((action: AIAction) => {
    if (!workspace.activeFile) return;

    // Close popup
    setSelection(prev => ({ ...prev, isVisible: false }));

    // Call parent handler if provided - this will trigger chat message
    if (onCodeAction) {
      onCodeAction(action, {
        file: workspace.activeFile,
        startLine: selection.startLine,
        endLine: selection.endLine,
        text: selection.text
      });
    }
  }, [workspace.activeFile, selection, onCodeAction]);

  const activeContent = workspace.activeFile
    ? workspace.fileContents[workspace.activeFile] || ""
    : "";

  // Function to sync Monaco editor content back to workspace state
  // This ensures Monaco (view layer) content is the source of truth after AI edits
  const syncMonacoToWorkspace = useCallback((source: "editor" | "system" = "system") => {
    if (!editorRef.current || !workspace.activeFile) {
      return;
    }

    // GUARD: Validate Monaco model exists and is not disposed
    const model = editorRef.current.getModel();
    if (!model || model.isDisposed()) {
      console.warn('[Monaco] Model is disposed or missing, skipping sync');
      return;
    }

    try {
      const monacoContent = editorRef.current.getValue();
      const workspaceContent = workspace.fileContents[workspace.activeFile] || "";

      // GUARD: Never sync empty content (likely from unmount/disposal)
      if (monacoContent.trim().length === 0 && workspaceContent.trim().length > 0) {
        console.warn('[Monaco] Refusing to sync empty content over existing content');
        return;
      }

      // Only sync if content differs (avoid unnecessary updates)
      if (monacoContent !== workspaceContent) {
        console.log('[Monaco] Syncing Monaco content to workspace state:', {
          file: workspace.activeFile,
          monacoLength: monacoContent.length,
          workspaceLength: workspaceContent.length,
          source
        });

        dispatch({
          type: "UPDATE_FILE",
          payload: {
            path: workspace.activeFile,
            content: monacoContent,
            source  // Use provided source (editor for compile, system for auto-sync)
          }
        });
      }
    } catch (error) {
      console.error('[Monaco] Error syncing Monaco to workspace:', error);
    }
  }, [workspace.activeFile, workspace.fileContents, dispatch]);

  // Expose sync function to parent component
  useEffect(() => {
    if (onMonacoSyncReady) {
      onMonacoSyncReady(syncMonacoToWorkspace);
    }
  }, [onMonacoSyncReady, syncMonacoToWorkspace]);

  // Sync Monaco to workspace when active file changes (ensures we capture any unsaved changes)
  // GUARD: Only sync when NOT in preview mode
  useEffect(() => {
    if (workspace.activeFile && editorRef.current && !workspace.ui.isPreviewMode) {
      // Small delay to ensure Monaco has updated
      const timer = setTimeout(() => {
        syncMonacoToWorkspace();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [workspace.activeFile, syncMonacoToWorkspace, workspace.ui.isPreviewMode]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 overflow-hidden">
      {/* Code Selection Popup */}
      <CodeSelectionPopup
        isVisible={selection.isVisible}
        position={selection.position}
        onAction={handleAIAction}
        onClose={() => setSelection(prev => ({ ...prev, isVisible: false }))}
      />

      {/* IDE Top Bar - Always visible */}
      <IdeHeader
        workspace={workspace}
        onToggleFileExplorer={onToggleFileExplorer}
        onToggleActionPanel={onToggleActionPanel}
        onToggleTerminal={onToggleTerminal}
        onCloseFile={(file) => dispatch({ type: "CLOSE_FILE", payload: file })}
        onSelectFile={(file) => dispatch({ type: "OPEN_FILE", payload: file })}
        onTogglePreview={onTogglePreview || (() => dispatch({ type: "TOGGLE_PREVIEW" }))}
        previewMode={workspace.ui.isPreviewMode}
        sandboxPreviewUrl={sandboxPreviewUrl}
        isSandboxRunning={isSandboxRunning}
        hasPendingChanges={hasPendingChanges}
      />

      {/* Full Preview Mode - Covers entire workspace */}
      {workspace.mode === "frontend" && workspace.ui.isPreviewMode ? (
        <div className="flex-1 bg-zinc-900 flex flex-col">
          {sandboxPreviewUrl && isSandboxRunning ? (
            // Live sandbox preview iframe
            <div className="flex-1 relative">
              <div className="absolute top-0 left-0 right-0 h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-zinc-400">Live Preview</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">{sandboxPreviewUrl}</span>
                  <button
                    onClick={() => window.open(sandboxPreviewUrl, '_blank')}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Open in new tab"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
              </div>
              <iframe
                src={sandboxPreviewUrl}
                className="w-full h-full border-0 pt-10"
                title="Sandbox Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          ) : (
            // Placeholder when sandbox not running
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-zinc-600 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  {sandboxStatus === "spawning" ? (
                    <svg className="w-10 h-10 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-purple-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-zinc-400">
                    {sandboxStatus === "spawning" ? "Starting Sandbox..." : "Live Preview"}
                  </p>
                  <p className="text-sm text-zinc-600 max-w-[280px] mt-1">
                    {sandboxStatus === "spawning"
                      ? "Setting up your development environment"
                      : "Start a sandbox to preview your frontend in real-time"
                    }
                  </p>
                </div>
                {sandboxStatus !== "spawning" && onSpawnSandbox && (
                  <button
                    onClick={onSpawnSandbox}
                    className="mt-4 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Sandbox
                  </button>
                )}
                {!onSpawnSandbox && (
                  <div className="mt-4 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-500">
                    Click the <span className="text-purple-400">Code</span> button to return to editor
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Main Workspace Body */}
          <div className="flex-1 flex min-h-0 relative">
            <FileExplorer
              files={workspace.fileTree}
              activeFile={workspace.activeFile}
              onSelectFile={(file) => dispatch({ type: "OPEN_FILE", payload: file })}
              isOpen={workspace.ui.isFileExplorerOpen}
              onAddFile={(parentPath, fileName) =>
                dispatch({ type: "ADD_FILE", payload: { parentPath, fileName } })
              }
              onAddFolder={(parentPath, folderName) =>
                dispatch({ type: "ADD_FOLDER", payload: { parentPath, folderName } })
              }
              onRename={(oldPath, newName) =>
                dispatch({ type: "RENAME_FILE", payload: { oldPath, newName } })
              }
              onDelete={(path) =>
                dispatch({ type: "DELETE_FILE", payload: { path } })
              }
              onRefresh={onRefreshFileTree}
              showRefresh={mode === "frontend" && isSandboxConnected}
            />

            {/* Center Editor Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
              <div className="flex-1 relative">
                {workspace.activeFile ? (
                  <Editor
                    height="100%"
                    defaultLanguage={workspace.activeFile.endsWith("rs") ? "rust" : "typescript"}
                    path={workspace.activeFile}
                    value={activeContent}
                    theme="v0-dark"
                    onMount={handleEditorMount}
                    onChange={(val) => dispatch({
                      type: "UPDATE_FILE",
                      payload: { path: workspace.activeFile, content: val, source: "editor" }
                    })}
                    options={{
                      minimap: { autohide: 'scroll' },
                      fontSize: 13,
                      fontFamily: "JetBrains Mono, monospace",
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      lineNumbersMinChars: 4
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mb-2">
                      <span className="text-2xl">⌘</span>
                    </div>
                    <p className="text-sm">Select a file to start editing</p>
                  </div>
                )}
              </div>
            </div>

            <ActionPanel
              mode={mode}
              isOpen={workspace.ui.isActionPanelOpen}
              terminalStatus={workspace.terminalStatus}
              deployedContracts={deployedContracts}
              onCompile={onCompile}
              onDeploy={onDeploy}
              onGenerateBindings={onGenerateBindings}
              compilerStatus={compilerStatus}
              deployerStatus={deployerStatus}
              wasmHex={wasmHex}
              latestContractId={latestContractId}
              isWalletConnected={isWalletConnected}
              network={network}
              onNetworkChange={onNetworkChange}
              explorerUrl={explorerUrl}
              sandboxStatus={sandboxStatus}
              isSandboxConnected={isSandboxRunning}
              onSpawnSandbox={onSpawnSandbox}
              onStopSandbox={onStopSandbox}
              bindingsStatus={bindingsStatus}
              fileContents={workspace.fileContents}
            />
          </div>

          {/* Terminal Dock */}
          <TerminalDock
            isOpen={workspace.ui.isTerminalOpen}
            logs={workspace.terminalLogs}
            status={workspace.terminalStatus}
            onClear={() => dispatch({ type: "CLEAR_LOGS" })}
            onToggle={onToggleTerminal}
          />
        </>
      )}
    </div>
  );
}
