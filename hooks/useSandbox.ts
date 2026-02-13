"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type SandboxStatus = "idle" | "spawning" | "running" | "stopping" | "error";
export type AgentStatus = "disconnected" | "connecting" | "connected";
export type BindingsStatus = "idle" | "generating" | "success" | "error";

export interface SandboxInfo {
    sessionId: string;
    previewUrl: string;
    previewPort: number;
    agentPort: number;
}

export interface EditorChange {
    path: string;
    action: 'create' | 'update' | 'delete';
    content: string;
}

export interface ChatResponse {
    chat: {
        message: string;
    };
    editor: {
        changes: EditorChange[];
    };
}

export interface BindingsResponse {
    success: boolean;
    contractId: string;
    network: string;
    chat: {
        message: string;
    };
    editor: {
        changes: EditorChange[];
    };
    error?: string;
}

// File info from sandbox agent
export interface SandboxFileInfo {
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
    modifiedAt?: string;
}

// File tree node (matches frontend FileNode type)
export interface FileTreeNode {
    id: string;
    name: string;
    type: "file" | "folder";
    children?: FileTreeNode[];
}

// File tree sync data
export interface FileTreeSyncData {
    tree: FileTreeNode[];
    files: SandboxFileInfo[];
}

// File content sync data
export interface FileContentSyncData {
    path: string;
    content: string;
}

export interface UseSandboxReturn {
    // Status
    status: SandboxStatus;
    agentStatus: AgentStatus;
    bindingsStatus: BindingsStatus;
    
    // Sandbox info
    sandboxInfo: SandboxInfo | null;
    previewUrl: string | null;
    
    // Logs
    logs: string[];
    
    // Actions
    spawn: (envVars?: Record<string, string>) => Promise<void>;
    stop: () => Promise<void>;
    generateBindings: (contractId: string, network: 'testnet' | 'mainnet') => void;
    sendChatMessage: (prompt: string, context?: any) => void;
    executeCommand: (command: string, cwd?: string) => void;
    
    // File operations
    readFile: (path: string) => void;
    writeFile: (path: string, content: string) => void;
    deleteFile: (path: string) => void;
    listFiles: (path?: string) => void;
    listFilesRecursive: (path?: string) => void;
    syncFileTree: () => void;
    
    // Event handlers (set these to receive responses)
    onChatResponse: ((response: ChatResponse) => void) | null;
    setOnChatResponse: (handler: ((response: ChatResponse) => void) | null) => void;
    onBindingsResponse: ((response: BindingsResponse) => void) | null;
    setOnBindingsResponse: (handler: ((response: BindingsResponse) => void) | null) => void;
    onFileResponse: ((data: any) => void) | null;
    setOnFileResponse: (handler: ((data: any) => void) | null) => void;
    onFileTreeSync: ((data: FileTreeSyncData) => void) | null;
    setOnFileTreeSync: (handler: ((data: FileTreeSyncData) => void) | null) => void;
    onFileContentSync: ((data: FileContentSyncData) => void) | null;
    setOnFileContentSync: (handler: ((data: FileContentSyncData) => void) | null) => void;
    
    // Utilities
    clearLogs: () => void;
    reset: () => void;
    isConnected: boolean;
}

// Helper: Convert flat file list to tree structure
function buildFileTree(files: SandboxFileInfo[]): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    // Sort files so directories come before their children
    const sortedFiles = [...files].sort((a, b) => {
        const aDepth = a.path.split('/').length;
        const bDepth = b.path.split('/').length;
        return aDepth - bDepth;
    });

    for (const file of sortedFiles) {
        const node: FileTreeNode = {
            id: file.path,
            name: file.name,
            type: file.isDirectory ? 'folder' : 'file',
            children: file.isDirectory ? [] : undefined
        };
        nodeMap.set(file.path, node);

        // Find parent path
        const pathParts = file.path.split('/');
        pathParts.pop(); // Remove current file/folder name
        const parentPath = pathParts.join('/');

        if (parentPath && parentPath !== '.') {
            const parent = nodeMap.get(parentPath);
            if (parent && parent.children) {
                parent.children.push(node);
            } else {
                // Parent not found, add to root
                root.push(node);
            }
        } else {
            // Root level item
            root.push(node);
        }
    }

    // Sort each level: folders first, then files, alphabetically
    const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        }).map(node => ({
            ...node,
            children: node.children ? sortNodes(node.children) : undefined
        }));
    };

    return sortNodes(root);
}

