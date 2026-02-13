"use client";

import { useState, useCallback } from 'react';
import * as StellarSdk from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

export type NetworkType = "testnet" | "mainnet";
export type DeployStatus = "IDLE" | "UPLOADING" | "INSTANTIATING" | "SUCCESS" | "ERROR";

const NETWORK_CONFIG = {
  testnet: {
    rpc: process.env.NEXT_PUBLIC_TESTNET_RPC || "https://soroban-testnet.stellar.org",
    passphrase: StellarSdk.Networks.TESTNET,
    explorer: "https://stellar.expert/explorer/testnet/contract"
  },
  mainnet: {
    rpc: process.env.NEXT_PUBLIC_MAINNET_RPC || "https://soroban.stellar.org",
    passphrase: StellarSdk.Networks.PUBLIC,
    explorer: "https://stellar.expert/explorer/public/contract"
  }
};

export interface UseDeployerReturn {
    status: DeployStatus;
    contractId: string | null;
    wasmHash: string | null;
    logs: string[];
    network: NetworkType;
    setNetwork: (network: NetworkType) => void;
    explorerUrl: string | null;
    deploy: (
        wasmHex: string, 
        walletAddress: string, 
        signFn: (xdr: string, networkPassphrase: string) => Promise<string>
    ) => Promise<void>;
    reset: () => void;
    clearLogs: () => void;
}

