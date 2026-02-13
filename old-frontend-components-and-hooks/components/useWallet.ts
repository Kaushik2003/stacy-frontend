import { useState } from 'react';
import { isConnected, setAllowed, getAddress, signTransaction } from "@stellar/freighter-api";

export interface UseWalletReturn {
    address: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    sign: (xdr: string, networkPassphrase: string) => Promise<string>;
    error: string | null;
    logs: string[];
}

export function useWallet(): UseWalletReturn {
    const [address, setAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

    const connect = async () => {
        setError(null);
        try {
            const installed = await isConnected();
            if (!installed) {
                const msg = "Freighter wallet is not installed.";
                setError(msg);
                addLog(msg);
                alert(msg);
                return;
            }

            await setAllowed();
            const { address } = await getAddress();
            setAddress(address);
            addLog(`Wallet Connected: ${address}`);
        } catch (e: any) {
            console.error(e);
            const msg = e.message || "Failed to connect wallet";
            setError(msg);
            addLog(`Error connecting: ${msg}`);
        }
    };

    const disconnect = () => {
        setAddress(null);
        addLog("Wallet Disconnected");
    };

    const sign = async (xdr: string, networkPassphrase: string) => {
        try {
            addLog("Requesting Signature...");
            const signed = await signTransaction(xdr, { networkPassphrase });
            if (signed.error) throw new Error(signed.error);
            addLog("Transaction Signed.");
            return signed.signedTxXdr;
        } catch (e: any) {
            console.error(e);
            addLog(`Sign Error: ${e.message}`);
            throw new Error(e.message || "Failed to sign transaction");
        }
    };

    return { address, connect, disconnect, sign, error, logs };
}
