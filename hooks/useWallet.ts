"use client";

import { useState, useCallback } from 'react';
import { isConnected, setAllowed, getAddress, signTransaction } from "@stellar/freighter-api";

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export interface UseWalletReturn {
    address: string | null;
    status: WalletStatus;
    connect: () => Promise<void>;
    disconnect: () => void;
    sign: (xdr: string, networkPassphrase: string) => Promise<string>;
    error: string | null;
    logs: string[];
    clearLogs: () => void;
}

export function useWallet(): UseWalletReturn {
    const [address, setAddress] = useState<string | null>(null);
    const [status, setStatus] = useState<WalletStatus>("disconnected");
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = useCallback((msg: string) => {
        setLogs(prev => [...prev, `> ${msg}`]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const connect = useCallback(async () => {
        setError(null);
        setStatus("connecting");
        
        try {
            const installed = await isConnected();
            if (!installed) {
                const msg = "Freighter wallet is not installed. Please install the Freighter browser extension.";
                setError(msg);
                setStatus("error");
                addLog(`[ERROR] ${msg}`);
                return;
            }

            await setAllowed();
            const { address: walletAddress } = await getAddress();
            
            setAddress(walletAddress);
            setStatus("connected");
            addLog(`[SUCCESS] Wallet Connected: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);
        } catch (e: any) {
            console.error("Wallet connection error:", e);
            const msg = e.message || "Failed to connect wallet";
            setError(msg);
            setStatus("error");
            addLog(`[ERROR] Connection failed: ${msg}`);
        }
    }, [addLog]);

    const disconnect = useCallback(() => {
        setAddress(null);
        setStatus("disconnected");
        setError(null);
        addLog("Wallet Disconnected");
    }, [addLog]);

    const sign = useCallback(async (xdr: string, networkPassphrase: string): Promise<string> => {
        if (!address) {
            throw new Error("Wallet not connected");
        }

        try {
            addLog("Requesting transaction signature...");
            const signed = await signTransaction(xdr, { networkPassphrase });
            
            if (signed.error) {
                throw new Error(signed.error);
            }
            
            addLog("[SUCCESS] Transaction signed");
            return signed.signedTxXdr;
        } catch (e: any) {
            console.error("Sign error:", e);
            const msg = e.message || "Failed to sign transaction";
            addLog(`[ERROR] Signing failed: ${msg}`);
            throw new Error(msg);
        }
    }, [address, addLog]);

    return { 
        address, 
        status,
        connect, 
        disconnect, 
        sign, 
        error, 
        logs,
        clearLogs
    };
}
