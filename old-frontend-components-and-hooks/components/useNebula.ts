import { useState } from 'react';
import { useWallet } from './useWallet';
import { useCompiler } from './useCompiler';
import { useFileSystem } from './useFileSystem';
import * as StellarSdk from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

const TESTNET_RPC: string = process.env.NEXT_PUBLIC_TESTNET_RPC ?? "";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

export function useNebula() {
    const wallet = useWallet();
    const compiler = useCompiler();
    const fileSystem = useFileSystem();

    const [deployStatus, setDeployStatus] = useState<"IDLE" | "UPLOADING" | "INSTANTIATING" | "SUCCESS" | "ERROR">("IDLE");
    const [contractId, setContractId] = useState<string | null>(null);
    const [deployLogs, setDeployLogs] = useState<string[]>([]);

    const addDeployLog = (msg: string) => setDeployLogs(prev => [...prev, `> ${msg}`]);

    const deploy = async () => {
        if (!wallet.address) {
            addDeployLog("[ERROR] Wallet not connected. Please connect your wallet.");
            return;
        }
        if (!compiler.wasmHex) {
            addDeployLog("[ERROR] No compiled WASM found. Please compile the contract first.");
            return;
        }

        setDeployStatus("UPLOADING");
        setDeployLogs([]);
        addDeployLog("Starting Deployment...");

        const server = new StellarSdk.rpc.Server(TESTNET_RPC);

        try {
            // 1. Upload WASM
            addDeployLog("Building Upload Transaction...");
            const account = await server.getAccount(wallet.address);
            const wasmBuffer = Buffer.from(compiler.wasmHex, 'hex');
            const uploadOp = StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer });

            const uploadTx = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: NETWORK_PASSPHRASE,
            })
                .addOperation(uploadOp)
                .setTimeout(30)
                .build();

            const preparedUpload = await server.prepareTransaction(uploadTx);
            addDeployLog("Requesting Signature...");
            const signedUploadXdr = await wallet.sign(preparedUpload.toXDR(), NETWORK_PASSPHRASE);

            addDeployLog("Submitting Upload...");
            const uploadResult = await server.sendTransaction(
                StellarSdk.TransactionBuilder.fromXDR(signedUploadXdr, NETWORK_PASSPHRASE)
            );

            if (uploadResult.status !== "PENDING") throw new Error("Upload Failed: " + JSON.stringify(uploadResult));

            const uploadHash = uploadResult.hash;
            addDeployLog(`Upload Hash: ${uploadHash}`);

            // Poll
            let uploadResp = await server.getTransaction(uploadHash);
            while (uploadResp.status === "NOT_FOUND" || (uploadResp.status as string) === "PENDING") {
                await new Promise(r => setTimeout(r, 1000));
                uploadResp = await server.getTransaction(uploadHash);
            }

            if ((uploadResp.status as string) !== "SUCCESS") throw new Error("Upload Failed on-chain");

            // @ts-ignore
            const wasmHash = uploadResp.returnValue.bytes();
            addDeployLog("WASM Uploaded.");

            // 2. Instantiate
            setDeployStatus("INSTANTIATING");
            addDeployLog("Building Instantiate Transaction...");

            const account2 = await server.getAccount(wallet.address);
            const createOp = StellarSdk.Operation.createCustomContract({
                wasmHash: wasmHash,
                address: StellarSdk.Address.fromString(wallet.address),
                salt: Buffer.from(uploadHash, 'hex'), // Reuse hash for uniqueness
            });

            const createTx = new StellarSdk.TransactionBuilder(account2, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: NETWORK_PASSPHRASE,
            }).addOperation(createOp).setTimeout(30).build();

            const preparedCreate = await server.prepareTransaction(createTx);
            addDeployLog("Requesting Create Signature...");
            const signedCreateXdr = await wallet.sign(preparedCreate.toXDR(), NETWORK_PASSPHRASE);

            const createResult = await server.sendTransaction(
                StellarSdk.TransactionBuilder.fromXDR(signedCreateXdr, NETWORK_PASSPHRASE)
            );

            const createHash = createResult.hash;
            addDeployLog(`Create Hash: ${createHash}`);

            // Poll
            let createResp = await server.getTransaction(createHash);
            while (createResp.status === "NOT_FOUND" || (createResp.status as string) === "PENDING") {
                await new Promise(r => setTimeout(r, 1000));
                createResp = await server.getTransaction(createHash);
            }

            if ((createResp.status as string) !== "SUCCESS") throw new Error("Creation Failed on-chain");

            // @ts-ignore
            const addressBytes = createResp.returnValue.address();
            const newId = StellarSdk.StrKey.encodeContract(
                StellarSdk.Address.fromScAddress(addressBytes).toBuffer()
            );

            setContractId(newId);
            setDeployStatus("SUCCESS");
            addDeployLog(`SUCCESS! Contract ID: ${newId}`);

        } catch (e: any) {
            console.error(e);
            setDeployStatus("ERROR");
            addDeployLog(`Error: ${e.message}`);
        }
    };

    const allLogs = [...wallet.logs, ...compiler.logs, ...deployLogs];

    return {
        wallet,
        compiler,
        deploy,
        deployStatus,
        deployLogs,
        allLogs,
        contractId,
        fileSystem
    };
}
