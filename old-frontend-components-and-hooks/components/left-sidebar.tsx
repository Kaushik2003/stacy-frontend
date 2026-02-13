"use client"

import { FileText, Search, Puzzle, Github, Plus, Trash2, Edit2 } from "lucide-react"
import { useState } from "react"
import { Tree, Folder, File as FileItem } from "../components/file-tree"
import { Button } from "@/components/ui/button"

export default function LeftSidebar({ fileSystem }: { fileSystem: any }) {
    const [activeIcon, setActiveIcon] = useState("file")
    const { fileTree, createContract, selectFile } = fileSystem;

    const icons = [
        { id: "file", Icon: FileText, label: "Explorer" },
        { id: "search", Icon: Search, label: "Search" },
        { id: "puzzle", Icon: Puzzle, label: "Extensions" },
        { id: "github", Icon: Github, label: "GitHub" },
    ]

    return (
        <div className="flex flex-row h-full">
            {/* Icons Bar */}
            <aside className="glass-elevated w-16 border-r border-primary/20 flex flex-col items-center py-6 gap-6 z-10">
                {icons.map(({ id, Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setActiveIcon(id)}
                        className={`
                relative p-3 rounded-lg transition-all duration-300 group
                ${activeIcon === id
                                ? "bg-primary/20 text-primary glow-border"
                                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                            }
            `}
                        title={label}
                    >
                        {activeIcon === id && (
                            <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-secondary rounded-r-full"></div>
                        )}
                        <Icon size={20} />
                    </button>
                ))}
            </aside>

            {/* File Tree Panel (Visible if Explorer is active) */}
            {activeIcon === "file" && (
                <div className="w-64 bg-[#1e1e1e] border-r border-primary/20 flex flex-col">
                    <div className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest flex justify-between items-center">
                        <span>Explorer</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => createContract("new_contract")}
                            title="New Contract"
                        >
                            <Plus size={14} />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-auto p-2">
                        <Tree
                            className="h-full w-full"
                            initialSelectedId="1"
                            initialExpandedItems={["1", "2", "4"]}
                            elements={fileTree}
                            onSelectChange={fileSystem.selectFile}
                        >
                            {/* Recursive rendering of the tree */}
                            {fileTree.map((node: any) => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    onDelete={fileSystem.deleteItem}
                                    onRename={fileSystem.renameItem}
                                />
                            ))}
                        </Tree>
                    </div>
                </div>
            )}
        </div>
    )
}

function TreeNode({ node, onDelete, onRename }: { node: any, onDelete: any, onRename: any }) {
    if (node.type === "folder") {
        return (
            <Folder
                element={
                    <div className="flex items-center justify-between group w-full pr-2">
                        <span>{node.name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Only allow deleting non-root folders for safety, or just all folders */}
                            {node.name !== "contracts" && (
                                <>
                                    <div
                                        className="p-1 hover:text-blue-500 cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newName = prompt("Rename folder:", node.name);
                                            if (newName && newName !== node.name) onRename(node.id, newName);
                                        }}
                                    >
                                        <Edit2 size={12} />
                                    </div>
                                    <div
                                        className="p-1 hover:text-red-500 cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Delete ${node.name}?`)) onDelete(node.id);
                                        }}
                                    >
                                        <Trash2 size={12} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                }
                value={node.id}
            >
                {node.children?.map((child: any) => (
                    <TreeNode key={child.id} node={child} onDelete={onDelete} onRename={onRename} />
                ))}
            </Folder>
        );
    }
    return (
        <FileItem value={node.id}>
            <div className="flex items-center justify-between group w-full pr-2">
                <p>{node.name}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                        className="p-1 hover:text-blue-500 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            const newName = prompt("Rename file:", node.name);
                            if (newName && newName !== node.name) onRename(node.id, newName);
                        }}
                    >
                        <Edit2 size={12} />
                    </div>
                    <div
                        className="p-1 hover:text-red-500 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${node.name}?`)) onDelete(node.id);
                        }}
                    >
                        <Trash2 size={12} />
                    </div>
                </div>
            </div>
        </FileItem>
    );
}
