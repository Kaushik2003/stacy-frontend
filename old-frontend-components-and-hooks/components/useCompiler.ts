import { useState, useCallback } from 'react';
import { io } from "socket.io-client";
import { FileSystemItem } from './useFileSystem';

const API_URL = "http://localhost:3001"; // Hardcoded for debugging to avoid env mismatches

export type CompilerStatus = "IDLE" | "QUEUED" | "COMPILING" | "SUCCESS" | "ERROR";

export interface UseCompilerReturn {
    status: CompilerStatus;
    logs: string[];
    wasmHex: string | null;
    compile: (activeContractName: string, fileTree: FileSystemItem[]) => void;
    reset: () => void;
}

export function useCompiler(): UseCompilerReturn {
    const [status, setStatus] = useState<CompilerStatus>("IDLE");
    const [logs, setLogs] = useState<string[]>([]);
    const [wasmHex, setWasmHex] = useState<string | null>(null);

    const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

    const compile = useCallback(async (activeContractName: string, fileTree: FileSystemItem[]) => {
        setStatus("COMPILING");
        setLogs([]);
        setWasmHex(null);
        addLog(`Preparing build for ${activeContractName}...`);

        // Helper to flatten tree into payload
        const files: { path: string; content: string }[] = [];
        const processNode = (node: FileSystemItem, currentPath: string) => {
            if (node.type === "file" && node.content) {
                files.push({ path: currentPath + node.name, content: node.content });
            } else if (node.type === "folder" && node.children) {
                node.children.forEach(child => processNode(child, currentPath + node.name + "/"));
            }
        };

        // Find root "contracts" folder or root itself? 
        // Based on useFileSystem, structure is root -> contracts -> folder -> files
        // Backend expects: Cargo.toml (root), contracts/name/...

        // Check if a root Cargo.toml already exists in the file tree
        const existingCargoToml = files.find(f => f.path === "Cargo.toml");
        
        if (!existingCargoToml) {
             // We need to generate the ROOT Cargo.toml dynamically if it doesn't exist
             const rootCargoToml = `[workspace]
resolver = "2"
members = [
  "contracts/${activeContractName}", 
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
`;
            files.push({ path: "Cargo.toml", content: rootCargoToml });
        }

        // Process file tree
        // We assume the fileTree passed contains the "contracts" folder at root or top level
        fileTree.forEach(node => processNode(node, ""));

        const payload = {
            jobId: crypto.randomUUID(),
            files
        };

        addLog(`Generated payload with ${files.length} files.`);
        // Debug payload files
        console.log("Payload Files:", files);

        addLog(`Connecting to Backend: ${API_URL}...`);

        const socket = io(API_URL, {
            transports: ['websocket', 'polling'], // forcing websocket might help
            reconnectionAttempts: 3
        });
        const submissionId = payload.jobId;

        socket.on("connect", () => {
            addLog(`Socket Connected (${socket.id}). Sending Payload...`);
            console.log("Emitting compile event with:", { payload, submissionId });
            socket.emit("compile", { payload, submissionId });

            // Set a timeout to warn if no response
            setTimeout(() => {
                setLogs(prev => {
                    if (prev[prev.length - 1]?.includes("Sending Payload")) {
                        return [...prev, "> [WARNING] Server is not responding. Check backend logs."];
                    }
                    return prev;
                });
            }, 5000);
        });

        socket.on("status", (data: any) => {
            setStatus((data.state as CompilerStatus) || "COMPILING");
            if (data.state !== "COMPILING" && data.state !== "QUEUED") {
                // Initial status update
            }
        });

        socket.on("log", (data: any) => {
            // Real-time log
            addLog(data.data || data);
        });

        socket.on("result", (data: any) => {
            if (data.success) {
                addLog(`[SUCCESS] Compilation Finished! WASM Size: ${data.wasmHex.length} chars`);
                setWasmHex(data.wasmHex);
                setStatus("SUCCESS");
            } else {
                addLog(`[ERROR] Compilation Failed:`);
                if (data.logs) addLog(data.logs);
                setStatus("ERROR");
            }
            socket.disconnect();
        });

        socket.on("connect_error", (err: any) => {
            addLog(`[ERROR] Socket Connection Error: ${err.message}`);
            setStatus("ERROR");
            socket.disconnect();
        });

    }, []);

    const reset = () => {
        setStatus("IDLE");
        setLogs([]);
        setWasmHex(null);
    };

    return { status, logs, wasmHex, compile, reset };
}