export function useSandbox(): UseSandboxReturn {
    const [status, setStatus] = useState<SandboxStatus>("idle");
    const [agentStatus, setAgentStatus] = useState<AgentStatus>("disconnected");
    const [bindingsStatus, setBindingsStatus] = useState<BindingsStatus>("idle");
    const [sandboxInfo, setSandboxInfo] = useState<SandboxInfo | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    
    const socketRef = useRef<Socket | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    
    // Callback refs for event handlers
    const onChatResponseRef = useRef<((response: ChatResponse) => void) | null>(null);
    const onBindingsResponseRef = useRef<((response: BindingsResponse) => void) | null>(null);
    const onFileResponseRef = useRef<((data: any) => void) | null>(null);
    const onFileTreeSyncRef = useRef<((data: FileTreeSyncData) => void) | null>(null);
    const onFileContentSyncRef = useRef<((data: FileContentSyncData) => void) | null>(null);
    
    // Track pending file read requests
    const pendingFileReadsRef = useRef<Set<string>>(new Set());

    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    // Initialize socket connection
    const initSocket = useCallback(() => {
        if (socketRef.current?.connected) return socketRef.current;

        const socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            timeout: 30000
        });

        // Socket events
        socket.on("connect", () => {
            addLog(`Connected to backend`);
        });

        socket.on("connect_error", (err) => {
            addLog(`Connection error: ${err.message}`);
            setStatus("error");
        });

        socket.on("disconnect", (reason) => {
            addLog(`Disconnected: ${reason}`);
            if (reason !== "io client disconnect") {
                setAgentStatus("disconnected");
            }
        });

        // Sandbox events
        socket.on("sandbox:spawned", (data) => {
            addLog(`Sandbox spawned at ${data.previewUrl}`);
            setSandboxInfo({
                sessionId: data.sessionId,
                previewUrl: data.previewUrl,
                previewPort: data.previewPort,
                agentPort: data.agentPort
            });
            sessionIdRef.current = data.sessionId;
            setStatus("running");
        });

        socket.on("sandbox:agent_connected", () => {
            addLog(`Agent connected`);
            setAgentStatus("connected");
        });

        socket.on("sandbox:agent_disconnected", () => {
            addLog(`Agent disconnected`);
            setAgentStatus("disconnected");
        });

        socket.on("sandbox:stopped", () => {
            addLog(`Sandbox stopped`);
            setStatus("idle");
            setSandboxInfo(null);
            setAgentStatus("disconnected");
        });

        socket.on("sandbox:error", (data) => {
            addLog(`Error: ${data.error}`);
            setStatus("error");
        });

        // Message events from agent
        socket.on("sandbox:message", (message) => {
            switch (message.type) {
                case "chat_response":
                    addLog(`Chat response received`);
                    if (onChatResponseRef.current) {
                        onChatResponseRef.current({
                            chat: message.chat,
                            editor: message.editor
                        });
                    }
                    break;

                case "bindings_generated":
                    console.log('[useSandbox] ============================================');
                    console.log('[useSandbox] bindings_generated MESSAGE RECEIVED');
                    console.log('[useSandbox] ============================================');
                    console.log('[useSandbox] Success:', message.success);
                    console.log('[useSandbox] Contract ID:', message.contractId);
                    console.log('[useSandbox] Network:', message.network);
                    console.log('[useSandbox] Changes count:', message.editor?.changes?.length || 0);
                    console.log('[useSandbox] Error:', message.error || 'none');
                    console.log('[useSandbox] Chat message:', message.chat?.message?.substring(0, 100) || 'none');
                    
                    if (message.success) {
                        const successMsg = `Bindings generated for ${message.contractId}`;
                        console.log('[useSandbox]', successMsg);
                        addLog(successMsg);
                        if (message.editor?.changes) {
                            const bindingsFiles = message.editor.changes.filter((c: EditorChange) => c.path.startsWith('bindings/'));
                            const aiFiles = message.editor.changes.filter((c: EditorChange) => !c.path.startsWith('bindings/'));
                            console.log('[useSandbox] Bindings files:', bindingsFiles.length);
                            console.log('[useSandbox] AI-generated files:', aiFiles.length);
                            addLog(`[bindings] ${bindingsFiles.length} bindings files, ${aiFiles.length} AI integration files`);
                        }
                        setBindingsStatus("success");
                    } else {
                        const errorMsg = `Bindings failed: ${message.error}`;
                        console.error('[useSandbox]', errorMsg);
                        addLog(errorMsg);
                        setBindingsStatus("error");
                    }
                    
                    if (onBindingsResponseRef.current) {
                        console.log('[useSandbox] Calling onBindingsResponse callback...');
                        onBindingsResponseRef.current(message as BindingsResponse);
                        console.log('[useSandbox] Callback executed');
                    } else {
                        console.warn('[useSandbox] No onBindingsResponse handler registered');
                    }
                    console.log('[useSandbox] ============================================');
                    break;

                case "file_operation_result":
                    // Handle file tree sync response
                    if (message.operation === 'list_recursive' && message.result) {
                        const files = message.result as SandboxFileInfo[];
                        const tree = buildFileTree(files);
                        if (onFileTreeSyncRef.current) {
                            onFileTreeSyncRef.current({ tree, files });
                        }
                    }
                    // Handle single file read response (for content sync)
                    else if (message.operation === 'read' && typeof message.result === 'string' && message.path) {
                        // Remove from pending reads
                        pendingFileReadsRef.current.delete(message.path);
                        if (onFileContentSyncRef.current) {
                            onFileContentSyncRef.current({ 
                                path: message.path, 
                                content: message.result 
                            });
                        }
                    }
                    // Generic file response handler
                    if (onFileResponseRef.current) {
                        onFileResponseRef.current(message);
                    }
                    break;

                case "command_output":
                    addLog(`[cmd] ${message.output}`);
                    break;

                case "command_complete":
                    addLog(`Command completed (exit: ${message.exitCode})`);
                    break;

                case "error":
                    addLog(`Agent error: ${message.error}`);
                    break;
            }
        });

        socketRef.current = socket;
        return socket;
    }, [addLog]);

    // Spawn sandbox
    const spawn = useCallback(async (envVars?: Record<string, string>) => {
        const socket = initSocket();
        
        setStatus("spawning");
        setAgentStatus("connecting");
        addLog("Spawning sandbox container...");

        socket.emit("sandbox:spawn", { envVars });
    }, [initSocket, addLog]);

    // Stop sandbox
    const stop = useCallback(async () => {
        if (!socketRef.current || !sessionIdRef.current) return;

        setStatus("stopping");
        addLog("Stopping sandbox...");

        socketRef.current.emit("sandbox:stop", { 
            sessionId: sessionIdRef.current 
        });
    }, [addLog]);

    // Generate bindings
    const generateBindings = useCallback((contractId: string, network: 'testnet' | 'mainnet') => {
        console.log('[useSandbox] ============================================');
        console.log('[useSandbox] generateBindings() CALLED');
        console.log('[useSandbox] ============================================');
        console.log('[useSandbox] Contract ID:', contractId);
        console.log('[useSandbox] Network:', network);
        console.log('[useSandbox] Socket connected:', socketRef.current?.connected);
        console.log('[useSandbox] Session ID:', sessionIdRef.current);
        console.log('[useSandbox] Timestamp:', new Date().toISOString());

        if (!socketRef.current || !sessionIdRef.current) {
            const errorMsg = "Error: No sandbox running. Spawn a sandbox first.";
            console.error('[useSandbox]', errorMsg);
            addLog(errorMsg);
            return;
        }

        setBindingsStatus("generating");
        const logMsg = `Generating bindings for ${contractId} on ${network}...`;
        console.log('[useSandbox]', logMsg);
        addLog(logMsg);

        const payload = {
            sessionId: sessionIdRef.current,
            contractId,
            network
        };
        console.log('[useSandbox] Emitting sandbox:generate_bindings with payload:', payload);
        socketRef.current.emit("sandbox:generate_bindings", payload);
        console.log('[useSandbox] Event emitted successfully');
        console.log('[useSandbox] ============================================');
    }, [addLog]);

    // Send chat message
    const sendChatMessage = useCallback((prompt: string, context?: any) => {
        if (!socketRef.current || !sessionIdRef.current) {
            addLog("Error: No sandbox running.");
            return;
        }

        addLog(`Sending chat message...`);

        socketRef.current.emit("sandbox:chat", {
            sessionId: sessionIdRef.current,
            prompt,
            context
        });
    }, [addLog]);

    // Execute command
    const executeCommand = useCallback((command: string, cwd?: string) => {
        if (!socketRef.current || !sessionIdRef.current) {
            addLog("Error: No sandbox running.");
            return;
        }

        addLog(`Executing: ${command}`);

        socketRef.current.emit("sandbox:command", {
            sessionId: sessionIdRef.current,
            command,
            cwd
        });
    }, [addLog]);

    // File operations
    const readFile = useCallback((path: string) => {
        if (!socketRef.current || !sessionIdRef.current) return;

        // Track this pending read for content sync
        pendingFileReadsRef.current.add(path);

        socketRef.current.emit("sandbox:file", {
            sessionId: sessionIdRef.current,
            operation: 'read',
            path
        });
    }, []);

    const writeFile = useCallback((path: string, content: string) => {
        if (!socketRef.current || !sessionIdRef.current) return;

        socketRef.current.emit("sandbox:file", {
            sessionId: sessionIdRef.current,
            operation: 'write',
            path,
            content
        });
    }, []);

    const deleteFile = useCallback((path: string) => {
        if (!socketRef.current || !sessionIdRef.current) {
            addLog("Error: No sandbox running.");
            return;
        }

        addLog(`Deleting file: ${path}`);
        socketRef.current.emit("sandbox:file", {
            sessionId: sessionIdRef.current,
            operation: 'delete',
            path
        });
    }, [addLog]);

    const listFiles = useCallback((path?: string) => {
        if (!socketRef.current || !sessionIdRef.current) return;

        socketRef.current.emit("sandbox:file", {
            sessionId: sessionIdRef.current,
            operation: 'list',
            path
        });
    }, []);

    // List files recursively (for file tree sync)
    const listFilesRecursive = useCallback((path?: string) => {
        if (!socketRef.current || !sessionIdRef.current) {
            addLog("Error: No sandbox running.");
            return;
        }

        socketRef.current.emit("sandbox:file", {
            sessionId: sessionIdRef.current,
            operation: 'list_recursive',
            path: path || '.'
        });
    }, [addLog]);

    // Sync entire file tree from sandbox
    const syncFileTree = useCallback(() => {
        if (!socketRef.current || !sessionIdRef.current) {
            addLog("Error: No sandbox running. Cannot sync file tree.");
            return;
        }

        addLog("Syncing file tree from container...");
        listFilesRecursive('.');
    }, [addLog, listFilesRecursive]);

    // Reset
    const reset = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        sessionIdRef.current = null;
        setStatus("idle");
        setAgentStatus("disconnected");
        setBindingsStatus("idle");
        setSandboxInfo(null);
        setLogs([]);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    return {
        status,
        agentStatus,
        bindingsStatus,
        sandboxInfo,
        previewUrl: sandboxInfo?.previewUrl || null,
        logs,
        spawn,
        stop,
        generateBindings,
        sendChatMessage,
        executeCommand,
        readFile,
        writeFile,
        deleteFile,
        listFiles,
        listFilesRecursive,
        syncFileTree,
        onChatResponse: onChatResponseRef.current,
        setOnChatResponse: (handler) => { onChatResponseRef.current = handler; },
        onBindingsResponse: onBindingsResponseRef.current,
        setOnBindingsResponse: (handler) => { onBindingsResponseRef.current = handler; },
        onFileResponse: onFileResponseRef.current,
        setOnFileResponse: (handler) => { onFileResponseRef.current = handler; },
        onFileTreeSync: onFileTreeSyncRef.current,
        setOnFileTreeSync: (handler) => { onFileTreeSyncRef.current = handler; },
        onFileContentSync: onFileContentSyncRef.current,
        setOnFileContentSync: (handler) => { onFileContentSyncRef.current = handler; },
        clearLogs,
        reset,
        isConnected: status === "running" && agentStatus === "connected"
    };
}