export function useDeployer(): UseDeployerReturn {
    const [status, setStatus] = useState<DeployStatus>("IDLE");
    const [contractId, setContractId] = useState<string | null>(null);
    const [wasmHash, setWasmHash] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [network, setNetwork] = useState<NetworkType>("testnet");

    const addLog = useCallback((msg: string) => {
        setLogs(prev => [...prev, msg.startsWith(">") ? msg : `> ${msg}`]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const explorerUrl = contractId 
        ? `${NETWORK_CONFIG[network].explorer}/${contractId}` 
        : null;

    const deploy = useCallback(async (
        wasmHex: string,
        walletAddress: string,
        signFn: (xdr: string, networkPassphrase: string) => Promise<string>
    ) => {
        if (!walletAddress) {
            addLog("[ERROR] Wallet not connected. Please connect your wallet first.");
            setStatus("ERROR");
            return;
        }

        if (!wasmHex) {
            addLog("[ERROR] No compiled WASM found. Please compile the contract first.");
            setStatus("ERROR");
            return;
        }

        const config = NETWORK_CONFIG[network];

        setStatus("UPLOADING");
        setLogs([]);
        setContractId(null);
        setWasmHash(null);
        
        const networkLabel = network === "testnet" ? "Stellar Testnet" : "Stellar Mainnet";
        addLog(`[DEPLOY] Starting deployment to ${networkLabel}...`);
        addLog(`[DEPLOY] RPC: ${config.rpc}`);

        const server = new StellarSdk.rpc.Server(config.rpc);

        try {
            // Step 1: Upload WASM
            addLog("[DEPLOY] Building WASM upload transaction...");
            const account = await server.getAccount(walletAddress);
            const wasmBuffer = Buffer.from(wasmHex, 'hex');
            
            addLog(`[DEPLOY] WASM size: ${wasmBuffer.length} bytes`);
            
            const uploadOp = StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer });

            const uploadTx = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: config.passphrase,
            })
                .addOperation(uploadOp)
                .setTimeout(60)
                .build();

            const preparedUpload = await server.prepareTransaction(uploadTx);
            addLog("[DEPLOY] Requesting signature for WASM upload...");
            
            const signedUploadXdr = await signFn(preparedUpload.toXDR(), config.passphrase);

            addLog("[DEPLOY] Submitting WASM upload transaction...");
            const uploadResult = await server.sendTransaction(
                StellarSdk.TransactionBuilder.fromXDR(signedUploadXdr, config.passphrase)
            );

            if (uploadResult.status !== "PENDING") {
                throw new Error("Upload failed: " + JSON.stringify(uploadResult));
            }

            const uploadHash = uploadResult.hash;
            addLog(`[DEPLOY] Upload transaction hash: ${uploadHash}`);

            // Poll for upload result
            addLog("[DEPLOY] Waiting for upload confirmation...");
            let uploadResp = await server.getTransaction(uploadHash);
            let attempts = 0;
            const maxAttempts = 30;
            
            while ((uploadResp.status === "NOT_FOUND" || (uploadResp.status as string) === "PENDING") && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 1000));
                uploadResp = await server.getTransaction(uploadHash);
                attempts++;
                if (attempts % 5 === 0) {
                    addLog(`[DEPLOY] Still waiting... (${attempts}s)`);
                }
            }

            if ((uploadResp.status as string) !== "SUCCESS") {
                throw new Error("Upload failed on-chain: " + uploadResp.status);
            }

            // @ts-ignore - Extract WASM hash from result
            const uploadedWasmHash = uploadResp.returnValue.bytes();
            setWasmHash(Buffer.from(uploadedWasmHash).toString('hex'));
            addLog("[SUCCESS] WASM uploaded successfully!");

            // Step 2: Instantiate Contract
            setStatus("INSTANTIATING");
            addLog("[DEPLOY] Building contract instantiation transaction...");

            const account2 = await server.getAccount(walletAddress);
            const createOp = StellarSdk.Operation.createCustomContract({
                wasmHash: uploadedWasmHash,
                address: StellarSdk.Address.fromString(walletAddress),
                salt: Buffer.from(uploadHash, 'hex').slice(0, 32), // Use hash as salt for uniqueness
            });

            const createTx = new StellarSdk.TransactionBuilder(account2, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: config.passphrase,
            })
                .addOperation(createOp)
                .setTimeout(60)
                .build();

            const preparedCreate = await server.prepareTransaction(createTx);
            addLog("[DEPLOY] Requesting signature for contract creation...");
            
            const signedCreateXdr = await signFn(preparedCreate.toXDR(), config.passphrase);

            addLog("[DEPLOY] Submitting contract creation transaction...");
            const createResult = await server.sendTransaction(
                StellarSdk.TransactionBuilder.fromXDR(signedCreateXdr, config.passphrase)
            );

            const createHash = createResult.hash;
            addLog(`[DEPLOY] Create transaction hash: ${createHash}`);

            // Poll for create result
            addLog("[DEPLOY] Waiting for contract creation confirmation...");
            let createResp = await server.getTransaction(createHash);
            attempts = 0;
            
            while ((createResp.status === "NOT_FOUND" || (createResp.status as string) === "PENDING") && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 1000));
                createResp = await server.getTransaction(createHash);
                attempts++;
                if (attempts % 5 === 0) {
                    addLog(`[DEPLOY] Still waiting... (${attempts}s)`);
                }
            }

            if ((createResp.status as string) !== "SUCCESS") {
                throw new Error("Contract creation failed on-chain: " + createResp.status);
            }

            // @ts-ignore - Extract contract ID
            const addressBytes = createResp.returnValue.address();
            const newContractId = StellarSdk.StrKey.encodeContract(
                StellarSdk.Address.fromScAddress(addressBytes).toBuffer()
            );

            setContractId(newContractId);
            setStatus("SUCCESS");
            addLog(`[SUCCESS] Contract deployed!`);
            addLog(`[SUCCESS] Contract ID: ${newContractId}`);
            addLog(`[INFO] View on explorer: ${NETWORK_CONFIG[network].explorer}/${newContractId}`);

        } catch (e: any) {
            console.error("Deployment error:", e);
            setStatus("ERROR");
            addLog(`[ERROR] Deployment failed: ${e.message}`);
        }
    }, [addLog, network]);

    const reset = useCallback(() => {
        setStatus("IDLE");
        setContractId(null);
        setWasmHash(null);
        setLogs([]);
    }, []);

    return { 
        status, 
        contractId, 
        wasmHash,
        logs, 
        network,
        setNetwork,
        explorerUrl,
        deploy, 
        reset,
        clearLogs
    };
}

