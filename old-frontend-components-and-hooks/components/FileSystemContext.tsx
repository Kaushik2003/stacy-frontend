"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type FileSystemItem = {
    id: string;
    name: string;
    type: "file" | "folder";
    children?: FileSystemItem[];
    content?: string;
    isSelectable?: boolean;
};

const INITIAL_TREE: FileSystemItem[] = [
    {
        id: "1",
        name: "contracts",
        type: "folder",
        children: [
            {
                id: "2",
                name: "hello_world",
                type: "folder",
                children: [
                    {
                        id: "3",
                        name: "Cargo.toml",
                        type: "file",
                        content: `[package]
name = "hello_world"
version = "0.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }
`
                    },
                    {
                        id: "4",
                        name: "src",
                        type: "folder",
                        children: [
                            {
                                id: "5",
                                name: "lib.rs",
                                type: "file",
                                content: `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
`
                            }
                        ]
                    }
                ]
            }
        ]
    }
];

interface FileSystemContextType {
    fileTree: FileSystemItem[];
    setFileTree: React.Dispatch<React.SetStateAction<FileSystemItem[]>>;
    createContract: (contractName: string) => void;
    selectedFile: FileSystemItem | null;
    selectFile: (fileId: string) => void;
    updateFileContent: (fileId: string, newContent: string) => void;
    activeContractName: string;
    activeContractId: string | null;
    deleteItem: (itemId: string) => void;
    renameItem: (itemId: string, newName: string) => void;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({ children }: { children: ReactNode }) {
    const [fileTree, setFileTree] = useState<FileSystemItem[]>(INITIAL_TREE);
    const [selectedFile, setSelectedFile] = useState<FileSystemItem | null>(null);
    const [activeContractId, setActiveContractId] = useState<string | null>("2");

    const generateId = useCallback(() => Math.random().toString(36).substr(2, 9), []);

    const createContract = useCallback((contractName: string) => {
        const newContract: FileSystemItem = {
            id: generateId(),
            name: contractName,
            type: "folder",
            children: [
                {
                    id: generateId(),
                    name: "Cargo.toml",
                    type: "file",
                    content: `[package]
name = "${contractName}"
version = "0.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }
`
                },
                {
                    id: generateId(),
                    name: "src",
                    type: "folder",
                    children: [
                        {
                            id: generateId(),
                            name: "lib.rs",
                            type: "file",
                            content: `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct ${contractName.charAt(0).toUpperCase() + contractName.slice(1)}Contract;

#[contractimpl]
impl ${contractName.charAt(0).toUpperCase() + contractName.slice(1)}Contract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
`
                        }
                    ]
                }
            ]
        };

        setFileTree(prev => {
            const newTree = prev.map(node => {
                if (node.name === "contracts" && node.type === "folder") {
                    return {
                        ...node,
                        children: [...(node.children || []), newContract]
                    };
                }
                return node;
            });

            const hasContracts = newTree.some(n => n.name === "contracts" && n.type === "folder");
            if (!hasContracts) {
                newTree.push({
                    id: generateId(),
                    name: "contracts",
                    type: "folder",
                    children: [newContract]
                });
            }
            return newTree;
        });
    }, [generateId]);

    // Derived State: Active Contract Name
    const getActiveContractName = useCallback(() => {
        if (!activeContractId) return "hello_world";

        const findNodeName = (nodes: FileSystemItem[]): string | null => {
            for (const node of nodes) {
                if (node.id === activeContractId) return node.name;
                if (node.children) {
                    const found = findNodeName(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return findNodeName(fileTree) || "hello_world";
    }, [fileTree, activeContractId]);

    const activeContractName = getActiveContractName();

    const selectFile = useCallback((fileId: string) => {
        let foundContractId = activeContractId;

        const findNode = (nodes: FileSystemItem[], parentPath: FileSystemItem[]): FileSystemItem | null => {
            for (const node of nodes) {
                if (node.id === fileId) {
                    if (parentPath.length > 0 && parentPath[0].name === "contracts") {
                        if (node.type === "folder" && parentPath.length === 1) {
                            foundContractId = node.id;
                        }
                        else if (parentPath.length >= 2) {
                            foundContractId = parentPath[1].id;
                        }
                    }
                    return node;
                }
                if (node.children) {
                    const found = findNode(node.children, [...parentPath, node]);
                    if (found) return found;
                }
            }
            return null;
        };

        const node = findNode(fileTree, []);

        if (node) {
            if (foundContractId) setActiveContractId(foundContractId);
            if (node.type === "file") {
                setSelectedFile(node);
            }
        }
    }, [fileTree, activeContractId]);

    const deleteItem = useCallback((itemId: string) => {
        setFileTree(prev => {
            const removeFrom = (nodes: FileSystemItem[]): FileSystemItem[] => {
                return nodes
                    .filter(node => node.id !== itemId)
                    .map(node => ({
                        ...node,
                        children: node.children ? removeFrom(node.children) : undefined
                    }));
            };
            return removeFrom(prev);
        });
        if (selectedFile?.id === itemId) {
            setSelectedFile(null);
        }
    }, [selectedFile]);

    const renameItem = useCallback((itemId: string, newName: string) => {
        setFileTree(prev => {
            const updateName = (nodes: FileSystemItem[]): FileSystemItem[] => {
                return nodes.map(node => {
                    if (node.id === itemId) {
                        return { ...node, name: newName };
                    }
                    if (node.children) {
                        return { ...node, children: updateName(node.children) };
                    }
                    return node;
                });
            };
            return updateName(prev);
        });
    }, []);

    const updateFileContent = useCallback((fileId: string, newContent: string) => {
        setFileTree(prev => {
            const updateNode = (nodes: FileSystemItem[]): FileSystemItem[] => {
                return nodes.map(node => {
                    if (node.id === fileId) {
                        return { ...node, content: newContent };
                    }
                    if (node.children) {
                        return { ...node, children: updateNode(node.children) };
                    }
                    return node;
                });
            };
            return updateNode(prev);
        });

        if (selectedFile?.id === fileId) {
            setSelectedFile(prev => prev ? { ...prev, content: newContent } : null);
        }
    }, [selectedFile]);

    return (
        <FileSystemContext.Provider value={{
            fileTree,
            setFileTree,
            createContract,
            selectedFile,
            selectFile,
            updateFileContent,
            activeContractName,
            activeContractId,
            deleteItem,
            renameItem
        }}>
            {children}
        </FileSystemContext.Provider>
    );
}

export function useFileSystemContext() {
    const context = useContext(FileSystemContext);
    if (context === undefined) {
        throw new Error('useFileSystemContext must be used within a FileSystemProvider');
    }
    return context;
}
