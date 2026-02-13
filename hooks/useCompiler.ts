"use client";

import { useState, useCallback, useRef } from 'react';
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type CompilerStatus = "IDLE" | "QUEUED" | "COMPILING" | "SUCCESS" | "ERROR";

export interface CompileFile {
    path: string;
    content: string;
}

export interface UseCompilerReturn {
    status: CompilerStatus;
    logs: string[];
    wasmHex: string | null;
    compile: (files: CompileFile[]) => void;
    reset: () => void;
    clearLogs: () => void;
}

export function useCompiler(): UseCompilerReturn {
    const [status, setStatus] = useState<CompilerStatus>("IDLE");
    const [logs, setLogs] = useState<string[]>([]);
    const [wasmHex, setWasmHex] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);

    const addLog = useCallback((msg: string) => {
        setLogs(prev => [...prev, msg.startsWith(">") ? msg : `> ${msg}`]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const compile = useCallback((files: CompileFile[]) => {
        // Clean up existing socket if any
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        setStatus("COMPILING");
        setLogs([]);
        setWasmHex(null);
        
        addLog(`[COMPILE] Preparing build with ${files.length} files...`);
        
        // Debug: log file paths
        files.forEach(f => {
            addLog(`  📄 ${f.path}`);
        });

        const payload = {
            jobId: crypto.randomUUID(),
            files
        };

        addLog(`[COMPILE] Connecting to backend: ${API_URL}...`);

        const socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 3,
            timeout: 10000
        });
        
        socketRef.current = socket;
        const submissionId = payload.jobId;

        socket.on("connect", () => {
            addLog(`[COMPILE] Socket connected (${socket.id}). Sending payload...`);
            socket.emit("compile", { payload, submissionId });

            // Timeout warning if no response
            setTimeout(() => {
                setLogs(prev => {
                    if (prev[prev.length - 1]?.includes("Sending payload")) {
                        return [...prev, "[WARNING] Server is not responding. Check if backend is running."];
                    }
                    return prev;
                });
            }, 5000);
        });

        socket.on("status", (data: any) => {
            const newStatus = (data.state as CompilerStatus) || "COMPILING";
            setStatus(newStatus);
            if (data.message) {
                addLog(`[STATUS] ${data.message}`);
            }
        });

        socket.on("log", (data: any) => {
            // Real-time log from backend
            const logMessage = typeof data === 'string' ? data : data.data || JSON.stringify(data);
            addLog(logMessage);
        });

        socket.on("result", (data: any) => {
            if (data.success) {
                addLog(`[SUCCESS] Compilation finished! WASM size: ${data.wasmHex.length} hex chars`);
                setWasmHex(data.wasmHex);
                setStatus("SUCCESS");
            } else {
                addLog(`[ERROR] Compilation failed:`);
                if (data.logs) {
                    addLog(data.logs);
                }
                if (data.error) {
                    addLog(data.error);
                }
                setStatus("ERROR");
            }
            socket.disconnect();
            socketRef.current = null;
        });

        socket.on("connect_error", (err: any) => {
            addLog(`[ERROR] Socket connection error: ${err.message}`);
            addLog(`[ERROR] Make sure the backend server is running at ${API_URL}`);
            setStatus("ERROR");
            socket.disconnect();
            socketRef.current = null;
        });

        socket.on("disconnect", (reason) => {
            if (reason === "io server disconnect") {
                addLog("[INFO] Disconnected by server");
            }
        });

    }, [addLog]);

    const reset = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setStatus("IDLE");
        setLogs([]);
        setWasmHex(null);
    }, []);

    return { status, logs, wasmHex, compile, reset, clearLogs };
}
